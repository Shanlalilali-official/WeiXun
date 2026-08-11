import type { NpcTurnEvaluation } from '@/lib/contracts/ai';
import {
  PROJECT_ONE_CODE,
  PROJECT_ONE_INITIAL_ACTION_POINTS,
  PROJECT_ONE_MAX_ROUNDS,
  PROJECT_ONE_NPCS,
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
}

export interface GameRuntimeState {
  scenarioCode: string;
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

export function createProjectOneState(): GameRuntimeState {
  return {
    scenarioCode: PROJECT_ONE_CODE,
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
): GameRuntimeState {
  if (state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
  if (!state.unlockedNpcIds.includes(npcId)) throw new Error('NPC_LOCKED');

  const dimensions = { ...state.dimensions };
  for (const key of GAME_DIMENSIONS) {
    dimensions[key] = clamp(dimensions[key] + evaluation.dimensionDeltas[key]);
  }

  const npcAffinity = {
    ...state.npcAffinity,
    [npcId]: clamp((state.npcAffinity[npcId] ?? 35) + evaluation.affinityDelta),
  };
  const acceptedClues = evaluation.cluesUnlocked.filter(
    (clue) => clue !== 'personal_interest' || npcAffinity[npcId] >= 50,
  );
  const unlockedClues = Array.from(new Set([...state.unlockedClues, ...acceptedClues]));
  const unlockedNpcIds = [...state.unlockedNpcIds];
  const shouldUnlockMinister =
    unlockedClues.includes('decision_process') ||
    Object.values(npcAffinity).some((affinity) => affinity >= 50);
  if (shouldUnlockMinister && !unlockedNpcIds.includes('p1-minister-chen-jianguo')) {
    unlockedNpcIds.push('p1-minister-chen-jianguo');
  }

  return { ...state, dimensions, npcAffinity, unlockedClues, unlockedNpcIds };
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

  return {
    ...state,
    actionPoints: state.actionPoints - action.cost,
    npcAffinity: {
      ...state.npcAffinity,
      [npcId]: clamp((state.npcAffinity[npcId] ?? 35) + action.affinityGain),
    },
    lastAction: actionId,
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
