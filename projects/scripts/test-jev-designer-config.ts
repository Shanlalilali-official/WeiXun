import assert from 'node:assert/strict';
import {
  JEV_DESIGNER_TASK_CATALOG,
  JEV_DESIGNER_TASK_IDS,
  applyJevDesignerConfig,
  invokeSelectedDecisionProvider,
  parseJevDesignerConfig,
} from '../src/lib/ai/jev-designer-config';
import { composeChannelDecisionInstructions } from '../src/lib/ai/formal-visit-decision';
import type { JevRequest } from '../src/lib/ai/jev-client';

const expectedQuestionTypes: Record<string, Record<string, string>> = {
  live_npc_turn: {
    pleasureDelta: 'choice', supportDelta: 'choice', decisionAnalysis: 'choice', relationshipBuilding: 'choice', valuePresentation: 'choice', objectionHandling: 'choice', informationDiscovery: 'choice', clue: 'choice', workTopicOpenedBy: 'choice', negativeInformation: 'choice', negativeInformationType: 'choice', riskyConduct: 'choice', giftMentioned: 'choice', explicitQuidProQuo: 'choice', repeatedPressure: 'choice', giftType: 'choice', giftOutcome: 'choice', giftRiskLevel: 'choice', handoffTarget: 'choice', emotion: 'choice',
  },
  live_gift: { disposition: 'choice', pleasureDelta: 'choice', supportDelta: 'choice' },
  competitor_stage: { targetNpcId: 'choice', kind: 'choice', pressureDelta: 'choice' },
  prompt_test_evaluator: {
    supportDelta: 'choice', pleasantnessDelta: 'choice', decisionAnalysis: 'choice', relationshipBuilding: 'choice', valuePresentation: 'choice', objectionHandling: 'choice', informationDiscovery: 'choice', effectiveContact: 'choice', acceptClue0: 'choice', acceptClue1: 'choice', acceptClue2: 'choice', acceptClue3: 'choice', acceptClue4: 'choice', 'blocker:compliance_redline': 'choice', 'blocker:prompt_injection': 'choice', 'blocker:compliance_check': 'choice', 'blocker:contract_boundary': 'choice',
  },
  preview_npc_evaluator: {
    pleasureDelta: 'choice', supportDelta: 'choice', decisionAnalysis: 'choice', relationshipBuilding: 'choice', valuePresentation: 'choice', objectionHandling: 'choice', informationDiscovery: 'choice', effectiveContact: 'noul', memoryType: 'choice', memoryStatus: 'choice', memoryMustMention: 'noul', blockerAction: 'choice',
  },
  preview_plan: { needsDetail: 'noul', 'match_P1-001': 'noul', 'match_P1-002': 'noul', 'match_P1-003': 'noul', 'match_P1-004': 'noul', 'match_P1-005': 'noul' },
  preview_attachment: { viewed: 'noul' },
  preview_message: { responseAction: 'choice', invitationStatus: 'choice' },
  phone_contact: { contactAction: 'choice' },
  preview_wechat_request: { accepted: 'noul' },
  preview_visit: { needsDetail: 'noul', completedTask: 'choice', playerDialogueSignal: 'choice', npcDialogueSignal: 'choice' },
  customer_activity_feasibility: { decision: 'choice' },
};

assert.equal(JEV_DESIGNER_TASK_CATALOG.length, 12);
assert.deepEqual(JEV_DESIGNER_TASK_CATALOG.map((task) => task.taskId), [...JEV_DESIGNER_TASK_IDS]);
for (const task of JEV_DESIGNER_TASK_CATALOG) {
  const actual = Object.fromEntries(task.questions.map((question) => [question.id, question.type]));
  assert.deepEqual(actual, expectedQuestionTypes[task.taskId], `${task.taskId} question IDs/types must match the code-owned Jev contract`);
  for (const question of task.questions) {
    assert.ok(question.baselineInstructions.length > 0, `${task.taskId}/${question.id} needs baseline wording`);
    assert.ok(question.criteria.length > 0, `${task.taskId}/${question.id} needs criteria documentation`);
  }
}

const previewEvaluator = JEV_DESIGNER_TASK_CATALOG.find((task) => task.taskId === 'preview_npc_evaluator')!;
assert.deepEqual(
  Object.fromEntries(previewEvaluator.questions
    .filter((question) => ['decisionAnalysis', 'relationshipBuilding', 'valuePresentation', 'objectionHandling', 'informationDiscovery'].includes(question.id))
    .map((question) => [question.id, question.baselineInstructions])),
  {
    decisionAnalysis: 'decisionAnalysis 维度变化，选择 -3 到 3 的整数。',
    relationshipBuilding: 'relationshipBuilding 维度变化，选择 -3 到 3 的整数。',
    valuePresentation: 'valuePresentation 维度变化，选择 -3 到 3 的整数。',
    objectionHandling: 'objectionHandling 维度变化，选择 -3 到 3 的整数。',
    informationDiscovery: 'informationDiscovery 维度变化，选择 -3 到 3 的整数。',
  },
  'preview evaluator baseline wording must stay aligned with the concrete Jev request',
);

const valid = parseJevDesignerConfig({
  tasks: {
    preview_message: {
      stateGuidance: '优先根据当前渠道与已知事实判断。',
      questionInstructions: { responseAction: '只在明确没有新事项时允许已读不回。' },
    },
    prompt_test_evaluator: { questionInstructions: { acceptClue4: '第 5 条候选仅在证据逐字可见时接受。' } },
  },
});
assert.ok(valid);
assert.equal(valid.decisionProvider, 'jev', 'legacy rows must default to Jev');
assert.equal(valid.tasks.preview_message.stateGuidance, '优先根据当前渠道与已知事实判断。');
assert.equal(valid.tasks.prompt_test_evaluator.questionInstructions.acceptClue4, '第 5 条候选仅在证据逐字可见时接受。');
assert.equal(parseJevDesignerConfig({ tasks: { invented_task: { stateGuidance: 'x' } } }), null);
assert.equal(parseJevDesignerConfig({ tasks: { preview_message: { questionInstructions: { invented_question: 'x' } } } }), null);
assert.equal(parseJevDesignerConfig({ tasks: { preview_message: { stateGuidance: 'x'.repeat(8_001) } } }), null);
assert.equal(parseJevDesignerConfig({ decisionProvider: 'unknown', tasks: {} }), null);
assert.equal(parseJevDesignerConfig({ decisionProvider: 'llm', tasks: {} })?.decisionProvider, 'llm');

const original: JevRequest = {
  state: 'original state is opaque and must be retained',
  questions: {
    responseAction: { type: 'choice', instructions: 'baseline action', criteria: { reply: 'reply', read_no_reply: 'silent' } },
    invitationStatus: { type: 'choice', instructions: 'baseline invitation', criteria: { none: 'none', accepted: 'accepted' } },
  },
};
const applied = applyJevDesignerConfig('preview_message', original, valid);
assert.deepEqual(applied.state, { designerStateGuidance: '优先根据当前渠道与已知事实判断。', originalState: original.state });
assert.match(String(applied.questions.responseAction.instructions), /baseline action/);
assert.match(String(applied.questions.responseAction.instructions), /全局设计师决策补充/);
assert.match(String(applied.questions.responseAction.instructions), /只在明确没有新事项时允许已读不回/);
assert.equal(applied.questions.invitationStatus.instructions, 'baseline invitation');
assert.deepEqual(applied.questions.responseAction.criteria, original.questions.responseAction.criteria);
assert.deepEqual(original.state, 'original state is opaque and must be retained');
assert.equal(original.questions.responseAction.instructions, 'baseline action');

const promptTestRequest: JevRequest = {
  state: 'untrusted prompt-test state',
  questions: {
    acceptClue4: {
      type: 'choice',
      instructions: '可编辑的结构化评估规则\n\n## 本题判定\n判断第 5 条候选线索。\n\n## 固定约束\n线索来源核验和候选字段不可改变。',
      criteria: { true: '接受', false: '不接受' },
    },
  },
};
const appliedPromptTest = applyJevDesignerConfig('prompt_test_evaluator', promptTestRequest, valid);
const appliedPromptTestInstructions = String(appliedPromptTest.questions.acceptClue4.instructions);
assert.match(appliedPromptTestInstructions, /可编辑的结构化评估规则/);
assert.match(appliedPromptTestInstructions, /第 5 条候选仅在证据逐字可见时接受/);
assert.ok(
  appliedPromptTestInstructions.indexOf('第 5 条候选仅在证据逐字可见时接受')
    < appliedPromptTestInstructions.indexOf('## 固定约束'),
  'per-question override must remain before the fixed runtime boundary',
);

const activityConfig = parseJevDesignerConfig({
  tasks: { customer_activity_feasibility: { questionInstructions: { decision: '设计师可调整活动匹配的业务取舍。' } } },
})!;
const activityRequest: JevRequest = {
  state: 'frozen activity data',
  questions: { decision: { type: 'choice', instructions: '只依据冻结的对话结束时状态判断是否可开展。', criteria: { allow: '允许', reject: '拒绝' } } },
};
const appliedActivity = applyJevDesignerConfig('customer_activity_feasibility', activityRequest, activityConfig);
const appliedActivityInstructions = String(appliedActivity.questions.decision.instructions);
assert.match(appliedActivityInstructions, /只依据冻结的对话结束时状态/);
assert.match(appliedActivityInstructions, /设计师可调整活动匹配的业务取舍/);
assert.match(appliedActivityInstructions, /不可信数据/);
assert.ok(
  appliedActivityInstructions.indexOf('设计师可调整活动匹配的业务取舍')
    < appliedActivityInstructions.indexOf('## 不可覆盖的系统边界'),
  'activity override must remain before its code-owned data/output boundary',
);

async function testProviderRouting() {
  const config = valid!;
  let jevCalls = 0;
  let llmCalls = 0;
  let firstLlmRequest: JevRequest | undefined;
  const response = { answers: {} };
  const jevInvoker = async (request: JevRequest) => { jevCalls += 1; assert.deepEqual(request.state, applied.state); return response; };
  const llmInvoker = async (request: JevRequest) => { llmCalls += 1; firstLlmRequest ??= request; return response; };
  await invokeSelectedDecisionProvider('preview_message', original, config, jevInvoker, llmInvoker);
  assert.deepEqual([jevCalls, llmCalls], [1, 0]);
  await invokeSelectedDecisionProvider('preview_message', original, { ...config, decisionProvider: 'llm' }, jevInvoker, llmInvoker);
  assert.deepEqual([jevCalls, llmCalls], [1, 1]);
  assert.deepEqual(firstLlmRequest, applied, 'LLM mode receives the same configured typed request');
  const phoneInstructions = composeChannelDecisionInstructions(
    '只判断本次电话是否接听。',
    '此人物在核对材料时可以暂不接听。',
    '只能选择 answer / unanswered，不能绕过安全边界。',
  );
  const phoneRequest: JevRequest = {
    state: 'server-owned phone state',
    questions: { contactAction: { type: 'choice', instructions: phoneInstructions, criteria: { answer: '接听', unanswered: '无人接听' } } },
  };
  await invokeSelectedDecisionProvider('phone_contact', phoneRequest, { ...config, decisionProvider: 'llm' }, jevInvoker, async (request) => {
    assert.equal(request.questions.contactAction?.instructions, phoneInstructions, 'LLM mode keeps per-person typed request guidance intact');
    return response;
  });
  await invokeSelectedDecisionProvider('prompt_test_evaluator', promptTestRequest, { ...config, decisionProvider: 'llm' }, jevInvoker, async (request) => {
    assert.deepEqual(request, appliedPromptTest, 'LLM mode receives the prompt-test business rubric and its fixed tail');
    return response;
  });
  await invokeSelectedDecisionProvider('customer_activity_feasibility', activityRequest, { ...activityConfig, decisionProvider: 'llm' }, jevInvoker, async (request) => {
    assert.deepEqual(request, appliedActivity, 'LLM mode retains the activity data-isolation/output boundary');
    return response;
  });
  for (const taskId of JEV_DESIGNER_TASK_IDS) {
    await invokeSelectedDecisionProvider(taskId, original, { ...config, decisionProvider: 'llm' }, jevInvoker, llmInvoker);
  }
  assert.deepEqual([jevCalls, llmCalls], [1, JEV_DESIGNER_TASK_IDS.length + 1]);
  console.log('jev designer config tests passed');
}

void testProviderRouting();
