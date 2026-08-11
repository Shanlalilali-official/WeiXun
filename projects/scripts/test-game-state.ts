import assert from 'node:assert/strict';
import {
  advanceRound,
  applyNpcEvaluation,
  applyRelationshipAction,
  calculateTotalScore,
  createProjectOneState,
  type GameRuntimeState,
} from '../src/lib/game/state';

const initial = createProjectOneState();
assert.equal(initial.maxRounds, 5);
assert.equal(initial.actionPoints, 28);
assert.equal(initial.unlockedNpcIds.length, 3);
assert.equal(initial.unlockedNpcIds.includes('p1-minister-chen-jianguo'), false);

const afterAction = applyRelationshipAction(initial, 'p1-frontline-wang-hao', 'tea');
assert.equal(afterAction.actionPoints, 22);
assert.equal(afterAction.npcAffinity['p1-frontline-wang-hao'], 39);
assert.equal(initial.actionPoints, 28, 'reducer must not mutate input state');

let relationshipUnlocked = initial;
for (let index = 0; index < 8; index += 1) {
  relationshipUnlocked = applyRelationshipAction(
    relationshipUnlocked,
    'p1-frontline-wang-hao',
    'festival',
  );
}
assert.equal(relationshipUnlocked.npcAffinity['p1-frontline-wang-hao'], 51);
assert.equal(relationshipUnlocked.unlockedNpcIds.includes('p1-minister-chen-jianguo'), true);

assert.throws(
  () => applyRelationshipAction({ ...initial, actionPoints: 0 }, 'p1-frontline-wang-hao', 'gift'),
  /ACTION_POINTS_INSUFFICIENT/,
);

const evaluated = applyNpcEvaluation(initial, 'p1-frontline-wang-hao', {
  affinityDelta: 8,
  dimensionDeltas: {
    decisionAnalysis: 3,
    relationshipBuilding: 2,
    valuePresentation: 1,
    objectionHandling: 0,
    informationDiscovery: 3,
  },
  cluesUnlocked: ['decision_process'],
  emotion: 'excited',
});
assert.equal(evaluated.unlockedNpcIds.includes('p1-minister-chen-jianguo'), true);
assert.equal(evaluated.dimensions.decisionAnalysis, 53);

const prematurePersonalClue = applyNpcEvaluation(initial, 'p1-frontline-wang-hao', {
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
});
assert.equal(prematurePersonalClue.unlockedClues.includes('personal_interest'), false);

let losingState = initial;
for (let index = 0; index < 4; index += 1) losingState = advanceRound(losingState);
assert.equal(losingState.currentRound, 5);
assert.equal(losingState.status, 'playing');
losingState = advanceRound(losingState);
assert.equal(losingState.status, 'lost');

let winningState: GameRuntimeState = {
  ...evaluated,
  dimensions: {
    decisionAnalysis: 70,
    relationshipBuilding: 70,
    valuePresentation: 70,
    objectionHandling: 70,
    informationDiscovery: 70,
  },
  npcAffinity: { ...evaluated.npcAffinity, 'p1-minister-chen-jianguo': 50 },
  currentRound: 5,
};
winningState = advanceRound(winningState);
assert.equal(winningState.status, 'won');
assert.equal(calculateTotalScore(winningState.dimensions), 70);

console.log('game-state tests passed');
