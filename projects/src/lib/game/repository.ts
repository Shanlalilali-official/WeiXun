import { createServerClient } from '@/storage/database/supabase-client';
import { calculateTotalScore, createProjectOneState, normalizeProjectOneState, type GameRuntimeState } from '@/lib/game/state';
import type { GameReview } from '@/lib/contracts/game';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
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
  last_action: string | null;
  version: number;
}

export interface OwnedGameSession {
  id: string;
  userId: string;
  state: GameRuntimeState;
}

function toState(session: Record<string, unknown>, runtime: RuntimeStateRow): GameRuntimeState {
  const rawStatus = String(session.status);
  const status: GameRuntimeState['status'] =
    rawStatus === 'won' || rawStatus === 'lost' ? rawStatus : 'playing';
  return normalizeProjectOneState({
    scenarioCode: runtime.scenario_code,
    currentRound: Number(session.current_round),
    maxRounds: Number(session.max_round),
    actionPoints: runtime.action_points,
    status,
    dimensions: runtime.dimensions,
    npcAffinity: runtime.npc_affinity,
    unlockedNpcIds: runtime.unlocked_npc_ids,
    unlockedClues: runtime.unlocked_clues,
    conversationMemories: runtime.conversation_memories,
    lastAction: runtime.last_action,
    version: runtime.version,
  });
}

export async function createGameSession(userId: string, displayName: string, scenarioCode: string) {
  if (scenarioCode !== 'project-1') throw new Error('SCENARIO_NOT_SUPPORTED');
  const supabase = createServerClient();
  const { data: scenario, error: scenarioError } = await supabase
    .from('project_scenarios')
    .select('id, difficulty')
    .eq('code', scenarioCode)
    .single();
  if (scenarioError || !scenario) throw new Error('SCENARIO_NOT_CONFIGURED');

  const initialState = createProjectOneState();
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      user_id: userId,
      user_name: displayName,
      scenario_id: scenario.id,
      difficulty: scenario.difficulty,
      mode: 'ai_dialog',
      multiplayer: false,
      current_round: initialState.currentRound,
      max_round: initialState.maxRounds,
      total_score: calculateTotalScore(initialState.dimensions),
      status: initialState.status,
    })
    .select('id')
    .single();
  if (sessionError || !session) throw new Error('SESSION_CREATE_FAILED');

  const { error: runtimeError } = await supabase.from('game_runtime_states').insert({
    session_id: session.id,
    scenario_code: initialState.scenarioCode,
    action_points: initialState.actionPoints,
    dimensions: initialState.dimensions,
    npc_affinity: initialState.npcAffinity,
    unlocked_npc_ids: initialState.unlockedNpcIds,
    unlocked_clues: initialState.unlockedClues,
    conversation_memories: initialState.conversationMemories,
    last_action: initialState.lastAction,
    version: initialState.version,
  });
  if (runtimeError) {
    await supabase.from('game_sessions').delete().eq('id', session.id);
    throw new Error('RUNTIME_STATE_CREATE_FAILED');
  }

  await appendGameEvent(session.id, initialState.currentRound, 'session.created', {
    scenarioCode,
  });
  return { id: session.id as string, state: initialState };
}

export async function getOwnedGameSession(sessionId: string, userId: string): Promise<OwnedGameSession> {
  const supabase = createServerClient();
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id, user_id, current_round, max_round, status')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();
  if (sessionError || !session) throw new Error('SESSION_NOT_FOUND');

  const { data: runtime, error: runtimeError } = await supabase
    .from('game_runtime_states')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  if (runtimeError || !runtime) throw new Error('RUNTIME_STATE_NOT_FOUND');
  return {
    id: session.id as string,
    userId: session.user_id as string,
    state: toState(session, runtime as RuntimeStateRow),
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
      last_action: state.lastAction,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('version', state.version)
    .select('version')
    .single();
  if (runtimeError || !runtime) throw new Error('STATE_VERSION_CONFLICT');

  const totalScore = calculateTotalScore(state.dimensions);
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
      },
      finished_at: state.status === 'playing' ? null : new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (sessionError) throw new Error('SESSION_STATE_UPDATE_FAILED');
  return { ...state, version: nextVersion };
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
  const { data: sent, error: sentError } = await supabase
    .from('game_events')
    .select('id, npc_key, round, payload')
    .eq('session_id', sessionId)
    .eq('event_type', 'npc.handoff.sent');
  if (sentError) throw new Error('HANDOFF_SENT_LOAD_FAILED');
  const sentPromiseIds = new Set((sent ?? []).map((event) => String((event.payload as Record<string, unknown>)?.sourceEventId ?? '')));
  for (const event of promised ?? []) {
    if (sentPromiseIds.has(String(event.id))) continue;
    const payload = event.payload as Record<string, unknown>;
    await appendGameEvent(sessionId, currentRound, 'npc.handoff.sent', {
      sourceEventId: event.id,
      sourceNpcId: event.npc_key,
      targetNpcId: payload.targetNpcId,
      summary: payload.summary,
    }, String(payload.targetNpcId));
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
    .select('id, sender, content, created_at')
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
    .select('id, sender, content, created_at')
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
  }));
}

export async function getSessionTranscript(sessionId: string, limit = 80): Promise<StoredChatMessage[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, content, created_at')
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
  const { error } = await supabase
    .from('game_sessions')
    .update({
      final_report: {
        status: state.status,
        totalScore: calculateTotalScore(state.dimensions),
        dimensions: state.dimensions,
        npcAffinity: state.npcAffinity,
        unlockedClues: state.unlockedClues,
        review,
      },
    })
    .eq('id', sessionId);
  if (error) throw new Error('FINAL_REVIEW_SAVE_FAILED');
}
