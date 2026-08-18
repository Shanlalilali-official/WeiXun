import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createAdminClient } from '../src/storage/database/supabase-client';
import type { GameAppointment, GameRuntimeState } from '../src/lib/game/state';

dotenv.config({ path: '.env.local', override: false, quiet: true });

const baseUrl = (process.env.E2E_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const userId = `u_simulated_visit_e2e_${Date.now()}`;
let sessionId = '';
let currentState: GameRuntimeState;

function makeCommandId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function jsonRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-session': token } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${payload.error || 'unknown error'}`);
  return payload;
}

async function command(
  token: string,
  type: string,
  payload: Record<string, unknown> = {},
  options?: { commandId?: string; expectedVersion?: number },
) {
  const commandId = options?.commandId ?? makeCommandId(type);
  const expectedVersion = options?.expectedVersion ?? currentState.version;
  const response = await jsonRequest<{
    state: GameRuntimeState;
    result: Record<string, unknown>;
    replayed: boolean;
  }>(`/api/game/sessions/${sessionId}/commands`, {
    method: 'POST',
    body: JSON.stringify({ commandId, expectedVersion, type, payload }),
  }, token);
  currentState = response.state;
  return { ...response, commandId, expectedVersion };
}

type StreamEvent = {
  type: string;
  code?: string;
  error?: string;
  content?: string;
  state?: GameRuntimeState;
  deliveryStatus?: 'replied' | 'unanswered';
  onlineAccepted?: boolean;
  replayed?: boolean;
};

async function streamChat(
  token: string,
  npcId: string,
  message: string,
  communication: {
    intent?: 'outreach' | 'message' | 'request_online';
    channel?: 'email' | 'work_phone' | 'online' | 'offline';
    contextType?: 'online' | 'short_visit' | 'formal_visit' | 'informal_visit';
    appointmentId?: string;
    usedPreparationIds?: string[];
  } = {},
  options?: { commandId?: string; expectedVersion?: number },
) {
  const commandId = options?.commandId ?? makeCommandId('chat');
  const expectedVersion = options?.expectedVersion ?? currentState.version;
  const response = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session': token },
    body: JSON.stringify({
      gameSessionId: sessionId,
      scenarioId: 'project-1',
      npcId,
      message,
      commandId,
      expectedVersion,
      usedPreparationIds: [],
      ...communication,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(`CHAT HTTP ${response.status}: ${payload.error || 'unknown error'}`);
  }
  const body = await response.text();
  const events = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice(6)) as StreamEvent);
  const error = events.find((event) => event.type === 'error');
  if (error) throw new Error(`CHAT_STREAM_${error.code || 'ERROR'}: ${error.error || ''}`);
  const result = events.find((event) => event.type === 'result' && event.state);
  assert(result?.state, 'chat stream must finish with authoritative state');
  currentState = result.state;
  const content = events.map((event) => event.content || '').join('');
  if (result.deliveryStatus === 'replied') assert(content.length > 0, 'a replied turn returns NPC content');
  return {
    content,
    state: result.state,
    deliveryStatus: result.deliveryStatus,
    onlineAccepted: result.onlineAccepted,
    replayed: result.replayed,
    commandId,
    expectedVersion,
  };
}

async function cleanup() {
  if (!sessionId) return;
  const { error } = await createAdminClient().from('game_sessions').delete().eq('id', sessionId);
  if (error) console.warn(`E2E cleanup failed for ${sessionId}: ${error.message}`);
}

async function main() {
  const authenticated = await jsonRequest<{ userId: string; loginToken: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', username: userId, password: 'e2e-test-password' }),
  });
  const login = await jsonRequest<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      action: 'select_role',
      loginToken: authenticated.loginToken,
      role: 'player',
      subRole: 'paid_individual',
    }),
  });
  assert(login.token);

  const created = await jsonRequest<{ gameSession: { id: string; state: GameRuntimeState } }>(
    '/api/game/sessions',
    { method: 'POST', body: JSON.stringify({ scenarioCode: 'project-1' }) },
    login.token,
  );
  sessionId = created.gameSession.id;
  currentState = created.gameSession.state;
  console.log(`project-one simulated-visit e2e started: session=${sessionId}`);
  assert.equal(currentState.currentRound, 1);
  assert.equal(currentState.maxRounds, 5);
  assert.equal(currentState.simulatedClockMinutes, 9 * 60);
  assert.equal(currentState.dayAvailableMinutes, 480);
  assert.equal(currentState.actionPoints, 28);
  assert.equal(currentState.pausedAt, null);

  // GET and real waiting are time-neutral; the obsolete timer endpoint is gone.
  const firstRead = await jsonRequest<{ gameSession: { state: GameRuntimeState } }>(
    `/api/game/sessions/${sessionId}`, {}, login.token,
  );
  const secondRead = await jsonRequest<{ gameSession: { state: GameRuntimeState } }>(
    `/api/game/sessions/${sessionId}`, {}, login.token,
  );
  assert.equal(firstRead.gameSession.state.simulatedClockMinutes, secondRead.gameSession.state.simulatedClockMinutes);
  const timerResponse = await fetch(`${baseUrl}/api/game/sessions/${sessionId}/timer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session': login.token },
    body: JSON.stringify({ action: 'pause' }),
  });
  assert.equal(timerResponse.status, 410);

  let outreach = await streamChat(
    login.token,
    'p1-frontline-wang-hao',
    '王老师您好，我负责本项目方案对接，想先了解您最关心的落地风险和现有流程。',
    { intent: 'outreach', channel: 'work_phone' },
  );
  for (let attempt = 0; outreach.deliveryStatus === 'unanswered' && attempt < 5; attempt += 1) {
    await command(login.token, 'wait', { minutes: 30 });
    outreach = await streamChat(
      login.token,
      'p1-frontline-wang-hao',
      '王老师您好，我已准备好同类案例、对接清单和测试计划，想和您确认项目重点。',
      { intent: 'outreach', channel: 'work_phone' },
    );
  }
  assert.equal(outreach.deliveryStatus, 'replied');
  assert.equal(currentState.npcContacts['p1-frontline-wang-hao'].status, 'connected');
  assert(currentState.cumulativeTimeMinutes >= 15);

  // A committed AI turn is replayable with the same operation id and never
  // consumes time or appends state twice.
  const replayedOutreach = await streamChat(
    login.token,
    'p1-frontline-wang-hao',
    outreach.content ? '此字段会被幂等记录忽略' : '重试',
    { intent: 'outreach', channel: 'work_phone' },
    { commandId: outreach.commandId, expectedVersion: outreach.expectedVersion },
  );
  assert.equal(replayedOutreach.replayed, true);
  assert.equal(replayedOutreach.state.version, outreach.state.version);
  assert.equal(replayedOutreach.state.cumulativeTimeMinutes, outreach.state.cumulativeTimeMinutes);

  let appointment: GameAppointment | null = null;
  for (let attempt = 0; !appointment && attempt < 8; attempt += 1) {
    const invited = await command(login.token, 'invite', {
      npcId: 'p1-frontline-wang-hao',
      channel: 'work_phone',
      invitationMethod: 'dedicated',
      visitType: 'formal',
      venue: '客户办公室会议室',
      purpose: '确认业务目标、展示方案并梳理下一步',
      scheduledRound: currentState.currentRound,
      startMinute: 14 * 60,
    });
    const candidate = invited.result.appointment as GameAppointment;
    if (candidate.status === 'countered') {
      const accepted = await command(login.token, 'update_appointment', {
        appointmentId: candidate.id,
        action: 'accept_counter',
      });
      appointment = accepted.result.appointment as GameAppointment;
    } else if (candidate.status === 'accepted') {
      appointment = candidate;
    }
  }
  assert(appointment, 'NPC should eventually accept or counter a formal appointment');
  assert.equal(appointment.durationMinutes, 40);
  assert.equal(appointment.maxTurns, 6);
  const availableAfterReservation = currentState.dayAvailableMinutes;

  await assert.rejects(() => command(login.token, 'follow_up', {
    action: 'message',
    npcId: appointment!.npcId,
    appointmentId: appointment!.id,
    channel: 'email',
    content: '尚未完成拜访时不应允许发送会后跟进。',
    preparationIds: [],
  }), /VISIT_NOT_COMPLETED/);

  const ppt = await command(login.token, 'prepare', {
    npcId: appointment.npcId,
    appointmentId: appointment.id,
    preparationType: 'ppt',
    title: '项目价值与落地方案',
    content: '现状、对公价值、岗位减负、交付计划与风险控制',
  });
  const pptId = String((ppt.result.preparation as { id: string }).id);
  const boundary = await command(login.token, 'prepare', {
    npcId: appointment.npcId,
    appointmentId: appointment.id,
    preparationType: 'boundary_gift',
    title: '私人化高价值礼品',
    content: '场合敏感，仅用于测试高波动分支',
  });
  const boundaryId = String((boundary.result.preparation as { id: string }).id);
  assert.equal(currentState.cumulativeSpentPoints, 12);

  const clockBeforeTravel = currentState.simulatedClockMinutes;
  const travelMinutes = appointment.invitationMethod === 'dedicated' ? 10 : 5;
  const departureMinute = appointment.startMinute - travelMinutes;
  const idleDaytimeMinutes = Math.max(0, Math.min(departureMinute, 17 * 60) - Math.max(clockBeforeTravel, 9 * 60));
  await command(login.token, 'start_visit', { appointmentId: appointment.id, preparationIds: [] });
  assert.equal(currentState.activeMeeting?.visitType, 'formal');
  assert.equal(currentState.activeMeeting?.maxTurns, 6);
  const investedAtMeetingStart = currentState.cumulativeTimeMinutes;

  await command(login.token, 'follow_up', {
    action: 'deliver_preparation',
    npcId: appointment.npcId,
    appointmentId: appointment.id,
    preparationId: pptId,
  });
  assert(currentState.activeMeeting?.usedPreparationIds.includes(pptId));

  const giftCommandId = makeCommandId('boundary-gift');
  const giftExpectedVersion = currentState.version;
  const firstGift = await command(login.token, 'give_gift', {
    preparationId: boundaryId,
    appointmentId: appointment.id,
    setting: 'private',
    witnesses: [],
    exchangeRequested: false,
  }, { commandId: giftCommandId, expectedVersion: giftExpectedVersion });
  const riskCount = currentState.complianceRisks.length;
  const replayedGift = await command(login.token, 'give_gift', {
    preparationId: boundaryId,
    appointmentId: appointment.id,
    setting: 'private',
    witnesses: [],
    exchangeRequested: false,
  }, { commandId: giftCommandId, expectedVersion: giftExpectedVersion });
  assert.equal(replayedGift.replayed, true);
  assert.equal(replayedGift.state.version, firstGift.state.version);
  assert.equal(replayedGift.state.complianceRisks.length, riskCount);

  // Seed enough already-persisted history to trigger the real rolling-memory
  // path on the next atomic chat turn without spending 16 model calls.
  const memoryRows = Array.from({ length: 18 }, (_, index) => ({
    session_id: sessionId,
    decision_maker_id: null,
    round: currentState.currentRound,
    sender: index % 2 === 0 ? 'user' : 'assistant',
    content: index % 2 === 0
      ? `历史沟通${index + 1}：请确认验收留痕、接口边界和交付计划。`
      : `历史回复${index + 1}：验收材料必须可追溯，接口边界需要写清楚。`,
    metadata: { npcId: appointment.npcId, source: 'memory-e2e-seed' },
  }));
  const { error: memorySeedError } = await createAdminClient().from('chat_messages').insert(memoryRows);
  assert.equal(memorySeedError, null, `memory history seed failed: ${memorySeedError?.message ?? ''}`);

  const visitTurn = await streamChat(
    login.token,
    appointment.npcId,
    '先结合材料确认两个问题：现有流程最大的组织风险是什么，哪类减负结果对您最有价值？',
    {
      intent: 'message',
      channel: 'offline',
      contextType: 'formal_visit',
      appointmentId: appointment.id,
      usedPreparationIds: [pptId],
    },
  );
  assert.equal(visitTurn.deliveryStatus, 'replied');
  assert.equal(currentState.activeMeeting?.turnCount, 1);
  assert.equal(currentState.cumulativeTimeMinutes, investedAtMeetingStart, 'meeting turns must not charge time');
  const refreshedMemory = currentState.conversationMemories[appointment.npcId];
  assert(refreshedMemory?.summary, '16+ persisted messages must produce a rolling summary');
  assert(refreshedMemory.summarizedMessageCount >= 10, 'summary cursor must advance while retaining the recent window');

  await command(login.token, 'end_visit', {
    appointmentId: appointment.id,
    reason: 'player',
    summary: '确认现状、客户顾虑、我方材料和下一步负责人。',
  });
  assert.equal(currentState.activeMeeting, null);
  assert.equal(currentState.cumulativeTimeMinutes, investedAtMeetingStart + 40);
  assert.equal(currentState.appointments.find((item) => item.id === appointment?.id)?.status, 'completed');
  assert.equal(currentState.meetingMinutes.some((item) => item.appointmentId === appointment?.id), true);
  assert.equal(
    currentState.dayAvailableMinutes,
    availableAfterReservation - 30 - 10 - travelMinutes - idleDaytimeMinutes,
    'preparation, intentional idle time and travel consume available capacity while the reserved visit is not charged twice',
  );

  const followUp = await command(login.token, 'follow_up', {
    action: 'message',
    npcId: appointment.npcId,
    appointmentId: appointment.id,
    channel: 'email',
    content: '按会面确认事项发送纪要，并同步下一步负责人。',
    preparationIds: [],
  });
  assert.equal(followUp.result.npcId, appointment.npcId);

  // Verify promised -> sent -> received across two simulated workdays. The
  // target NPC must not receive the summary in the promise round.
  const handoffCommandId = makeCommandId('handoff-source');
  const handoffSummary = '王浩已确认验收材料必须留痕，并建议业务部继续评估。';
  const { error: handoffSeedError } = await createAdminClient().from('game_events').insert({
    session_id: sessionId,
    npc_key: 'p1-frontline-wang-hao',
    round: currentState.currentRound,
    event_type: 'npc.handoff.promised',
    payload: {
      sourceCommandId: handoffCommandId,
      sourceNpcId: 'p1-frontline-wang-hao',
      targetNpcId: 'p1-minister-chen-jianguo',
      summary: handoffSummary,
    },
  });
  assert.equal(handoffSeedError, null, `handoff promise seed failed: ${handoffSeedError?.message ?? ''}`);

  await command(login.token, 'advance_phase');
  const { data: sentEvents, error: sentLoadError } = await createAdminClient()
    .from('game_events')
    .select('round, payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.sent');
  assert.equal(sentLoadError, null);
  assert(sentEvents?.some((event) => String((event.payload as Record<string, unknown>).promiseKey) === handoffCommandId));

  const { data: prematureReceived, error: prematureLoadError } = await createAdminClient()
    .from('game_events')
    .select('id')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.received');
  assert.equal(prematureLoadError, null);
  assert.equal(prematureReceived?.length ?? 0, 0, 'handoff cannot be received in the same phase in which it is sent');

  await command(login.token, 'advance_phase');
  const { data: receivedEvents, error: receivedLoadError } = await createAdminClient()
    .from('game_events')
    .select('npc_key, round, payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.received')
    .eq('npc_key', 'p1-minister-chen-jianguo');
  assert.equal(receivedLoadError, null);
  assert(receivedEvents?.some((event) => String((event.payload as Record<string, unknown>).summary) === handoffSummary));

  const firstHistory = await jsonRequest<{ messages: Array<{ metadata?: { commandId?: string } }> }>(
    `/api/game/sessions/${sessionId}/messages?npcId=p1-frontline-wang-hao`, {}, login.token,
  );
  assert(firstHistory.messages.length >= 4);
  assert(firstHistory.messages.some((item) => item.metadata?.commandId === outreach.commandId));

  // Refresh preserves exact command state and never advances the simulated day.
  const restored = await jsonRequest<{ gameSession: { state: GameRuntimeState } }>(
    `/api/game/sessions/${sessionId}`, {}, login.token,
  );
  assert.equal(restored.gameSession.state.version, currentState.version);
  assert.equal(restored.gameSession.state.simulatedClockMinutes, currentState.simulatedClockMinutes);
  assert.equal(restored.gameSession.state.cumulativeTimeMinutes, currentState.cumulativeTimeMinutes);

  while (currentState.status === 'playing') await command(login.token, 'advance_phase');
  assert.equal(currentState.currentRound, 5);
  assert(['won', 'lost'].includes(currentState.status));

  const review = await jsonRequest<{ review: { strengths: string[]; improvements: string[]; nextActions: string[] } }>(
    `/api/game/sessions/${sessionId}/review`, { method: 'POST', body: '{}' }, login.token,
  );
  assert(review.review.strengths.length > 0);
  assert(review.review.improvements.length > 0);
  assert(review.review.nextActions.length > 0);

  const { data: observedEvents, error: observedEventError } = await createAdminClient()
    .from('game_events')
    .select('event_type, payload')
    .eq('session_id', sessionId);
  assert.equal(observedEventError, null);
  const eventsByType = new Map((observedEvents ?? []).map((event) => [event.event_type, event.payload as Record<string, unknown>]));
  for (const requiredType of ['session.created', 'preparation.completed', 'visit.started', 'visit.completed', 'phase.advanced', 'session.finished']) {
    assert(eventsByType.has(requiredType), `missing observation event: ${requiredType}`);
  }
  const preparationEvent = (observedEvents ?? []).find((event) =>
    event.event_type === 'preparation.completed'
    && (event.payload as Record<string, unknown>).type === 'ppt')?.payload as Record<string, unknown>;
  assert(preparationEvent, 'missing PPT preparation observation');
  assert.equal(preparationEvent.hasPreparationBrief, true);
  assert.equal('content' in preparationEvent, false);
  const visitCompletedEvent = eventsByType.get('visit.completed')!;
  assert.equal('summary' in visitCompletedEvent, false, 'meeting summary must not be copied to observation payload');
  assert.equal(typeof visitCompletedEvent.turnCount, 'number');
  const phaseEvent = eventsByType.get('phase.advanced')!;
  assert.equal(typeof phaseEvent.fromRound, 'number');
  assert.equal(typeof phaseEvent.toRound, 'number');

  console.log(`project-one simulated-visit e2e passed: session=${sessionId}, result=${currentState.status}`);
  await cleanup();
}

main().catch(async (error) => {
  console.error(`project-one simulated-visit e2e failed: session=${sessionId || 'not-created'}`);
  console.error(error instanceof Error ? error.message : error);
  await cleanup();
  process.exitCode = 1;
});
