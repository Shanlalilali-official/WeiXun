import assert from 'node:assert/strict';
import {
  clearCompetitorStageDecisionCache,
  evaluateCompetitorStageAction,
  type CompetitorStageInvoker,
} from '../src/lib/ai/competitor-stage';
import type { JevInvoker } from '../src/lib/ai/jev-client';
import {
  createProjectOneState,
  executeGameCommand,
  isCompetitorStageActionCandidate,
  toPlayerVisibleGameState,
  type CompetitorStageActionCandidate,
} from '../src/lib/game/state';

const validCandidate: CompetitorStageActionCandidate = {
  round: 1,
  targetNpcId: 'P1-004',
  kind: 'relationship',
  title: '竞品强化一线关系',
  summary: '竞品尝试利用既有合作经验争取一线反馈。',
  pressureDelta: 4,
};

const json = (value: unknown) => JSON.stringify(value);
const competitorJev: JevInvoker = async () => ({
  answers: {
    targetNpcId: { type: 'choice', choice: 'P1-004', probabilities: {}, confidence: 1 },
    kind: { type: 'choice', choice: 'relationship', probabilities: {}, confidence: 1 },
    pressureDelta: { type: 'choice', choice: '4', probabilities: {}, confidence: 1 },
  },
});
const command = (commandId: string) => ({
  commandId,
  expectedVersion: 1,
  type: 'advance_phase' as const,
  payload: {},
});

async function main() {
  const state = createProjectOneState();
  let invocations = 0;
  const validInvoker: CompetitorStageInvoker = async () => {
    invocations += 1;
    // LLM may try to supply state fields, but only its prose is consumed.
    return json({ ...validCandidate, targetNpcId: 'P1-001', kind: 'price', pressureDelta: 1 });
  };

  clearCompetitorStageDecisionCache();
  const generated = await evaluateCompetitorStageAction({
  sessionId: 'competitor-ai-idempotent',
  state,
  invoker: validInvoker,
  jevInvoker: competitorJev,
});
  const cached = await evaluateCompetitorStageAction({
  sessionId: 'competitor-ai-idempotent',
  state,
  invoker: validInvoker,
  jevInvoker: competitorJev,
});
assert.equal(generated.source, 'model');
assert.deepEqual(generated.candidate, validCandidate);
assert.equal(generated.candidate?.targetNpcId, 'P1-004', 'Jev decision wins over LLM-supplied target');
assert.equal(generated.candidate?.pressureDelta, 4, 'Jev choice controls persisted pressure');
assert.equal(cached.source, 'cached', 'the same session/stage reuses one decision');
assert.equal(invocations, 1, 'same-stage retries do not invoke the model twice');
assert.equal(isCompetitorStageActionCandidate(generated.candidate, 1), true);

const applied = executeGameCommand(state, command('competitor-ai-apply'), {
  competitorStageAction: generated.candidate,
  competitorStageSource: 'model',
});
const appliedAction = applied.state.competitorState.actions[0];
assert.equal(appliedAction?.summary, validCandidate.summary);
assert.equal(appliedAction?.targetNpcId, validCandidate.targetNpcId);
assert.equal(appliedAction?.pressureDelta, validCandidate.pressureDelta);
assert.equal(applied.eventPayload.competitorActionSource, 'model');
assert.equal('competitorAction' in applied.result, false, 'player result never exposes the action record');
assert.equal(toPlayerVisibleGameState(applied.state).competitorState.actions.length, 0);
assert.equal(applied.state.npcAttitudes[validCandidate.targetNpcId].support, 27, 'support impact is derived by the reducer');

  clearCompetitorStageDecisionCache();
  let invalidInvocations = 0;
  const invalidInvoker: CompetitorStageInvoker = async () => {
    invalidInvocations += 1;
    return json({ ...validCandidate, round: 2, pressureDelta: 99 });
  };
  const invalid = await evaluateCompetitorStageAction({
  sessionId: 'competitor-ai-invalid',
  state,
  invoker: invalidInvoker,
  jevInvoker: competitorJev,
});
assert.deepEqual(invalid.candidate, validCandidate, 'invalid LLM prose falls back without replacing Jev choice');
assert.equal(invalid.source, 'model');
assert.equal(invalidInvocations, 1);
const fallback = executeGameCommand(state, command('competitor-ai-fallback'));
assert.equal(fallback.state.competitorState.actions[0]?.title, '竞品正在接触项目执行人员');
assert.equal(fallback.eventPayload.competitorActionSource, 'fallback');

  let multiplayerInvocations = 0;
  const multiplayer = await evaluateCompetitorStageAction({
  sessionId: 'competitor-ai-multiplayer',
  state: { ...state, gameMode: 'multiplayer' },
  invoker: async () => {
    multiplayerInvocations += 1;
    return json(validCandidate);
  },
  jevInvoker: competitorJev,
});
assert.equal(multiplayer.source, 'existing');
assert.equal(multiplayer.validationErrors[0], 'MULTIPLAYER_DEFERRED');
assert.equal(multiplayerInvocations, 0, 'multiplayer stage transitions do not call solo competitor AI');

  clearCompetitorStageDecisionCache();
  console.log('competitor stage AI contracts passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
