import assert from 'node:assert/strict';
import {
  DEFAULT_NPC_SUPPORT_TIER_THRESHOLDS,
  DEFAULT_PROJECT_ONE_PROMPT_CONFIG,
  normalizeNpcRolePrompt,
  normalizeProjectOnePromptConfig,
  npcSupportTierThresholdsSchema,
} from '../src/lib/designer/prompt-config';
import {
  PROJECT_ONE_CHANNEL_MODIFIERS,
  PROJECT_ONE_FIVE_PERSON_IDS,
} from '../src/lib/designer/project-one-five-person';
import { mergeEditablePromptConfig } from '../src/app/api/designer/prompt-config/route';

const current = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
current.liveCustomerPrompt = 'server live prompt';
current.promptLayers = { protected: 'server layer' };
current.channelModifiers = { protected: 'server channel' };
current.liveEvaluatorPrompt = 'server live evaluator';
current.previewEvaluatorPrompt = 'server preview evaluator';
current.promptTestNpcPrompt = {
  ...current.promptTestNpcPrompt,
  additionalInstructions: 'server test prompt',
};
current.promptTestEvaluatorPrompt = 'server test evaluator';
current.npcRolePrompts['unknown-person'] = 'stale value';
current.npcChannelExceptions['unknown-person'] = { email: 'stale value' };
current.npcChannelExceptions['P1-001']['unknown-channel'] = 'stale value';
current.npcChannelDecisionPrompts['P1-001'].email = 'server email decision';

const requested = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
requested.liveCustomerPrompt = 'client must not replace this';
requested.promptLayers = { client: 'client layer' };
requested.channelModifiers = { client: 'client channel' };
requested.liveEvaluatorPrompt = 'client evaluator';
requested.previewEvaluatorPrompt = 'client preview evaluator';
requested.promptTestNpcPrompt.additionalInstructions = 'client test prompt';
requested.promptTestEvaluatorPrompt = 'client test evaluator';
requested.supportTierThresholds = { mediumMin: 40, highMin: 80 };
requested.npcRolePrompts['P1-001'] = '';
requested.npcRolePrompts['unknown-person'] = 'must not persist';
requested.npcChannelExceptions['P1-001'] = Object.fromEntries(
  Object.keys(PROJECT_ONE_CHANNEL_MODIFIERS).map((channelId) => [channelId, '']),
);
requested.npcChannelExceptions['unknown-person'] = { email: 'must not persist' };
requested.npcChannelExceptions['P1-001']['unknown-channel'] = 'must not persist';
requested.npcChannelDecisionPrompts['P1-001'].email = 'client email decision';
requested.npcChannelDecisionPrompts['P1-001'].work_phone = 'client phone decision';

const merged = mergeEditablePromptConfig(current, requested);

assert.equal(merged.liveCustomerPrompt, 'server live prompt');
assert.deepEqual(merged.promptLayers, { protected: 'server layer' });
assert.deepEqual(merged.channelModifiers, { protected: 'server channel' });
assert.equal(merged.liveEvaluatorPrompt, 'server live evaluator');
assert.equal(merged.previewEvaluatorPrompt, 'server preview evaluator');
assert.equal(merged.promptTestNpcPrompt.additionalInstructions, 'server test prompt');
assert.equal(merged.promptTestEvaluatorPrompt, 'server test evaluator');
assert.deepEqual(merged.supportTierThresholds, { mediumMin: 40, highMin: 80 });
assert.equal(merged.npcRolePrompts['P1-001'], '');
assert.equal(merged.npcRolePrompts['unknown-person'], undefined);
assert.deepEqual(Object.keys(merged.npcRolePrompts).sort(), [...PROJECT_ONE_FIVE_PERSON_IDS].sort());
assert.equal(merged.npcChannelExceptions['P1-001']['unknown-channel'], undefined);
assert.equal(merged.npcChannelExceptions['unknown-person'], undefined);
assert.deepEqual(
  Object.keys(merged.npcChannelExceptions['P1-001']).sort(),
  Object.keys(PROJECT_ONE_CHANNEL_MODIFIERS).sort(),
);
assert.ok(Object.values(merged.npcChannelExceptions['P1-001']).every((value) => value === ''));
assert.equal(merged.npcChannelDecisionPrompts['P1-001'].email, 'client email decision');
assert.equal(merged.npcChannelDecisionPrompts['P1-001'].work_phone, 'client phone decision');

const narrowSave = mergeEditablePromptConfig(current, {
  npcChannelExceptions: { 'P1-001': { email: 'old client email prose' } },
});
assert.equal(narrowSave.npcChannelExceptions['P1-001'].email, 'old client email prose');
assert.equal(narrowSave.npcChannelDecisionPrompts['P1-001'].email, 'server email decision', 'an old narrow save keeps new decision guidance');

const legacyConfig = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG) as Record<string, unknown>;
delete legacyConfig.supportTierThresholds;
legacyConfig.liveCustomerPrompt = 'legacy live prompt must remain';
const normalizedLegacy = normalizeProjectOnePromptConfig(legacyConfig);
assert.equal(normalizedLegacy.liveCustomerPrompt, 'legacy live prompt must remain');
assert.deepEqual(normalizedLegacy.supportTierThresholds, DEFAULT_NPC_SUPPORT_TIER_THRESHOLDS);
const narrowLegacy = { npcChannelExceptions: { 'P1-001': { email: '只保留这封邮件的历史设置。' } } };
const normalizedNarrowLegacy = normalizeProjectOnePromptConfig(narrowLegacy);
assert.equal(normalizedNarrowLegacy.npcChannelExceptions['P1-001'].email, '只保留这封邮件的历史设置。');
assert.equal(normalizeNpcRolePrompt(normalizedNarrowLegacy.npcRolePrompts['P1-001']).base, normalizeNpcRolePrompt(DEFAULT_PROJECT_ONE_PROMPT_CONFIG.npcRolePrompts['P1-001']).base);
assert.equal(npcSupportTierThresholdsSchema.safeParse({ mediumMin: 40, highMin: 40 }).success, false);
assert.equal(npcSupportTierThresholdsSchema.safeParse({ mediumMin: 40.5, highMin: 80 }).success, false);

console.log('prompt config edit scope tests passed');
