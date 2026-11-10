import assert from 'node:assert/strict';
import { npcRuntimeRulePrompts } from '../src/lib/ai/runtime-rule-prompts-npc';

const expectedIds = [
  'live_npc_evidence_narrative',
  'live_npc_evaluator_legacy_guidance',
  'live_gift_explanation',
  'competitor_stage_narrative',
  'prompt_test_npc_business',
  'prompt_test_npc_repair',
  'prompt_test_acceptance_high',
  'prompt_test_acceptance_middle',
  'prompt_test_acceptance_low',
  'prompt_test_conversation_stages',
  'prompt_test_evaluator_narrative',
  'prompt_test_evaluator_legacy_guidance',
  'prompt_test_structured_evaluation_rule',
] as const;

assert.deepEqual(Object.keys(npcRuntimeRulePrompts), expectedIds);
for (const id of expectedIds) {
  const rule = npcRuntimeRulePrompts[id];
  assert.ok(rule.label.trim(), `${id} requires a designer label`);
  assert.ok(rule.group.trim(), `${id} requires a group`);
  assert.ok(rule.description.trim(), `${id} requires a description`);
  assert.ok(rule.defaultText.trim(), `${id} requires active default wording`);
  assert.ok(rule.boundary.trim(), `${id} requires immutable boundary wording`);
}
assert.match(npcRuntimeRulePrompts.live_npc_evidence_narrative.boundary, /不得改变/);
assert.match(npcRuntimeRulePrompts.competitor_stage_narrative.boundary, /绝不能选择或改写/);
assert.match(npcRuntimeRulePrompts.prompt_test_evaluator_narrative.boundary, /结构化决策/);

console.log('npc runtime rule prompt catalog tests passed');
