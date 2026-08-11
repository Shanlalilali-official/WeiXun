import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createAdminClient } from '../src/storage/database/supabase-client';
import type { GameRuntimeState } from '../src/lib/game/state';

dotenv.config({ path: '.env.local', override: false, quiet: true });

const baseUrl = (process.env.E2E_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const userId = `u_e2e_${Date.now()}`;
let sessionId = '';

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

async function streamChat(token: string, npcId: string) {
  const response = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session': token },
    body: JSON.stringify({
      gameSessionId: sessionId,
      scenarioId: 'project-1',
      npcId,
      message: '请介绍这个项目当前的决策流程，以及你最关注的工作目标。',
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  const events = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice(6)) as { type: string; code?: string; content?: string; state?: unknown });
  const error = events.find((event) => event.type === 'error');
  if (error) throw new Error(`CHAT_STREAM_${error.code || 'ERROR'}`);
  assert(events.some((event) => event.type === 'delta' && event.content));
  assert(events.some((event) => event.type === 'result' && event.state));
}

async function cleanup() {
  if (!sessionId) return;
  const { error } = await createAdminClient().from('game_sessions').delete().eq('id', sessionId);
  if (error) console.warn(`E2E cleanup failed for ${sessionId}: ${error.message}`);
}

async function main() {
  const login = await jsonRequest<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ action: 'select_role', userId, role: 'player', subRole: 'paid_individual' }),
  });
  assert(login.token);

  const created = await jsonRequest<{ gameSession: { id: string; state: GameRuntimeState } }>(
    '/api/game/sessions',
    { method: 'POST', body: JSON.stringify({ scenarioCode: 'project-1' }) },
    login.token,
  );
  sessionId = created.gameSession.id;
  const initial = created.gameSession.state;
  assert.equal(initial.currentRound, 1);
  assert.equal(initial.maxRounds, 5);
  assert.equal(initial.actionPoints, 28);
  assert.equal(initial.status, 'playing');
  assert.equal(initial.unlockedNpcIds.length, 3);
  assert(!initial.unlockedNpcIds.includes('p1-minister-chen-jianguo'));

  let action = await jsonRequest<{ state: GameRuntimeState }>(
    `/api/game/sessions/${sessionId}/actions`,
    { method: 'POST', body: JSON.stringify({ npcId: 'p1-frontline-wang-hao', actionId: 'festival' }) },
    login.token,
  );
  assert.equal(action.state.actionPoints, 25);
  assert.equal(action.state.npcAffinity['p1-frontline-wang-hao'], 37);

  for (let index = 0; index < 7; index += 1) {
    action = await jsonRequest<{ state: GameRuntimeState }>(
      `/api/game/sessions/${sessionId}/actions`,
      { method: 'POST', body: JSON.stringify({ npcId: 'p1-frontline-wang-hao', actionId: 'festival' }) },
      login.token,
    );
  }
  assert.equal(action.state.actionPoints, 4);
  assert.equal(action.state.npcAffinity['p1-frontline-wang-hao'], 51);
  assert(action.state.unlockedNpcIds.includes('p1-minister-chen-jianguo'));

  await streamChat(login.token, 'p1-frontline-wang-hao');

  const firstHistory = await jsonRequest<{ messages: unknown[] }>(
    `/api/game/sessions/${sessionId}/messages?npcId=p1-frontline-wang-hao`,
    {},
    login.token,
  );
  const secondHistory = await jsonRequest<{ messages: unknown[] }>(
    `/api/game/sessions/${sessionId}/messages?npcId=p1-procurement-liu-kai`,
    {},
    login.token,
  );
  assert(firstHistory.messages.length >= 2);
  assert.equal(secondHistory.messages.length, 0);

  const restored = await jsonRequest<{ gameSession: { state: GameRuntimeState } }>(
    `/api/game/sessions/${sessionId}`,
    {},
    login.token,
  );
  assert.equal(restored.gameSession.state.actionPoints, 4);
  assert(restored.gameSession.state.unlockedNpcIds.includes('p1-minister-chen-jianguo'));
  assert(restored.gameSession.state.version > initial.version);

  let finalState = restored.gameSession.state;
  for (let i = 0; i < 5; i += 1) {
    const advanced = await jsonRequest<{ state: GameRuntimeState }>(
      `/api/game/sessions/${sessionId}/advance`,
      { method: 'POST', body: '{}' },
      login.token,
    );
    finalState = advanced.state;
  }
  assert.equal(finalState.currentRound, 5);
  assert(['won', 'lost'].includes(finalState.status));

  const review = await jsonRequest<{ review: { strengths: string[]; improvements: string[]; nextActions: string[] } }>(
    `/api/game/sessions/${sessionId}/review`,
    { method: 'POST', body: '{}' },
    login.token,
  );
  assert(review.review.strengths.length > 0);
  assert(review.review.improvements.length > 0);
  assert(review.review.nextActions.length > 0);

  console.log(`project-one e2e passed: session=${sessionId}, result=${finalState.status}`);
  await cleanup();
}

main().catch(async (error) => {
  console.error(`project-one e2e failed: session=${sessionId || 'not-created'}`);
  console.error(error instanceof Error ? error.message : error);
  await cleanup();
  process.exitCode = 1;
});
