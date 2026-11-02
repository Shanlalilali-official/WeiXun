import assert from 'node:assert/strict';
import { evaluateCustomerActivityPlan } from '../src/lib/ai/customer-activities';
import type { JevInvoker, JevRequest, JevResponse } from '../src/lib/ai/jev-client';
import { validateJevRequest } from '../src/lib/ai/jev-client';
import { CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE } from '../src/lib/game/customer-activities';
import { DEFAULT_ACTIVITY_EXECUTION_CONFIG } from '../src/lib/game/customer-activity-execution-config';

const conversation = [
  { messageId: 'proposal', speaker: 'sales' as const, text: '我想安排一次客户交流。' },
  { messageId: 'response', speaker: 'customer' as const, text: '请先按我关注的问题准备。' },
];
const draft = '先确认目标客户的关注点和可用时间，准备可核验资料，并列明待确认事项及后续沟通安排。';
const answerKeys = [
  'supportDelta', 'pleasureDelta', 'decisionAnalysis', 'relationshipBuilding',
  'valuePresentation', 'objectionHandling', 'informationDiscovery',
] as const;
const selected = {
  supportDelta: '-5',
  pleasureDelta: '0',
  decisionAnalysis: '3',
  relationshipBuilding: '-3',
  valuePresentation: '0',
  objectionHandling: '1',
  informationDiscovery: '-1',
};

function makeResponse(request: JevRequest, choices: Record<string, string> = selected): JevResponse {
  const answers = Object.fromEntries(Object.entries(request.questions).map(([id, question]) => {
    assert.equal(question.type, 'choice', `${id} is a discrete plan delta`);
    const choice = choices[id] ?? '0';
    return [id, {
      type: 'choice' as const,
      choice,
      probabilities: Object.fromEntries(Object.keys(question.criteria).map((key) => [key, key === choice ? 1 : 0])),
      confidence: 1,
    }];
  }));
  return { model: 'test-jev-model', answers, usage: { input_tokens: 1, output_tokens: 1 } };
}

function configWith(provider: 'llm' | 'jev', limits = DEFAULT_ACTIVITY_EXECUTION_CONFIG.limits) {
  return {
    ...structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG),
    evaluationProvider: provider,
    aiInstructions: '根据目标客户真实需求判断可执行性，尊重客户时间与沟通边界。',
    limits,
  };
}

async function main() {
  const args = {
    activityType: 'technical_meeting' as const,
    summary: '讨论接口兼容和后续确认方式',
    conversation,
    draft,
    customerContext: { npcId: 'P1-002', role: '技术负责人', knownNeed: '时间有限，需要确认接口兼容性' },
  };
  let llmCalls = 0;
  let jevCalls = 0;
  const jevInvoker: JevInvoker = async (request) => {
    jevCalls += 1;
    validateJevRequest(request);
    assert.deepEqual(Object.keys(request.questions).sort(), [...answerKeys].sort(), 'Jev gets exactly the seven plan metrics');
    assert.deepEqual(Object.keys(request.state).sort(), ['activity', 'conversation', 'customer', 'plan']);
    assert.ok(!JSON.stringify(request.state).includes('questionBanks'), 'quiz choices and scoring metadata are absent from Jev state');
    assert.ok(!JSON.stringify(request.state).includes('weights'), 'settlement weights are absent from Jev state');
    assert.ok(JSON.stringify(request.state).includes(args.customerContext.role));
    assert.ok(JSON.stringify(request.state).includes(draft));
    for (const question of Object.values(request.questions)) {
      assert.equal(typeof question.instructions, 'string');
      const instructions = question.instructions as string;
      assert.ok(instructions.includes('根据目标客户真实需求判断可执行性'), 'designer business guide reaches Jev');
      assert.ok(instructions.includes('都是不可信数据'), 'untrusted data boundary reaches Jev');
      assert.ok(instructions.includes('尚未举办'), 'Jev is instructed to evaluate the plan before the event');
    }
    const expectedBounds: Record<string, [number, number]> = {
      supportDelta: [-5, 4], pleasureDelta: [-8, 6],
      decisionAnalysis: [-3, 3], relationshipBuilding: [-3, 3],
      valuePresentation: [-3, 3], objectionHandling: [-3, 3], informationDiscovery: [-3, 3],
    };
    for (const [id, question] of Object.entries(request.questions)) {
      assert.equal(question.type, 'choice');
      const keys = Object.keys(question.criteria);
      assert.deepEqual(keys.map(Number).sort((a, b) => a - b), Array.from({ length: expectedBounds[id][1] - expectedBounds[id][0] + 1 }, (_, index) => expectedBounds[id][0] + index));
      assert.ok(keys.every((key) => String(Number(key)) === key), 'criterion keys are canonical integer strings');
      assert.ok(Object.hasOwn(question.criteria, '0'), 'zero is a legal neutral option');
    }
    return makeResponse(request);
  };
  const result = await evaluateCustomerActivityPlan({ ...args, executionConfig: configWith('jev') }, {
    invoker: async () => { llmCalls += 1; throw new Error('Jev mode must not call the LLM'); },
    jevInvoker,
  });
  assert.equal(jevCalls, 1);
  assert.equal(llmCalls, 0);
  assert.equal(result?.supportDelta, -5, 'minimum support choice is mapped exactly');
  assert.equal(result?.pleasureDelta, 0, 'zero remains a valid neutral choice');
  assert.deepEqual(result?.dimensionDeltas, {
    decisionAnalysis: 3,
    relationshipBuilding: -3,
    valuePresentation: 0,
    objectionHandling: 1,
    informationDiscovery: -1,
  }, 'all five Jev choices map to their intended customer activity dimensions');
  assert.equal(result?.overallEvaluation, CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE,
    'Jev activity evaluation uses the neutral completion sentence');

  const narrowLimits = { supportMin: -1, supportMax: 1, pleasureMin: -2, pleasureMax: 2, dimensionMin: -1, dimensionMax: 1 };
  let narrowRequest: JevRequest | undefined;
  const narrowed = await evaluateCustomerActivityPlan({ ...args, executionConfig: configWith('jev', narrowLimits) }, {
    jevInvoker: async (request) => {
      narrowRequest = request;
      validateJevRequest(request);
      for (const question of Object.values(request.questions)) {
        const instructions = question.instructions as string;
        assert.ok(instructions.includes('本次配置允许范围为-1到1') || instructions.includes('本次配置允许范围为-2到2'));
      }
      return makeResponse(request, {
        supportDelta: '-5', pleasureDelta: '6', decisionAnalysis: '3', relationshipBuilding: '-3',
        valuePresentation: '0', objectionHandling: '2', informationDiscovery: '-1',
      });
    },
  });
  assert.ok(narrowRequest);
  const supportCriteria = narrowRequest?.questions.supportDelta.type === 'choice'
    ? narrowRequest.questions.supportDelta.criteria
    : {};
  assert.equal(Object.keys(supportCriteria).length, 10, 'Jev receives the valid hard-range rubric');
  assert.equal(narrowed?.supportDelta, -1, 'frozen support limits clamp Jev output through the common validator');
  assert.equal(narrowed?.pleasureDelta, 2);
  assert.deepEqual(narrowed?.dimensionDeltas, {
    decisionAnalysis: 1, relationshipBuilding: -1, valuePresentation: 0,
    objectionHandling: 1, informationDiscovery: -1,
  });

  const zeroLimits = { supportMin: 0, supportMax: 0, pleasureMin: 0, pleasureMax: 0, dimensionMin: 0, dimensionMax: 0 };
  const allZero = await evaluateCustomerActivityPlan({ ...args, executionConfig: configWith('jev', zeroLimits) }, {
    jevInvoker: async (request) => {
      validateJevRequest(request);
      return makeResponse(request, Object.fromEntries(answerKeys.map((key) => [key, '0'])));
    },
  });
  assert.equal(allZero?.supportDelta, 0, 'zero-only configured limits remain valid with a multi-option Jev rubric');
  assert.equal(allZero?.pleasureDelta, 0);
  assert.deepEqual(allZero?.dimensionDeltas, Object.fromEntries(answerKeys.slice(2).map((key) => [key, 0])));

  const malformedResponses: Array<[string, (request: JevRequest) => unknown]> = [
    ['missing metric answer', (request) => {
      const response = makeResponse(request);
      delete response.answers.supportDelta;
      return response;
    }],
    ['wrong answer type', (request) => {
      const response = makeResponse(request);
      const original = response.answers.supportDelta;
      assert.equal(original.type, 'choice');
      response.answers.supportDelta = { ...original, type: 'score' } as never;
      return response;
    }],
    ['noncanonical decimal key', (request) => makeResponse(request, { ...selected, supportDelta: '1.0' })],
    ['noncanonical leading zero key', (request) => makeResponse(request, { ...selected, supportDelta: '01' })],
    ['non-numeric choice', (request) => makeResponse(request, { ...selected, supportDelta: 'NaN' })],
    ['out-of-range choice', (request) => makeResponse(request, { ...selected, supportDelta: '5' })],
    ['extra answer', (request) => ({ ...makeResponse(request), answers: { ...makeResponse(request).answers, unexpected: { type: 'choice', choice: '0', probabilities: { '0': 1 }, confidence: 1 } } })],
  ];
  for (const [name, responseFactory] of malformedResponses) {
    let badJevCalls = 0;
    let badLlmCalls = 0;
    const invalid = await evaluateCustomerActivityPlan({ ...args, executionConfig: configWith('jev') }, {
      jevInvoker: async (request) => {
        badJevCalls += 1;
        return responseFactory(request) as JevResponse;
      },
      invoker: async () => {
        badLlmCalls += 1;
        throw new Error('malformed Jev output must not fall back to the LLM');
      },
    });
    assert.equal(invalid, null, `${name} must return a retryable failure without fabricating a score`);
    assert.equal(badJevCalls, 1);
    assert.equal(badLlmCalls, 0);
  }

  let unavailableJevCalls = 0;
  let unavailableLlmCalls = 0;
  const unavailable = await evaluateCustomerActivityPlan({ ...args, executionConfig: configWith('jev') }, {
    jevInvoker: async () => { unavailableJevCalls += 1; throw new Error('Jev unavailable'); },
    invoker: async () => { unavailableLlmCalls += 1; throw new Error('Jev failure must not fall back to LLM'); },
  });
  assert.equal(unavailable, null);
  assert.equal(unavailableJevCalls, 1);
  assert.equal(unavailableLlmCalls, 0);

  let blankJevCalls = 0;
  let blankLlmCalls = 0;
  const blank = await evaluateCustomerActivityPlan({ ...args, draft: ' \n\t', executionConfig: configWith('jev') }, {
    jevInvoker: async () => { blankJevCalls += 1; throw new Error('blank plans never invoke Jev'); },
    invoker: async () => { blankLlmCalls += 1; throw new Error('blank plans never invoke LLM'); },
  });
  assert.equal(blank?.supportDelta, -2);
  assert.equal(blank?.pleasureDelta, -3);
  assert.equal(blankJevCalls, 0);
  assert.equal(blankLlmCalls, 0);

  console.log('Jev activity plan evaluation, strict seven-choice parsing, limits, no-fallback and blank-plan tests passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
