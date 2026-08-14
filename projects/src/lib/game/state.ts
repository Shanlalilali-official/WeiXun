import type { NpcTurnEvaluation } from '@/lib/contracts/ai';
import type { GameCommand } from '@/lib/contracts/game';
import {
  PROJECT_ONE_ACTION_POINT_CAP,
  PROJECT_ONE_CODE,
  PROJECT_ONE_COMMUNICATION_MINUTES,
  PROJECT_ONE_DAY_START_MINUTE,
  PROJECT_ONE_EVENING_END_MINUTE,
  PROJECT_ONE_INITIAL_ACTION_POINTS,
  PROJECT_ONE_MAX_ROUNDS,
  PROJECT_ONE_NPCS,
  PROJECT_ONE_OVERTIME_END_MINUTE,
  PROJECT_ONE_PHASE_ACTION_POINT_GAIN,
  PROJECT_ONE_PHASE_NAMES,
  PROJECT_ONE_PREPARATION_RULES,
  PROJECT_ONE_STANDARD_DAY_MINUTES,
  PROJECT_ONE_VISIT_RULES,
  PROJECT_ONE_WORK_END_MINUTE,
  getProjectOneNpc,
  type ContactChannel,
  type ProjectOneClue,
} from '@/lib/game/project-one';

export const GAME_DIMENSIONS = [
  'decisionAnalysis',
  'relationshipBuilding',
  'valuePresentation',
  'objectionHandling',
  'informationDiscovery',
] as const;

export type GameDimension = (typeof GAME_DIMENSIONS)[number];
export type GameDimensions = Record<GameDimension, number>;
export type CommunicationChannel = Exclude<ContactChannel, 'offline'>;
export type VisitType = keyof typeof PROJECT_ONE_VISIT_RULES;
export type InvitationMethod = 'dedicated' | 'drop_in';
export type AppointmentStatus =
  | 'pending'
  | 'accepted'
  | 'countered'
  | 'rejected'
  | 'cancelled'
  | 'missed'
  | 'active'
  | 'completed';
export type PreparationType = keyof typeof PROJECT_ONE_PREPARATION_RULES;

export interface ConversationMemory {
  summary: string;
  summarizedMessageCount: number;
  confirmedFacts?: string[];
  commitments?: string[];
}

export interface NpcContactState {
  status: 'known' | 'connected' | 'online';
  initialChannel: Extract<ContactChannel, 'email' | 'work_phone'>;
  onlineRequestedRound: number | null;
  unansweredRound: number | null;
  outboundCount: number;
  hasReplied: boolean;
  lastContactRound: number | null;
  lastContactMinute: number | null;
  channelCooldownUntil: Partial<Record<CommunicationChannel, number>>;
}

export interface AttitudeHistoryItem {
  round: number;
  minute: number;
  pleasantnessDelta: number;
  supportDelta: number;
  reason: string;
  source: string;
}

export interface NpcAttitudeState {
  pleasantness: number;
  support: number;
  unmetImpression: number;
  complianceAwareness: number;
  history: AttitudeHistoryItem[];
}

export interface GameAppointment {
  id: string;
  npcId: string;
  invitationMethod: InvitationMethod;
  visitType: VisitType;
  venue: string;
  purpose: string;
  scheduledRound: number;
  startMinute: number;
  durationMinutes: number;
  maxTurns: number;
  status: AppointmentStatus;
  conditions: string[];
  reservedMinutes: number;
  workTopicOpenedBy: 'player' | 'npc' | null;
  invitationCommandId: string;
}

export interface GamePreparation {
  id: string;
  npcId: string;
  appointmentId: string | null;
  type: PreparationType;
  title: string;
  content: string;
  status: 'ready' | 'used';
  costPoints: number;
  timeMinutes: number;
  reusable: boolean;
  usedCount: number;
  createdRound: number;
}

export type NotificationKind =
  | 'appointment'
  | 'commitment'
  | 'handoff'
  | 'project'
  | 'follow_up'
  | 'compliance';

export interface GameNotification {
  id: string;
  npcId: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  round: number;
  minute: number;
  isRead: boolean;
  targetId: string | null;
}

export interface OutcomeEvidenceItem {
  id: string;
  npcId: string;
  statement: string;
  strength: number;
  source: 'ai_confirmed' | 'material' | 'commitment' | 'system';
  confirmedRound: number;
}

export interface OutcomeEvidenceLedger {
  publicValue: OutcomeEvidenceItem[];
  personalBenefit: OutcomeEvidenceItem[];
}

export type GiftDisposition =
  | 'delighted_acceptance'
  | 'cautious_acceptance'
  | 'polite_decline'
  | 'firm_rejection'
  | 'reported';

export interface ComplianceRiskEvent {
  id: string;
  npcId: string;
  preparationId: string | null;
  kind: 'boundary_gift' | 'explicit_bribe' | 'audit' | 'report';
  severity: number;
  status: 'latent' | 'triggered' | 'resolved';
  penalty: number;
  reason: string;
  createdRound: number;
  triggerRound: number | null;
  outcome: GiftDisposition | null;
}

export interface ActiveMeeting {
  id: string;
  npcId: string;
  actionId: string;
  appointmentId: string;
  visitType: VisitType;
  turnCount: number;
  maxTurns: number;
  durationMinutes: number;
  startedAt: string;
  workTopicOpenedBy: 'player' | 'npc' | null;
  usedPreparationIds: string[];
}

export interface GameMeetingMinutes {
  id: string;
  appointmentId: string;
  npcId: string;
  visitType: VisitType;
  summary: string;
  confirmedItems: string[];
  npcCommitments: string[];
  playerCommitments: string[];
  pendingMaterials: string[];
  nextStep: string;
  nextStepRound: number;
  nextStepMinute: number;
  owner: string;
  createdRound: number;
  createdMinute: number;
}

export interface GameRuntimeState {
  scenarioCode: string;
  progressionMultiplier: number;
  currentRound: number;
  maxRounds: number;
  actionPoints: number;
  status: 'playing' | 'won' | 'lost';
  dimensions: GameDimensions;
  /** Legacy mirror of npcAttitudes[npcId].support. */
  npcAffinity: Record<string, number>;
  unlockedNpcIds: string[];
  unlockedClues: ProjectOneClue[];
  conversationMemories: Record<string, ConversationMemory>;

  simulatedClockMinutes: number;
  dayAvailableMinutes: number;
  overtimeMinutes: number;
  cumulativeTimeMinutes: number;
  cumulativeSpentPoints: number;
  appointments: GameAppointment[];
  preparations: GamePreparation[];
  meetingMinutes: GameMeetingMinutes[];
  notifications: GameNotification[];
  npcAttitudes: Record<string, NpcAttitudeState>;
  outcomeEvidence: OutcomeEvidenceLedger;
  complianceRisks: ComplianceRiskEvent[];
  processedCommandIds: string[];

  /** Deprecated wall-clock fields retained while old persisted rows migrate. */
  phaseStartedAt: string;
  phaseEndsAt: string;
  pausedAt: string | null;
  pausedRemainingMs: number | null;
  npcContacts: Record<string, NpcContactState>;
  activeMeeting: ActiveMeeting | null;
  lastAction: string | null;
  version: number;
}

export interface RelationshipAction {
  id: string;
  cost: number;
  affinityGain: number;
}

export interface RelationshipActionEffect {
  baseAffinityDelta: number;
  preferenceAffinityDelta: number;
  totalAffinityDelta: number;
}

export interface GameOutcome {
  fiveDimensionScore: number;
  publicValueScore: number;
  personalBenefitScore: number;
  decisionChainSupportScore: number;
  /** Compatibility alias for early UI work. */
  decisionChainSupport: number;
  baseScore: number;
  compliancePenalty: number;
  finalScore: number;
  won: boolean;
  eligible: boolean;
  supportByNpc: Record<string, number>;
}

export interface ExecuteGameCommandResult {
  state: GameRuntimeState;
  result: Record<string, unknown>;
  eventType: string;
  eventPayload: Record<string, unknown>;
}

/** Trusted server-side AI assessment for a gift command. Never accept it from client JSON. */
export interface GiftCommandEvaluation {
  disposition: GiftDisposition;
  pleasureDelta?: number;
  pleasantnessDelta?: number;
  supportDelta: number;
  severity: number;
  reason: string;
  riskReason: string;
  npcResponse: string;
  source: string;
}

export interface ExecuteGameCommandOptions {
  giftEvaluation?: GiftCommandEvaluation;
}

export const RELATIONSHIP_ACTIONS: Record<string, RelationshipAction> = {
  gift: { id: 'gift', cost: 5, affinityGain: 3 },
  dinner: { id: 'dinner', cost: 8, affinityGain: 5 },
  tea: { id: 'tea', cost: 6, affinityGain: 4 },
  festival: { id: 'festival', cost: 3, affinityGain: 2 },
  roadshow: { id: 'roadshow', cost: 10, affinityGain: 6 },
  visit: { id: 'visit', cost: 12, affinityGain: 7 },
  sample: { id: 'sample', cost: 4, affinityGain: 2 },
  video: { id: 'video', cost: 7, affinityGain: 4 },
};

export const OFFLINE_ACTION_IDS = new Set(['dinner', 'tea', 'roadshow', 'visit']);
const LEGACY_SIMULATION_MARKER = '2000-01-01T00:00:00.000Z';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const clampDelta = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const roundScore = (value: number) => Math.round(clamp(value) * 10) / 10;

function deriveUnlockedNpcIds(unlockedClues: ProjectOneClue[]): string[] {
  const next = PROJECT_ONE_NPCS.filter((npc) => npc.initiallyVisible).map((npc) => npc.id);
  if (unlockedClues.includes('key_contact')) next.push('p1-minister-chen-jianguo');
  return Array.from(new Set(next));
}

function defaultContact(npcId: string): NpcContactState {
  const npc = getProjectOneNpc(npcId);
  if (!npc) throw new Error('NPC_UNKNOWN');
  return {
    status: 'known',
    initialChannel: npc.initialContactChannel,
    onlineRequestedRound: null,
    unansweredRound: null,
    outboundCount: 0,
    hasReplied: false,
    lastContactRound: null,
    lastContactMinute: null,
    channelCooldownUntil: {},
  };
}

function defaultAttitude(support = 35): NpcAttitudeState {
  return {
    pleasantness: 50,
    support: clamp(support),
    unmetImpression: 0,
    complianceAwareness: 0,
    history: [],
  };
}

type ProjectOneStateInput = Partial<GameRuntimeState> & Pick<
  GameRuntimeState,
  | 'scenarioCode'
  | 'currentRound'
  | 'maxRounds'
  | 'actionPoints'
  | 'status'
  | 'dimensions'
  | 'npcAffinity'
  | 'unlockedClues'
  | 'conversationMemories'
  | 'lastAction'
  | 'version'
>;

/** Pure legacy migration: no Date.now() and no wall-clock phase advancement. */
export function normalizeProjectOneState(state: ProjectOneStateInput): GameRuntimeState {
  const contacts = Object.fromEntries(PROJECT_ONE_NPCS.map((npc) => {
    const existing = state.npcContacts?.[npc.id];
    return [npc.id, {
      ...defaultContact(npc.id),
      ...existing,
      hasReplied: existing?.hasReplied ?? (existing ? existing.status !== 'known' : false),
      lastContactRound: existing?.lastContactRound ?? null,
      lastContactMinute: existing?.lastContactMinute ?? null,
      channelCooldownUntil: existing?.channelCooldownUntil ?? {},
    } satisfies NpcContactState];
  }));
  const npcAttitudes = Object.fromEntries(PROJECT_ONE_NPCS.map((npc) => {
    const existing = state.npcAttitudes?.[npc.id];
    const fallback = defaultAttitude(state.npcAffinity[npc.id] ?? 35);
    return [npc.id, {
      ...fallback,
      ...existing,
      history: existing?.history ?? [],
    } satisfies NpcAttitudeState];
  }));
  const npcAffinity = Object.fromEntries(PROJECT_ONE_NPCS.map((npc) => [
    npc.id,
    npcAttitudes[npc.id].support,
  ]));
  return {
    ...state,
    progressionMultiplier: state.progressionMultiplier ?? 1,
    unlockedNpcIds: deriveUnlockedNpcIds(state.unlockedClues ?? []),
    simulatedClockMinutes: clamp(state.simulatedClockMinutes ?? PROJECT_ONE_DAY_START_MINUTE, PROJECT_ONE_DAY_START_MINUTE, PROJECT_ONE_EVENING_END_MINUTE),
    dayAvailableMinutes: clamp(state.dayAvailableMinutes ?? PROJECT_ONE_STANDARD_DAY_MINUTES, 0, PROJECT_ONE_STANDARD_DAY_MINUTES),
    overtimeMinutes: clamp(state.overtimeMinutes ?? 0, 0, PROJECT_ONE_OVERTIME_END_MINUTE - PROJECT_ONE_WORK_END_MINUTE),
    cumulativeTimeMinutes: Math.max(0, state.cumulativeTimeMinutes ?? 0),
    cumulativeSpentPoints: Math.max(0, state.cumulativeSpentPoints ?? 0),
    appointments: state.appointments ?? [],
    preparations: state.preparations ?? [],
    meetingMinutes: state.meetingMinutes ?? [],
    notifications: state.notifications ?? [],
    npcAttitudes,
    npcAffinity,
    outcomeEvidence: state.outcomeEvidence ?? { publicValue: [], personalBenefit: [] },
    complianceRisks: state.complianceRisks ?? [],
    processedCommandIds: state.processedCommandIds ?? [],
    phaseStartedAt: LEGACY_SIMULATION_MARKER,
    phaseEndsAt: LEGACY_SIMULATION_MARKER,
    pausedAt: null,
    pausedRemainingMs: null,
    npcContacts: contacts,
    activeMeeting: state.activeMeeting ? normalizeActiveMeeting(state.activeMeeting) : null,
  };
}

function normalizeActiveMeeting(meeting: ActiveMeeting): ActiveMeeting {
  const legacyAction = meeting.actionId;
  const visitType: VisitType = meeting.visitType ?? (legacyAction === 'tea' || legacyAction === 'dinner' ? 'informal' : 'formal');
  const rules = PROJECT_ONE_VISIT_RULES[visitType];
  return {
    ...meeting,
    appointmentId: meeting.appointmentId ?? meeting.id,
    visitType,
    maxTurns: meeting.maxTurns ?? rules.maxTurns,
    durationMinutes: meeting.durationMinutes ?? rules.durationMinutes,
    workTopicOpenedBy: meeting.workTopicOpenedBy ?? null,
    usedPreparationIds: meeting.usedPreparationIds ?? [],
  };
}

export function explicitlyRevealsMinister(replyContent: string): boolean {
  if (!replyContent.includes('陈建国')) return false;
  return /业务部.{0,8}陈建国.{0,4}部长|陈建国.{0,6}(业务部|部长)|陈部长|业务部部长/.test(replyContent);
}

export function reconcileNarrativeDiscoveries(state: GameRuntimeState, assistantReplies: string[]): GameRuntimeState {
  if (state.unlockedClues.includes('key_contact') || !assistantReplies.some(explicitlyRevealsMinister)) return state;
  const unlockedClues = [...state.unlockedClues, 'key_contact' as const];
  return { ...state, unlockedClues, unlockedNpcIds: deriveUnlockedNpcIds(unlockedClues) };
}

export function createProjectOneState(progressionMultiplier = 1, _legacyNow?: number): GameRuntimeState {
  const initial: ProjectOneStateInput = {
    scenarioCode: PROJECT_ONE_CODE,
    progressionMultiplier,
    currentRound: 1,
    maxRounds: PROJECT_ONE_MAX_ROUNDS,
    actionPoints: PROJECT_ONE_INITIAL_ACTION_POINTS,
    status: 'playing',
    dimensions: {
      decisionAnalysis: 50,
      relationshipBuilding: 50,
      valuePresentation: 50,
      objectionHandling: 50,
      informationDiscovery: 50,
    },
    npcAffinity: Object.fromEntries(PROJECT_ONE_NPCS.map((npc) => [npc.id, 35])),
    unlockedNpcIds: PROJECT_ONE_NPCS.filter((npc) => npc.initiallyVisible).map((npc) => npc.id),
    unlockedClues: [],
    conversationMemories: {},
    npcContacts: Object.fromEntries(PROJECT_ONE_NPCS.map((npc) => [npc.id, defaultContact(npc.id)])),
    lastAction: null,
    version: 1,
  };
  return normalizeProjectOneState(initial);
}

export function calculateTotalScore(dimensions: GameDimensions): number {
  const total = GAME_DIMENSIONS.reduce((sum, key) => sum + dimensions[key], 0);
  return Math.round(total / GAME_DIMENSIONS.length);
}

function appendEvidence(
  ledger: OutcomeEvidenceLedger,
  category: keyof OutcomeEvidenceLedger,
  items: OutcomeEvidenceItem[],
): OutcomeEvidenceLedger {
  const existing = new Set(ledger[category].map((item) => `${item.npcId}:${item.statement}`));
  return {
    ...ledger,
    [category]: [...ledger[category], ...items.filter((item) => !existing.has(`${item.npcId}:${item.statement}`))].slice(-40),
  };
}

export interface NpcAttitudeDelta {
  pleasantnessDelta?: number;
  supportDelta?: number;
  unmetImpressionDelta?: number;
  complianceAwarenessDelta?: number;
  reason: string;
  source?: string;
  allowBoundaryGiftRange?: boolean;
}

export function applyNpcAttitudeDelta(
  state: GameRuntimeState,
  npcId: string,
  delta: NpcAttitudeDelta,
): GameRuntimeState {
  const current = state.npcAttitudes[npcId] ?? defaultAttitude(state.npcAffinity[npcId] ?? 35);
  const pleasantLimit = delta.allowBoundaryGiftRange ? 15 : 10;
  const supportLimit = delta.allowBoundaryGiftRange ? 10 : 8;
  const pleasantnessDelta = clampDelta(Math.round(delta.pleasantnessDelta ?? 0), -pleasantLimit, pleasantLimit);
  const supportDelta = clampDelta(Math.round(delta.supportDelta ?? 0), -supportLimit, supportLimit);
  const next: NpcAttitudeState = {
    pleasantness: clamp(current.pleasantness + pleasantnessDelta),
    support: clamp(current.support + supportDelta),
    unmetImpression: clamp(current.unmetImpression + clampDelta(Math.round(delta.unmetImpressionDelta ?? 0), -5, 5), -100, 100),
    complianceAwareness: clamp(current.complianceAwareness + clampDelta(Math.round(delta.complianceAwarenessDelta ?? 0), -10, 20)),
    history: [...current.history, {
      round: state.currentRound,
      minute: state.simulatedClockMinutes,
      pleasantnessDelta,
      supportDelta,
      reason: delta.reason,
      source: delta.source ?? 'system',
    }].slice(-40),
  };
  return {
    ...state,
    npcAttitudes: { ...state.npcAttitudes, [npcId]: next },
    npcAffinity: { ...state.npcAffinity, [npcId]: next.support },
  };
}

type ExtendedNpcEvaluation = NpcTurnEvaluation & {
  pleasureDelta?: number;
  pleasantnessDelta?: number;
  supportDelta?: number;
  unmetImpressionDelta?: number;
  complianceAwarenessDelta?: number;
  publicValueEvidence?: Array<string | { statement: string; strength?: number }>;
  personalBenefitEvidence?: Array<string | { statement: string; strength?: number }>;
  workTopicOpenedBy?: 'none' | 'player' | 'npc' | null;
};

function normalizeEvidenceItems(
  npcId: string,
  round: number,
  category: 'public' | 'personal',
  raw: Array<string | { statement: string; strength?: number }>,
): OutcomeEvidenceItem[] {
  return raw.slice(0, 4).map((item, index) => {
    const statement = typeof item === 'string' ? item : item.statement;
    const strength = typeof item === 'string' ? 2 : clamp(item.strength ?? 2, 1, 5);
    return {
      id: `${npcId}:${round}:${category}:${index}:${statement.slice(0, 24)}`,
      npcId,
      statement,
      strength,
      source: 'ai_confirmed' as const,
      confirmedRound: round,
    };
  }).filter((item) => item.statement.trim().length > 0);
}

export function applyNpcEvaluation(
  state: GameRuntimeState,
  npcId: string,
  evaluation: NpcTurnEvaluation,
  replyContent = '',
  channel?: ContactChannel,
): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (!state.unlockedNpcIds.includes(npcId)) throw new Error('NPC_LOCKED');
  let next = state;
  if (channel && channel !== 'offline') next = consumeCommunicationTime(next, channel);

  const dimensions = { ...next.dimensions };
  for (const key of GAME_DIMENSIONS) {
    dimensions[key] = clamp(dimensions[key] + evaluation.dimensionDeltas[key] * next.progressionMultiplier);
  }

  const extended = evaluation as ExtendedNpcEvaluation;
  const supportDelta = (extended.supportDelta ?? evaluation.affinityDelta) * next.progressionMultiplier;
  const pleasantnessDelta = (extended.pleasureDelta ?? extended.pleasantnessDelta ?? evaluation.affinityDelta) * next.progressionMultiplier;
  next = applyNpcAttitudeDelta({ ...next, dimensions }, npcId, {
    pleasantnessDelta,
    supportDelta,
    unmetImpressionDelta: extended.unmetImpressionDelta,
    complianceAwarenessDelta: extended.complianceAwarenessDelta,
    reason: evaluation.affinityReason,
    source: 'ai_evaluation',
  });

  const acceptedClues: ProjectOneClue[] = evaluation.cluesUnlocked.filter(
    (clue) => clue !== 'personal_interest' || (next.npcAttitudes[npcId]?.support ?? 0) >= 50,
  );
  if (explicitlyRevealsMinister(replyContent)) acceptedClues.push('key_contact');
  const unlockedClues = Array.from(new Set([...next.unlockedClues, ...acceptedClues]));
  const memory = next.conversationMemories[npcId] ?? { summary: '', summarizedMessageCount: 0 };
  const confirmedFacts = Array.from(new Set([...(memory.confirmedFacts ?? []), ...evaluation.confirmedFacts])).slice(-12);
  const commitments = Array.from(new Set([...(memory.commitments ?? []), ...evaluation.commitments])).slice(-12);
  let outcomeEvidence = next.outcomeEvidence;
  const publicRaw = extended.publicValueEvidence ?? evaluation.confirmedFacts
    .filter((fact) => /预算|回报|风险|合规|落地|效率|绩效|组织|成本/.test(fact));
  const personalRaw = extended.personalBenefitEvidence ?? evaluation.confirmedFacts
    .filter((fact) => /减负|晋升|职业|声誉|成长|安全|个人绩效/.test(fact));
  outcomeEvidence = appendEvidence(outcomeEvidence, 'publicValue', normalizeEvidenceItems(npcId, next.currentRound, 'public', publicRaw));
  outcomeEvidence = appendEvidence(outcomeEvidence, 'personalBenefit', normalizeEvidenceItems(npcId, next.currentRound, 'personal', personalRaw));

  const activeMeeting = next.activeMeeting
    && next.activeMeeting.npcId === npcId
    && extended.workTopicOpenedBy
    && extended.workTopicOpenedBy !== 'none'
    ? { ...next.activeMeeting, workTopicOpenedBy: next.activeMeeting.workTopicOpenedBy ?? extended.workTopicOpenedBy }
    : next.activeMeeting;

  return {
    ...next,
    unlockedClues,
    unlockedNpcIds: deriveUnlockedNpcIds(unlockedClues),
    conversationMemories: {
      ...next.conversationMemories,
      [npcId]: { ...memory, confirmedFacts, commitments },
    },
    outcomeEvidence,
    activeMeeting,
  };
}

/** Applies a one-hop reputation handoff without exposing another NPC's chat. */
export function applyIndirectImpression(
  state: GameRuntimeState,
  targetNpcId: string,
  originalDelta: number,
  reason: string,
  sourceNpcId: string,
  sourceEventId: string,
): GameRuntimeState {
  const attitude = state.npcAttitudes[targetNpcId];
  if (!attitude) throw new Error('NPC_UNKNOWN');
  const sourceKey = `indirect:${sourceEventId}`;
  if (attitude.history.some((item) => item.source === sourceKey)) return state;
  const hasMet = state.appointments.some((appointment) =>
    appointment.npcId === targetNpcId && ['active', 'completed'].includes(appointment.status));
  return applyNpcAttitudeDelta(state, targetNpcId, {
    unmetImpressionDelta: hasMet ? 0 : clampDelta(Math.round(originalDelta * 0.5), -3, 3),
    supportDelta: hasMet ? clampDelta(Math.round(originalDelta * 0.25), -2, 2) : 0,
    reason: `${sourceNpcId}转述：${reason}`,
    source: sourceKey,
  });
}

export interface ConsumeGameTimeOptions {
  pointCost?: number;
  countAsInvested?: boolean;
  allowOvertime?: boolean;
  allowDuringMeeting?: boolean;
  ignoreAppointmentId?: string;
}

/** Consumes simulated work capacity; wall-clock time is never read. */
export function consumeGameTime(
  state: GameRuntimeState,
  minutes: number,
  options: ConsumeGameTimeOptions = {},
): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (state.activeMeeting && !options.allowDuringMeeting) throw new Error('MEETING_ALREADY_ACTIVE');
  if (!Number.isInteger(minutes) || minutes < 0) throw new Error('TIME_AMOUNT_INVALID');
  const current = reconcileMissedAppointments(state);
  const simulatedClockMinutes = current.simulatedClockMinutes + minutes;
  const regularMinutes = Math.min(minutes, Math.max(0, PROJECT_ONE_WORK_END_MINUTE - current.simulatedClockMinutes));
  if (current.dayAvailableMinutes < regularMinutes) throw new Error('DAY_TIME_INSUFFICIENT');
  const capacityMinutes = Math.min(minutes, current.dayAvailableMinutes);
  const overtimeNeeded = minutes - regularMinutes;
  if (overtimeNeeded > 0 && options.allowOvertime === false) throw new Error('DAY_TIME_INSUFFICIENT');
  const nextOvertime = current.overtimeMinutes + overtimeNeeded;
  if (nextOvertime > PROJECT_ONE_OVERTIME_END_MINUTE - PROJECT_ONE_WORK_END_MINUTE) throw new Error('OVERTIME_LIMIT_EXCEEDED');
  const priorBlocks = Math.ceil(current.overtimeMinutes / 30);
  const nextBlocks = Math.ceil(nextOvertime / 30);
  const overtimeCost = Math.max(0, nextBlocks - priorBlocks);
  const pointCost = (options.pointCost ?? 0) + overtimeCost;
  if (current.actionPoints < pointCost) throw new Error('ACTION_POINTS_INSUFFICIENT');
  if (simulatedClockMinutes > PROJECT_ONE_OVERTIME_END_MINUTE) throw new Error('OVERTIME_LIMIT_EXCEEDED');

  const overlapsAppointment = current.appointments.some((appointment) =>
    appointment.id !== options.ignoreAppointmentId
    &&
    appointment.status === 'accepted'
    && appointment.scheduledRound === current.currentRound
    && current.simulatedClockMinutes < appointment.startMinute + appointment.durationMinutes
    && simulatedClockMinutes > getAppointmentDepartureMinute(appointment));
  if (overlapsAppointment) throw new Error('APPOINTMENT_CONFLICT');

  return {
    ...current,
    simulatedClockMinutes,
    dayAvailableMinutes: current.dayAvailableMinutes - capacityMinutes,
    overtimeMinutes: nextOvertime,
    cumulativeTimeMinutes: current.cumulativeTimeMinutes + (options.countAsInvested === false ? 0 : minutes),
    actionPoints: current.actionPoints - pointCost,
    cumulativeSpentPoints: current.cumulativeSpentPoints + pointCost,
  };
}

function chargeOvertimeMinutes(state: GameRuntimeState, minutes: number): GameRuntimeState {
  if (minutes <= 0) return state;
  const nextOvertime = state.overtimeMinutes + minutes;
  if (nextOvertime > PROJECT_ONE_OVERTIME_END_MINUTE - PROJECT_ONE_WORK_END_MINUTE) throw new Error('OVERTIME_LIMIT_EXCEEDED');
  const pointCost = Math.max(0, Math.ceil(nextOvertime / 30) - Math.ceil(state.overtimeMinutes / 30));
  if (state.actionPoints < pointCost) throw new Error('ACTION_POINTS_INSUFFICIENT');
  return {
    ...state,
    overtimeMinutes: nextOvertime,
    actionPoints: state.actionPoints - pointCost,
    cumulativeSpentPoints: state.cumulativeSpentPoints + pointCost,
  };
}

export function consumeCommunicationTime(state: GameRuntimeState, channel: CommunicationChannel): GameRuntimeState {
  return consumeGameTime(state, PROJECT_ONE_COMMUNICATION_MINUTES[channel]);
}

function advanceClockWithoutInvestment(state: GameRuntimeState, minutes: number): GameRuntimeState {
  if (!Number.isInteger(minutes) || minutes < 1) throw new Error('TIME_AMOUNT_INVALID');
  const nextMinute = state.simulatedClockMinutes + minutes;
  if (nextMinute > PROJECT_ONE_EVENING_END_MINUTE) throw new Error('DAY_CLOCK_LIMIT_EXCEEDED');
  return advanceIdleClockTo(state, nextMinute);
}

function getAppointmentTravelMinutes(): number {
  // Dedicated/drop-in describes the invitation posture, not a second activity
  // on the calendar. Visit duration is determined solely by visitType.
  return 0;
}

function getAppointmentDepartureMinute(appointment: Pick<GameAppointment, 'invitationMethod' | 'startMinute'>): number {
  return appointment.startMinute - getAppointmentTravelMinutes();
}

export function getAppointmentHospitalityCost(
  appointment: Pick<GameAppointment, 'visitType' | 'venue'>,
): number {
  if (appointment.visitType !== 'informal') return 0;
  return /餐|饭|酒|宴|dinner|banquet/i.test(appointment.venue) ? 8 : 6;
}

function advanceIdleClockTo(
  state: GameRuntimeState,
  targetMinute: number,
  ignoreAppointmentId?: string,
): GameRuntimeState {
  if (!Number.isInteger(targetMinute) || targetMinute < state.simulatedClockMinutes) throw new Error('TIME_AMOUNT_INVALID');
  if (targetMinute > PROJECT_ONE_EVENING_END_MINUTE) throw new Error('DAY_CLOCK_LIMIT_EXCEEDED');
  const reconciled = reconcileMissedAppointments(
    { ...state, simulatedClockMinutes: targetMinute },
    ignoreAppointmentId,
  );
  const skippedDaytimeMinutes = Math.max(0,
    Math.min(targetMinute, PROJECT_ONE_WORK_END_MINUTE)
    - Math.max(state.simulatedClockMinutes, PROJECT_ONE_DAY_START_MINUTE));
  return {
    ...reconciled,
    dayAvailableMinutes: Math.max(0, reconciled.dayAvailableMinutes - skippedDaytimeMinutes),
  };
}

function reconcileMissedAppointments(state: GameRuntimeState, ignoreAppointmentId?: string): GameRuntimeState {
  const missed = state.appointments.filter((appointment) =>
    appointment.id !== ignoreAppointmentId
    &&
    appointment.status === 'accepted'
    && appointment.scheduledRound === state.currentRound
    && getAppointmentDepartureMinute(appointment) < state.simulatedClockMinutes);
  if (!missed.length) return state;
  const missedIds = new Set(missed.map((appointment) => appointment.id));
  const releasedMinutes = missed.reduce((sum, appointment) => sum + appointment.reservedMinutes, 0);
  const notifications = [...state.notifications, ...missed.map((appointment) => ({
    id: `missed:${appointment.id}`,
    npcId: appointment.npcId,
    kind: 'appointment' as const,
    title: '已错过预约',
    body: '约定时间已经过去，本次拜访记为爽约。',
    round: state.currentRound,
    minute: state.simulatedClockMinutes,
    isRead: false,
    targetId: appointment.id,
  }))];
  return {
    ...state,
    dayAvailableMinutes: Math.min(PROJECT_ONE_STANDARD_DAY_MINUTES, state.dayAvailableMinutes + releasedMinutes),
    appointments: state.appointments.map((appointment) => missedIds.has(appointment.id)
      ? { ...appointment, status: 'missed' as const, reservedMinutes: 0 }
      : appointment),
    notifications,
  };
}

export function applyRelationshipAction(state: GameRuntimeState, npcId: string, actionId: string): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (!state.unlockedNpcIds.includes(npcId)) throw new Error('NPC_LOCKED');
  if (state.npcContacts[npcId]?.status !== 'online') throw new Error('ONLINE_CONTACT_REQUIRED');
  if (state.activeMeeting) throw new Error('MEETING_ALREADY_ACTIVE');
  const action = RELATIONSHIP_ACTIONS[actionId];
  if (!action) throw new Error('ACTION_UNKNOWN');
  const offline = OFFLINE_ACTION_IDS.has(actionId);
  const visitType: VisitType = actionId === 'tea' || actionId === 'dinner' ? 'informal' : 'formal';
  const duration = offline ? PROJECT_ONE_VISIT_RULES[visitType].durationMinutes : 10;
  let next = consumeGameTime(state, duration, { pointCost: action.cost });
  const effect = getRelationshipActionEffect(npcId, actionId, state.progressionMultiplier);
  next = applyNpcAttitudeDelta(next, npcId, {
    pleasantnessDelta: effect.totalAffinityDelta,
    supportDelta: Math.round(effect.totalAffinityDelta / 2),
    reason: `兼容关系动作：${actionId}`,
    source: 'legacy_relationship_action',
  });
  if (!offline) return { ...next, lastAction: actionId };
  const id = `legacy:${npcId}:${state.currentRound}:${state.version + 1}`;
  const rules = PROJECT_ONE_VISIT_RULES[visitType];
  const appointment: GameAppointment = {
    id,
    npcId,
    invitationMethod: 'dedicated',
    visitType,
    venue: visitType === 'informal' ? '非正式场合' : '办公室',
    purpose: actionId,
    scheduledRound: state.currentRound,
    startMinute: state.simulatedClockMinutes,
    durationMinutes: rules.durationMinutes,
    maxTurns: rules.maxTurns,
    status: 'active',
    conditions: [],
    reservedMinutes: 0,
    workTopicOpenedBy: null,
    invitationCommandId: id,
  };
  return {
    ...next,
    appointments: [...next.appointments, appointment],
    activeMeeting: {
      id,
      npcId,
      actionId,
      appointmentId: id,
      visitType,
      turnCount: 0,
      maxTurns: rules.maxTurns,
      durationMinutes: rules.durationMinutes,
      startedAt: `round:${state.currentRound}:minute:${state.simulatedClockMinutes}`,
      workTopicOpenedBy: null,
      usedPreparationIds: [],
    },
    lastAction: actionId,
  };
}

export function replenishActionPoints(state: GameRuntimeState, amount: number): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (!Number.isInteger(amount) || amount < 1 || amount > 999) throw new Error('ACTION_POINTS_AMOUNT_INVALID');
  return { ...state, actionPoints: state.actionPoints + amount };
}

export function getRelationshipActionEffect(npcId: string, actionId: string, progressionMultiplier = 1): RelationshipActionEffect {
  const action = RELATIONSHIP_ACTIONS[actionId];
  if (!action) throw new Error('ACTION_UNKNOWN');
  const npc = getProjectOneNpc(npcId);
  if (!npc) throw new Error('NPC_UNKNOWN');
  const preferenceAffinityDelta = npc.actionPreferences[actionId] ?? 0;
  return {
    baseAffinityDelta: action.affinityGain * progressionMultiplier,
    preferenceAffinityDelta: preferenceAffinityDelta * progressionMultiplier,
    totalAffinityDelta: (action.affinityGain + preferenceAffinityDelta) * progressionMultiplier,
  };
}

export function getPhaseName(round: number): string {
  return PROJECT_ONE_PHASE_NAMES[Math.max(0, Math.min(PROJECT_ONE_PHASE_NAMES.length - 1, round - 1))];
}

function calculateEvidenceScore(items: OutcomeEvidenceItem[], multiplier: number): number {
  return roundScore(items.reduce((sum, item) => sum + clamp(item.strength, 1, 5) * multiplier, 0));
}

export function getGameOutcome(state: GameRuntimeState): GameOutcome {
  const fiveDimensionScore = calculateTotalScore(state.dimensions);
  const publicValueScore = calculateEvidenceScore(state.outcomeEvidence.publicValue, 12);
  const personalBenefitScore = calculateEvidenceScore(state.outcomeEvidence.personalBenefit, 15);
  const supportByNpc = Object.fromEntries(PROJECT_ONE_NPCS.map((npc) => [
    npc.id,
    state.npcAttitudes[npc.id]?.support ?? state.npcAffinity[npc.id] ?? 35,
  ]));
  const decisionChainSupportScore = roundScore(PROJECT_ONE_NPCS.reduce((sum, npc) =>
    sum + (state.npcAttitudes[npc.id]?.support ?? state.npcAffinity[npc.id] ?? 35) * npc.decisionWeight, 0));
  const baseScore = Math.round((
    fiveDimensionScore * 0.4
    + publicValueScore * 0.3
    + personalBenefitScore * 0.2
    + decisionChainSupportScore * 0.1
  ) * 10) / 10;
  const compliancePenalty = Math.min(30, state.complianceRisks
    .filter((risk) => risk.status === 'triggered')
    .reduce((sum, risk) => sum + Math.max(0, risk.penalty), 0));
  const finalScore = Math.max(0, Math.round((baseScore - compliancePenalty) * 10) / 10);
  const won = finalScore >= 60;
  return {
    fiveDimensionScore,
    publicValueScore,
    personalBenefitScore,
    decisionChainSupportScore,
    decisionChainSupport: decisionChainSupportScore,
    baseScore,
    compliancePenalty,
    finalScore,
    won,
    eligible: won,
    supportByNpc,
  };
}

export function getWinConditions(state: GameRuntimeState) {
  const outcome = getGameOutcome(state);
  return {
    ...outcome,
    totalScore: outcome.finalScore,
    hasDecisionClue: state.unlockedClues.includes('decision_process'),
    keyAffinity: state.npcAttitudes['p1-minister-chen-jianguo']?.support ?? state.npcAffinity['p1-minister-chen-jianguo'] ?? 0,
  };
}

function processComplianceRisks(state: GameRuntimeState, finalAudit = false): GameRuntimeState {
  let next = state;
  const risks = state.complianceRisks.map((risk) => {
    if (risk.status !== 'latent') return risk;
    const chance = Math.min(90, risk.severity * 12 + (finalAudit ? 15 : 0));
    if (!shouldNpcRespond(`${risk.id}:audit:${state.currentRound}:${finalAudit}`, chance)) return risk;
    next = applyNpcAttitudeDelta(next, risk.npcId, {
      pleasantnessDelta: -Math.min(10, risk.severity * 2),
      supportDelta: -Math.min(8, risk.severity * 2),
      complianceAwarenessDelta: 15,
      reason: '边界礼品风险暴露',
      source: 'compliance_audit',
      allowBoundaryGiftRange: true,
    });
    return { ...risk, status: 'triggered' as const, triggerRound: state.currentRound };
  });
  const newlyTriggered = risks.filter((risk, index) => risk.status === 'triggered' && state.complianceRisks[index]?.status === 'latent');
  return {
    ...next,
    complianceRisks: risks,
    notifications: [...next.notifications, ...newlyTriggered.map((risk) => ({
      id: `compliance:${risk.id}:${state.currentRound}`,
      npcId: risk.npcId,
      kind: 'compliance' as const,
      title: '合规风险暴露',
      body: risk.reason,
      round: state.currentRound,
      minute: state.simulatedClockMinutes,
      isRead: false,
      targetId: risk.id,
    }))],
  };
}

export function submitGame(state: GameRuntimeState): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (state.activeMeeting) throw new Error('MEETING_ALREADY_ACTIVE');
  const audited = processComplianceRisks(state, true);
  const outcome = getGameOutcome(audited);
  return { ...audited, status: outcome.eligible ? 'won' : 'lost', activeMeeting: null, lastAction: null };
}

/** @deprecated Simulated time naturally stops when the player does not act. */
export function pauseGame(state: GameRuntimeState, _legacyNow?: number): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  return state;
}

/** @deprecated Simulated time naturally stops when the player does not act. */
export function resumeGame(state: GameRuntimeState, _legacyNow?: number): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  return state;
}

export function connectNpc(state: GameRuntimeState, npcId: string): GameRuntimeState {
  const contact = state.npcContacts[npcId];
  if (!contact) throw new Error('NPC_UNKNOWN');
  return {
    ...state,
    npcContacts: {
      ...state.npcContacts,
      [npcId]: {
        ...contact,
        status: contact.status === 'online' ? 'online' : 'connected',
        hasReplied: true,
        unansweredRound: null,
        lastContactRound: state.currentRound,
        lastContactMinute: state.simulatedClockMinutes,
      },
    },
  };
}

export function setNpcOnline(state: GameRuntimeState, npcId: string, accepted: boolean): GameRuntimeState {
  const contact = state.npcContacts[npcId];
  if (!contact || contact.status === 'known') throw new Error('NPC_NOT_CONNECTED');
  return {
    ...state,
    npcContacts: {
      ...state.npcContacts,
      [npcId]: {
        ...contact,
        status: accepted ? 'online' : contact.status,
        onlineRequestedRound: state.currentRound,
        lastContactRound: state.currentRound,
        lastContactMinute: state.simulatedClockMinutes,
      },
    },
  };
}

export function markNpcUnanswered(state: GameRuntimeState, npcId: string, channel?: CommunicationChannel): GameRuntimeState {
  const contact = state.npcContacts[npcId];
  if (!contact) throw new Error('NPC_UNKNOWN');
  const selectedChannel = channel ?? contact.initialChannel;
  const cooldownMinutes = PROJECT_ONE_COMMUNICATION_MINUTES[selectedChannel];
  return {
    ...state,
    npcContacts: {
      ...state.npcContacts,
      [npcId]: {
        ...contact,
        unansweredRound: state.currentRound,
        outboundCount: contact.outboundCount + 1,
        channelCooldownUntil: {
          ...contact.channelCooldownUntil,
          [selectedChannel]: state.simulatedClockMinutes + Math.max(15, cooldownMinutes),
        },
      },
    },
  };
}

export function recordNpcOutbound(state: GameRuntimeState, npcId: string): GameRuntimeState {
  const contact = state.npcContacts[npcId];
  if (!contact) throw new Error('NPC_UNKNOWN');
  return {
    ...state,
    npcContacts: {
      ...state.npcContacts,
      [npcId]: {
        ...contact,
        outboundCount: contact.outboundCount + 1,
        lastContactRound: state.currentRound,
        lastContactMinute: state.simulatedClockMinutes,
      },
    },
  };
}

export function shouldNpcRespond(seed: string, chancePercent: number): boolean {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100 < Math.max(0, Math.min(100, chancePercent));
}

function completeMeeting(state: GameRuntimeState, reason: string, summary = ''): GameRuntimeState {
  const meeting = state.activeMeeting;
  if (!meeting) return state;
  const appointment = state.appointments.find((item) => item.id === meeting.appointmentId);
  const memory = state.conversationMemories[meeting.npcId];
  const pendingMaterials = state.preparations
    .filter((item) =>
      item.npcId === meeting.npcId
      && (item.appointmentId === null || item.appointmentId === meeting.appointmentId)
      && ['ppt', 'materials'].includes(item.type)
      && item.status === 'ready'
      && !meeting.usedPreparationIds.includes(item.id))
    .map((item) => item.title);
  let simulatedClockMinutes = state.simulatedClockMinutes;
  let cumulativeTimeMinutes = state.cumulativeTimeMinutes;
  if (appointment && appointment.reservedMinutes > 0) {
    simulatedClockMinutes = Math.max(simulatedClockMinutes, appointment.startMinute) + appointment.durationMinutes;
    cumulativeTimeMinutes += appointment.durationMinutes;
  }
  const canFollowUpToday = simulatedClockMinutes + 30 <= PROJECT_ONE_EVENING_END_MINUTE;
  const hasNextRound = state.currentRound < state.maxRounds;
  const nextStepRound = canFollowUpToday || !hasNextRound ? state.currentRound : state.currentRound + 1;
  const nextStepMinute = canFollowUpToday
    ? simulatedClockMinutes + 30
    : hasNextRound ? PROJECT_ONE_DAY_START_MINUTE : PROJECT_ONE_EVENING_END_MINUTE;
  const normalizedSummary = summary.trim();
  const confirmedItems = Array.from(new Set([
    ...(memory?.confirmedFacts ?? []),
    ...(appointment?.purpose ? [`已围绕“${appointment.purpose}”完成沟通`] : []),
  ])).slice(-12);
  const playerCommitments = normalizedSummary
    ? [normalizedSummary]
    : [pendingMaterials.length > 0 ? '补发待补材料并确认会谈纪要' : '发送会谈纪要并确认下一步安排'];
  const minutes: GameMeetingMinutes = {
    id: `minutes:${meeting.appointmentId}`,
    appointmentId: meeting.appointmentId,
    npcId: meeting.npcId,
    visitType: meeting.visitType,
    summary: normalizedSummary || (reason === 'turn_limit' ? '会谈达到内容轮次上限后结束。' : '本次拜访已结束。'),
    confirmedItems,
    npcCommitments: Array.from(new Set(memory?.commitments ?? [])).slice(-12),
    playerCommitments,
    pendingMaterials,
    nextStep: pendingMaterials.length > 0 ? '补发材料、确认纪要并约定后续沟通' : '确认纪要并约定后续沟通',
    nextStepRound,
    nextStepMinute,
    owner: `我方销售 / ${getProjectOneNpc(meeting.npcId)?.name ?? '客户联系人'}`,
    createdRound: state.currentRound,
    createdMinute: simulatedClockMinutes,
  };
  return {
    ...state,
    simulatedClockMinutes: Math.min(PROJECT_ONE_EVENING_END_MINUTE, simulatedClockMinutes),
    cumulativeTimeMinutes,
    appointments: state.appointments.map((item) => item.id === meeting.appointmentId
      ? { ...item, status: 'completed' as const, reservedMinutes: 0, workTopicOpenedBy: meeting.workTopicOpenedBy }
      : item),
    meetingMinutes: [...state.meetingMinutes.filter((item) => item.appointmentId !== meeting.appointmentId), minutes],
    notifications: [...state.notifications, {
      id: `follow-up:${meeting.appointmentId}`,
      npcId: meeting.npcId,
      kind: 'follow_up',
      title: '拜访后跟进',
      body: pendingMaterials.length > 0
        ? `纪要已生成，仍需补发${pendingMaterials.join('、')}并跟进承诺。`
        : reason === 'turn_limit' ? '会谈已达到内容轮次，纪要已生成，请跟进承诺。' : '拜访纪要已生成，请确认并完成后续跟进。',
      round: state.currentRound,
      minute: simulatedClockMinutes,
      isRead: false,
      targetId: meeting.appointmentId,
    }],
    activeMeeting: null,
    lastAction: null,
  };
}

export function recordMeetingTurn(state: GameRuntimeState): GameRuntimeState {
  if (!state.activeMeeting) throw new Error('MEETING_NOT_ACTIVE');
  const nextCount = state.activeMeeting.turnCount + 1;
  if (nextCount >= state.activeMeeting.maxTurns) {
    return completeMeeting({ ...state, activeMeeting: { ...state.activeMeeting, turnCount: nextCount } }, 'turn_limit');
  }
  return { ...state, activeMeeting: { ...state.activeMeeting, turnCount: nextCount } };
}

export function setMeetingWorkTopicOpenedBy(state: GameRuntimeState, by: 'player' | 'npc'): GameRuntimeState {
  if (!state.activeMeeting) throw new Error('MEETING_NOT_ACTIVE');
  if (state.activeMeeting.workTopicOpenedBy) return state;
  return { ...state, activeMeeting: { ...state.activeMeeting, workTopicOpenedBy: by } };
}

export function endMeeting(state: GameRuntimeState): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  return completeMeeting(state, 'player');
}

export function advanceRound(state: GameRuntimeState, _legacyNow?: number): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (state.activeMeeting) throw new Error('MEETING_ALREADY_ACTIVE');
  let next = processComplianceRisks(state);
  next = {
    ...next,
    appointments: next.appointments.map((appointment) =>
      appointment.scheduledRound === state.currentRound && appointment.status === 'accepted'
        ? { ...appointment, status: 'missed' as const, reservedMinutes: 0 }
        : appointment),
  };
  if (state.currentRound >= state.maxRounds) return submitGame(next);
  const currentRound = state.currentRound + 1;
  const reservedMinutes = next.appointments
    .filter((appointment) => appointment.scheduledRound === currentRound && appointment.status === 'accepted')
    .reduce((sum, appointment) => sum + appointment.durationMinutes, 0);
  return {
    ...next,
    currentRound,
    actionPoints: Math.min(PROJECT_ONE_ACTION_POINT_CAP, next.actionPoints + PROJECT_ONE_PHASE_ACTION_POINT_GAIN),
    simulatedClockMinutes: PROJECT_ONE_DAY_START_MINUTE,
    dayAvailableMinutes: Math.max(0, PROJECT_ONE_STANDARD_DAY_MINUTES - reservedMinutes),
    overtimeMinutes: 0,
    phaseStartedAt: LEGACY_SIMULATION_MARKER,
    phaseEndsAt: LEGACY_SIMULATION_MARKER,
    pausedAt: null,
    pausedRemainingMs: null,
    npcContacts: Object.fromEntries(Object.entries(next.npcContacts).map(([npcId, contact]) => [npcId, {
      ...contact,
      unansweredRound: null,
      channelCooldownUntil: {},
    }])),
    lastAction: null,
  };
}

/** Wall-clock reconciliation was removed; reads are now pure and time-neutral. */
export function reconcileExpiredPhases(state: GameRuntimeState, _legacyNow?: number): GameRuntimeState {
  return state;
}

function invitationChance(state: GameRuntimeState, command: Extract<GameCommand, { type: 'invite' }>): number {
  const { npcId, invitationMethod, visitType } = command.payload;
  const attitude = state.npcAttitudes[npcId] ?? defaultAttitude();
  let chance = 40 + (attitude.support - 35) * 0.45 + (attitude.pleasantness - 50) * 0.2;
  if (invitationMethod === 'drop_in' && visitType === 'short') chance += 15;
  if (invitationMethod === 'drop_in' && visitType !== 'short') chance -= 15;
  if (invitationMethod === 'dedicated' && visitType === 'formal') chance += 10;
  if (visitType === 'informal' && attitude.support < 45) chance -= 8;
  return clamp(chance, 10, 90);
}

function reserveAppointmentTime(state: GameRuntimeState, appointment: GameAppointment): GameRuntimeState {
  if (appointment.scheduledRound !== state.currentRound) return state;
  const overlapsExisting = state.appointments.some((item) =>
    item.id !== appointment.id
    && item.scheduledRound === appointment.scheduledRound
    && ['accepted', 'active'].includes(item.status)
    && getAppointmentDepartureMinute(item) < appointment.startMinute + appointment.durationMinutes
    && getAppointmentDepartureMinute(appointment) < item.startMinute + item.durationMinutes);
  if (overlapsExisting) throw new Error('APPOINTMENT_CONFLICT');
  if (state.dayAvailableMinutes < appointment.durationMinutes) throw new Error('DAY_TIME_INSUFFICIENT');
  return { ...state, dayAvailableMinutes: state.dayAvailableMinutes - appointment.durationMinutes };
}

function assertAppointmentSlotAvailable(
  state: GameRuntimeState,
  appointment: GameAppointment,
  excludingId?: string,
): void {
  const end = appointment.startMinute + appointment.durationMinutes;
  const departure = getAppointmentDepartureMinute(appointment);
  const overlapping = state.appointments.some((item) =>
    item.id !== excludingId
    && item.scheduledRound === appointment.scheduledRound
    && ['accepted', 'active'].includes(item.status)
    && departure < item.startMinute + item.durationMinutes
    && end > getAppointmentDepartureMinute(item));
  if (overlapping) throw new Error('APPOINTMENT_TIME_CONFLICT');
}

function assertEveningVisitLimit(state: GameRuntimeState, appointment: GameAppointment, excludingId?: string): void {
  if (appointment.visitType !== 'informal' || appointment.startMinute < 18 * 60) return;
  const alreadyScheduled = state.appointments.some((item) =>
    item.id !== excludingId
    && item.scheduledRound === appointment.scheduledRound
    && item.visitType === 'informal'
    && item.startMinute >= 18 * 60
    && ['accepted', 'active', 'completed'].includes(item.status));
  if (alreadyScheduled) throw new Error('EVENING_VISIT_LIMIT_REACHED');
}

function createAppointmentFromCommand(
  state: GameRuntimeState,
  command: Extract<GameCommand, { type: 'invite' }>,
): { state: GameRuntimeState; appointment: GameAppointment } {
  const { payload } = command;
  const contact = state.npcContacts[payload.npcId];
  if (!contact || contact.status === 'known' || (!contact.hasReplied && contact.status !== 'online')) {
    throw new Error('TWO_WAY_CONTACT_REQUIRED');
  }
  if (!state.unlockedNpcIds.includes(payload.npcId)) throw new Error('NPC_LOCKED');
  if (payload.scheduledRound < state.currentRound) throw new Error('APPOINTMENT_PHASE_INVALID');
  const departureMinute = payload.startMinute;
  const earliestDepartureMinute = payload.scheduledRound === state.currentRound
    ? state.simulatedClockMinutes
    : PROJECT_ONE_DAY_START_MINUTE;
  if (departureMinute < earliestDepartureMinute) {
    throw new Error('APPOINTMENT_TIME_INVALID');
  }
  const rules = PROJECT_ONE_VISIT_RULES[payload.visitType];
  const eveningInformal = payload.visitType === 'informal' && payload.startMinute >= 18 * 60;
  if (eveningInformal) {
    const eveningCount = state.appointments.filter((item) =>
      item.scheduledRound === payload.scheduledRound
      && item.visitType === 'informal'
      && item.startMinute >= 18 * 60
      && ['accepted', 'active', 'completed'].includes(item.status)).length;
    if (eveningCount >= 1) throw new Error('EVENING_VISIT_LIMIT_REACHED');
  }
  const appointmentEnd = payload.startMinute + rules.durationMinutes;
  if (eveningInformal) {
    if (appointmentEnd > PROJECT_ONE_EVENING_END_MINUTE) throw new Error('APPOINTMENT_TIME_INVALID');
  } else if (appointmentEnd > PROJECT_ONE_OVERTIME_END_MINUTE) {
    throw new Error('APPOINTMENT_TIME_INVALID');
  }
  const chance = invitationChance(state, command);
  const accepted = shouldNpcRespond(`${command.commandId}:accepted`, chance);
  const countered = !accepted && shouldNpcRespond(`${command.commandId}:countered`, 65);
  const status: AppointmentStatus = accepted ? 'accepted' : countered ? 'countered' : 'rejected';
  const counteredStartMinute = countered
    ? Math.min(eveningInformal ? PROJECT_ONE_EVENING_END_MINUTE - rules.durationMinutes : PROJECT_ONE_OVERTIME_END_MINUTE - rules.durationMinutes, payload.startMinute + 60)
    : payload.startMinute;
  const conditions = countered
    ? [payload.visitType === 'formal' ? '请先发送议程或案例材料' : '请重新确认合适时间']
    : [];
  const appointment: GameAppointment = {
    id: `appointment:${command.commandId}`,
    npcId: payload.npcId,
    invitationMethod: payload.invitationMethod,
    visitType: payload.visitType,
    venue: payload.venue,
    purpose: payload.purpose,
    scheduledRound: payload.scheduledRound,
    startMinute: counteredStartMinute,
    durationMinutes: rules.durationMinutes,
    maxTurns: rules.maxTurns,
    status,
    conditions,
    reservedMinutes: accepted ? rules.durationMinutes : 0,
    workTopicOpenedBy: null,
    invitationCommandId: command.commandId,
  };
  let next = { ...state, appointments: [...state.appointments, appointment] };
  if (accepted) {
    assertEveningVisitLimit(state, appointment);
    assertAppointmentSlotAvailable(state, appointment);
    next = reserveAppointmentTime(next, appointment);
  }
  next = {
    ...next,
    notifications: [...next.notifications, {
      id: `invite-response:${appointment.id}`,
      npcId: payload.npcId,
      kind: 'appointment',
      title: accepted ? '邀约已接受' : countered ? 'NPC提出改期条件' : '邀约被拒绝',
      body: accepted ? '预约已加入日程。' : conditions[0] ?? '本次邀约未能安排。',
      round: state.currentRound,
      minute: next.simulatedClockMinutes,
      isRead: false,
      targetId: appointment.id,
    }],
  };
  return { state: next, appointment };
}

function prepareForVisit(
  state: GameRuntimeState,
  command: Extract<GameCommand, { type: 'prepare' }>,
): { state: GameRuntimeState; preparation: GamePreparation } {
  const { payload } = command;
  if (!state.unlockedNpcIds.includes(payload.npcId)) throw new Error('NPC_LOCKED');
  if (payload.appointmentId) {
    const appointment = state.appointments.find((item) => item.id === payload.appointmentId);
    if (!appointment || appointment.npcId !== payload.npcId) throw new Error('APPOINTMENT_NOT_FOUND');
  }
  const rule = PROJECT_ONE_PREPARATION_RULES[payload.preparationType];
  const next = consumeGameTime(state, rule.timeMinutes, { pointCost: rule.costPoints });
  const preparation: GamePreparation = {
    id: `preparation:${command.commandId}`,
    npcId: payload.npcId,
    appointmentId: payload.appointmentId ?? null,
    type: payload.preparationType,
    title: payload.title,
    content: payload.content,
    status: 'ready',
    costPoints: rule.costPoints,
    timeMinutes: rule.timeMinutes,
    reusable: rule.reusable,
    usedCount: 0,
    createdRound: state.currentRound,
  };
  return { state: { ...next, preparations: [...next.preparations, preparation], lastAction: payload.preparationType }, preparation };
}

function startVisit(
  state: GameRuntimeState,
  command: Extract<GameCommand, { type: 'start_visit' }>,
): { state: GameRuntimeState; appointment: GameAppointment } {
  if (state.activeMeeting) throw new Error('MEETING_ALREADY_ACTIVE');
  const appointment = state.appointments.find((item) => item.id === command.payload.appointmentId);
  if (!appointment || appointment.status !== 'accepted') throw new Error('APPOINTMENT_NOT_ACCEPTED');
  if (appointment.scheduledRound !== state.currentRound) throw new Error('APPOINTMENT_NOT_TODAY');
  const eveningInformal = appointment.visitType === 'informal' && appointment.startMinute >= 18 * 60;
  if (!eveningInformal && appointment.startMinute + appointment.durationMinutes > PROJECT_ONE_OVERTIME_END_MINUTE) {
    throw new Error('APPOINTMENT_TIME_INVALID');
  }
  const hospitalityCost = getAppointmentHospitalityCost(appointment);
  const travelStartMinute = getAppointmentDepartureMinute(appointment);
  if (state.simulatedClockMinutes > travelStartMinute) throw new Error('APPOINTMENT_MISSED');
  let next = advanceIdleClockTo(state, travelStartMinute, appointment.id);
  if (eveningInformal) {
    const visitCost = hospitalityCost;
    if (next.actionPoints < visitCost) throw new Error('ACTION_POINTS_INSUFFICIENT');
    next = {
      ...next,
      simulatedClockMinutes: travelStartMinute,
      // Once the player leaves for an evening engagement, unused daytime
      // opportunities are gone. The engagement itself remains overtime-exempt.
      dayAvailableMinutes: 0,
      cumulativeTimeMinutes: next.cumulativeTimeMinutes,
      actionPoints: next.actionPoints - visitCost,
      cumulativeSpentPoints: next.cumulativeSpentPoints + visitCost,
    };
  } else {
    if (hospitalityCost > 0) {
      next = consumeGameTime(next, 0, { pointCost: hospitalityCost, ignoreAppointmentId: appointment.id });
    }
  }
  const meetingStartMinute = appointment.startMinute;
  const meetingEndMinute = meetingStartMinute + appointment.durationMinutes;
  if (!eveningInformal && meetingEndMinute > PROJECT_ONE_OVERTIME_END_MINUTE) throw new Error('OVERTIME_LIMIT_EXCEEDED');
  if (eveningInformal && meetingEndMinute > PROJECT_ONE_EVENING_END_MINUTE) throw new Error('APPOINTMENT_TIME_INVALID');
  const meetingOvertimeMinutes = eveningInformal
    ? 0
    : Math.max(0, meetingEndMinute - Math.max(meetingStartMinute, PROJECT_ONE_WORK_END_MINUTE));
  next = chargeOvertimeMinutes({ ...next, simulatedClockMinutes: meetingStartMinute }, meetingOvertimeMinutes);
  const selectedPreparationIds = command.payload.preparationIds ?? [];
  const usable = new Set(next.preparations
    .filter((item) => item.npcId === appointment.npcId && item.status === 'ready')
    .map((item) => item.id));
  if (selectedPreparationIds.some((id) => !usable.has(id))) throw new Error('PREPARATION_NOT_AVAILABLE');
  const activeMeeting: ActiveMeeting = {
    id: `meeting:${appointment.id}`,
    npcId: appointment.npcId,
    actionId: appointment.visitType,
    appointmentId: appointment.id,
    visitType: appointment.visitType,
    turnCount: 0,
    maxTurns: appointment.maxTurns,
    durationMinutes: appointment.durationMinutes,
    startedAt: `round:${state.currentRound}:minute:${next.simulatedClockMinutes}`,
    workTopicOpenedBy: appointment.workTopicOpenedBy,
    usedPreparationIds: selectedPreparationIds,
  };
  return {
    state: {
      ...next,
      appointments: next.appointments.map((item) => item.id === appointment.id ? { ...item, status: 'active' as const } : item),
      preparations: next.preparations.map((item) => selectedPreparationIds.includes(item.id) && item.type !== 'courtesy_gift' && item.type !== 'boundary_gift'
        ? { ...item, usedCount: item.usedCount + 1, status: item.reusable ? 'ready' as const : 'used' as const }
        : item),
      activeMeeting,
      lastAction: `visit:${appointment.visitType}`,
    },
    appointment,
  };
}

function giveGift(
  state: GameRuntimeState,
  command: Extract<GameCommand, { type: 'give_gift' }>,
  trustedEvaluation?: GiftCommandEvaluation,
): {
  state: GameRuntimeState;
  disposition: GiftDisposition;
  risk: ComplianceRiskEvent | null;
  message: string;
  evaluationSource: string;
  reason: string;
} {
  const preparation = state.preparations.find((item) => item.id === command.payload.preparationId);
  if (!preparation || preparation.status !== 'ready' || !['courtesy_gift', 'boundary_gift'].includes(preparation.type)) {
    throw new Error('GIFT_NOT_AVAILABLE');
  }
  const meeting = state.activeMeeting;
  if (!meeting || meeting.npcId !== preparation.npcId) throw new Error('GIFT_REQUIRES_ACTIVE_VISIT');
  if (command.payload.appointmentId && command.payload.appointmentId !== meeting.appointmentId) throw new Error('APPOINTMENT_NOT_ACTIVE');
  let next = state;
  let disposition: GiftDisposition;
  let risk: ComplianceRiskEvent | null = null;
  let message = trustedEvaluation?.npcResponse.trim() ?? '';
  let evaluationSource = trustedEvaluation?.source.trim() || 'deterministic_fallback';
  let decisionReason = trustedEvaluation?.reason.trim() ?? '';
  if (preparation.type === 'courtesy_gift') {
    const preference = getProjectOneNpc(preparation.npcId)?.actionPreferences.gift ?? 0;
    disposition = trustedEvaluation?.disposition ?? (preference < -1 ? 'polite_decline' : 'delighted_acceptance');
    let pleasantnessDelta = clampDelta(trustedEvaluation?.pleasureDelta ?? trustedEvaluation?.pleasantnessDelta ?? (2 + preference), -3, 4);
    let supportDelta = clampDelta(trustedEvaluation?.supportDelta ?? Math.max(0, Math.min(1, preference)), -2, 2);
    if (disposition !== 'delighted_acceptance' && disposition !== 'cautious_acceptance') {
      pleasantnessDelta = Math.min(0, pleasantnessDelta);
      supportDelta = Math.min(0, supportDelta);
    }
    decisionReason ||= disposition === 'polite_decline' ? '人物对商务礼品较为谨慎' : '合规伴手礼与场合匹配';
    message ||= disposition === 'delighted_acceptance' || disposition === 'cautious_acceptance'
      ? '谢谢，这份心意我收下了。'
      : '谢谢，不过这份礼物我不方便收。';
    next = applyNpcAttitudeDelta(next, preparation.npcId, {
      pleasantnessDelta,
      supportDelta,
      reason: decisionReason,
      source: evaluationSource,
    });
  } else {
    const npc = getProjectOneNpc(preparation.npcId);
    if (!npc) throw new Error('NPC_UNKNOWN');
    const priorAccepted = state.complianceRisks.some((item) =>
      item.npcId === preparation.npcId
      && item.kind === 'boundary_gift'
      && (item.outcome === 'delighted_acceptance' || item.outcome === 'cautious_acceptance'));
    const attitude = state.npcAttitudes[preparation.npcId] ?? defaultAttitude();
    const explicitBribe = command.payload.exchangeRequested;
    if (explicitBribe) {
      disposition = 'reported';
      decisionReason = '明确提出利益交换';
      evaluationSource = 'deterministic_compliance_rule';
      message = '这属于不合规的利益交换，我不能接受并会按流程上报。';
    } else if (trustedEvaluation) {
      const assessedAsAccepted = trustedEvaluation.disposition === 'delighted_acceptance'
        || trustedEvaluation.disposition === 'cautious_acceptance';
      disposition = priorAccepted && assessedAsAccepted ? 'firm_rejection' : trustedEvaluation.disposition;
    } else {
      let acceptChance = 55 - npc.complianceSensitivity * 0.4 + (attitude.support - 35) * 0.4;
      if (command.payload.setting === 'private') acceptChance += 10;
      if (command.payload.witnesses.length) acceptChance -= 15;
      if (priorAccepted) acceptChance -= 35;
      const bucketAccepted = !priorAccepted && shouldNpcRespond(`${command.commandId}:gift-accept`, clamp(acceptChance, 5, 70));
      const bucketReport = shouldNpcRespond(`${command.commandId}:gift-report`, clamp(npc.complianceSensitivity * 0.45 + (priorAccepted ? 20 : 0), 10, 75));
      if (bucketAccepted) {
        disposition = shouldNpcRespond(`${command.commandId}:gift-delighted`, 45)
          ? 'delighted_acceptance'
          : 'cautious_acceptance';
      } else if (bucketReport) {
        disposition = 'reported';
      } else {
        disposition = shouldNpcRespond(`${command.commandId}:gift-firm`, 45) ? 'firm_rejection' : 'polite_decline';
      }
    }
    const deltas: Record<GiftDisposition, [number, number]> = {
      delighted_acceptance: [12, 7],
      cautious_acceptance: [5, 3],
      polite_decline: [-2, -1],
      firm_rejection: [-7, -5],
      reported: [-12, -9],
    };
    let [pleasantnessDelta, supportDelta] = trustedEvaluation && !explicitBribe
      ? [
          clampDelta(trustedEvaluation.pleasureDelta ?? trustedEvaluation.pleasantnessDelta ?? 0, -12, 12),
          clampDelta(trustedEvaluation.supportDelta, -10, 7),
        ]
      : deltas[disposition];
    if (disposition !== 'delighted_acceptance' && disposition !== 'cautious_acceptance') {
      pleasantnessDelta = Math.min(0, pleasantnessDelta);
      supportDelta = Math.min(0, supportDelta);
    }
    if (priorAccepted && trustedEvaluation && (trustedEvaluation.disposition === 'delighted_acceptance' || trustedEvaluation.disposition === 'cautious_acceptance')) {
      pleasantnessDelta = Math.min(-5, pleasantnessDelta);
      supportDelta = Math.min(-3, supportDelta);
      decisionReason = '同一人物不能再次接受边界礼品，重复尝试引起警惕';
      message = '之前已经收过一次，这次我不能再接受。';
    }
    decisionReason ||= command.payload.exchangeRequested ? '明确提出利益交换' : `高波动边界礼品：${disposition}`;
    message ||= disposition === 'delighted_acceptance' || disposition === 'cautious_acceptance'
      ? '我明白你的心意，这次收下。'
      : disposition === 'reported' ? '这件事我必须按规定上报。' : '这份礼物我不能接受。';
    next = applyNpcAttitudeDelta(next, preparation.npcId, {
      pleasantnessDelta,
      supportDelta,
      complianceAwarenessDelta: disposition === 'reported' ? 20 : 8,
      reason: decisionReason,
      source: evaluationSource,
      allowBoundaryGiftRange: true,
    });
    const triggered = disposition === 'reported';
    const severity = command.payload.exchangeRequested ? 5
      : trustedEvaluation ? clampDelta(Math.round(trustedEvaluation.severity), 1, 5)
        : disposition === 'cautious_acceptance' ? 5
        : disposition === 'delighted_acceptance' ? 4
          : disposition === 'firm_rejection' ? (priorAccepted ? 4 : 3) : (priorAccepted ? 3 : 2);
    risk = {
      id: `risk:${command.commandId}`,
      npcId: preparation.npcId,
      preparationId: preparation.id,
      kind: command.payload.exchangeRequested ? 'explicit_bribe' : 'boundary_gift',
      severity,
      status: triggered ? 'triggered' : 'latent',
      penalty: command.payload.exchangeRequested ? 20 : severity * 3,
      reason: command.payload.exchangeRequested
        ? '明确回扣或利益交换已被记录'
        : trustedEvaluation?.riskReason.trim() || '边界礼品可能在后续审计或转述中暴露',
      createdRound: state.currentRound,
      triggerRound: triggered ? state.currentRound : null,
      outcome: disposition,
    };
    next = { ...next, complianceRisks: [...next.complianceRisks, risk] };
  }
  return {
    state: {
      ...next,
      preparations: next.preparations.map((item) => item.id === preparation.id
        ? { ...item, status: 'used' as const, usedCount: item.usedCount + 1 }
        : item),
      activeMeeting: next.activeMeeting ? {
        ...next.activeMeeting,
        usedPreparationIds: Array.from(new Set([...next.activeMeeting.usedPreparationIds, preparation.id])),
      } : null,
    },
    disposition,
    risk,
    message,
    evaluationSource,
    reason: decisionReason,
  };
}

function markProcessed(state: GameRuntimeState, commandId: string): GameRuntimeState {
  return { ...state, processedCommandIds: [...state.processedCommandIds, commandId].slice(-200) };
}

/**
 * Unified pure command reducer. Persistence/version increments remain the
 * repository's responsibility; this function validates expectedVersion.
 */
export function executeGameCommand(
  stateInput: GameRuntimeState,
  command: GameCommand,
  options: ExecuteGameCommandOptions = {},
): ExecuteGameCommandResult {
  let state = normalizeProjectOneState(stateInput);
  if (state.processedCommandIds.includes(command.commandId)) {
    return { state, result: { duplicate: true }, eventType: 'command.duplicate', eventPayload: { commandId: command.commandId } };
  }
  if (command.expectedVersion !== state.version) throw new Error('STATE_VERSION_CONFLICT');
  if (state.status !== 'playing' && command.type !== 'mark_notification_read') throw new Error('GAME_ALREADY_FINISHED');
  if (state.activeMeeting && !['end_visit', 'give_gift', 'follow_up', 'mark_notification_read'].includes(command.type)) {
    throw new Error('MEETING_ALREADY_ACTIVE');
  }

  let result: Record<string, unknown> = {};
  let eventType = `game.${command.type}`;
  let eventPayload: Record<string, unknown> = { commandId: command.commandId };

  switch (command.type) {
    case 'contact': {
      if (!state.unlockedNpcIds.includes(command.payload.npcId)) throw new Error('NPC_LOCKED');
      state = consumeCommunicationTime(state, command.payload.channel);
      state = connectNpc(recordNpcOutbound(state, command.payload.npcId), command.payload.npcId);
      result = { npcId: command.payload.npcId, channel: command.payload.channel };
      eventType = 'contact.completed';
      break;
    }
    case 'invite': {
      state = consumeCommunicationTime(state, command.payload.channel);
      const created = createAppointmentFromCommand(state, command);
      state = created.state;
      result = { appointment: created.appointment };
      eventType = `appointment.${created.appointment.status}`;
      eventPayload = { ...eventPayload, appointmentId: created.appointment.id, status: created.appointment.status };
      break;
    }
    case 'update_appointment': {
      const appointment = state.appointments.find((item) => item.id === command.payload.appointmentId);
      if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');
      if (command.payload.action === 'cancel') {
        if (!['accepted', 'countered', 'pending'].includes(appointment.status)) throw new Error('APPOINTMENT_CANNOT_CHANGE');
        state = {
          ...state,
          dayAvailableMinutes: appointment.status === 'accepted' && appointment.scheduledRound === state.currentRound
            ? Math.min(PROJECT_ONE_STANDARD_DAY_MINUTES, state.dayAvailableMinutes + appointment.reservedMinutes)
            : state.dayAvailableMinutes,
          appointments: state.appointments.map((item) => item.id === appointment.id
            ? { ...item, status: 'cancelled' as const, reservedMinutes: 0 }
            : item),
        };
      } else {
        if (appointment.status !== 'countered') throw new Error('APPOINTMENT_NOT_COUNTERED');
        const accepted = { ...appointment, status: 'accepted' as const, reservedMinutes: appointment.durationMinutes };
        assertEveningVisitLimit(state, accepted, appointment.id);
        assertAppointmentSlotAvailable(state, accepted, appointment.id);
        state = reserveAppointmentTime({
          ...state,
          appointments: state.appointments.map((item) => item.id === appointment.id ? accepted : item),
        }, accepted);
      }
      result = { appointment: state.appointments.find((item) => item.id === appointment.id) };
      eventType = command.payload.action === 'cancel' ? 'appointment.cancelled' : 'appointment.accepted';
      break;
    }
    case 'prepare': {
      const prepared = prepareForVisit(state, command);
      state = prepared.state;
      result = { preparation: prepared.preparation };
      eventType = 'preparation.completed';
      eventPayload = { ...eventPayload, preparationId: prepared.preparation.id, type: prepared.preparation.type };
      break;
    }
    case 'start_visit': {
      const started = startVisit(state, command);
      state = started.state;
      result = { appointment: started.appointment, meeting: state.activeMeeting };
      eventType = 'visit.started';
      eventPayload = { ...eventPayload, appointmentId: started.appointment.id, visitType: started.appointment.visitType };
      break;
    }
    case 'end_visit': {
      if (!state.activeMeeting) throw new Error('MEETING_NOT_ACTIVE');
      if (command.payload.appointmentId && command.payload.appointmentId !== state.activeMeeting.appointmentId) throw new Error('APPOINTMENT_NOT_ACTIVE');
      if (command.payload.meetingId && command.payload.meetingId !== state.activeMeeting.id) throw new Error('MEETING_NOT_ACTIVE');
      const meeting = state.activeMeeting;
      state = completeMeeting(state, command.payload.reason, command.payload.summary);
      result = {
        appointmentId: meeting.appointmentId,
        summary: command.payload.summary,
        minutes: state.meetingMinutes.find((item) => item.appointmentId === meeting.appointmentId),
      };
      eventType = 'visit.completed';
      eventPayload = { ...eventPayload, appointmentId: meeting.appointmentId, reason: command.payload.reason, summary: command.payload.summary };
      break;
    }
    case 'give_gift': {
      const gift = giveGift(state, command, options.giftEvaluation);
      state = gift.state;
      result = {
        disposition: gift.disposition,
        riskId: gift.risk?.id ?? null,
        message: gift.message,
        evaluationSource: gift.evaluationSource,
      };
      eventType = 'gift.delivered';
      eventPayload = {
        ...eventPayload,
        preparationId: command.payload.preparationId,
        disposition: gift.disposition,
        riskId: gift.risk?.id ?? null,
        reason: gift.reason,
        source: gift.evaluationSource,
      };
      break;
    }
    case 'follow_up': {
      const payload = command.payload;
      if (!state.unlockedNpcIds.includes(payload.npcId)) throw new Error('NPC_LOCKED');
      if (payload.action === 'deliver_preparation') {
        if (!state.activeMeeting || state.activeMeeting.npcId !== payload.npcId) throw new Error('MEETING_NOT_ACTIVE');
        if (payload.appointmentId && payload.appointmentId !== state.activeMeeting.appointmentId) throw new Error('APPOINTMENT_NOT_ACTIVE');
        const preparation = state.preparations.find((item) => item.id === payload.preparationId);
        if (!preparation || preparation.npcId !== payload.npcId || preparation.status !== 'ready' || preparation.type.endsWith('gift')) {
          throw new Error('PREPARATION_NOT_AVAILABLE');
        }
        state = {
          ...state,
          preparations: state.preparations.map((item) => item.id === preparation.id
            ? { ...item, usedCount: item.usedCount + 1, status: item.reusable ? 'ready' as const : 'used' as const }
            : item),
          activeMeeting: {
            ...state.activeMeeting,
            usedPreparationIds: Array.from(new Set([...state.activeMeeting.usedPreparationIds, preparation.id])),
          },
        };
        result = { npcId: payload.npcId, preparationIds: [preparation.id], deliveredDuringVisit: true };
        eventType = 'preparation.delivered';
        break;
      }
      const selected = state.preparations.filter((item) => payload.preparationIds.includes(item.id));
      if (selected.length !== payload.preparationIds.length || selected.some((item) => item.npcId !== payload.npcId || item.status !== 'ready' || item.type.endsWith('gift'))) {
        throw new Error('PREPARATION_NOT_AVAILABLE');
      }
      state = consumeCommunicationTime(state, payload.channel);
      state = recordNpcOutbound(state, payload.npcId);
      state = {
        ...state,
        preparations: state.preparations.map((item) => payload.preparationIds.includes(item.id)
          ? { ...item, usedCount: item.usedCount + 1, status: item.reusable ? 'ready' as const : 'used' as const }
          : item),
      };
      result = { npcId: payload.npcId, preparationIds: payload.preparationIds };
      eventType = 'follow_up.sent';
      break;
    }
    case 'wait': {
      state = advanceClockWithoutInvestment(state, command.payload.minutes);
      result = { simulatedClockMinutes: state.simulatedClockMinutes };
      eventType = 'time.waited';
      break;
    }
    case 'advance_phase': {
      const fromRound = state.currentRound;
      state = advanceRound(state);
      result = { fromRound, toRound: state.currentRound, status: state.status, outcome: state.status === 'playing' ? null : getGameOutcome(state) };
      eventType = state.status === 'playing' ? 'phase.advanced' : 'session.finished';
      break;
    }
    case 'submit': {
      state = submitGame(state);
      result = { status: state.status, outcome: getGameOutcome(state) };
      eventType = 'session.submitted';
      break;
    }
    case 'mark_notification_read': {
      const exists = state.notifications.some((item) => item.id === command.payload.notificationId);
      if (!exists) throw new Error('NOTIFICATION_NOT_FOUND');
      state = {
        ...state,
        notifications: state.notifications.map((item) => item.id === command.payload.notificationId ? { ...item, isRead: true } : item),
      };
      result = { notificationId: command.payload.notificationId };
      eventType = 'notification.read';
      break;
    }
  }

  state = markProcessed(state, command.commandId);
  return { state, result, eventType, eventPayload };
}
