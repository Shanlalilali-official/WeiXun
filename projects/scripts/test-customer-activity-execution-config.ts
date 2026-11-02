import assert from 'node:assert/strict';
import {
  activityExecutionConfigSchema,
  DEFAULT_ACTIVITY_EXECUTION_CONFIG,
  resolveActivityExecutionConfig,
  withActivityExecutionProvider,
} from '@/lib/game/customer-activity-execution-config';
import { createCustomerActivityQuiz } from '@/lib/game/customer-activity-quiz';

const parsedDefault = activityExecutionConfigSchema.parse(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
assert.equal(parsedDefault.quizDurationSeconds, 120);
assert.equal(parsedDefault.evaluationProvider, 'llm', 'new execution settings use the LLM evaluation provider by default');
assert.deepEqual(Object.keys(parsedDefault.questionBanks).sort(), [
  'case_site_visit', 'company_visit', 'hospitality', 'technical_meeting',
]);
for (const bank of Object.values(parsedDefault.questionBanks)) {
  assert.equal(bank.length, 3);
  for (const question of bank) assert.equal(question.options.length, 4);
}

const resolved = resolveActivityExecutionConfig();
assert.deepEqual(resolved, DEFAULT_ACTIVITY_EXECUTION_CONFIG, 'missing execution settings resolve to the default rubric and question banks');
assert.notStrictEqual(resolved, DEFAULT_ACTIVITY_EXECUTION_CONFIG);
assert.notStrictEqual(resolved.questionBanks, DEFAULT_ACTIVITY_EXECUTION_CONFIG.questionBanks);
resolved.questionBanks.technical_meeting[0].title = 'local clone';
assert.notEqual(DEFAULT_ACTIVITY_EXECUTION_CONFIG.questionBanks.technical_meeting[0].title, 'local clone',
  'resolved settings are a deep clone of shared defaults');
assert.throws(() => resolveActivityExecutionConfig(null as never),
  'explicit null is invalid and cannot silently reset to defaults');

const legacyExecution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG) as unknown as Record<string, unknown>;
delete legacyExecution.evaluationProvider;
assert.equal(resolveActivityExecutionConfig(legacyExecution).evaluationProvider, 'llm',
  'old explicitly stored execution settings without a provider normalize to LLM');

for (const provider of ['llm', 'jev'] as const) {
  const withProvider = { ...structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG), evaluationProvider: provider };
  assert.equal(activityExecutionConfigSchema.parse(withProvider).evaluationProvider, provider,
    `${provider} evaluation provider parses and round-trips`);
}
const invalidProvider = { ...structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG), evaluationProvider: 'other' };
assert.equal(activityExecutionConfigSchema.safeParse(invalidProvider).success, false,
  'unknown evaluation providers are rejected');

const providerToggleSource = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
providerToggleSource.questionBanks.technical_meeting[0].title = '保留的题库内容';
providerToggleSource.weights = { plan: 0.65, quiz: 0.35 };
const toggledToJev = withActivityExecutionProvider(providerToggleSource, 'jev');
assert.equal(toggledToJev.evaluationProvider, 'jev');
assert.strictEqual(toggledToJev.questionBanks, providerToggleSource.questionBanks,
  'switching provider keeps the existing question bank');
assert.strictEqual(toggledToJev.weights, providerToggleSource.weights,
  'switching provider keeps the existing evaluation weights');

const invalidDuration = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
invalidDuration.quizDurationSeconds = 29;
assert.equal(activityExecutionConfigSchema.safeParse(invalidDuration).success, false);
const invalidOptionCount = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
(invalidOptionCount.questionBanks.hospitality[0].options as unknown[]).push({
  id: 'extra', text: 'extra', supportDelta: 0, pleasureDelta: 0,
});
assert.equal(activityExecutionConfigSchema.safeParse(invalidOptionCount).success, false);
const duplicateQuestionId = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
duplicateQuestionId.questionBanks.case_site_visit[0].id = duplicateQuestionId.questionBanks.technical_meeting[0].id;
assert.equal(activityExecutionConfigSchema.safeParse(duplicateQuestionId).success, false);
const duplicateOptionId = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
duplicateOptionId.questionBanks.hospitality[0].options[1].id = duplicateOptionId.questionBanks.hospitality[0].options[0].id;
assert.equal(activityExecutionConfigSchema.safeParse(duplicateOptionId).success, false);
for (const reservedId of ['__proto__', 'constructor', 'prototype']) {
  const reservedQuestion = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  reservedQuestion.questionBanks.technical_meeting[0].id = reservedId;
  assert.equal(activityExecutionConfigSchema.safeParse(reservedQuestion).success, false,
    'a configurable question ID must be safe for the persisted answer dictionary');
}
const customQuestionIds = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
customQuestionIds.questionBanks.technical_meeting[0].id = 'custom-technical-question';
const acceptedConfig = activityExecutionConfigSchema.parse(customQuestionIds);
const generatedQuiz = createCustomerActivityQuiz('technical_meeting', 1_000, '核对需求。', 'config-contract-test', acceptedConfig);
assert.equal(generatedQuiz.answers['custom-technical-question'], null,
  'a validated customized question bank can create an actual answerable quiz');
assert.equal(generatedQuiz.questions[0].title, acceptedConfig.questionBanks.technical_meeting[0].title);
const invalidWeightPrecision = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
invalidWeightPrecision.weights.plan = 0.333;
assert.equal(activityExecutionConfigSchema.safeParse(invalidWeightPrecision).success, false);
const zeroWeights = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
zeroWeights.weights = { plan: 0, quiz: 0 };
assert.equal(activityExecutionConfigSchema.safeParse(zeroWeights).success, false);
const invalidBounds = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
invalidBounds.limits.dimensionMax = 4;
assert.equal(activityExecutionConfigSchema.safeParse(invalidBounds).success, false);
const emptyInstructions = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
emptyInstructions.aiInstructions = '   ';
assert.equal(activityExecutionConfigSchema.safeParse(emptyInstructions).success, false);

const noReplacement = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
noReplacement.hospitalityNonAlcoholQuestion = null;
assert.equal(activityExecutionConfigSchema.safeParse(noReplacement).success, true,
  'null explicitly disables the no-alcohol replacement question');

console.log('Customer activity execution config defaults, deep cloning and validation passed.');
