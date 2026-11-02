import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerActivityExecutionEditor } from '../src/components/designer/customer-activity-execution-editor';
import { HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD } from '../src/lib/game/customer-activities';
import {
  DEFAULT_ACTIVITY_EXECUTION_CONFIG,
  activityExecutionConfigSchema,
} from '../src/lib/game/customer-activity-execution-config';
import { parseCustomerActivityDecisionConfigWrite } from '../src/lib/designer/customer-activity-decision-form';

const validExecution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
assert.equal(activityExecutionConfigSchema.safeParse(validExecution).success, true);

const parsedWrite = parseCustomerActivityDecisionConfigWrite({
  mode: 'ai',
  thresholds: { hospitality: HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD },
  execution: validExecution,
});
assert.ok(parsedWrite, 'the actual designer form parser accepts a complete execution config');
assert.deepEqual(parsedWrite.execution, validExecution, 'the parser preserves the edited execution config');

const zeroWeights = structuredClone(validExecution);
zeroWeights.weights = { plan: 0, quiz: 0 };
assert.equal(parseCustomerActivityDecisionConfigWrite({
  mode: 'ai',
  thresholds: { hospitality: HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD },
  execution: zeroWeights,
}), null, 'the actual write parser rejects two disabled evaluation weights');

const badAnswerDelta = structuredClone(validExecution);
badAnswerDelta.questionBanks.technical_meeting[0].options[0].supportDelta = -6;
assert.equal(parseCustomerActivityDecisionConfigWrite({
  mode: 'ai',
  thresholds: { hospitality: HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD },
  execution: badAnswerDelta,
}), null, 'the actual write parser rejects answer deltas outside the schema limits');

const blankNumberValue = structuredClone(validExecution);
blankNumberValue.quizDurationSeconds = Number.NaN;
assert.equal(parseCustomerActivityDecisionConfigWrite({
  mode: 'ai',
  thresholds: { hospitality: HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD },
  execution: blankNumberValue,
}), null, 'the actual write parser blocks blank numeric fields propagated as NaN');

const legacyWrite = parseCustomerActivityDecisionConfigWrite({
  mode: 'ai',
  thresholds: { hospitality: HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD },
});
assert.ok(legacyWrite, 'legacy writes without execution remain accepted');
assert.equal(Object.hasOwn(legacyWrite, 'execution'), false, 'legacy writes do not fabricate execution values in the form parser');

const questionMarkup = renderToStaticMarkup(createElement(CustomerActivityExecutionEditor, {
  tab: 'questions',
  value: validExecution,
  disabled: false,
  onChange: () => undefined,
}));
assert.equal((questionMarkup.match(/aria-label="技术交流会第 \d 题题干"/g) ?? []).length, 3, 'the real question editor renders all three default questions');
assert.match(questionMarkup, /问答时限/);
assert.match(questionMarkup, /aria-label="技术交流会第 1 题选项 1文字"/);

const evaluationMarkup = renderToStaticMarkup(createElement(CustomerActivityExecutionEditor, {
  tab: 'evaluation',
  value: validExecution,
  disabled: true,
  onChange: () => undefined,
}));
assert.match(evaluationMarkup, /方案评价指引/);
assert.match(evaluationMarkup, /disabled=""/);
assert.match(evaluationMarkup, /固定的准备不足负向影响/);
assert.equal((evaluationMarkup.match(/type="radio"/g) ?? []).length, 2,
  'the evaluation editor renders exactly the LLM and Jev choices');
assert.match(evaluationMarkup, /type="radio" disabled=""[^>]*checked=""[^>]*value="llm"/,
  'LLM is selected and the provider input is disabled while the editor is loading or saving');
assert.match(evaluationMarkup, /type="radio" disabled=""[^>]*value="jev"/,
  'Jev remains visible and disabled while the editor is loading or saving');
assert.match(evaluationMarkup, /当前项目配置的模型/);
assert.match(evaluationMarkup, /独立于全局匹配决策模式/);
assert.match(evaluationMarkup, /共用下方的评价指引、数值边界和方案\/问答权重/);
assert.match(evaluationMarkup, /保留为待评价状态/);
assert.match(evaluationMarkup, /不会自动改用 LLM/);

const jevExecution = { ...validExecution, evaluationProvider: 'jev' as const };
const jevEvaluationMarkup = renderToStaticMarkup(createElement(CustomerActivityExecutionEditor, {
  tab: 'evaluation',
  value: jevExecution,
  disabled: false,
  onChange: () => undefined,
}));
assert.match(jevEvaluationMarkup, /type="radio"[^>]*checked=""[^>]*value="jev"/,
  'loading a saved Jev setting selects the Jev option');

const page = readFileSync(resolve(process.cwd(), 'src/app/designer/customer-activities/page.tsx'), 'utf8');
const editor = readFileSync(resolve(process.cwd(), 'src/components/designer/customer-activity-execution-editor.tsx'), 'utf8');
const designerHome = readFileSync(resolve(process.cwd(), 'src/app/designer/page.tsx'), 'utf8');

for (const tabLabel of ['匹配门槛', '情境问答', 'AI 评价与结算']) {
  assert.ok(page.includes(tabLabel), `the real settings page exposes the ${tabLabel} tab`);
}
assert.ok(page.includes('execution: saved.execution'), 'recommended threshold drafts preserve execution edits from the loaded config');
assert.ok(page.includes('execution: form.execution'), 'the page submits complete execution values in the same save');
assert.ok(page.includes('|| !executionConfigValid'), 'the page prevents saving if any execution number field is invalid');
assert.ok(page.includes('resolveActivityExecutionConfig(config.execution)'), 'legacy rows without execution values hydrate with configured defaults');
assert.ok(page.includes('已开始或已匹配的活动沿用创建时的配置快照'), 'the page explains that active activities keep their snapshots');
for (const capability of ['问答时限', '无酒精替代情境题', '方案评价指引', '方案评价引擎', 'withActivityExecutionProvider(value, provider)', '合并后的结果重复应用', '固定的准备不足负向影响', 'onChange(Number.NaN)', 'maxLength={8000}']) {
  assert.ok(editor.includes(capability), `the real editor contains ${capability}`);
}
assert.ok(designerHome.includes('情境问答题库'), 'the designer home card advertises the new activity configuration');

console.log('Customer activity execution designer UI checks passed.');
