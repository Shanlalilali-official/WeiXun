import { NextRequest } from 'next/server';
import { streamLLM, type ChatMessage } from '@/lib/ai/client';
import { CUSTOMER_CONTEXT, CUSTOMER_PROMPT, type CustomerPromptContext } from '@/lib/ai/prompts/customer';
import { evaluateNpcTurn } from '@/lib/ai/npc-evaluation';
import { authGuard } from '@/lib/auth/guard';
import { npcChatRequestSchema } from '@/lib/contracts/ai';
import type { GameCommand } from '@/lib/contracts/game';
import { getProjectOneNpc, type ContactChannel } from '@/lib/game/project-one';
import { isNaturalLanguageInvitation } from '@/lib/game/invitation-intent';
import {
  commitGameCommand,
  appendGameEvent,
  appendCompetitorClaim,
  assertOwnedMultiplayerRoomRunning,
  deliverPendingNpcHandoffs,
  getCommittedGameCommand,
  getNpcConversation,
  getNpcInbox,
  getOwnedGameSession,
} from '@/lib/game/repository';
import {
  applyNpcEvaluation,
  applyPreparationAttachments,
  connectNpc,
  consumeCommunicationTime,
  getGameOutcome,
  getPhaseName,
  markNpcUnanswered,
  recordMeetingTurn,
  recordNpcOutbound,
  setMeetingWorkTopicOpenedBy,
  shouldNpcRespond,
  toPlayerVisibleGameState,
  type GameRuntimeState,
  executeGameCommand,
} from '@/lib/game/state';
import { createServerProbabilitySeed } from '@/lib/game/server-random';
import { refreshConversationMemory } from '@/lib/game/memory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const streamHeaders = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function jsonResponse(error: string, status: number, details?: unknown) {
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function immediateSse(events: unknown[]) {
  return new Response(`${events.map(sseData).join('')}data: [DONE]\n\n`, { headers: streamHeaders });
}

function telephoneGreeting(npcName: string, npcTitle: string, seed: string): string {
  const options = [
    `喂，您好，我是${npcName}，您哪位？`,
    `喂，您好。这里是${npcName}，请问您是？`,
    `您好，我是${npcName}${npcTitle ? `，${npcTitle}` : ''}，请讲。`,
  ];
  const index = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0) % options.length;
  return options[index];
}

function attitudeBand(value: number, kind: 'pleasure' | 'support') {
  if (kind === 'pleasure') {
    if (value >= 70) return '交流放松、愿意展开';
    if (value >= 45) return '克制、正常商务交流';
    return '不悦或戒备，需要注意措辞和边界';
  }
  if (value >= 70) return '较认可项目，但仍受职责与合规约束';
  if (value >= 45) return '中立观察，需要更多可信证据';
  return '对项目保留或反对，需要先解决核心顾虑';
}

function unseenImpressionSummary(value: number) {
  if (value >= 15) return '通过他人转述形成了较积极的接触前印象';
  if (value <= -15) return '已受到负面转述影响，接触前较为警惕';
  return '间接印象有限，主要根据本次沟通判断';
}

function applySelectedPreparations(
  state: GameRuntimeState,
  npcId: string,
  requestedIds: string[],
): GameRuntimeState {
  if (!state.activeMeeting || state.activeMeeting.npcId !== npcId) return state;
  const requested = new Set(requestedIds);
  const newlyUsed = state.preparations.filter((item) =>
    requested.has(item.id)
    && item.npcId === npcId
    && item.status === 'ready'
    && item.type !== 'courtesy_gift'
    && item.type !== 'boundary_gift');
  if (!newlyUsed.length) return state;
  const newlyUsedIds = new Set(newlyUsed.map((item) => item.id));
  return {
    ...state,
    preparations: state.preparations.map((item) => newlyUsedIds.has(item.id)
      ? { ...item, usedCount: item.usedCount + 1, status: item.reusable ? 'ready' as const : 'used' as const }
      : item),
    activeMeeting: {
      ...state.activeMeeting,
      usedPreparationIds: Array.from(new Set([
        ...state.activeMeeting.usedPreparationIds,
        ...newlyUsedIds,
      ])),
    },
  };
}

function normalizeHandoff(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { targetNpcId?: unknown; summary?: unknown };
  if (typeof raw.targetNpcId !== 'string' || typeof raw.summary !== 'string') return null;
  return { targetNpcId: raw.targetNpcId, summary: raw.summary };
}

function addExplicitComplianceEvent(
  state: GameRuntimeState,
  npcId: string,
  commandId: string,
  reason: string,
) {
  if (state.complianceRisks.some((risk) => risk.id === `risk:dialogue:${commandId}`)) return state;
  return {
    ...state,
    complianceRisks: [...state.complianceRisks, {
      id: `risk:dialogue:${commandId}`,
      npcId,
      preparationId: null,
      kind: 'explicit_bribe' as const,
      severity: 5,
      status: 'triggered' as const,
      penalty: 20,
      reason,
      createdRound: state.currentRound,
      triggerRound: state.currentRound,
      outcome: 'reported' as const,
    }],
  };
}

export async function POST(req: NextRequest) {
  const guard = authGuard(req);
  if (!guard.ok || !guard.session) return guard.response!;

  const parsed = npcChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse('聊天请求字段无效', 400, parsed.error.flatten());

  const {
    gameSessionId,
    scenarioId,
    npcId,
    message,
    intent,
    commandId,
    expectedVersion,
    attachmentIds,
    usedPreparationIds,
  } = parsed.data;

  let gameSession;
  try {
    gameSession = await getOwnedGameSession(gameSessionId, guard.session.userId);
  } catch {
    return jsonResponse('对局不存在或无权访问', 404);
  }

  const replay = await getCommittedGameCommand(gameSessionId, commandId).catch(() => null);
  if (replay) {
    const reply = typeof replay.result.reply === 'string' ? replay.result.reply : '';
    const deliveryStatus = replay.result.deliveryStatus === 'unanswered' ? 'unanswered' : 'replied';
    return immediateSse([
      ...(reply ? [{ type: 'delta', content: reply }] : []),
      { type: 'result', state: toPlayerVisibleGameState(replay.state), deliveryStatus, replayed: true },
      { type: 'done' },
    ]);
  }

  try {
    await assertOwnedMultiplayerRoomRunning(gameSessionId, gameSession.state);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MULTIPLAYER_ROOM_NOT_RUNNING';
    return jsonResponse(code === 'MULTIPLAYER_ROOM_NOT_RUNNING' ? code : 'MULTIPLAYER_ROOM_NOT_RUNNING', 409);
  }

  const { state: initialState } = gameSession;
  if (initialState.version !== expectedVersion) return jsonResponse('STATE_VERSION_CONFLICT', 409, { state: toPlayerVisibleGameState(initialState) });
  if (initialState.scenarioCode !== scenarioId) return jsonResponse('场景与对局不一致', 409);
  if (initialState.status !== 'playing') return jsonResponse('对局已经结束', 409);
  if (!initialState.unlockedNpcIds.includes(npcId)) return jsonResponse('NPC尚未解锁', 403);

  const npc = getProjectOneNpc(npcId);
  if (!npc) return jsonResponse('NPC不存在', 404);
  const contact = initialState.npcContacts[npcId];
  const meeting = initialState.activeMeeting;
  const channel: ContactChannel = parsed.data.channel
    ?? (meeting?.npcId === npcId ? 'offline' : contact.status === 'online' ? 'online' : contact.initialChannel);

  if (intent === 'outreach') {
    if (contact.status !== 'known') return jsonResponse('CONTACT_ALREADY_ESTABLISHED', 409);
    if (channel !== contact.initialChannel) return jsonResponse('CONTACT_CHANNEL_UNAVAILABLE', 409);
  } else if (intent === 'call_connect') {
    if (channel !== 'work_phone') return jsonResponse('CALL_CHANNEL_INVALID', 409);
    if (contact.status === 'known' && channel !== contact.initialChannel) return jsonResponse('CONTACT_CHANNEL_UNAVAILABLE', 409);
    if (contact.status !== 'known' && contact.status !== 'online' && channel !== contact.initialChannel) return jsonResponse('CONTACT_CHANNEL_UNAVAILABLE', 409);
  } else if (channel === 'offline') {
    if (!meeting || meeting.npcId !== npcId) return jsonResponse('MEETING_NOT_ACTIVE', 409);
  } else if (!(contact.status === 'connected' && channel === contact.initialChannel) && contact.status !== 'online') {
    return jsonResponse('ONLINE_CONTACT_REQUIRED', 409);
  }

  if (attachmentIds.length > 0) {
    if (channel !== 'email') return jsonResponse('EMAIL_ATTACHMENT_CHANNEL_INVALID', 409);
    try {
      // Validate against the server snapshot before invoking the model. The
      // same transition is applied only after a successful response commit.
      applyPreparationAttachments(initialState, npcId, attachmentIds);
    } catch (error) {
      return jsonResponse(error instanceof Error ? error.message : 'EMAIL_ATTACHMENT_NOT_AVAILABLE', 409);
    }
  }

  if (channel !== 'offline') {
    const cooldownUntil = contact.channelCooldownUntil[channel] ?? 0;
    if (cooldownUntil > initialState.simulatedClockMinutes) {
      return jsonResponse('CHANNEL_COOLDOWN_ACTIVE', 409, { cooldownUntil });
    }
    try {
      // Pure preflight: avoid invoking the model when the action cannot fit in
      // today's capacity or the player cannot afford an overtime block.
      consumeCommunicationTime(initialState, channel);
    } catch (error) {
      return jsonResponse(error instanceof Error ? error.message : 'TIME_RESOURCE_INSUFFICIENT', 409);
    }
  }

  // Natural-language invitations use the same deterministic command path as
  // the former dedicated UI. This keeps visit extraction, acceptance or
  // counter-offers, action-point charging, notifications and idempotency under
  // the server-side game state machine. The model still handles ordinary
  // phone/email/WeChat conversation.
  if (channel !== 'offline' && intent !== 'call_connect' && isNaturalLanguageInvitation(message)) {
    const invitationCommand: GameCommand = {
      commandId: createServerProbabilitySeed([gameSessionId, commandId, 'invite']),
      expectedVersion,
      type: 'invite',
      payload: {
        npcId,
        channel,
        rawText: message,
        attachmentIds,
      },
    };
    try {
      const execution = executeGameCommand(initialState, invitationCommand);
      const appointment = execution.result.appointment;
      const appointmentId = appointment && typeof appointment === 'object' && 'id' in appointment && typeof appointment.id === 'string'
        ? appointment.id
        : null;
      const reply = appointmentId
        ? initialState.notifications.find((item) => item.id === `invite-response:${appointmentId}`)?.body
          ?? execution.state.notifications.find((item) => item.id === `invite-response:${appointmentId}`)?.body
        : undefined;
      const committed = await commitGameCommand({
        sessionId: gameSessionId,
        commandId,
        commandType: 'invite',
        expectedVersion,
        state: execution.state,
        eventType: execution.eventType,
        eventPayload: {
          ...execution.eventPayload,
          source: 'natural_language_chat',
          sourceChannel: channel,
        },
        result: {
          ...execution.result,
          reply: reply ?? '邀约已记录，请留意对方的回复。',
          deliveryStatus: 'replied',
          channel,
          invitation: true,
          attachmentIds,
        },
        chatMessages: [
          {
            round: initialState.currentRound,
            role: 'user',
            content: message,
            metadata: { npcId, intent, channel, deliveryStatus: 'sent', invitation: true, attachmentIds },
          },
          {
            round: initialState.currentRound,
            role: 'assistant',
            content: reply ?? '邀约已记录，请留意对方的回复。',
            metadata: { npcId, intent, channel, deliveryStatus: 'replied', invitation: true, appointmentId, attachmentIds },
          },
        ],
      });
      const visibleState = toPlayerVisibleGameState(committed.state);
      const visibleReply = reply ?? '邀约已记录，请留意对方的回复。';
      return immediateSse([
        { type: 'delta', content: visibleReply },
        {
          type: 'result',
          state: visibleState,
          deliveryStatus: 'replied',
          channel,
          invitation: true,
          appointment: execution.result.appointment,
          reply: visibleReply,
        },
        { type: 'done' },
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INVITATION_FAILED';
      return jsonResponse(code, code === 'STATE_VERSION_CONFLICT' ? 409 : 400);
    }
  }

  let recentHistory;
  try {
    recentHistory = await getNpcConversation(gameSessionId, npcId, 12);
  } catch {
    return jsonResponse('对话历史读取失败，本轮未调用AI', 503);
  }

  if (intent === 'call_connect') {
    if (channel !== 'work_phone') return jsonResponse('CALL_CHANNEL_INVALID', 409);
    try {
      const callChance = Math.max(35, Math.min(90, 58 + initialState.currentRound * 4 + ((initialState.npcAffinity[npcId] ?? 35) - 35) * 0.5));
      const connected = shouldNpcRespond(createServerProbabilitySeed([gameSessionId, commandId, npcId, 'phone-connect']), callChance);
      if (!connected) {
        let changed = consumeCommunicationTime(initialState, channel);
        changed = markNpcUnanswered(changed, npcId, channel);
        const committed = await commitGameCommand({
          sessionId: gameSessionId,
          commandId,
          commandType: 'chat.call_unanswered',
          expectedVersion,
          state: changed,
          eventType: 'npc.call.unanswered',
          eventPayload: { npcId, channel, callChance },
          result: { deliveryStatus: 'unanswered', callConnected: false },
          chatMessages: [{ round: initialState.currentRound, role: 'user', content: '[电话呼出]', metadata: { npcId, intent, channel, deliveryStatus: 'unanswered', hiddenFromTranscript: true } }],
        });
        return immediateSse([
          { type: 'delta', content: '电话暂时无人接听。' },
          { type: 'result', state: toPlayerVisibleGameState(committed.state), deliveryStatus: 'unanswered', callConnected: false, emotion: 'thinking' },
          { type: 'done' },
        ]);
      }
      const reply = telephoneGreeting(npc.name, npc.title, `${gameSessionId}:${npcId}:${commandId}`);
      let changed = consumeCommunicationTime(initialState, channel);
      changed = connectNpc(recordNpcOutbound(changed, npcId), npcId);
      const committed = await commitGameCommand({
        sessionId: gameSessionId,
        commandId,
        commandType: 'chat.call_connect',
        expectedVersion,
        state: changed,
        eventType: 'npc.call.connected',
        eventPayload: { npcId, channel },
        result: { reply, deliveryStatus: 'replied', callConnected: true },
        chatMessages: [
          { round: initialState.currentRound, role: 'user', content: '[电话呼出]', metadata: { npcId, intent, channel, deliveryStatus: 'sent', hiddenFromTranscript: true } },
          { round: initialState.currentRound, role: 'assistant', content: reply, metadata: { npcId, intent, channel, deliveryStatus: 'replied', callConnected: true } },
        ],
      });
      return immediateSse([
        { type: 'delta', content: reply },
        { type: 'result', state: toPlayerVisibleGameState(committed.state), deliveryStatus: 'replied', callConnected: true },
        { type: 'done' },
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CALL_CONNECT_FAILED';
      return jsonResponse(code, code === 'STATE_VERSION_CONFLICT' ? 409 : 503);
    }
  }

  const responseChance = channel === 'offline'
    ? 100
    : intent === 'outreach'
      ? channel === 'email' ? 55 : 70
      : Math.max(35, Math.min(90, 65 + ((initialState.npcAffinity[npcId] ?? 35) - 35) * 0.5));
  const responseSeed = createServerProbabilitySeed([
    gameSessionId,
    commandId,
    'npc-response',
    npcId,
    initialState.currentRound,
    contact.outboundCount,
    channel,
  ]);
  if (!shouldNpcRespond(responseSeed, responseChance)) {
    try {
      let changed = channel === 'offline' ? initialState : consumeCommunicationTime(initialState, channel);
      changed = markNpcUnanswered(changed, npcId, channel === 'offline' ? undefined : channel);
      changed = applyPreparationAttachments(changed, npcId, attachmentIds);
      const committed = await commitGameCommand({
        sessionId: gameSessionId,
        commandId,
        commandType: 'chat.unanswered',
        expectedVersion,
        state: changed,
        eventType: 'npc.message.unanswered',
        eventPayload: { npcId, channel, intent, responseChance },
        result: { deliveryStatus: 'unanswered', channel, attachmentIds },
        chatMessages: [{
          round: initialState.currentRound,
          role: 'user',
          content: message,
          metadata: { npcId, intent, channel, deliveryStatus: 'unanswered', attachmentIds },
        }],
      });
      return immediateSse([
        { type: 'result', state: toPlayerVisibleGameState(committed.state), deliveryStatus: 'unanswered', channel },
        { type: 'done' },
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'MESSAGE_COMMIT_FAILED';
      return jsonResponse(code, code === 'STATE_VERSION_CONFLICT' ? 409 : 503);
    }
  }

  const memory = initialState.conversationMemories[npcId];
  await deliverPendingNpcHandoffs(gameSessionId, initialState.currentRound).catch(() => undefined);
  const inbox = await getNpcInbox(gameSessionId, npcId).catch(() => []);
  const attitude = initialState.npcAttitudes[npcId];
  const requestedPreparationIds = new Set([...usedPreparationIds, ...attachmentIds]);
  const relevantPreparations = initialState.preparations.filter((item) =>
    item.npcId === npcId
    && (requestedPreparationIds.has(item.id) || meeting?.usedPreparationIds.includes(item.id)));
  // Meeting context is authoritative server state. A client cannot label an
  // online message as informal/formal to influence the NPC or score evaluator.
  const meetingType = meeting?.npcId === npcId ? ({
    short: 'short_visit',
    formal: 'formal_visit',
    informal: 'informal_visit',
  } as const)[meeting.visitType] : undefined;
  // Who opened the work topic is authoritative meeting state derived from
  // prior evaluated turns. The browser cannot declare this value.
  const workTopicOpenedBy = meeting?.workTopicOpenedBy ?? 'none';
  const customerContext: CustomerPromptContext = {
    gameSessionId,
    scenarioId,
    npc,
    competitorPosition: initialState.competitorState.position,
    playerKnownPersonalInfo: initialState.knownPersonalInfo[npcId] ?? [],
    round: initialState.currentRound,
    maxRounds: initialState.maxRounds,
    phaseName: getPhaseName(initialState.currentRound),
    channel,
    meetingTurn: meeting ? meeting.turnCount + 1 : undefined,
    meetingType,
    maxMeetingTurns: meeting?.maxTurns,
    workTopicOpenedBy,
    affinity: initialState.npcAffinity[npcId] ?? 35,
    pleasureBand: attitudeBand(attitude?.pleasantness ?? 50, 'pleasure'),
    supportBand: attitudeBand(attitude?.support ?? 35, 'support'),
    unseenImpressionSummary: unseenImpressionSummary(attitude?.unmetImpression ?? 0),
    preparedItems: relevantPreparations.map((item) => ({ type: item.type, title: item.title })),
    giftContext: { giftType: 'none' },
    lastAction: initialState.lastAction,
    memorySummary: memory?.summary,
    confirmedFacts: memory?.confirmedFacts,
    commitments: memory?.commitments,
    inbox,
    canRevealPersonalInterest: (attitude?.support ?? 35) >= 50,
    canRevealKeyContact: (attitude?.support ?? 35) >= 50,
  };
  const messages: ChatMessage[] = [
    { role: 'system', content: CUSTOMER_PROMPT() },
    { role: 'user', content: CUSTOMER_CONTEXT(customerContext) },
    ...recentHistory.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ];

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => controller.enqueue(encoder.encode(sseData(payload)));
      try {
        // Buffer the provider stream until the versioned transaction commits.
        // This preserves the all-or-nothing contract visible to the player.
        let reply = '';
        for await (const chunk of streamLLM(messages, { temperature: 0.7, thinking: 'disabled' })) reply += chunk;
        if (!reply.trim()) throw new Error('AI_PROVIDER_EMPTY_RESPONSE');

        const assessment = await evaluateNpcTurn({
          npcId,
          npcName: npc.name,
          npcTitle: npc.title,
          npcPersonality: npc.personality,
          npcCategory: npc.category,
          npcConcern: npc.weakness,
          affinity: initialState.npcAffinity[npcId] ?? 35,
          pleasure: attitude?.pleasantness ?? 50,
          support: attitude?.support ?? 35,
          round: initialState.currentRound,
          phaseName: getPhaseName(initialState.currentRound),
          channel,
          meetingType,
          workTopicOpenedBy,
          giftContext: { giftType: 'none' },
          playerMessage: message,
          npcReply: reply,
          recentConversation: recentHistory,
          confirmedFacts: memory?.confirmedFacts ?? [],
          commitments: memory?.commitments ?? [],
        });
        const evaluation = assessment.evaluation;
        const priorOutcome = getGameOutcome(initialState);
        let changedState = applyNpcEvaluation(initialState, npcId, evaluation, reply, channel);
        changedState = recordNpcOutbound(changedState, npcId);
        if (intent === 'outreach') changedState = connectNpc(changedState, npcId);
        changedState = applySelectedPreparations(changedState, npcId, usedPreparationIds);
        changedState = applyPreparationAttachments(changedState, npcId, attachmentIds);

        if (channel === 'offline') {
          if (!changedState.activeMeeting) throw new Error('MEETING_NOT_ACTIVE');
          const opener = evaluation.workTopicOpenedBy;
          if (opener === 'player' || opener === 'npc') changedState = setMeetingWorkTopicOpenedBy(changedState, opener);
          changedState = recordMeetingTurn(changedState);
        }

        if (evaluation.semanticFlags?.explicitQuidProQuo) {
          changedState = addExplicitComplianceEvent(changedState, npcId, commandId, evaluation.affinityReason);
        }
        const handoff = normalizeHandoff(evaluation.handoff);
        const validHandoff = handoff && getProjectOneNpc(handoff.targetNpcId) ? handoff : null;

        let memoryRefreshError: string | null = null;
        try {
          changedState = await refreshConversationMemory(gameSessionId, npcId, changedState);
        } catch (error) {
          memoryRefreshError = error instanceof Error ? error.message.slice(0, 80) : 'MEMORY_REFRESH_FAILED';
        }

        const nextOutcome = getGameOutcome(changedState);
        // Legacy chat_messages.score_delta is an integer column even though the
        // hybrid outcome may contain one decimal place.
        const scoreDelta = Math.round(nextOutcome.finalScore - priorOutcome.finalScore);
        const meetingEnded = channel === 'offline' && !changedState.activeMeeting;
        const committed = await commitGameCommand({
          sessionId: gameSessionId,
          commandId,
          commandType: 'chat.turn',
          expectedVersion,
          state: changedState,
          eventType: 'npc.turn.completed',
          eventPayload: {
            npcId,
            channel,
            intent,
            scoreDelta,
            evaluationSource: assessment.source,
            evaluationValidationErrors: assessment.validationErrors.slice(0, 12),
            cluesUnlocked: evaluation.cluesUnlocked,
            handoff: validHandoff,
            memoryRefreshError,
            meetingEnded,
          },
          result: {
            reply,
            deliveryStatus: 'replied',
            attachmentIds,
            emotion: evaluation.emotion,
            meetingEnded,
          },
          chatMessages: [
            {
              round: initialState.currentRound,
              role: 'user',
              content: message,
              metadata: { npcId, intent, channel, deliveryStatus: 'sent', meetingId: meeting?.id ?? null, meetingTurn: meeting ? meeting.turnCount + 1 : null, attachmentIds },
            },
            {
              round: initialState.currentRound,
              role: 'assistant',
              content: reply,
              affinityDelta: evaluation.supportDelta ?? evaluation.affinityDelta,
              scoreDelta,
              metadata: {
                npcId,
                ...evaluation,
                protocolValid: assessment.source !== 'fallback',
                evaluationSource: assessment.source,
                evaluationValidationErrors: assessment.validationErrors.slice(0, 12),
                intent,
                channel,
                deliveryStatus: 'replied',
                meetingId: meeting?.id ?? null,
                meetingTurn: meeting ? meeting.turnCount + 1 : null,
                usedPreparationIds,
                attachmentIds,
              },
            },
          ],
        });

        await appendCompetitorClaim(gameSessionId, committed.state.companyId, npcId, committed.state.currentRound, reply).catch(() => undefined);

        if (validHandoff) {
          await appendGameEvent(gameSessionId, initialState.currentRound, 'npc.handoff.promised', {
            sourceCommandId: commandId,
            sourceNpcId: npcId,
            targetNpcId: validHandoff.targetNpcId,
            summary: validHandoff.summary,
          }, npcId).catch(() => undefined);
        }

        // Emit content only after the transaction succeeds. Chunking keeps the
        // existing typewriter client behavior without exposing partial state.
        for (let index = 0; index < reply.length; index += 24) {
          emit({ type: 'delta', content: reply.slice(index, index + 24) });
        }
        emit({
          type: 'result',
          state: toPlayerVisibleGameState(committed.state),
          deliveryStatus: 'replied',
          meetingEnded,
          emotion: evaluation.emotion,
        });
        emit({ type: 'done' });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const code = error instanceof Error ? error.message : 'AI_PROVIDER_ERROR';
        emit({
          type: 'error',
          code,
          error: code === 'STATE_VERSION_CONFLICT'
            ? '对局已在其他页面更新，本次未扣除时间或行动点，请刷新后重试。'
            : 'AI服务或状态提交暂时不可用，本次未推进模拟时间，请稍后重试。',
        });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });
  return new Response(readableStream, { headers: streamHeaders });
}
