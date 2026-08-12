import type { NpcTurnEvaluation } from '@/lib/contracts/ai';
import {
  PROJECT_ONE_CODE,
  PROJECT_ONE_INITIAL_ACTION_POINTS,
  PROJECT_ONE_MAX_ROUNDS,
  PROJECT_ONE_NPCS,
  getProjectOneNpc,
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

export interface ConversationMemory {
  summary: string;
  summarizedMessageCount: number;
  confirmedFacts?: string[];
  commitments?: string[];
}

export interface GameRuntimeState {
  scenarioCode: string;
  progressionMultiplier: number;
  currentRound: number;
  maxRounds: number;
  actionPoints: number;
  status: 'playing' | 'won' | 'lost';
  dimensions: GameDimensions;
  npcAffinity: Record<string, number>;
  unlockedNpcIds: string[];
  unlockedClues: ProjectOneClue[];
  conversationMemories: Record<string, ConversationMemory>;
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

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function deriveUnlockedNpcIds(
  unlockedClues: ProjectOneClue[],
): string[] {
  const next = PROJECT_ONE_NPCS.filter((npc) => npc.initiallyVisible).map((npc) => npc.id);
  if (unlockedClues.includes('key_contact')) {
    next.push('p1-minister-chen-jianguo');
  }
  return next;
}

export function normalizeProjectOneState(state: GameRuntimeState): GameRuntimeState {
  return {
    ...state,
    progressionMultiplier: state.progressionMultiplier ?? 1,
    unlockedNpcIds: deriveUnlockedNpcIds(state.unlockedClues),
  };
}

export function explicitlyRevealsMinister(replyContent: string): boolean {
  if (!replyContent.includes('陈建国')) return false;
  return /业务部.{0,8}陈建国.{0,4}部长|陈建国.{0,6}(业务部)?部长|陈部长|业务部部长/.test(replyContent);
}

export function reconcileNarrativeDiscoveries(state: GameRuntimeState, assistantReplies: string[]): GameRuntimeState {
  if (state.unlockedClues.includes('key_contact') || !assistantReplies.some(explicitlyRevealsMinister)) return state;
  const unlockedClues = [...state.unlockedClues, 'key_contact' as const];
  return { ...state, unlockedClues, unlockedNpcIds: deriveUnlockedNpcIds(unlockedClues) };
}

export function createProjectOneState(progressionMultiplier = 1): GameRuntimeState {
  return {
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
    lastAction: null,
    version: 1,
  };
}

export function calculateTotalScore(dimensions: GameDimensions): number {
  const total = GAME_DIMENSIONS.reduce((sum, key) => sum + dimensions[key], 0);
  return Math.round(total / GAME_DIMENSIONS.length);
}

export function applyNpcEvaluation(
  state: GameRuntimeState,
  npcId: string,
  evaluation: NpcTurnEvaluation,
  replyContent = '',
): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (!state.unlockedNpcIds.includes(npcId)) throw new Error('NPC_LOCKED');

  const dimensions = { ...state.dimensions };
  for (const key of GAME_DIMENSIONS) {
    dimensions[key] = clamp(dimensions[key] + evaluation.dimensionDeltas[key] * state.progressionMultiplier);
  }

  const npcAffinity = {
    ...state.npcAffinity,
    [npcId]: clamp((state.npcAffinity[npcId] ?? 35) + evaluation.affinityDelta * state.progressionMultiplier),
  };
  const acceptedClues: ProjectOneClue[] = evaluation.cluesUnlocked.filter(
    (clue) => clue !== 'personal_interest' || npcAffinity[npcId] >= 50,
  );
  if (explicitlyRevealsMinister(replyContent)) acceptedClues.push('key_contact');
  const unlockedClues = Array.from(new Set([...state.unlockedClues, ...acceptedClues]));
  const unlockedNpcIds = deriveUnlockedNpcIds(unlockedClues);
  const memory = state.conversationMemories[npcId] ?? { summary: '', summarizedMessageCount: 0 };
  const confirmedFacts = Array.from(new Set([...(memory.confirmedFacts ?? []), ...evaluation.confirmedFacts])).slice(-12);
  const commitments = Array.from(new Set([...(memory.commitments ?? []), ...evaluation.commitments])).slice(-12);
  const conversationMemories = {
    ...state.conversationMemories,
    [npcId]: { ...memory, confirmedFacts, commitments },
  };

  return { ...state, dimensions, npcAffinity, unlockedClues, unlockedNpcIds, conversationMemories };
}

export function applyRelationshipAction(
  state: GameRuntimeState,
  npcId: string,
  actionId: string,
): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (!state.unlockedNpcIds.includes(npcId)) throw new Error('NPC_LOCKED');
  const action = RELATIONSHIP_ACTIONS[actionId];
  if (!action) throw new Error('ACTION_UNKNOWN');
  if (state.actionPoints < action.cost) throw new Error('ACTION_POINTS_INSUFFICIENT');

  const effect = getRelationshipActionEffect(npcId, actionId, state.progressionMultiplier);
  const npcAffinity = {
    ...state.npcAffinity,
    [npcId]: clamp((state.npcAffinity[npcId] ?? 35) + effect.totalAffinityDelta),
  };

  return {
    ...state,
    actionPoints: state.actionPoints - action.cost,
    npcAffinity,
    unlockedNpcIds: deriveUnlockedNpcIds(state.unlockedClues),
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

export function advanceRound(state: GameRuntimeState): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (state.currentRound < state.maxRounds) {
    return { ...state, currentRound: state.currentRound + 1, lastAction: null };
  }

  const totalScore = calculateTotalScore(state.dimensions);
  const hasDecisionClue = state.unlockedClues.includes('decision_process');
  const keyAffinity = state.npcAffinity['p1-minister-chen-jianguo'] ?? 0;
  const won = totalScore >= 60 && hasDecisionClue && keyAffinity >= 45;
  return { ...state, status: won ? 'won' : 'lost', lastAction: null };
}
