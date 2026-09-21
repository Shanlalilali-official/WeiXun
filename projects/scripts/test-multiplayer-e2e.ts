import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createAdminClient } from '../src/storage/database/supabase-client';

dotenv.config({ path: '.env.local', override: false, quiet: true });

type JsonObject = Record<string, unknown>;
type HttpResult = { status: number; payload: JsonObject };
type Account = { userId: string; token: string };
type RoomSnapshot = {
  id: string;
  currentStage: number;
  stageVersion: number;
  status: string;
  raw: JsonObject;
};
type ReadyResult = RoomSnapshot & { advanced: boolean; replayed: boolean };

const baseUrl = (process.env.E2E_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const runTag = `${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
const usernames = {
  coach: `multi_e2e_coach_${runTag}`,
  playerA: `multi_e2e_player_a_${runTag}`,
  playerB: `multi_e2e_player_b_${runTag}`,
};
const userIds = Object.values(usernames).map((username) => `u_${username}`);

let roomId = '';
let roomCode = '';
const sessionIds = new Set<string>();

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: JsonObject, ...keys: string[]): string {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key]) return record[key];
  }
  throw new Error(`missing string field: ${keys.join('/')}`);
}

function numberField(record: JsonObject, ...keys: string[]): number {
  for (const key of keys) {
    if (typeof record[key] === 'number' && Number.isFinite(record[key])) return record[key];
  }
  throw new Error(`missing number field: ${keys.join('/')}`);
}

function payloadError(payload: JsonObject): string {
  return typeof payload.error === 'string' ? payload.error : JSON.stringify(payload);
}

async function request(path: string, init: RequestInit = {}, token?: string): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-session': token } : {}),
      ...init.headers,
    },
  });
  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { raw };
  }
  return { status: response.status, payload: isRecord(parsed) ? parsed : { data: parsed } };
}

function expectStatus(result: HttpResult, expected: number | number[], label: string): JsonObject {
  const statuses = Array.isArray(expected) ? expected : [expected];
  assert(statuses.includes(result.status), `${label}: HTTP ${result.status}: ${payloadError(result.payload)}`);
  return result.payload;
}

function extractObject(payload: JsonObject, ...keys: string[]): JsonObject {
  for (const key of keys) {
    const value = payload[key];
    if (isRecord(value)) return value;
  }
  throw new Error(`missing object field: ${keys.join('/')}`);
}

function parseRoom(payload: JsonObject): RoomSnapshot {
  const data = isRecord(payload.data) ? payload.data : null;
  const candidate = isRecord(payload.room)
    ? payload.room
    : data && isRecord(data.room)
      ? data.room
      : data;
  if (!candidate) throw new Error(`room missing in response: ${JSON.stringify(payload)}`);
  return {
    id: stringField(candidate, 'id', 'roomId'),
    currentStage: numberField(candidate, 'current_stage', 'currentStage'),
    stageVersion: numberField(candidate, 'stage_version', 'stageVersion'),
    status: stringField(candidate, 'status'),
    raw: candidate,
  };
}

function parseReady(payload: JsonObject): ReadyResult {
  const room = parseRoom(payload);
  assert.equal(typeof payload.advanced, 'boolean', 'ready response must expose advanced');
  assert.equal(typeof payload.replayed, 'boolean', 'ready response must expose replayed');
  return {
    ...room,
    advanced: payload.advanced as boolean,
    replayed: payload.replayed as boolean,
  };
}

function parseSessionId(payload: JsonObject): string {
  const gameSession = extractObject(payload, 'gameSession');
  const id = stringField(gameSession, 'id');
  sessionIds.add(id);
  return id;
}

async function authenticate(username: string, role: 'player' | 'trainer'): Promise<Account> {
  const login = expectStatus(await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', username, password: 'e2e-test-password' }),
  }), 200, `${role} login`);
  const loginToken = stringField(login, 'loginToken');
  const selected = expectStatus(await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      action: 'select_role',
      loginToken,
      role,
      ...(role === 'player' ? { subRole: 'paid_individual' } : {}),
    }),
  }), 200, `${role} role selection`);
  return { userId: `u_${username}`, token: stringField(selected, 'token') };
}

async function createRoom(coach: Account): Promise<RoomSnapshot> {
  const payload = expectStatus(await request('/api/coach/rooms', {
    method: 'POST',
    body: JSON.stringify({
      stageDurationSeconds: 60,
      companies: [
        { id: 'e2e-player-company', name: 'E2E 甲公司' },
        { id: 'e2e-abc-company', name: 'E2E 乙公司' },
      ],
    }),
  }, coach.token), 201, 'room creation');
  const data = extractObject(payload, 'data');
  roomCode = stringField(data, 'room_code', 'roomCode');
  const room = parseRoom(payload);
  roomId = room.id;
  return room;
}

async function joinRoom(account: Account, companyId: string): Promise<string> {
  const payload = expectStatus(await request('/api/multiplayer/join', {
    method: 'POST',
    body: JSON.stringify({ roomCode, companyId }),
  }, account.token), 200, `${companyId} join`);
  const data = extractObject(payload, 'data');
  const joinedRoomId = stringField(data, 'roomId');
  assert.equal(joinedRoomId, roomId);
  const sessionId = stringField(data, 'sessionId');
  sessionIds.add(sessionId);
  return sessionId;
}

async function fetchRoom(coach: Account): Promise<RoomSnapshot> {
  const payload = expectStatus(await request(`/api/coach/rooms/${roomId}`, {}, coach.token), 200, 'room recovery');
  const room = parseRoom(payload);
  assert.equal(room.id, roomId);
  return room;
}

async function markReady(account: Account, stage: number, version: number): Promise<HttpResult> {
  return request(`/api/multiplayer/rooms/${roomId}/ready`, {
    method: 'POST',
    body: JSON.stringify({ expectedStage: stage, expectedVersion: version }),
  }, account.token);
}

async function readGameSession(account: Account, sessionId: string): Promise<JsonObject> {
  const payload = expectStatus(await request(`/api/game/sessions/${sessionId}`, {}, account.token), 200, 'game session recovery');
  return extractObject(payload, 'gameSession');
}

function readState(session: JsonObject): JsonObject {
  return extractObject(session, 'state');
}

async function cleanup(): Promise<void> {
  try {
    const admin = createAdminClient();
    let targetRoomId = roomId;
    if (!targetRoomId && roomCode) {
      const roomLookup = await admin.from('multiplayer_rooms').select('id').eq('room_code', roomCode).maybeSingle();
      if (roomLookup.error) console.warn(`room lookup cleanup failed: ${roomLookup.error.message}`);
      targetRoomId = typeof roomLookup.data?.id === 'string' ? roomLookup.data.id : '';
    }

    if (targetRoomId) {
      const slots = await admin.from('multiplayer_company_slots').select('game_session_id').eq('room_id', targetRoomId);
      if (slots.error) console.warn(`slot lookup cleanup failed: ${slots.error.message}`);
      for (const slot of slots.data ?? []) {
        if (typeof slot.game_session_id === 'string') sessionIds.add(slot.game_session_id);
      }
    }

    const ownedSessions = await admin.from('game_sessions').select('id').in('user_id', userIds);
    if (ownedSessions.error) console.warn(`owned session lookup cleanup failed: ${ownedSessions.error.message}`);
    for (const row of ownedSessions.data ?? []) {
      if (typeof row.id === 'string') sessionIds.add(row.id);
    }

    if (sessionIds.size > 0) {
      const deletedSessions = await admin.from('game_sessions').delete().in('id', [...sessionIds]);
      if (deletedSessions.error) console.warn(`session cleanup failed: ${deletedSessions.error.message}`);
    }
    if (targetRoomId) {
      const deletedRoom = await admin.from('multiplayer_rooms').delete().eq('id', targetRoomId);
      if (deletedRoom.error) console.warn(`room cleanup failed: ${deletedRoom.error.message}`);
    }
  } catch (error) {
    console.warn(`multiplayer E2E cleanup unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  const coach = await authenticate(usernames.coach, 'trainer');
  const playerA = await authenticate(usernames.playerA, 'player');
  const playerB = await authenticate(usernames.playerB, 'player');

  const waitingRoom = await createRoom(coach);
  assert.equal(waitingRoom.currentStage, 1);
  assert.equal(waitingRoom.stageVersion, 1);
  assert.equal(waitingRoom.status, 'waiting');

  // A joined player cannot act before the coach starts the room. Removing a
  // lobby player invalidates the detached runtime version before clearing the
  // slot, so an in-flight command cannot revive an orphan session.
  const detachedPlayerASessionId = await joinRoom(playerA, 'e2e-player-company');
  const detachedState = readState(await readGameSession(playerA, detachedPlayerASessionId));
  const preStartCommand = await request(`/api/game/sessions/${detachedPlayerASessionId}/commands`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: `multi-prestart-${crypto.randomUUID()}`,
      expectedVersion: numberField(detachedState, 'version'),
      type: 'research_public_info',
      payload: { npcId: 'P1-004' },
    }),
  }, playerA.token);
  expectStatus(preStartCommand, 409, 'pre-start multiplayer command rejection');
  assert.equal(preStartCommand.payload.error, 'MULTIPLAYER_ROOM_NOT_RUNNING');

  const lobbyWithPlayerA = await fetchRoom(coach);
  const lobbySlots = lobbyWithPlayerA.raw.multiplayer_company_slots;
  assert(Array.isArray(lobbySlots));
  const detachedSlot = lobbySlots.find((slot) => isRecord(slot) && slot.player_user_id === playerA.userId);
  assert(isRecord(detachedSlot));
  const detachedSlotId = stringField(detachedSlot, 'id');
  const removed = expectStatus(await request(`/api/coach/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'remove_player', slotId: detachedSlotId, expectedVersion: lobbyWithPlayerA.stageVersion }),
  }, coach.token), 200, 'remove lobby player');
  const removedRoom = parseRoom(removed);
  assert.equal(removedRoom.stageVersion, lobbyWithPlayerA.stageVersion + 1);
  const adminAfterRemove = createAdminClient();
  const detachedRuntime = await adminAfterRemove.from('game_runtime_states').select('version').eq('session_id', detachedPlayerASessionId).single();
  assert.equal(detachedRuntime.error, null);
  assert.equal(detachedRuntime.data?.version, numberField(detachedState, 'version') + 1);
  const detachedSession = await adminAfterRemove.from('game_sessions').select('status').eq('id', detachedPlayerASessionId).single();
  assert.equal(detachedSession.error, null);
  assert.equal(detachedSession.data?.status, 'replaced');

  // Two independent player accounts now occupy the two company slots before
  // the coach starts the room. Rejoining creates a fresh attached runtime.
  const playerASessionId = await joinRoom(playerA, 'e2e-player-company');
  const playerBSessionId = await joinRoom(playerB, 'e2e-abc-company');
  const readyToStartRoom = await fetchRoom(coach);
  const startedPayload = expectStatus(await request(`/api/coach/rooms/${roomId}/start`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion: readyToStartRoom.stageVersion }),
  }, coach.token), 200, 'room start');
  const startedRoom = parseRoom(startedPayload);
  assert.equal(startedRoom.currentStage, 1);
  assert.equal(startedRoom.stageVersion, readyToStartRoom.stageVersion + 1);
  assert.equal(startedRoom.status, 'running');
  const initialStage = startedRoom.currentStage;
  const initialVersion = startedRoom.stageVersion;

  // A multiplayer stage cannot be advanced through the generic per-session
  // command endpoint; only the room-owned ready RPC may advance it.
  const initialSession = readState(await readGameSession(playerA, playerASessionId));
  const genericAdvance = await request(`/api/game/sessions/${playerASessionId}/commands`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: `multi-generic-advance-${crypto.randomUUID()}`,
      expectedVersion: numberField(initialSession, 'version'),
      type: 'advance_phase',
      payload: {},
    }),
  }, playerA.token);
  expectStatus(genericAdvance, [400, 409], 'generic multiplayer advance rejection');
  assert.equal(genericAdvance.payload.error, 'MULTIPLAYER_STAGE_ADVANCE_REQUIRES_ROOM_READY');

  // Both players confirm the same room version concurrently. Exactly one
  // request owns the transition; a retried/later request must not grant AP a
  // second time or move the room more than one stage.
  const concurrentReady = await Promise.all([
    markReady(playerA, initialStage, initialVersion),
    markReady(playerB, initialStage, initialVersion),
  ]);
  const firstReadyResults = concurrentReady.map((result, index) => {
    expectStatus(result, 200, `concurrent ready ${index + 1}`);
    return parseReady(result.payload);
  });
  assert.equal(firstReadyResults.filter((result) => result.advanced && !result.replayed).length, 1);
  const stageTwoFromReady = firstReadyResults.reduce((latest, result) =>
    result.stageVersion > latest.stageVersion ? result : latest, firstReadyResults[0]);
  assert.equal(stageTwoFromReady.currentStage, initialStage + 1);
  assert.equal(stageTwoFromReady.stageVersion, initialVersion + 1);
  assert.equal(stageTwoFromReady.status, 'running');

  const stageTwo = await fetchRoom(coach);
  assert.equal(stageTwo.currentStage, initialStage + 1);
  assert.equal(stageTwo.stageVersion, initialVersion + 1);
  const stageTwoStage = stageTwo.currentStage;
  const stageTwoVersion = stageTwo.stageVersion;

  // A response lost immediately after the stage transition can be replayed
  // with the previous expected pair. It must not mark the player ready for
  // the now-current stage.
  const oldReplay = await markReady(playerA, initialStage, initialVersion);
  expectStatus(oldReplay, 200, 'one-stage-old ready replay');
  const oldReplayResult = parseReady(oldReplay.payload);
  assert.equal(oldReplayResult.replayed, true);
  const afterOldReplay = await fetchRoom(coach);
  assert.equal(afterOldReplay.currentStage, stageTwoStage);
  assert.equal(afterOldReplay.stageVersion, stageTwoVersion);
  const slots = afterOldReplay.raw.multiplayer_company_slots;
  assert(Array.isArray(slots), 'coach room response must include multiplayer slots');
  const playerASlot = slots.find((slot) => isRecord(slot) && slot.player_user_id === playerA.userId);
  assert(isRecord(playerASlot), 'player A slot must be recoverable');
  assert.equal(playerASlot.ready_stage, null, 'old replay must not mark the next stage ready');

  // A same-stage duplicate is acknowledged idempotently and does not advance
  // the room by itself.
  const stageTwoFirstReady = await markReady(playerA, stageTwoStage, stageTwoVersion);
  expectStatus(stageTwoFirstReady, 200, 'stage two first ready');
  const stageTwoFirstResult = parseReady(stageTwoFirstReady.payload);
  assert.equal(stageTwoFirstResult.advanced, false);
  assert.equal(stageTwoFirstResult.replayed, false);
  const stageTwoDuplicate = await markReady(playerA, stageTwoStage, stageTwoVersion);
  expectStatus(stageTwoDuplicate, 200, 'same-stage duplicate ready');
  const stageTwoDuplicateResult = parseReady(stageTwoDuplicate.payload);
  assert.equal(stageTwoDuplicateResult.advanced, false);
  assert.equal(stageTwoDuplicateResult.replayed, true);

  // The second player's ready is the only request that can now advance stage
  // two. This also gives us a stable recovery checkpoint at stage three.
  const stageThreeReady = await markReady(playerB, stageTwoStage, stageTwoVersion);
  expectStatus(stageThreeReady, 200, 'stage three transition');
  const stageThree = parseReady(stageThreeReady.payload);
  assert.equal(stageThree.advanced, true);
  assert.equal(stageThree.replayed, false);
  assert.equal(stageThree.currentStage, stageTwoStage + 1);
  assert.equal(stageThree.stageVersion, stageTwoVersion + 1);
  const stageThreeStage = stageThree.currentStage;
  const stageThreeVersion = stageThree.stageVersion;

  const recoveredA = readState(await readGameSession(playerA, playerASessionId));
  const recoveredB = readState(await readGameSession(playerB, playerBSessionId));
  const expectedRuntimeVersionAtStageThree = 4;
  for (const [label, state] of [['player A', recoveredA], ['player B', recoveredB]] as const) {
    assert.equal(numberField(state, 'currentStage'), stageThreeStage, `${label} stage recovery`);
    assert.equal(numberField(state, 'currentRound'), stageThreeStage, `${label} round recovery`);
    assert.equal(numberField(state, 'version'), expectedRuntimeVersionAtStageThree, `${label} runtime version recovery`);
    assert.equal(numberField(state, 'roomStageVersion'), stageThreeVersion, `${label} room stage version recovery`);
    assert.equal(numberField(state, 'actionPoints'), 28, `${label} action-point cap recovery`);
  }

  // Once the room is three versions ahead, the first-stage request is truly
  // stale and must be rejected instead of writing a ready marker.
  const staleReady = await markReady(playerA, initialStage, initialVersion);
  expectStatus(staleReady, 409, 'stale ready conflict');
  assert.equal(staleReady.payload.error, 'ROOM_VERSION_CONFLICT');

  // Replacing a player's solo save must not touch the already-running room
  // runtime for that same user. Use two solo saves so this covers the actual
  // replace branch, not only the first solo creation.
  const soloFirst = expectStatus(await request('/api/game/sessions', {
    method: 'POST',
    body: JSON.stringify({ scenarioCode: 'project-1' }),
  }, playerA.token), 200, 'solo save creation beside room');
  const soloFirstId = parseSessionId(soloFirst);
  const soloReplacement = expectStatus(await request('/api/game/sessions', {
    method: 'POST',
    body: JSON.stringify({ scenarioCode: 'project-1', replaceExisting: true }),
  }, playerA.token), 200, 'solo save replacement beside room');
  const soloReplacementId = parseSessionId(soloReplacement);
  assert.notEqual(soloReplacementId, soloFirstId);

  const admin = createAdminClient();
  const rows = await admin.from('game_sessions').select('id,status,multiplayer').in('id', [playerASessionId, soloFirstId, soloReplacementId]);
  assert.equal(rows.error, null);
  const rowById = new Map((rows.data ?? []).map((row) => [String(row.id), row]));
  assert.equal(rowById.get(playerASessionId)?.status, 'playing');
  assert.equal(rowById.get(playerASessionId)?.multiplayer, true);
  assert.equal(rowById.get(soloFirstId)?.status, 'replaced');
  assert.equal(rowById.get(soloReplacementId)?.status, 'playing');

  const roomAfterSoloReplace = await fetchRoom(coach);
  assert.equal(roomAfterSoloReplace.currentStage, stageThreeStage);
  assert.equal(roomAfterSoloReplace.stageVersion, stageThreeVersion);
  const slotsAfterSoloReplace = roomAfterSoloReplace.raw.multiplayer_company_slots;
  assert(Array.isArray(slotsAfterSoloReplace), 'room recovery after solo replace must include slots');
  const playerASlotAfterSoloReplace = slotsAfterSoloReplace.find((slot) => isRecord(slot) && slot.player_user_id === playerA.userId);
  assert(isRecord(playerASlotAfterSoloReplace), 'player A slot must survive solo replacement');
  assert.equal(playerASlotAfterSoloReplace.game_session_id, playerASessionId);
  const multiplayerAfterReplace = readState(await readGameSession(playerA, playerASessionId));
  assert.equal(numberField(multiplayerAfterReplace, 'currentStage'), stageThreeStage);
  assert.equal(numberField(multiplayerAfterReplace, 'version'), expectedRuntimeVersionAtStageThree);
  assert.equal(numberField(multiplayerAfterReplace, 'roomStageVersion'), stageThreeVersion);

  // Finish stages three through five through the room-owned ready path, then
  // verify the finished room still allows the required per-player submit.
  let finalRoom = roomAfterSoloReplace;
  for (let stage = finalRoom.currentStage; stage <= 5; stage += 1) {
    const expectedStage = finalRoom.currentStage;
    const expectedVersion = finalRoom.stageVersion;
    const first = await markReady(playerA, expectedStage, expectedVersion);
    expectStatus(first, 200, `final path stage ${stage} first ready`);
    const second = await markReady(playerB, expectedStage, expectedVersion);
    expectStatus(second, 200, `final path stage ${stage} second ready`);
    finalRoom = parseReady(second.payload);
    if (finalRoom.status === 'finished') break;
  }
  assert.equal(finalRoom.status, 'finished');
  assert.equal(finalRoom.currentStage, 5);

  const finalPlayerAState = readState(await readGameSession(playerA, playerASessionId));
  assert.equal(finalPlayerAState.submissionReady, true);
  assert.equal(numberField(finalPlayerAState, 'roomStageVersion'), finalRoom.stageVersion);
  const submitted = expectStatus(await request(`/api/game/sessions/${playerASessionId}/commands`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: `multi-submit-${crypto.randomUUID()}`,
      expectedVersion: numberField(finalPlayerAState, 'version'),
      type: 'submit',
      payload: {},
    }),
  }, playerA.token), 200, 'finished multiplayer submit');
  assert(['won', 'lost'].includes(String((extractObject(submitted, 'state')).status)));

  console.log(`multiplayer dual-account e2e passed: room=${roomId}, sessions=${playerASessionId},${playerBSessionId}`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(`multiplayer dual-account e2e failed: room=${roomId || 'not-created'}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

void run();
