import { NextRequest } from 'next/server';
import { streamLLM, type ChatMessage } from '@/lib/ai/client';
import { CUSTOMER_PROMPT } from '@/lib/ai/prompts/customer';
import { decideOnlineContact, evaluateNpcTurn } from '@/lib/ai/npc-evaluation';
import { authGuard } from '@/lib/auth/guard';
import { npcChatRequestSchema } from '@/lib/contracts/ai';
import { getProjectOneNpc, type ContactChannel } from '@/lib/game/project-one';
import {
  commitGameCommand,
  getCommittedGameCommand,
  getNpcConversation,
  getNpcInbox,
  getOwnedGameSession,
} from '@/lib/game/repository';
import {
  applyNpcAttitudeDelta,
  applyNpcEvaluation,
  connectNpc,
  consumeCommunicationTime,
  getGameOutcome,
  getPhaseName,
  markNpcUnanswered,
  recordMeetingTurn,
  recordNpcOutbound,
  setMeetingWorkTopicOpenedBy,
  setNpcOnline,
  shouldNpcRespond,
  type GameRuntimeState,
} from '@/lib/game/state';

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

function applyHandoffImpression(
  state: GameRuntimeState,
  sourceNpcId: string,
  handoff: NonNullable<ReturnType<typeof normalizeHandoff>>,
  supportDelta: number,
) {
  const impressionDelta = supportDelta > 0 ? 3 : supportDelta < 0 ? -3 : 1;
  let next = applyNpcAttitudeDelta(state, handoff.targetNpcId, {
    unmetImpressionDelta: impressionDelta,
    reason: `来自其他人物的间接转述：${handoff.summary}`,
    source: 'npc_handoff',
  });
  next = {
    ...next,
    notifications: [...next.notifications, {
      id: `handoff:${sourceNpcId}:${handoff.targetNpcId}:${state.currentRound}:${state.version}`,
      npcId: handoff.targetNpcId,
      kind: 'handoff' as const,
      title: '收到内部转述',
      body: handoff.summary,
      round: state.currentRound,
      minute: state.simulatedClockMinutes,
      isRead: false,
      targetId: sourceNpcId,
    }],
  };
  return next;
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
      { type: 'result', state: replay.state, deliveryStatus, replayed: true },
      { type: 'done' },
    ]);
  }

  const { state: initialState } = gameSession;
  if (initialState.version !== expectedVersion) return jsonResponse('STATE_VERSION_CONFLICT', 409, { state: initialState });
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
  } else if (intent === 'request_online') {
    if (contact.status !== 'connected') return jsonResponse('NPC_NOT_CONNECTED', 409);
    if (contact.onlineRequestedRound === initialState.currentRound) return jsonResponse('ONLINE_CONTACT_ALREADY_REQUESTED', 409);
  } else if (channel === 'offline') {
    if (!meeting || meeting.npcId !== npcId) return jsonResponse('MEETING_NOT_ACTIVE', 409);
  } else if (!(contact.status === 'connected' && channel === contact.initialChannel) && contact.status !== 'online') {
    return jsonResponse('ONLINE_CONTACT_REQUIRED', 409);
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

  let recentHistory;
  try {
    recentHistory = await getNpcConversation(gameSessionId, npcId, 12);
  } catch {
    return jsonResponse('对话历史读取失败，本轮未调用AI', 503);
  }

  if (intent === 'request_online') {
    try {
      const decision = await decideOnlineContact({
        npcName: npc.name,
        npcTitle: npc.title,
        affinity: initialState.npcAffinity[npcId] ?? 35,
        playerMessage: message,
        hasPriorReply: recentHistory.some((item) => item.role === 'assistant'),
      });
      let changed = channel === 'offline' ? initialState : consumeCommunicationTime(initialState, channel);
      changed = setNpcOnline(recordNpcOutbound(changed, npcId), npcId, decision.decision.accepted);
      const committed = await commitGameCommand({
        sessionId: gameSessionId,
        commandId,
        commandType: 'chat.request_online',
        expectedVersion,
        state: changed,
        eventType: 'contact.online_decided',
        eventPayload: { npcId, channel, accepted: decision.decision.accepted, source: decision.source },
        result: {
          reply: decision.decision.response,
          deliveryStatus: 'replied',
          onlineAccepted: decision.decision.accepted,
        },
        chatMessages: [
          { round: initialState.currentRound, role: 'user', content: message, metadata: { npcId, intent, channel, deliveryStatus: 'sent' } },
          { round: initialState.currentRound, role: 'assistant', content: decision.decision.response, metadata: { npcId, intent, channel, deliveryStatus: 'replied', onlineAccepted: decision.decision.accepted, decisionSource: decision.source } },
        ],
      });
      return immediateSse([
        { type: 'delta', content: decision.decision.response },
        { type: 'result', state: committed.state, deliveryStatus: 'replied', onlineAccepted: decision.decision.accepted, emotion: 'thinking' },
        { type: 'done' },
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'ONLINE_CONTACT_FAILED';
      return jsonResponse(code, code === 'STATE_VERSION_CONFLICT' ? 409 : 503);
    }
  }

  if (intent === 'call_connect') {
    if (channel !== 'work_phone') return jsonResponse('CALL_CHANNEL_INVALID', 409);
    try {
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
        { type: 'result', state: committed.state, deliveryStatus: 'replied', callConnected: true },
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
  const responseSeed = `${gameSessionId}:${npcId}:${initialState.currentRound}:${contact.outboundCount}:${channel}`;
  if (!shouldNpcRespond(responseSeed, responseChance)) {
    try {
      let changed = channel === 'offline' ? initialState : consumeCommunicationTime(initialState, channel);
      changed = markNpcUnanswered(changed, npcId, channel === 'offline' ? undefined : channel);
      const committed = await commitGameCommand({
        sessionId: gameSessionId,
        commandId,
        commandType: 'chat.unanswered',
        expectedVersion,
        state: changed,
        eventType: 'npc.message.unanswered',
        eventPayload: { npcId, channel, intent, responseChance },
        result: { deliveryStatus: 'unanswered', channel },
        chatMessages: [{
          round: initialState.currentRound,
          role: 'user',
          content: message,
          metadata: { npcId, intent, channel, deliveryStatus: 'unanswered' },
        }],
      });
      return immediateSse([
        { type: 'result', state: committed.state, deliveryStatus: 'unanswered', channel },
        { type: 'done' },
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'MESSAGE_COMMIT_FAILED';
      return jsonResponse(code, code === 'STATE_VERSION_CONFLICT' ? 409 : 503);
    }
  }

  const memory = initialState.conversationMemories[npcId];
  const inbox = await getNpcInbox(gameSessionId, npcId).catch(() => []);
  const attitude = initialState.npcAttitudes[npcId];
  const relevantPreparations = initialState.preparations.filter((item) =>
    item.npcId === npcId
    && (usedPreparationIds.includes(item.id) || meeting?.usedPreparationIds.includes(item.id)));
  // Meeting context is authoritative server state. A client cannot label an
  // online message as informal/formal to influence the NPC or score evaluator.
  const meetingType = meeting?.npcId === npcId ? ({
    short: 'short_visit',
    formal: 'formal_visit',
    informal: 'informal_visit',
  } as const)[meeting.visitType] : undefined;
  const workTopicOpenedBy = meeting?.workTopicOpenedBy ?? parsed.data.workTopicOpenedBy ?? 'none';
  const systemPrompt = CUSTOMER_PROMPT({
    gameSessionId,
    scenarioId,
    npc,
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
  });
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
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
        if (handoff && getProjectOneNpc(handoff.targetNpcId)) {
          changedState = applyHandoffImpression(changedState, npcId, handoff, evaluation.supportDelta ?? evaluation.affinityDelta);
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
            cluesUnlocked: evaluation.cluesUnlocked,
            handoff,
            meetingEnded,
          },
          result: {
            reply,
            deliveryStatus: 'replied',
            emotion: evaluation.emotion,
            meetingEnded,
          },
          chatMessages: [
            {
              round: initialState.currentRound,
              role: 'user',
              content: message,
              metadata: { npcId, intent, channel, deliveryStatus: 'sent', meetingId: meeting?.id ?? null, meetingTurn: meeting ? meeting.turnCount + 1 : null },
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
                protocolValid: true,
                evaluationSource: assessment.source,
                intent,
                channel,
                deliveryStatus: 'replied',
                meetingId: meeting?.id ?? null,
                meetingTurn: meeting ? meeting.turnCount + 1 : null,
                usedPreparationIds,
              },
            },
          ],
        });

        // Emit content only after the transaction succeeds. Chunking keeps the
        // existing typewriter client behavior without exposing partial state.
        for (let index = 0; index < reply.length; index += 24) {
          emit({ type: 'delta', content: reply.slice(index, index + 24) });
        }
        emit({
          type: 'result',
          state: committed.state,
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
