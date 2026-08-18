import { createServerClient } from '@/storage/database/supabase-client';
import { getProgressionMultiplier } from '@/lib/game/acceptance-mode';
import { createProjectOneState, getGameOutcome, normalizeProjectOneState, reconcileNarrativeDiscoveries, type GameRuntimeState } from '@/lib/game/state';
import type { GameReview } from '@/lib/contracts/game';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NpcInboxItem {
  sourceNpcId: string;
  summary: string;
  round: number;
}

interface RuntimeStateRow {
  scenario_code: string;
  action_points: number;
  dimensions: GameRuntimeState['dimensions'];
  npc_affinity: GameRuntimeState['npcAffinity'];
  unlocked_npc_ids: string[];
  unlocked_clues: GameRuntimeState['unlockedClues'];
  conversation_memories: GameRuntimeState['conversationMemories'];
  phase_started_at?: string | null;
  phase_ends_at?: string | null;
  paused_at?: string | null;
  paused_remaining_ms?: number | null;
  npc_contacts?: GameRuntimeState['npcContacts'] | null;
  active_meeting?: GameRuntimeState['activeMeeting'];
  simulation_state?: Partial<GameRuntimeState> | null;
  last_action: string | null;
  version: number;
}

export interface OwnedGameSession {
  id: string;
  userId: string;
  state: GameRuntimeState;
}

export interface GameSaveSummary {
  id: string;
  scenarioCode: string;
  currentRound: number;
  maxRounds: number;
  updatedAt: string;
  startedAt: string;
}

export const MAX_ACTIVE_GAME_SAVES = 1;

function toState(session: Record<string, unknown>, runtime: RuntimeStateRow): GameRuntimeState {
  const rawStatus = String(session.status);
  const status: GameRuntimeState['status'] =
    rawStatus === 'won' || rawStatus === 'lost' ? rawStatus : 'playing';
  const legacyState = {
    scenarioCode: runtime.scenario_code,
    progressionMultiplier: 1,
    currentRound: Number(session.current_round),
    maxRounds: Number(session.max_round),
    actionPoints: runtime.action_points,
    status,
    dimensions: runtime.dimensions,
    npcAffinity: runtime.npc_affinity,
    unlockedNpcIds: runtime.unlocked_npc_ids,
    unlockedClues: runtime.unlocked_clues,
    conversationMemories: runtime.conversation_memories,
    phaseStartedAt: runtime.phase_started_at ?? '',
    phaseEndsAt: runtime.phase_ends_at ?? '',
    pausedAt: runtime.paused_at ?? null,
    pausedRemainingMs: runtime.paused_remaining_ms ?? null,
    npcContacts: runtime.npc_contacts ?? {},
    activeMeeting: runtime.active_meeting ?? null,
    lastAction: runtime.last_action,
    version: runtime.version,
  };
  return normalizeProjectOneState({
    ...legacyState,
    ...(runtime.simulation_state ?? {}),
    // The relational version is the concurrency authority even if an older JSON
    // snapshot contains a stale value.
    version: runtime.version,
  });
}

export async function createGameSession(
  userId: string,
  displayName: string,
  scenarioCode: string,
  progressionMultiplier = 1,
  replaceExisting = false,
) {
  if (scenarioCode !== 'project-1') throw new Error('SCENARIO_NOT_SUPPORTED');
  const supabase = createServerClient();
  const { data: scenario, error: scenarioError } = await supabase
    .from('project_scenarios')
    .select('id, difficulty')
    .eq('code', scenarioCode)
    .single();
  // Project one is a fixed, bundled scenario. The explicit fallback preserves
  // playable sessions on databases where RLS temporarily hides seed rows from
  // the server client; the UUID is the idempotent seed value in seed.sql.
  const resolvedScenario = scenario ?? (scenarioError
    ? { id: '10000000-0000-4000-8000-000000000001', difficulty: 1 }
    : null);
  if (!resolvedScenario) throw new Error('SCENARIO_NOT_CONFIGURED');

  const initialState = createProjectOneState(progressionMultiplier);
  const { data, error } = await supabase.rpc('create_or_replace_game_session', {
    p_user_id: userId,
    p_user_name: displayName,
    p_scenario_id: resolvedScenario.id,
    p_difficulty: resolvedScenario.difficulty,
    p_state: initialState,
    p_total_score: Math.round(getGameOutcome(initialState).finalScore),
    p_replace_existing: replaceExisting,
  });
  if (error || !data || typeof data !== 'object') {
    const message = error?.message ?? '';
    if (message.includes('SAVE_LIMIT_REACHED') || error?.code === '23505') throw new Error('SAVE_LIMIT_REACHED');
    console.error('atomic game session create failed', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
    });
    throw new Error('SESSION_CREATE_FAILED');
  }
  const envelope = data as { id?: unknown };
  if (typeof envelope.id !== 'string') throw new Error('SESSION_CREATE_FAILED');
  return { id: envelope.id, state: initialState };
}

export async function listOwnedActiveGameSaves(userId: string, scenarioCode?: string): Promise<GameSaveSummary[]> {
  const supabase = createServerClient();
  let query = supabase
    .from('game_sessions')
    .select('id, current_round, max_round, started_at, created_at, game_runtime_states!inner(scenario_code, updated_at)')
    .eq('user_id', userId)
    .eq('status', 'playing')
    .order('created_at', { ascending: false })
    .limit(MAX_ACTIVE_GAME_SAVES);
  if (scenarioCode) query = query.eq('game_runtime_states.scenario_code', scenarioCode);
  const { data, error } = await query;
  if (error) throw new Error('SAVE_LIST_UNAVAILABLE');
  return (data ?? []).map((row) => {
    const runtime = Array.isArray(row.game_runtime_states) ? row.game_runtime_states[0] : row.game_runtime_states;
    return {
      id: String(row.id),
      scenarioCode: String(runtime?.scenario_code ?? scenarioCode ?? 'project-1'),
      currentRound: Number(row.current_round),
      maxRounds: Number(row.max_round),
      updatedAt: String(runtime?.updated_at ?? row.created_at ?? row.started_at),
      startedAt: String(row.started_at ?? row.created_at),
    };
  });
}

export async function deleteOwnedActiveGameSave(sessionId: string, userId: string): Promise<void> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('game_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('status', 'playing')
    .select('id')
    .maybeSingle();
  if (error) throw new Error('SAVE_DELETE_FAILED');
  if (!data) throw new Error('SAVE_NOT_DELETABLE');
}

export async function getOwnedGameSession(sessionId: string, userId: string): Promise<OwnedGameSession> {
  const supabase = createServerClient();
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id, user_id, current_round, max_round, status')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .in('status', ['playing', 'won', 'lost'])
    .single();
  if (sessionError || !session) throw new Error('SESSION_NOT_FOUND');

  const { data: runtime, error: runtimeError } = await supabase
    .from('game_runtime_states')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  if (runtimeError || !runtime) throw new Error('RUNTIME_STATE_NOT_FOUND');
  const needsContactMigration = !Object.keys((runtime as RuntimeStateRow).npc_contacts ?? {}).length;
  let state = {
    ...toState(session, runtime as RuntimeStateRow),
    progressionMultiplier: getProgressionMultiplier(userId),
  };
  if (needsContactMigration) {
    const { data: priorReplies } = await supabase
      .from('chat_messages')
      .select('metadata')
      .eq('session_id', sessionId)
      .eq('sender', 'assistant');
    const repliedNpcIds = new Set((priorReplies ?? []).map((row) => String((row.metadata as Record<string, unknown> | null)?.npcId ?? '')).filter(Boolean));
    state = {
      ...state,
      npcContacts: Object.fromEntries(Object.entries(state.npcContacts).map(([npcId, contact]) => [
        npcId,
        repliedNpcIds.has(npcId) ? { ...contact, status: 'online' as const } : contact,
      ])),
    };
  }
  // Reading a session is deliberately side-effect free. Simulated time advances
  // only through an explicit command, never because a browser refreshed later.
  if (!state.unlockedClues.includes('key_contact')) {
    const { data: replies } = await supabase
      .from('chat_messages')
      .select('content')
      .eq('session_id', sessionId)
      .eq('sender', 'assistant')
      .ilike('content', '%陈建国%')
      .limit(20);
    const reconciled = reconcileNarrativeDiscoveries(state, (replies ?? []).map((reply) => String(reply.content)));
    if (reconciled !== state) state = reconciled;
  }
  return {
    id: session.id as string,
    userId: session.user_id as string,
    state,
  };
}

export async function saveGameState(sessionId: string, state: GameRuntimeState): Promise<GameRuntimeState> {
  const supabase = createServerClient();
  const nextVersion = state.version + 1;
  const { data: runtime, error: runtimeError } = await supabase
    .from('game_runtime_states')
    .update({
      action_points: state.actionPoints,
      dimensions: state.dimensions,
      npc_affinity: state.npcAffinity,
      unlocked_npc_ids: state.unlockedNpcIds,
      unlocked_clues: state.unlockedClues,
      conversation_memories: state.conversationMemories,
      phase_started_at: state.phaseStartedAt,
      phase_ends_at: state.phaseEndsAt,
      paused_at: state.pausedAt,
      paused_remaining_ms: state.pausedRemainingMs,
      npc_contacts: state.npcContacts,
      active_meeting: state.activeMeeting,
      simulation_state: { ...state, version: nextVersion },
      last_action: state.lastAction,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('version', state.version)
    .select('version')
    .single();
  if (runtimeError || !runtime) throw new Error('STATE_VERSION_CONFLICT');

  const outcome = getGameOutcome(state);
  const totalScore = Math.round(outcome.finalScore);
  const { error: sessionError } = await supabase
    .from('game_sessions')
    .update({
      current_round: state.currentRound,
      max_round: state.maxRounds,
      total_score: totalScore,
      win_probability: totalScore,
      status: state.status,
      won: state.status === 'playing' ? null : state.status === 'won',
      final_report: state.status === 'playing' ? null : {
        status: state.status,
        totalScore,
        dimensions: state.dimensions,
        npcAffinity: state.npcAffinity,
        unlockedClues: state.unlockedClues,
        outcome,
      },
      finished_at: state.status === 'playing' ? null : new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (sessionError) throw new Error('SESSION_STATE_UPDATE_FAILED');
  return { ...state, version: nextVersion };
}

export interface GameCommandCommitResult {
  state: GameRuntimeState;
  result: Record<string, unknown>;
  replayed: boolean;
}

export async function getCommittedGameCommand(
  sessionId: string,
  commandId: string,
): Promise<GameCommandCommitResult | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('game_command_records')
    .select('status, response')
    .eq('session_id', sessionId)
    .eq('command_id', commandId)
    .maybeSingle();
  if (error) throw new Error('GAME_COMMAND_LOOKUP_FAILED');
  if (!data || data.status !== 'completed' || !data.response) return null;
  const response = data.response as { state?: GameRuntimeState; result?: Record<string, unknown> };
  if (!response.state) throw new Error('GAME_COMMAND_RESPONSE_INVALID');
  return {
    state: normalizeProjectOneState(response.state),
    result: response.result ?? {},
    replayed: true,
  };
}

/**
 * Atomically commits a deterministic game command and its audit event. The
 * database owns idempotency by (session_id, command_id), so retries and double
 * clicks return the original response without charging time or points twice.
 */
export async function commitGameCommand(args: {
  sessionId: string;
  commandId: string;
  commandType: string;
  expectedVersion: number;
  state: GameRuntimeState;
  eventType: string;
  eventPayload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  chatMessages?: Array<{
    round: number;
    role: 'user' | 'assistant';
    content: string;
    affinityDelta?: number;
    scoreDelta?: number;
    metadata?: Record<string, unknown>;
  }>;
}): Promise<GameCommandCommitResult> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('commit_game_command', {
    p_session_id: args.sessionId,
    p_command_id: args.commandId,
    p_command_type: args.commandType,
    p_expected_version: args.expectedVersion,
    p_state: args.state,
    p_total_score: Math.round(getGameOutcome(args.state).finalScore),
    p_event_type: args.eventType,
    p_event_payload: args.eventPayload ?? {},
    p_result: args.result ?? {},
    p_chat_messages: args.chatMessages ?? [],
  });
  if (error || !data || typeof data !== 'object') {
    const message = error?.message ?? '';
    if (message.includes('STATE_VERSION_CONFLICT')) throw new Error('STATE_VERSION_CONFLICT');
    if (message.includes('COMMAND_IN_PROGRESS')) throw new Error('COMMAND_IN_PROGRESS');
    throw new Error('GAME_COMMAND_COMMIT_FAILED');
  }
  const envelope = data as { replayed?: boolean; response?: { state?: GameRuntimeState; result?: Record<string, unknown> } };
  if (!envelope.response?.state) throw new Error('GAME_COMMAND_RESPONSE_INVALID');
  return {
    state: normalizeProjectOneState(envelope.response.state),
    result: envelope.response.result ?? {},
    replayed: Boolean(envelope.replayed),
  };
}

export async function commitPhaseTransition(
  sessionId: string,
  state: GameRuntimeState,
  eventType: string,
  eventPayload: Record<string, unknown>,
): Promise<GameRuntimeState> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('commit_game_phase_transition', {
    p_session_id: sessionId,
    p_expected_version: state.version,
    p_state: state,
    p_total_score: Math.round(getGameOutcome(state).finalScore),
    p_event_type: eventType,
    p_event_payload: eventPayload,
  });
  if (error || typeof data !== 'number') throw new Error(error?.message.includes('STATE_VERSION_CONFLICT') ? 'STATE_VERSION_CONFLICT' : 'PHASE_TRANSITION_FAILED');
  return { ...state, version: data };
}

export async function appendGameEvent(
  sessionId: string,
  round: number,
  eventType: string,
  payload: Record<string, unknown>,
  npcKey?: string,
) {
  const supabase = createServerClient();
  const { error } = await supabase.from('game_events').insert({
    session_id: sessionId,
    npc_key: npcKey ?? null,
    round,
    event_type: eventType,
    payload,
  });
  if (error) throw new Error('EVENT_APPEND_FAILED');
}

export async function deliverPendingNpcHandoffs(sessionId: string, currentRound: number) {
  const supabase = createServerClient();
  const { data: promised, error } = await supabase
    .from('game_events')
    .select('id, npc_key, round, payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.promised')
    .lt('round', currentRound);
  if (error) throw new Error('HANDOFF_LOAD_FAILED');
  // npc.turn.completed is the durable recovery source. The explicit promised
  // event is written after the atomic command commit; if that best-effort write
  // fails, the completed event still lets delivery progress exactly once.
  const { data: completedTurns, error: completedError } = await supabase
    .from('game_events')
    .select('id, npc_key, round, payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.turn.completed')
    .lt('round', currentRound);
  if (completedError) throw new Error('HANDOFF_SOURCE_LOAD_FAILED');
  const { data: sent, error: sentError } = await supabase
    .from('game_events')
    .select('id, npc_key, round, payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.sent');
  if (sentError) throw new Error('HANDOFF_SENT_LOAD_FAILED');
  const sentPromiseKeys = new Set((sent ?? []).map((event) => String((event.payload as Record<string, unknown>)?.promiseKey ?? '')));
  const explicitPromises = (promised ?? []).map((event) => {
    const payload = event.payload as Record<string, unknown>;
    return {
      ...event,
      promiseKey: String(payload.sourceCommandId ?? payload.commandId ?? event.id),
      sourceNpcId: String(payload.sourceNpcId ?? event.npc_key ?? ''),
      targetNpcId: payload.targetNpcId,
      summary: payload.summary,
    };
  });
  const explicitKeys = new Set(explicitPromises.map((event) => event.promiseKey));
  const recoveredPromises = (completedTurns ?? []).flatMap((event) => {
    const payload = event.payload as Record<string, unknown>;
    const handoff = payload.handoff;
    if (!handoff || typeof handoff !== 'object') return [];
    const value = handoff as Record<string, unknown>;
    const promiseKey = String(payload.commandId ?? event.id);
    if (explicitKeys.has(promiseKey)) return [];
    return [{
      ...event,
      promiseKey,
      sourceNpcId: String(payload.npcId ?? event.npc_key ?? ''),
      targetNpcId: value.targetNpcId,
      summary: value.summary,
    }];
  });
  for (const event of [...explicitPromises, ...recoveredPromises]) {
    if (sentPromiseKeys.has(event.promiseKey)) continue;
    if (typeof event.targetNpcId !== 'string' || typeof event.summary !== 'string') continue;
    await appendGameEvent(sessionId, currentRound, 'npc.handoff.sent', {
      sourceEventId: event.id,
      promiseKey: event.promiseKey,
      sourceNpcId: event.sourceNpcId,
      targetNpcId: event.targetNpcId,
      summary: event.summary,
    }, event.targetNpcId);
  }

  const { data: received, error: receivedError } = await supabase
    .from('game_events')
    .select('payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.received');
  if (receivedError) throw new Error('HANDOFF_RECEIVED_LOAD_FAILED');
  const receivedSentIds = new Set((received ?? []).map((event) => String((event.payload as Record<string, unknown>)?.sourceEventId ?? '')));
  for (const event of sent ?? []) {
    if (event.round >= currentRound || receivedSentIds.has(String(event.id))) continue;
    const payload = event.payload as Record<string, unknown>;
    await appendGameEvent(sessionId, currentRound, 'npc.handoff.received', {
      sourceEventId: event.id,
      sourceNpcId: payload.sourceNpcId ?? event.npc_key,
      targetNpcId: payload.targetNpcId,
      summary: payload.summary,
    }, String(payload.targetNpcId));
  }
}

export async function getNpcInbox(sessionId: string, npcId: string): Promise<NpcInboxItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('game_events')
    .select('npc_key, round, payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.received')
    .eq('npc_key', npcId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw new Error('NPC_INBOX_LOAD_FAILED');
  return (data ?? []).map((event) => {
    const payload = event.payload as Record<string, unknown>;
    return { sourceNpcId: String(payload.sourceNpcId ?? 'unknown'), summary: String(payload.summary ?? ''), round: Number(event.round) };
  });
}

export async function saveChatMessage(args: {
  sessionId: string;
  npcId: string;
  round: number;
  role: 'user' | 'assistant';
  content: string;
  affinityDelta?: number;
  scoreDelta?: number;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerClient();
  const { error } = await supabase.from('chat_messages').insert({
    session_id: args.sessionId,
    decision_maker_id: null,
    round: args.round,
    sender: args.role,
    content: args.content,
    affinity_delta: args.affinityDelta ?? null,
    score_delta: args.scoreDelta ?? null,
    metadata: { npcId: args.npcId, ...args.metadata },
  });
  if (error) throw new Error('CHAT_MESSAGE_SAVE_FAILED');
}

export async function getNpcConversation(sessionId: string, npcId: string, limit = 12): Promise<StoredChatMessage[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, content, created_at, metadata')
    .eq('session_id', sessionId)
    .contains('metadata', { npcId })
    .in('sender', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('CHAT_HISTORY_LOAD_FAILED');
  return (data ?? []).reverse().map((message) => ({
    id: String(message.id),
    role: message.sender as 'user' | 'assistant',
    content: String(message.content),
    createdAt: String(message.created_at),
    metadata: (message.metadata as Record<string, unknown> | null) ?? undefined,
  }));
}

export async function getNpcMessageCount(sessionId: string, npcId: string): Promise<number> {
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .contains('metadata', { npcId })
    .in('sender', ['user', 'assistant']);
  if (error) throw new Error('CHAT_COUNT_LOAD_FAILED');
  return count ?? 0;
}

export async function getNpcConversationRange(
  sessionId: string,
  npcId: string,
  offset: number,
  limit: number,
): Promise<StoredChatMessage[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, content, created_at, metadata')
    .eq('session_id', sessionId)
    .contains('metadata', { npcId })
    .in('sender', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error('CHAT_RANGE_LOAD_FAILED');
  return (data ?? []).map((message) => ({
    id: String(message.id),
    role: message.sender as 'user' | 'assistant',
    content: String(message.content),
    createdAt: String(message.created_at),
    metadata: (message.metadata as Record<string, unknown> | null) ?? undefined,
  }));
}

export async function getSessionTranscript(sessionId: string, limit = 80): Promise<StoredChatMessage[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, content, created_at, metadata')
    .eq('session_id', sessionId)
    .in('sender', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error('SESSION_TRANSCRIPT_LOAD_FAILED');
  return (data ?? []).map((message) => ({
    id: String(message.id),
    role: message.sender as 'user' | 'assistant',
    content: String(message.content),
    createdAt: String(message.created_at),
    metadata: (message.metadata as Record<string, unknown> | null) ?? undefined,
  }));
}

export async function getStoredReview(sessionId: string): Promise<GameReview | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('game_sessions')
    .select('final_report')
    .eq('id', sessionId)
    .single();
  if (error || !data) throw new Error('FINAL_REPORT_LOAD_FAILED');
  const report = data.final_report as { review?: GameReview } | null;
  return report?.review ?? null;
}

export async function saveStoredReview(sessionId: string, state: GameRuntimeState, review: GameReview) {
  const supabase = createServerClient();
  const outcome = getGameOutcome(state);
  const { error } = await supabase
    .from('game_sessions')
    .update({
      final_report: {
        ...state,
        totalScore: outcome.finalScore,
        outcome,
        review,
      },
    })
    .eq('id', sessionId);
  if (error) throw new Error('FINAL_REVIEW_SAVE_FAILED');
}
