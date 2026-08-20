export interface MultiplayerStageSlot {
  playerUserId: string | null;
  readyStage: number | null;
  connected: boolean;
}

export const MULTIPLAYER_MAX_STAGES = 5;
export const MULTIPLAYER_ACTION_POINT_CAP = 28;
export const MULTIPLAYER_STAGE_ACTION_POINT_GAIN = 8;

export type MultiplayerNumericMap = Record<string, unknown>;

/**
 * The fields that the database transition updates on each company runtime.
 * Keeping this deliberately smaller than GameRuntimeState makes the transition
 * rules usable in local tests without coupling them to persistence.
 */
export interface MultiplayerRuntimeSnapshot {
  actionPoints: number;
  version: number;
  simulationState: MultiplayerNumericMap;
  dimensions?: MultiplayerNumericMap | null;
  npcAffinity?: MultiplayerNumericMap | null;
}

export interface AdvancedMultiplayerRuntime extends MultiplayerRuntimeSnapshot {
  currentStage: number;
  maxStages: number;
  submissionReady: boolean;
}

export type MultiplayerStageVersionDecision = 'advance' | 'replay' | 'conflict';
export type MultiplayerReadyDecision = 'mark_ready' | 'ready_replay' | 'stage_replay' | 'conflict';

/**
 * A multiplayer runtime is owned by its room. A generic session command may
 * mutate its own actions, but it must never move the shared stage directly.
 */
export function assertMultiplayerCommandAllowed(
  gameMode: 'solo' | 'multiplayer',
  commandType: string,
): void {
  if (gameMode === 'multiplayer' && commandType === 'advance_phase') {
    throw new Error('MULTIPLAYER_STAGE_ADVANCE_REQUIRES_ROOM_READY');
  }
}

/** A joined company may write only while its shared room is running. */
export function assertMultiplayerRoomRunning(
  gameMode: 'solo' | 'multiplayer',
  roomStatus: string | null | undefined,
): void {
  if (gameMode === 'multiplayer' && roomStatus !== 'running') {
    throw new Error('MULTIPLAYER_ROOM_NOT_RUNNING');
  }
}

/**
 * A transition retry is idempotent only for the immediately preceding version.
 * Older snapshots must be rejected so a stale client cannot silently mistake a
 * later stage for its own transition.
 */
export function decideMultiplayerStageVersion(
  currentVersion: number,
  expectedVersion: number,
): MultiplayerStageVersionDecision {
  if (currentVersion === expectedVersion) return 'advance';
  if (currentVersion === expectedVersion + 1) return 'replay';
  return 'conflict';
}

/** Pure contract mirror for mark_multiplayer_ready's stale-retry handling. */
export function decideMultiplayerReadyRetry(
  currentStage: number,
  currentVersion: number,
  expectedStage: number,
  expectedVersion: number,
  alreadyReady: boolean,
  roomFinished = false,
): MultiplayerReadyDecision {
  if (currentVersion === expectedVersion && currentStage === expectedStage) {
    return alreadyReady ? 'ready_replay' : 'mark_ready';
  }
  if (currentVersion === expectedVersion + 1
    && (currentStage === expectedStage + 1 || (roomFinished && currentStage === expectedStage))) {
    return 'stage_replay';
  }
  return 'conflict';
}

export function allCompaniesOccupied(slots: MultiplayerStageSlot[]): boolean {
  return slots.length >= 2 && slots.every((slot) => Boolean(slot.playerUserId));
}

export function shouldAdvanceSharedStage(
  currentStage: number,
  slots: MultiplayerStageSlot[],
  deadlineAt: string | null,
  nowMs = Date.now(),
): 'all_ready' | 'timeout' | null {
  if (deadlineAt && Date.parse(deadlineAt) <= nowMs) return 'timeout';
  return allCompaniesOccupied(slots) && slots.every((slot) => slot.readyStage === currentStage) ? 'all_ready' : null;
}

export function nextStageDeadline(durationSeconds: number | null, nowMs = Date.now()): string | null {
  return durationSeconds && durationSeconds >= 60 ? new Date(nowMs + durationSeconds * 1000).toISOString() : null;
}

const numericValue = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** PostgreSQL round(numeric) rounds half values away from zero. */
const roundHalfAwayFromZero = (value: number): number =>
  value < 0 ? -Math.round(-value) : Math.round(value);

/**
 * Derive the hidden per-company progress delta used by the stage RPC. Invalid
 * or absent dimensions/affinities intentionally use the same neutral values
 * as the SQL function, so a malformed optional field cannot move progress.
 */
export function calculateHiddenProgressDelta(
  dimensions: MultiplayerNumericMap | null | undefined,
  npcAffinity: MultiplayerNumericMap | null | undefined,
): number {
  const dimensionKeys = [
    'decisionAnalysis',
    'relationshipBuilding',
    'valuePresentation',
    'objectionHandling',
    'informationDiscovery',
  ];
  const dimensionAverage = dimensionKeys.reduce(
    (total, key) => total + numericValue(dimensions?.[key], 50),
    0,
  ) / dimensionKeys.length;
  const affinityValues = Object.values(npcAffinity ?? {})
    .map((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && /^-?[0-9]+(?:\.[0-9]+)?$/.test(value)) return Number(value);
      return null;
    })
    .filter((value): value is number => value !== null);
  const affinityAverage = affinityValues.length > 0
    ? affinityValues.reduce((total, value) => total + value, 0) / affinityValues.length
    : 35;
  return clamp(
    roundHalfAwayFromZero((dimensionAverage - 50) / 10 + (affinityAverage - 35) / 10),
    -5,
    5,
  );
}

/**
 * Pure mirror of the per-runtime part of advance_multiplayer_stage. The SQL
 * function remains authoritative; this is used for deterministic contract
 * tests and for clients that need to render the next-stage preview.
 */
export function advanceMultiplayerRuntime(
  runtime: MultiplayerRuntimeSnapshot,
  currentStage: number,
  maxStages = MULTIPLAYER_MAX_STAGES,
): AdvancedMultiplayerRuntime {
  const finalStage = currentStage >= maxStages;
  const nextStage = finalStage ? currentStage : currentStage + 1;
  const nextActionPoints = finalStage
    ? Math.max(0, numericValue(runtime.actionPoints, 0))
    : Math.min(
      MULTIPLAYER_ACTION_POINT_CAP,
      Math.max(0, numericValue(runtime.actionPoints, 0)) + MULTIPLAYER_STAGE_ACTION_POINT_GAIN,
    );
  const simulationState = {
    ...(runtime.simulationState ?? {}),
    currentRound: nextStage,
    currentStage: nextStage,
    maxRounds: maxStages,
    maxStages,
    actionPoints: nextActionPoints,
    submissionReady: finalStage,
    lastAction: 'multiplayer_stage_advance',
  };
  return {
    ...runtime,
    actionPoints: nextActionPoints,
    version: runtime.version + 1,
    simulationState,
    currentStage: nextStage,
    maxStages,
    submissionReady: finalStage,
  };
}

/** Return the public shared-world fields written by the stage transition. */
export function updateSharedCustomerState(
  state: MultiplayerNumericMap | null | undefined,
  currentStage: number,
  nextStage: number,
  companyCount: number,
  updatedAt: string,
): MultiplayerNumericMap {
  return {
    ...(state ?? {}),
    currentStage: nextStage,
    lastCompletedStage: currentStage,
    companyCount,
    updatedAt,
  };
}
