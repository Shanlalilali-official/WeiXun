import assert from 'node:assert/strict';
import {
  advanceRound,
  applyNpcEvaluation,
  applyRelationshipAction,
  calculateTotalScore,
  createProjectOneState,
  getRelationshipActionEffect,
  reconcileNarrativeDiscoveries,
  type GameRuntimeState,
} from '../src/lib/game/state';
import type { NpcTurnEvaluation } from '../src/lib/contracts/ai';

function evaluation(overrides: Partial<NpcTurnEvaluation>): NpcTurnEvaluation {
  return {
    affinityDelta: 0,
    dimensionDeltas: {
      decisionAnalysis: 0,
      relationshipBuilding: 0,
      valuePresentation: 0,
      objectionHandling: 0,
      informationDiscovery: 0,
    },
    cluesUnlocked: [],
    confirmedFacts: [],
    commitments: [],
    handoff: null,
    emotion: 'thinking',
    ...overrides,
  };
}

const initial = createProjectOneState();
assert.equal(initial.maxRounds, 5);
assert.equal(initial.actionPoints, 28);
assert.equal(initial.unlockedNpcIds.length, 3);
assert.equal(initial.unlockedNpcIds.includes('p1-minister-chen-jianguo'), false);

const afterAction = applyRelationshipAction(initial, 'p1-frontline-wang-hao', 'tea');
assert.equal(afterAction.actionPoints, 22);
assert.equal(afterAction.npcAffinity['p1-frontline-wang-hao'], 41);
assert.equal(initial.actionPoints, 28, 'reducer must not mutate input state');
assert.deepEqual(getRelationshipActionEffect('p1-frontline-wang-hao', 'tea'), {
  baseAffinityDelta: 4,
  preferenceAffinityDelta: 2,
  totalAffinityDelta: 6,
});
assert.deepEqual(getRelationshipActionEffect('p1-deputy-zhao-feng', 'gift'), {
  baseAffinityDelta: 3,
  preferenceAffinityDelta: -3,
  totalAffinityDelta: 0,
});

let relationshipUnlocked = initial;
for (let index = 0; index < 8; index += 1) {
  relationshipUnlocked = applyRelationshipAction(
    relationshipUnlocked,
    'p1-frontline-wang-hao',
    'festival',
  );
}
assert.equal(relationshipUnlocked.npcAffinity['p1-frontline-wang-hao'], 59);
assert.equal(relationshipUnlocked.unlockedNpcIds.includes('p1-minister-chen-jianguo'), false);

assert.throws(
  () => applyRelationshipAction({ ...initial, actionPoints: 0 }, 'p1-frontline-wang-hao', 'gift'),
  /ACTION_POINTS_INSUFFICIENT/,
);

const evaluated = applyNpcEvaluation(initial, 'p1-frontline-wang-hao', evaluation({
  affinityDelta: 8,
  dimensionDeltas: {
    decisionAnalysis: 3,
    relationshipBuilding: 2,
    valuePresentation: 1,
    objectionHandling: 0,
    informationDiscovery: 3,
  },
  cluesUnlocked: ['decision_process'],
  confirmedFacts: ['技术方案与商务报价分别评审'],
  commitments: ['下周三安排方案演示'],
  emotion: 'excited',
}));
assert.equal(evaluated.unlockedNpcIds.includes('p1-minister-chen-jianguo'), false);
assert.equal(evaluated.dimensions.decisionAnalysis, 53);
assert.deepEqual(evaluated.conversationMemories['p1-frontline-wang-hao']?.confirmedFacts, ['技术方案与商务报价分别评审']);
assert.deepEqual(evaluated.conversationMemories['p1-frontline-wang-hao']?.commitments, ['下周三安排方案演示']);

const explicitlyRevealed = applyNpcEvaluation(relationshipUnlocked, 'p1-frontline-wang-hao', evaluation({
  affinityDelta: 0,
  dimensionDeltas: {
    decisionAnalysis: 0,
    relationshipBuilding: 0,
    valuePresentation: 0,
    objectionHandling: 0,
    informationDiscovery: 0,
  },
  cluesUnlocked: ['decision_process'],
  emotion: 'thinking',
}), '业务评估先找业务部部长陈建国，他汇总意见后再往上报。');
assert.equal(explicitlyRevealed.unlockedClues.includes('key_contact'), true);
assert.equal(explicitlyRevealed.unlockedNpcIds.includes('p1-minister-chen-jianguo'), true);

const legacyPhraseReconciled = reconcileNarrativeDiscoveries(relationshipUnlocked, [
  '涉及内部决策链我得先跟业务部陈建国部长汇报。',
]);
assert.equal(legacyPhraseReconciled.unlockedClues.includes('key_contact'), true);
assert.equal(legacyPhraseReconciled.unlockedNpcIds.includes('p1-minister-chen-jianguo'), true);

const prematurePersonalClue = applyNpcEvaluation(initial, 'p1-frontline-wang-hao', evaluation({
  affinityDelta: 0,
  dimensionDeltas: {
    decisionAnalysis: 0,
    relationshipBuilding: 0,
    valuePresentation: 0,
    objectionHandling: 0,
    informationDiscovery: 0,
  },
  cluesUnlocked: ['personal_interest'],
  emotion: 'thinking',
}));
assert.equal(prematurePersonalClue.unlockedClues.includes('personal_interest'), false);

let losingState = initial;
for (let index = 0; index < 4; index += 1) losingState = advanceRound(losingState);
assert.equal(losingState.currentRound, 5);
assert.equal(losingState.status, 'playing');
losingState = advanceRound(losingState);
assert.equal(losingState.status, 'lost');

let winningState: GameRuntimeState = {
  ...explicitlyRevealed,
  dimensions: {
    decisionAnalysis: 70,
    relationshipBuilding: 70,
    valuePresentation: 70,
    objectionHandling: 70,
    informationDiscovery: 70,
  },
  npcAffinity: { ...explicitlyRevealed.npcAffinity, 'p1-minister-chen-jianguo': 50 },
  currentRound: 5,
};
winningState = advanceRound(winningState);
assert.equal(winningState.status, 'won');
assert.equal(calculateTotalScore(winningState.dimensions), 70);

console.log('game-state tests passed');
