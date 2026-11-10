import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createPreviewAiService,
  createPreviewCustomerActivityJevInvoker,
  createPreviewServerState,
  hasCustomerActivitySettlementWork,
  fromPersistedPreviewServerState,
  PREVIEW_NPC_IDS,
  PreviewSessionStore,
  toPreviewRecoveryDto,
  toPersistedPreviewServerState,
  type PreviewSessionPersistence,
} from '../src/lib/game/project-one-preview-ai';
import { previewAiRequestSchema, type PreviewAiRequest } from '../src/lib/contracts/project-one-preview-ai';
import { detectCustomerActivityProposals } from '../src/lib/ai/customer-activities';
import {
  CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE,
  CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS,
  DEFAULT_ACTIVITY_DECISION_CONFIG,
  type CustomerActivityType,
  type CustomerActivityConversationMessage,
  type ActivityDecisionConfig,
} from '../src/lib/game/customer-activities';
import { DEFAULT_ACTIVITY_EXECUTION_CONFIG } from '../src/lib/game/customer-activity-execution-config';
import type { JevInvoker, JevRequest } from '../src/lib/ai/jev-client';
type TestNpcId = keyof ReturnType<typeof createPreviewServerState>['npcStates'];
const legacyAiDecisionConfig: ActivityDecisionConfig = { revision: 30, mode: 'ai', thresholds: {} };

const json = (value: unknown) => JSON.stringify(value);
let commandCounter = 0;
function requestFor(sessionId: string, version: number, action: Record<string, unknown>): PreviewAiRequest {
  commandCounter += 1;
  return previewAiRequestSchema.parse({
    ...action,
    ...(sessionId ? { previewSessionId: sessionId } : {}),
    commandId: `preview-activity-${commandCounter}`.padEnd(24, 'x'),
    expectedVersion: version,
  });
}

async function execute(
  service: ReturnType<typeof createPreviewAiService>,
  userId: string,
  sessionId: string,
  version: number,
  action: Record<string, unknown>,
  config?: ActivityDecisionConfig,
) {
  return service.execute(userId, requestFor(sessionId, version, action), undefined, config);
}

function seedEmailConversation(
  state: ReturnType<typeof createPreviewServerState>,
  messages: Array<{ messageId: string; speaker: 'sales' | 'customer'; text: string }>,
  npcId: TestNpcId = 'P1-002',
) {
  for (const message of messages) {
    state.conversations[npcId].push({
      messageId: message.messageId,
      role: message.speaker === 'sales' ? 'player' : 'npc',
      channel: 'email',
      text: message.text,
      at: Date.now(),
    });
  }
}

type TestOrganizationMetrics = { support: number; pleasantness: number };
function setOrganizationMetrics(
  state: ReturnType<typeof createPreviewServerState>,
  overrides: Partial<Record<TestNpcId, TestOrganizationMetrics>> = {},
) {
  for (const npcId of CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS) {
    const metrics = overrides[npcId] ?? { support: 0, pleasantness: 50 };
    state.npcStates[npcId].support = metrics.support;
    state.npcStates[npcId].pleasantness = metrics.pleasantness;
  }
}

function createNumericTechnicalProposalService(
  store: PreviewSessionStore,
  detectorState: { failuresRemaining: number } = { failuresRemaining: 0 },
) {
  return createPreviewAiService({
    store,
    invoker: async (messages) => {
      if (!messages[0]?.content.includes('活动提议语义识别器')) throw new Error('unexpected prose model request');
      if (detectorState.failuresRemaining > 0) {
        detectorState.failuresRemaining -= 1;
        throw new Error('temporary detector outage');
      }
      return json(modelCandidate(messagesFromDetectionPrompt(messages[messages.length - 1].content), 'technical_meeting'));
    },
    jevInvoker: async () => { throw new Error('numeric organization gate must never call Jev'); },
  });
}

function messagesFromDetectionPrompt(content: string) {
  const match = content.match(/<untrusted_data label="ended_customer_conversation">\r?\n([\s\S]*?)\r?\n<\/untrusted_data>/);
  assert.ok(match, 'detector prompt contains the bounded source transcript');
  return JSON.parse(match[1]) as Array<{ messageId: string; speaker: 'sales' | 'customer'; text: string }>;
}

function modelCandidate(
  messages: Array<{ messageId: string; speaker: 'sales' | 'customer'; text: string }>,
  type: CustomerActivityType,
) {
  const activityMention = {
    technical_meeting: /技术交流会|技术研讨/u,
    case_site_visit: /(?:案例|项目).{0,8}(?:现场)?(?:参观|考察)|(?:参观|考察).{0,12}(?:案例|项目)/u,
    company_visit: /(?:公司|我司|我们公司).{0,8}参观|参观.{0,8}(?:公司|我司|我们公司)/u,
    hospitality: /吃(?:个|顿)?(?:饭|便饭)|用餐|聚餐|饭局|喝酒|喝一杯|小酌/u,
  }[type];
  const salesProposalIndex = messages.findIndex((message) => message.speaker === 'sales'
    && activityMention.test(message.text)
    && /建议|提议|希望|想|邀请|要不要|能否|可否|是否|可以|安排|组织|召开|举办|一起|请/u.test(message.text)
    && !/(?:撤回|撤销|取消|不再|先不|暂不|不安排|不组织|此前|之前|上周|以前|曾经|过去|已经.{0,8}(?:举办|召开|组织|参观))/u.test(message.text));
  const customerProposalIndex = messages.findIndex((message) => message.speaker === 'customer' && activityMention.test(message.text));
  if (salesProposalIndex >= 0 && (customerProposalIndex < 0 || salesProposalIndex < customerProposalIndex)) {
    const proposal = messages[salesProposalIndex];
    return { activities: [{ type, initiator: 'sales', proposal: { messageId: proposal.messageId, quote: proposal.text.slice(0, 400) } }] };
  }

  if (customerProposalIndex < 0) return { activities: [] };
  const customerProposal = messages[customerProposalIndex];
  const response = messages.slice(customerProposalIndex + 1).find((message) => message.speaker === 'sales'
    && activityMention.test(message.text)
    && /(?:可以|同意|确认|愿意|协调|安排)/u.test(message.text)
    && !/(?:不|没|别|取消|撤回|不再|暂不|先不)/u.test(message.text));
  if (!response) return { activities: [] };
  return {
    activities: [{
      type,
      initiator: 'customer',
      proposal: { messageId: customerProposal.messageId, quote: customerProposal.text.slice(0, 400) },
      response: {
        messageId: response.messageId,
        quote: response.text.slice(0, 400),
        kind: 'explicit_acceptance',
      },
      finalStatus: 'active',
      finalOutcome: { messageId: response.messageId, quote: response.text.slice(0, 400) },
      confidence: 0.98,
    }],
  };
}

function selectionJev(choiceFor: (id: string, state: string, criteria: Record<string, string | null>) => string = () => 'none'): JevInvoker {
  return async (request: JevRequest) => {
    const state = typeof request.state === 'string' ? request.state : JSON.stringify(request.state);
    const answers = Object.fromEntries(Object.entries(request.questions).map(([id, question]) => {
      if (question.type === 'choice') {
        const choice = choiceFor(id, state, question.criteria);
        return [id, { type: 'choice' as const, choice, probabilities: Object.fromEntries(Object.keys(question.criteria).map((key) => [key, key === choice ? 1 : 0])), confidence: 1 }];
      }
      if (question.type === 'noul') return [id, { type: 'noul' as const, noul: 0 }];
      return [id, { type: 'score' as const, score: 0, legend: Object.fromEntries(question.criteria.map((item, index) => [String(index), item])), probabilities: Object.fromEntries(question.criteria.map((_, index) => [String(index), index === 0 ? 1 : 0])), confidence: 1 }];
    }));
    return { answers };
  };
}

const activityPlanEvaluationKeys = [
  'supportDelta',
  'pleasureDelta',
  'decisionAnalysis',
  'relationshipBuilding',
  'valuePresentation',
  'objectionHandling',
  'informationDiscovery',
] as const;

function activityPlanJevInvoker(
  deltas: Record<(typeof activityPlanEvaluationKeys)[number], number>,
  onRequest?: (request: JevRequest) => void,
): JevInvoker {
  return async (request) => {
    onRequest?.(request);
    assert.deepEqual(Object.keys(request.questions), activityPlanEvaluationKeys,
      'preview activity evaluation asks seven independent questions with stable metric keys');
    const answers = Object.fromEntries(activityPlanEvaluationKeys.map((key) => {
      const question = request.questions[key];
      assert.ok(question && question.type === 'choice', `${key} is an integer-choice question`);
      const choice = String(deltas[key]);
      const criteria = Object.keys(question.criteria);
      assert.ok(criteria.every((item) => Number.isInteger(Number(item)) && String(Number(item)) === item),
        `${key} options are canonical integer strings`);
      assert.ok(criteria.includes(choice), `${key} result is in the task's frozen allowed range`);
      return [key, {
        type: 'choice' as const,
        choice,
        probabilities: Object.fromEntries(criteria.map((item) => [item, item === choice ? 1 : 0])),
        confidence: 1,
      }];
    }));
    return { model: 'test-activity-plan', answers, usage: { input_tokens: 1, output_tokens: 1 } };
  };
}

async function testCustomerConfirmationAndPlanning() {
  const userId = 'preview-activity-confirmation';
  const store = new PreviewSessionStore();
  let detectionFailures = 1;
  let planEvaluationCalls = 0;
  let planSystemPrompt = '';
  const planEvaluation = {
    supportDelta: 2,
    pleasureDelta: 1,
    dimensionDeltas: { decisionAnalysis: 1, relationshipBuilding: 1, valuePresentation: 0, objectionHandling: 0, informationDiscovery: 1 },
    overallEvaluation: '本次方案有助于推进后续活动沟通。',
  };
  const service = createPreviewAiService({
    store,
    invoker: async (messages) => {
      if (messages[0]?.content.includes('活动提议语义识别器')) {
        if (detectionFailures > 0) {
          detectionFailures -= 1;
          throw new Error('temporary detector outage');
        }
        return json(modelCandidate(messagesFromDetectionPrompt(messages[messages.length - 1].content), 'case_site_visit'));
      }
      if (messages[0]?.content.includes('销售活动策划的复盘评价器')) {
        planEvaluationCalls += 1;
        planSystemPrompt = messages[0]?.content ?? '';
        return json(planEvaluation);
      }
      throw new Error('unexpected prose model request');
    },
    jevInvoker: async () => { throw new Error('customer confirmation and plan evaluation do not need Jev'); },
  });
  const state = store.create(userId);
  seedEmailConversation(state, [
    { messageId: 'case-proposal-1', speaker: 'customer', text: '能否安排一次案例现场参观，看看以前项目的实际运行？' },
    { messageId: 'case-confirm-1', speaker: 'sales', text: '可以，我来协调案例现场参观。' },
  ]);

  const configuredExecution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  configuredExecution.quizDurationSeconds = 90;
  configuredExecution.questionBanks.case_site_visit[0].title = '情境推演（假设）：冻结的自定义案例题？';
  configuredExecution.aiInstructions = '冻结执行规则：评价方案时优先核对案例信息授权与后续责任人。';
  configuredExecution.weights = { plan: 0.5, quiz: 0.5 };
  configuredExecution.limits.supportMax = 1;
  configuredExecution.limits.pleasureMax = 1;
  configuredExecution.limits.dimensionMax = 0;
  const config: ActivityDecisionConfig = { ...legacyAiDecisionConfig, revision: 4, execution: configuredExecution };
  let response = await execute(service, userId, state.previewSessionId, 0,
    { action: 'customer_activity_end_conversation', npcId: 'P1-002', channel: 'email' }, config);
  let current = store.get(userId, state.previewSessionId)!;
  assert.equal(current.pendingCustomerActivityDetections.length, 1, 'a detector failure keeps the ended transcript queued');
  assert.equal(current.customerActivities.tasks.length, 0);
  assert.equal(current.pendingCustomerActivityDetections[0].relationshipSnapshot.support, 0);
  assert.equal(current.pendingCustomerActivityDetections[0].decisionConfig.revision, 4);

  configuredExecution.quizDurationSeconds = 30;
  configuredExecution.questionBanks.case_site_visit[0].title = '后台后来修改的题';
  configuredExecution.aiInstructions = '后来修改的提示词';

  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_sync' });
  current = store.get(userId, state.previewSessionId)!;
  assert.equal(current.pendingCustomerActivityDetections.length, 0, 'a later authoritative sync retries the same ended transcript');
  assert.equal(current.customerActivities.tasks.length, 1);
  assert.equal(current.customerActivities.tasks[0].type, 'case_site_visit');
  assert.equal(current.customerActivities.tasks[0].decisionMode, 'customer_confirmed');
  assert.equal(current.customerActivities.tasks[0].decisionConfig?.execution?.quizDurationSeconds, 90,
    'a task retains the full execution config captured when its ended conversation was queued');
  assert.equal(current.customerActivities.tasks[0].decisionConfig?.execution?.aiInstructions,
    '冻结执行规则：评价方案时优先核对案例信息授权与后续责任人。');
  assert.equal(current.customerActivities.decisions.length, 1);
  assert.equal(current.customerActivities.decisions[0].configRevision, 4);

  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_start', taskId: current.customerActivities.tasks[0].id });
  current = store.get(userId, state.previewSessionId)!;
  const taskId = current.customerActivities.tasks[0].id;
  assert.equal(current.customerActivities.tasks[0].status, 'planning');
  assert.equal(current.customerActivities.tasks[0].deadlineAt! - current.customerActivities.tasks[0].startedAt!, 300_000);
  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_save', taskId, draft: '准备现场核验清单和案例问题。' });
  current = store.get(userId, state.previewSessionId)!;
  assert.equal(current.customerActivities.tasks[0].draft, '准备现场核验清单和案例问题。');
  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_submit', taskId, draft: '围绕系统运行、接口适配和运维边界准备现场议程，并列出客户需核验的记录。' });
  current = store.get(userId, state.previewSessionId)!;
  const submitted = current.customerActivities.tasks[0];
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.submitReason, 'manual');
  assert.match(submitted.draft, /运维边界/, 'submit commits the exact latest client draft atomically');
  assert.ok(submitted.quiz);
  assert.equal(submitted.quiz.status, 'answering');
  assert.equal(submitted.quiz.deadlineAt - submitted.quiz.startedAt, 90_000,
    'the submitted task uses its frozen, designer-configured quiz deadline');
  assert.equal(submitted.quiz.questions[0]?.title, '情境推演（假设）：冻结的自定义案例题？',
    'the submitted quiz uses its frozen custom question text');
  assert.equal(hasCustomerActivitySettlementWork(current, submitted.quiz!.startedAt), false,
    'an active quiz is not treated as immediately ready for background AI evaluation');
  assert.equal(submitted.evaluation, undefined, 'plan submit does not settle or change NPC metrics before answers');
  assert.equal(planEvaluationCalls, 0, 'plan submit does not call the evaluator before the quiz');
  assert.equal(current.npcStates['P1-002'].support, 0);
  assert.equal(current.npcStates['P1-002'].pleasantness, 50);
  assert.equal(current.npcStates['P1-002'].dimensionScores.decisionAnalysis, 0);

  await assert.rejects(
    execute(service, userId, state.previewSessionId, response.version,
      { action: 'message', npcId: 'P1-002', channel: 'email', text: '趁现在补充一下项目内容。' }, config),
    /CUSTOMER_ACTIVITY_QUIZ_ACTIVE/u,
    'other preview game actions are blocked during the quiz',
  );
  current = store.get(userId, state.previewSessionId)!;
  assert.equal(current.version, response.version, 'a blocked game action does not advance the preview version');

  for (const [questionId, optionId] of submitted.quiz.questions.map((question) => {
      const best = question.options.reduce((currentBest, option) =>
        option.supportDelta + option.pleasureDelta > currentBest.supportDelta + currentBest.pleasureDelta ? option : currentBest);
      return [question.id, best.id] as const;
    })) {
    response = await execute(service, userId, state.previewSessionId, response.version,
      { action: 'customer_activity_answer', taskId, questionId, optionId }, config);
  }
  current = store.get(userId, state.previewSessionId)!;
  assert.equal(current.customerActivities.tasks[0]?.quiz?.status, 'answering', 'answers alone do not settle before final confirmation');
  assert.equal(current.customerActivities.tasks[0]?.evaluation, undefined);
  assert.equal(planEvaluationCalls, 0);
  assert.equal(current.npcStates['P1-002'].support, 0, 'answering the quiz still has no intermediate metric changes');

  const privateQuiz = current.customerActivities.tasks[0]!.quiz!;
  const expectedQuizDelta = privateQuiz.questions.reduce((total, question) => {
    const selected = question.options.find((option) => option.id === privateQuiz.answers[question.id]);
    return { supportDelta: total.supportDelta + (selected?.supportDelta ?? 0), pleasureDelta: total.pleasureDelta + (selected?.pleasureDelta ?? 0) };
  }, { supportDelta: 0, pleasureDelta: 0 });
  assert.deepEqual(expectedQuizDelta, { supportDelta: 3, pleasureDelta: 3 },
    'the configured question options retain their private answer deltas before weighting');
  const persistedQuiz = toPersistedPreviewServerState(current);
  const reloadedState = fromPersistedPreviewServerState(
    JSON.parse(JSON.stringify(persistedQuiz)), userId, state.previewSessionId, current.version,
  );
  assert.deepEqual(reloadedState.customerActivities, current.customerActivities,
    'quiz questions and selected answers survive JSON storage reload');
  let committedState = reloadedState;
  const persistence: PreviewSessionPersistence = {
    async acquire(_userId, request) {
      return {
        previewSessionId: committedState.previewSessionId,
        version: committedState.version,
        state: structuredClone(committedState),
        leaseToken: `quiz-${request.commandId}`,
      };
    },
    async renew() {},
    async commit(args) {
      committedState = args.state;
      return args.response;
    },
    async abandon() {},
  };
  response = await service.executePersistent(
    userId,
    requestFor(state.previewSessionId, committedState.version, { action: 'customer_activity_complete_quiz', taskId }),
    persistence,
    undefined,
    config,
  );
  current = committedState;
  const settledTask = current.customerActivities.tasks[0]!;
  assert.equal(settledTask.quiz?.status, 'completed');
  assert.equal(planEvaluationCalls, 1, 'the plan evaluator runs once after quiz completion');
  assert.equal(settledTask.evaluation?.supportDelta, 1,
    'weighted AI and quiz support is constrained by the frozen total cap');
  assert.equal(settledTask.evaluation?.pleasureDelta, 1,
    'weighted AI and quiz pleasure is constrained by the frozen total cap');
  assert.deepEqual(settledTask.evaluationBreakdown?.aiPlan, {
    ...planEvaluation,
    supportDelta: 1,
    pleasureDelta: 1,
    dimensionDeltas: { decisionAnalysis: 0, relationshipBuilding: 0, valuePresentation: 0, objectionHandling: 0, informationDiscovery: 0 },
  }, 'the frozen AI limits clamp the model contribution before it is combined with quiz scores');
  assert.deepEqual(settledTask.evaluationBreakdown?.quiz, { supportDelta: 1.5, pleasureDelta: 1.5 },
    'the frozen quiz weight contributes to the private breakdown');
  assert.equal(current.npcStates['P1-002'].support, 1,
    'weighted, capped AI and quiz results change the target NPC support score');
  assert.equal(current.npcStates['P1-002'].pleasantness, 51,
    'weighted, capped AI and quiz results change the target NPC experience score');
  assert.equal(current.npcStates['P1-002'].dimensionScores.decisionAnalysis, 0,
    'the frozen dimension cap applies to the weighted AI dimension delta');
  assert.match(planSystemPrompt, /冻结执行规则/u, 'the plan evaluator receives the original snapshotted AI instructions');
  assert.doesNotMatch(planSystemPrompt, /后来修改的提示词/u, 'changing designer settings later cannot change an in-progress task prompt');
  assert.equal(current.npcStates['P1-001'].support, 0, 'other NPC metrics remain untouched');
  assert.equal(current.npcStates['P1-001'].pleasantness, 50);
  assert.equal(JSON.stringify(response).includes('supportDelta'), false, 'public completion response omits score deltas');
  assert.equal(JSON.stringify(response).includes('pleasureDelta'), false, 'public quiz omits private option scoring');
  assert.equal(JSON.stringify(response).includes('evaluationBreakdown'), false, 'the AI and quiz score breakdown stays private');
  assert.equal(JSON.stringify(response).includes('aiInstructions'), false, 'the public task response hides designer execution settings');

  const supportAfterEvaluation = current.npcStates['P1-002'].support;
  const pleasureAfterEvaluation = current.npcStates['P1-002'].pleasantness;
  response = await service.executePersistent(
    userId,
    requestFor(state.previewSessionId, committedState.version, { action: 'customer_activity_complete_quiz', taskId }),
    persistence,
    undefined,
    config,
  );
  current = committedState;
  assert.equal(planEvaluationCalls, 1, 'a repeated quiz completion does not rerun AI evaluation');
  assert.equal(current.npcStates['P1-002'].support, supportAfterEvaluation, 'repeated completion does not apply support twice');
  assert.equal(current.npcStates['P1-002'].pleasantness, pleasureAfterEvaluation, 'repeated completion does not apply pleasure twice');
  assert.equal(response.customerActivities?.tasks[0].evaluation?.overallEvaluation,
    CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE);
  const persisted = toPersistedPreviewServerState(current);
  const restored = fromPersistedPreviewServerState(persisted, userId, state.previewSessionId, current.version);
  assert.deepEqual(restored.customerActivities, current.customerActivities, 'task, decision, and one-time evaluation markers survive JSON persistence');
}

async function testFrozenActivityPlanProviderAndJevFailure() {
  const planDeltas = {
    supportDelta: 2,
    pleasureDelta: 2,
    decisionAnalysis: 1,
    relationshipBuilding: -1,
    valuePresentation: 2,
    objectionHandling: 0,
    informationDiscovery: 1,
  };
  const jevExecution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  jevExecution.evaluationProvider = 'jev';
  jevExecution.weights = { plan: 0.5, quiz: 0.5 };
  const jevConfig: ActivityDecisionConfig = { ...legacyAiDecisionConfig, revision: 61, execution: jevExecution };
  const laterExecution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  laterExecution.evaluationProvider = 'llm';
  laterExecution.weights = { plan: 0.5, quiz: 0.5 };
  const laterConfig: ActivityDecisionConfig = { ...legacyAiDecisionConfig, revision: 62, execution: laterExecution };

  const prepareSubmittedHospitalityQuiz = async (
    service: ReturnType<typeof createPreviewAiService>,
    store: PreviewSessionStore,
    userId: string,
  ) => {
    const state = store.create(userId);
    setOrganizationMetrics(state, Object.fromEntries(CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => [
      npcId,
      npcId === 'P1-002' ? { support: 15, pleasantness: 55 } : { support: 0, pleasantness: 0 },
    ])) as Record<TestNpcId, TestOrganizationMetrics>);
    seedEmailConversation(state, [
      { messageId: `${userId}-proposal`, speaker: 'sales', text: '赵老师，周末方便一起吃饭吗？我想听听您对项目安排的想法。' },
      { messageId: `${userId}-response`, speaker: 'customer', text: '我先看下工作安排，之后再回复您。' },
    ]);
    let response = await execute(service, userId, state.previewSessionId, state.version,
      { action: 'customer_activity_end_conversation', npcId: 'P1-002', channel: 'email' }, jevConfig);
    let current = store.get(userId, state.previewSessionId)!;
    const task = current.customerActivities.tasks[0];
    assert.ok(task, 'the hospitality gate creates a task for the target customer at the threshold');
    assert.equal(task.decisionConfig?.execution?.evaluationProvider, 'jev',
      'proposal matching freezes the Jev evaluator provider on the new task');
    response = await execute(service, userId, state.previewSessionId, response.version,
      { action: 'customer_activity_start', taskId: task.id }, laterConfig);
    const draft = '围绕项目接口和客户关注点准备议题，提前确认时间与餐饮偏好，提供无酒精饮品选项，尊重不饮酒选择，并在会后发送经确认的要点。';
    response = await execute(service, userId, state.previewSessionId, response.version,
      { action: 'customer_activity_submit', taskId: task.id, draft }, laterConfig);
    current = store.get(userId, state.previewSessionId)!;
    assert.equal(current.customerActivities.tasks[0]?.quiz?.status, 'answering');
    assert.equal(current.customerActivities.tasks[0]?.evaluation, undefined);
    return { state, response, taskId: task.id, current };
  };

  const answerAndCompleteQuiz = async (
    service: ReturnType<typeof createPreviewAiService>,
    store: PreviewSessionStore,
    userId: string,
    sessionId: string,
    response: Awaited<ReturnType<typeof execute>>,
    taskId: string,
    afterAnswers?: () => void,
  ) => {
    let current = store.get(userId, sessionId)!;
    let nextResponse = response;
    const questions = current.customerActivities.tasks[0]!.quiz!.questions;
    for (const question of questions) {
      nextResponse = await execute(service, userId, sessionId, nextResponse.version,
        { action: 'customer_activity_answer', taskId, questionId: question.id, optionId: 'option-1' }, laterConfig);
    }
    afterAnswers?.();
    nextResponse = await execute(service, userId, sessionId, nextResponse.version,
      { action: 'customer_activity_complete_quiz', taskId }, laterConfig);
    current = store.get(userId, sessionId)!;
    return { response: nextResponse, current };
  };

  const store = new PreviewSessionStore();
  let llmEvaluationCalls = 0;
  let jevEvaluationCalls = 0;
  const service = createPreviewAiService({
    store,
    invoker: async (messages) => {
      if (messages[0]?.content.includes('活动提议语义识别器')) {
        return json(modelCandidate(messagesFromDetectionPrompt(messages.at(-1)?.content ?? ''), 'hospitality'));
      }
      if (messages[0]?.content.includes('销售活动策划的复盘评价器')) {
        llmEvaluationCalls += 1;
        return json({ supportDelta: 0, pleasureDelta: 0, dimensionDeltas: {
          decisionAnalysis: 0, relationshipBuilding: 0, valuePresentation: 0, objectionHandling: 0, informationDiscovery: 0,
        }, overallEvaluation: 'LLM fallback must not run.' });
      }
      throw new Error('unexpected preview model request');
    },
    jevInvoker: async () => { throw new Error('numeric hospitality decision must not use the global Jev router'); },
    activityPlanJevInvoker: activityPlanJevInvoker(planDeltas, () => { jevEvaluationCalls += 1; }),
  });
  const prepared = await prepareSubmittedHospitalityQuiz(service, store, 'preview-frozen-jev-provider');
  assert.equal(llmEvaluationCalls, 0);
  assert.equal(jevEvaluationCalls, 0, 'preview does not call the Jev evaluator before quiz completion');
  assert.equal(prepared.current.npcStates['P1-002'].support, 15);
  assert.equal(prepared.current.npcStates['P1-002'].pleasantness, 55);
  const completed = await answerAndCompleteQuiz(service, store, 'preview-frozen-jev-provider', prepared.state.previewSessionId,
    prepared.response, prepared.taskId, () => {
      assert.equal(jevEvaluationCalls, 0, 'answering questions without completing the quiz still does not call Jev');
      assert.equal(llmEvaluationCalls, 0);
    });
  const settledTask = completed.current.customerActivities.tasks[0]!;
  assert.equal(jevEvaluationCalls, 1, 'preview calls Jev once after quiz completion despite the current global LLM setting');
  assert.equal(llmEvaluationCalls, 0, 'preview Jev evaluation never calls the LLM evaluator');
  assert.equal(settledTask.evaluation?.supportDelta, 2,
    'the Jev plan support and the two-point hospitality quiz score are each weighted by one half');
  assert.equal(settledTask.evaluation?.pleasureDelta, 3,
    'the Jev plan pleasure and four-point hospitality quiz score are weighted and combined');
  assert.deepEqual(settledTask.evaluation?.dimensionDeltas, {
    decisionAnalysis: 1,
    relationshipBuilding: -1,
    valuePresentation: 1,
    objectionHandling: 0,
    informationDiscovery: 1,
  });
  assert.equal(completed.current.npcStates['P1-002'].support, 17,
    'the weighted Jev plan and quiz results change the target customer once');
  assert.equal(completed.current.npcStates['P1-002'].pleasantness, 58,
    'weighted plan and quiz effects change target customer experience once');
  assert.equal(completed.current.npcStates['P1-001'].support, 0, 'preview settlement leaves other NPCs unchanged');
  assert.equal(completed.current.npcStates['P1-001'].pleasantness, 0, 'preview settlement leaves other NPC experience unchanged');
  assert.equal(completed.current.npcStates['P1-002'].dimensionScores.relationshipBuilding, -1,
    'the five integer Jev choices update the target NPC ability dimensions');
  assert.equal(completed.current.npcStates['P1-002'].dimensionScores.valuePresentation, 1);

  const failureStore = new PreviewSessionStore();
  let failedJevCalls = 0;
  let failedLlmEvaluationCalls = 0;
  const failingService = createPreviewAiService({
    store: failureStore,
    invoker: async (messages) => {
      if (messages[0]?.content.includes('活动提议语义识别器')) {
        return json(modelCandidate(messagesFromDetectionPrompt(messages.at(-1)?.content ?? ''), 'hospitality'));
      }
      if (messages[0]?.content.includes('销售活动策划的复盘评价器')) {
        failedLlmEvaluationCalls += 1;
        return json({ supportDelta: 0, pleasureDelta: 0, dimensionDeltas: {
          decisionAnalysis: 0, relationshipBuilding: 0, valuePresentation: 0, objectionHandling: 0, informationDiscovery: 0,
        }, overallEvaluation: '不应回退。' });
      }
      throw new Error('unexpected preview model request');
    },
    jevInvoker: async () => { throw new Error('numeric hospitality decision must not use the global Jev router'); },
    activityPlanJevInvoker: async () => { failedJevCalls += 1; throw new Error('Jev unavailable'); },
  });
  const failedPrepared = await prepareSubmittedHospitalityQuiz(failingService, failureStore, 'preview-failing-jev-provider');
  const failedReady = await answerAndCompleteQuiz(failingService, failureStore, 'preview-failing-jev-provider', failedPrepared.state.previewSessionId,
    failedPrepared.response, failedPrepared.taskId, () => {
      assert.equal(failedJevCalls, 0, 'a Jev evaluation is not attempted while the player is still answering');
      assert.equal(failedLlmEvaluationCalls, 0);
    });
  assert.equal(failedJevCalls, 1);
  assert.equal(failedLlmEvaluationCalls, 0, 'a Jev failure never silently falls back to the LLM');
  assert.equal(failedReady.current.customerActivities.tasks[0]?.evaluation, undefined,
    'a failed Jev evaluation leaves the task ready for retry');
  assert.equal(failedReady.current.npcStates['P1-002'].support, 15,
    'a failed Jev evaluation leaves target customer values unchanged');
  const retried = await execute(failingService, 'preview-failing-jev-provider', failedPrepared.state.previewSessionId,
    failedReady.response.version, { action: 'customer_activity_sync' }, laterConfig);
  const afterRetry = failureStore.get('preview-failing-jev-provider', failedPrepared.state.previewSessionId)!;
  assert.equal(failedJevCalls, 2, 'a later preview sync retries the pending Jev evaluation');
  assert.equal(failedLlmEvaluationCalls, 0);
  assert.equal(afterRetry.customerActivities.tasks[0]?.evaluation, undefined);
  assert.equal(afterRetry.npcStates['P1-002'].support, 15);
  assert.ok(retried.customerActivities);
}

async function testHospitalityPreviewServiceFlow() {
  const config: ActivityDecisionConfig = { revision: 19, mode: 'ai', thresholds: {} };
  const planEvaluation = {
    supportDelta: 1,
    pleasureDelta: 2,
    dimensionDeltas: { decisionAnalysis: 1, relationshipBuilding: 2, valuePresentation: 0, objectionHandling: 0, informationDiscovery: 1 },
    overallEvaluation: '方案尊重客户边界，并说明了合适场合、时间安排和会后跟进。',
  };
  const createHospitalityService = (store: PreviewSessionStore) => createPreviewAiService({
    store,
    invoker: async (messages) => {
      if (messages[0]?.content.includes('活动提议语义识别器')) {
        return json(modelCandidate(messagesFromDetectionPrompt(messages.at(-1)?.content ?? ''), 'hospitality'));
      }
      if (messages[0]?.content.includes('销售活动策划的复盘评价器')) return json(planEvaluation);
      throw new Error('unexpected prose model request');
    },
    jevInvoker: async () => { throw new Error('hospitality must apply its target-customer numeric gate under global AI mode'); },
  });
  const runConversation = async (
    userId: string,
    messages: Array<{ messageId: string; speaker: 'sales' | 'customer'; text: string }>,
    targetMetrics: TestOrganizationMetrics,
  ) => {
    const store = new PreviewSessionStore();
    const service = createHospitalityService(store);
    const state = store.create(userId);
    setOrganizationMetrics(state, Object.fromEntries(CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => [
      npcId,
      npcId === 'P1-002' ? targetMetrics : { support: 0, pleasantness: 0 },
    ])) as Record<TestNpcId, TestOrganizationMetrics>);
    seedEmailConversation(state, messages, 'P1-002');
    const response = await execute(service, userId, state.previewSessionId, 0,
      { action: 'customer_activity_end_conversation', npcId: 'P1-002', channel: 'email' }, config);
    return { store, service, state, response, current: store.get(userId, state.previewSessionId)! };
  };

  const salesProposal = [
    { messageId: 'hospitality-sales', speaker: 'sales' as const, text: '赵老师，周末要不要喝酒？我也想听听您对项目安排的想法。' },
    { messageId: 'hospitality-customer', speaker: 'customer' as const, text: '我先结合工作安排考虑一下，之后再给您反馈。' },
  ];
  const allowed = await runConversation('preview-hospitality-allowed', salesProposal, { support: 15, pleasantness: 55 });
  assert.equal(allowed.current.customerActivities.tasks.length, 1,
    'target scores at the inclusive 15/55 boundary create the hospitality task although every other NPC is at 0/0');
  const task = allowed.current.customerActivities.tasks[0];
  assert.equal(task.type, 'hospitality');
  assert.equal(task.npcId, 'P1-002');
  assert.equal(task.decisionMode, 'numeric', 'the hospitality task stays numeric even when the frozen config uses global AI mode');
  assert.equal(allowed.current.customerActivities.decisions[0]?.mode, 'numeric');
  assert.equal(allowed.current.customerActivities.decisions[0]?.decision, 'allow');
  assert.equal(allowed.response.customerActivities?.tasks[0]?.type, 'hospitality');

  let response = await execute(allowed.service, 'preview-hospitality-allowed', allowed.state.previewSessionId, allowed.response.version,
    { action: 'customer_activity_start', taskId: task.id });
  response = await execute(allowed.service, 'preview-hospitality-allowed', allowed.state.previewSessionId, response.version,
    { action: 'customer_activity_save', taskId: task.id, draft: '先确认客户愿意参加及饮酒偏好，选择安静、合规的用餐场合，控制时长并围绕项目问题交流；不劝酒，不作采购承诺，会后发送简要纪要并确认下一步。' });
  response = await execute(allowed.service, 'preview-hospitality-allowed', allowed.state.previewSessionId, response.version,
    { action: 'customer_activity_submit', taskId: task.id, draft: '先确认客户愿意参加及饮酒偏好，选择安静、合规的用餐场合，控制时长并围绕项目问题交流；不劝酒，不作采购承诺，会后发送简要纪要并确认下一步。' });
  let current = allowed.store.get('preview-hospitality-allowed', allowed.state.previewSessionId)!;
  assert.equal(current.customerActivities.tasks[0]?.status, 'submitted');
  assert.match(current.customerActivities.tasks[0]?.draft ?? '', /不劝酒.*不作采购承诺/u);
  assert.equal(current.customerActivities.tasks[0]?.quiz?.questions[0]?.id, 'hospitality-preparation');
  assert.equal(current.customerActivities.tasks[0]?.evaluation, undefined, 'hospitality plan submission also waits for quiz completion');
  assert.equal(current.npcStates['P1-002'].support, 15);
  assert.equal(current.npcStates['P1-002'].pleasantness, 55);
  for (const questionId of ['hospitality-preparation', 'hospitality-event', 'hospitality-follow-up']) {
    response = await execute(allowed.service, 'preview-hospitality-allowed', allowed.state.previewSessionId, response.version,
      { action: 'customer_activity_answer', taskId: task.id, questionId, optionId: 'option-1' }, config);
  }
  const answeredQuiz = allowed.store.get('preview-hospitality-allowed', allowed.state.previewSessionId)!.customerActivities.tasks[0]!.quiz!;
  const expectedQuizDelta = answeredQuiz.questions.reduce((total, question) => {
    const selected = question.options.find((option) => option.id === answeredQuiz.answers[question.id]);
    return { supportDelta: total.supportDelta + (selected?.supportDelta ?? 0), pleasureDelta: total.pleasureDelta + (selected?.pleasureDelta ?? 0) };
  }, { supportDelta: 0, pleasureDelta: 0 });
  response = await execute(allowed.service, 'preview-hospitality-allowed', allowed.state.previewSessionId, response.version,
    { action: 'customer_activity_complete_quiz', taskId: task.id }, config);
  current = allowed.store.get('preview-hospitality-allowed', allowed.state.previewSessionId)!;
  assert.equal(current.customerActivities.tasks[0]?.evaluation?.overallEvaluation, planEvaluation.overallEvaluation);
  assert.deepEqual(current.customerActivities.tasks[0]?.evaluationBreakdown?.quiz, expectedQuizDelta);
  const combinedEvaluation = current.customerActivities.tasks[0]?.evaluation as { supportDelta: number; pleasureDelta: number } | undefined;
  assert.ok(combinedEvaluation);
  assert.equal(current.npcStates['P1-002'].support, 15 + combinedEvaluation.supportDelta);
  assert.equal(current.npcStates['P1-002'].pleasantness, 55 + combinedEvaluation.pleasureDelta);
  const supportAfterEvaluation = current.npcStates['P1-002'].support;
  const recovery = toPreviewRecoveryDto(current);
  assert.equal(JSON.stringify(recovery).includes('relationshipSnapshot'), false,
    'player recovery does not expose the frozen numeric relationship snapshot');
  assert.equal(JSON.stringify(allowed.response).includes('supportMin'), false,
    'player action responses do not expose internal numeric thresholds');

  response = await execute(allowed.service, 'preview-hospitality-allowed', allowed.state.previewSessionId, response.version,
    { action: 'customer_activity_sync' });
  current = allowed.store.get('preview-hospitality-allowed', allowed.state.previewSessionId)!;
  assert.equal(current.npcStates['P1-002'].support, supportAfterEvaluation,
    'recovery sync does not apply the plan evaluation more than once');
  assert.equal(current.customerActivities.tasks[0]?.evaluation?.overallEvaluation, planEvaluation.overallEvaluation);

  const belowSupport = await runConversation('preview-hospitality-low-support', salesProposal, { support: 14, pleasantness: 55 });
  assert.equal(belowSupport.current.customerActivities.tasks.length, 0, 'support below threshold rejects the hospitality proposal');
  assert.equal(belowSupport.current.customerActivities.decisions[0]?.decision, 'reject');
  const belowPleasantness = await runConversation('preview-hospitality-low-pleasantness', salesProposal, { support: 15, pleasantness: 54 });
  assert.equal(belowPleasantness.current.customerActivities.tasks.length, 0, 'pleasantness below threshold rejects the hospitality proposal');
  assert.equal(belowPleasantness.current.customerActivities.decisions[0]?.decision, 'reject');

  const customerProposal = await runConversation('preview-hospitality-customer-proposal', [
    { messageId: 'hospitality-customer-proposal', speaker: 'customer' as const, text: '我们周五项目组聚餐，您要不要一起吃个饭？' },
    { messageId: 'hospitality-sales-confirmation', speaker: 'sales' as const, text: '可以，我愿意一起吃饭。' },
  ], { support: 15, pleasantness: 55 });
  assert.equal(customerProposal.current.customerActivities.tasks.length, 1,
    'a customer-initiated dinner proposal becomes an event after sales confirms');
  assert.equal(customerProposal.current.customerActivities.tasks[0]?.initiator, 'customer');
  assert.equal(customerProposal.current.customerActivities.tasks[0]?.responseKind, 'explicit_acceptance');
  assert.equal(customerProposal.current.customerActivities.tasks[0]?.decisionMode, 'numeric',
    'customer confirmation does not bypass the target-customer numeric gate');
}

async function testP1005HospitalityMessageFlow() {
  const playerText = '刘老师您好，我是A公司的小孙，请问您最近是否有空呢？想请您吃个便饭，顺便也请教您一些问题~';
  const npcReply = '小孙您好，感谢来信。最近手头事情比较多，吃饭就不必了。您要是有具体事项，可以先通过邮件说明，我看看是否属于我这边能协助的范围。';
  const config: ActivityDecisionConfig = { revision: 57, mode: 'ai', thresholds: {} };
  const runMessage = async (support: number, includeModelEvidence: boolean) => {
    const userId = `preview-p1005-casual-meal-${support}-${includeModelEvidence ? 'evidence' : 'empty'}`;
    const store = new PreviewSessionStore();
    const state = store.create(userId);
    state.npcStates['P1-005'].support = support;
    state.npcStates['P1-005'].pleasantness = 55;
    const service = createPreviewAiService({
      store,
      invoker: async (messages) => {
        const system = messages[0]?.content ?? '';
        if (system.includes('活动提议语义识别器')) {
          if (!includeModelEvidence) return json({ activities: [] });
          const transcript = messagesFromDetectionPrompt(messages.at(-1)?.content ?? '');
          const proposal = transcript.find((message) => message.speaker === 'sales' && message.text === playerText);
          assert.ok(proposal, 'the real message command supplies the exact sales invitation as detector evidence');
          return json({ activities: [{
            type: 'hospitality',
            initiator: 'sales',
            proposal: { messageId: proposal.messageId, quote: proposal.text },
          }] });
        }
        if (system.includes('客户活动回复的上下文语义复核器')) return json({ decision: 'allowed', issue: 'none' });
        if (system.includes('独立评估刚刚完成的 NPC 正文')) return json({ memorySuggestions: [] });
        return json({ content: npcReply });
      },
      jevInvoker: async () => ({ answers: {} }),
    });
    const response = await execute(service, userId, state.previewSessionId, 0, {
      action: 'message', channel: 'email', npcId: 'P1-005', text: playerText,
    }, config);
    return { state: store.get(userId, state.previewSessionId)!, response };
  };

  const belowThreshold = await runMessage(14, true);
  assert.equal(belowThreshold.state.customerActivities.decisions[0]?.decision, 'reject');
  assert.equal(belowThreshold.state.customerActivities.tasks.length, 0);
  assert.equal(belowThreshold.response.customerActivities?.unavailableNotices.length, 1,
    'the P1-005 screenshot email becomes a hospitality notice below the target threshold');

  const allowed = await runMessage(15, true);
  assert.equal(allowed.state.customerActivities.decisions[0]?.decision, 'allow');
  assert.equal(allowed.response.customerActivities?.tasks.length, 1,
    'the NPC reply does not erase the model-classified sales invitation at the inclusive threshold');
  assert.equal(allowed.response.customerActivities?.tasks[0]?.type, 'hospitality');
  assert.equal(allowed.response.customerActivities?.unavailableNotices.length, 0);

  const emptyModelResult = await runMessage(100, false);
  assert.equal(emptyModelResult.state.customerActivities.decisions.length, 0,
    'an empty semantic model result does not fall back to keyword-created candidates');
  assert.equal(emptyModelResult.response.customerActivities?.tasks.length, 0);
  assert.equal(emptyModelResult.response.customerActivities?.unavailableNotices.length, 0);
}

async function testFrozenNumericGateAndDuplicateDecision() {
  const userId = 'preview-activity-frozen';
  const store = new PreviewSessionStore();
  let detectorFailures = 1;
  const numericConfig: ActivityDecisionConfig = {
    revision: 12,
    mode: 'numeric',
    thresholds: {
      technical_meeting: { supportMin: 50, pleasantnessMin: 50 },
      case_site_visit: { supportMin: 0, pleasantnessMin: 0 },
      company_visit: { supportMin: 100, pleasantnessMin: 100 },
    },
  };
  const service = createPreviewAiService({
    store,
    invoker: async (messages) => {
      if (!messages[0]?.content.includes('活动提议语义识别器')) throw new Error('unexpected prose model request');
      if (detectorFailures > 0) {
        detectorFailures -= 1;
        throw new Error('temporary detector outage');
      }
      return json(modelCandidate(messagesFromDetectionPrompt(messages[messages.length - 1].content), 'technical_meeting'));
    },
    jevInvoker: async () => { throw new Error('numeric gate must never call Jev'); },
  });
  const state = store.create(userId);
  seedEmailConversation(state, [
    { messageId: 'customer-proposal-1', speaker: 'customer', text: '能否安排一次技术交流会，围绕接口适配讨论？' },
    { messageId: 'sales-confirm-1', speaker: 'sales', text: '我确认并同意协调这次技术交流会。' },
  ]);
  let response = await execute(service, userId, state.previewSessionId, 0,
    { action: 'customer_activity_end_conversation', npcId: 'P1-002', channel: 'email' }, numericConfig);
  const queued = store.get(userId, state.previewSessionId)!;
  assert.equal(queued.pendingCustomerActivityDetections[0].relationshipSnapshot.support, 0);
  assert.equal(queued.pendingCustomerActivityDetections[0].decisionConfig.revision, 12);

  queued.npcStates['P1-002'].support = 100;
  queued.npcStates['P1-002'].pleasantness = 100;
  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_sync' });
  const decided = store.get(userId, state.previewSessionId)!;
  assert.equal(decided.pendingCustomerActivityDetections.length, 0);
  assert.equal(decided.customerActivities.tasks.length, 0, 'current high metrics cannot replace the decision-time low snapshot');
  assert.equal(decided.customerActivities.decisions.length, 1);
  assert.equal(decided.customerActivities.decisions[0].decision, 'reject');
  assert.equal(decided.customerActivities.decisions[0].relationshipSnapshot.support, 0);
  assert.equal(decided.customerActivities.decisions[0].configRevision, 12);
  assert.equal(response.customerActivities?.tasks.length, 0);
  assert.equal(response.customerActivities?.unavailableNotices.length, 1,
    'a persisted non-allow decision is projected to the preview unavailable-notice queue');
  const publicUnavailable = response.customerActivities?.unavailableNotices[0];
  assert.deepEqual(Object.keys(publicUnavailable ?? {}), ['id', 'npcId', 'type', 'decidedAt'],
    'the preview notification carries only the narrow public unavailable projection');
  assert.equal(JSON.stringify(publicUnavailable).includes('relationshipSnapshot'), false);
  assert.equal(JSON.stringify(publicUnavailable).includes('decisionConfig'), false);
  assert.equal(JSON.stringify(publicUnavailable).includes('support'), false);
  assert.equal(JSON.stringify(publicUnavailable).includes('pleasantness'), false);

  const aiUser = 'preview-activity-once';
  const aiStore = new PreviewSessionStore();
  let gateCalls = 0;
  const aiService = createPreviewAiService({
    store: aiStore,
    invoker: async (messages) => {
      if (messages[0]?.content.includes('活动提议语义识别器')) {
        return json(modelCandidate(messagesFromDetectionPrompt(messages[messages.length - 1].content), 'technical_meeting'));
      }
      if (messages[0]?.content.includes('独立评估刚刚完成的 NPC 正文')) return json({ memorySuggestions: [] });
      return json({ content: '收到，验收材料已更新。' });
    },
    jevInvoker: async (request) => {
      if (typeof request.state === 'object') {
        gateCalls += 1;
        return { answers: { decision: { type: 'choice', choice: 'reject', probabilities: { allow: 0, reject: 1 }, confidence: 1 } } };
      }
      return selectionJev()(request);
    },
  });
  const aiState = aiStore.create(aiUser);
  seedEmailConversation(aiState, [
    { messageId: 'sales-proposal-once', speaker: 'sales', text: '建议组织一次技术交流会，围绕接口适配讨论。' },
    { messageId: 'customer-vague-once', speaker: 'customer', text: '建议和负责项目的同事商量后再回复。' },
  ]);
  const aiResponse = await execute(aiService, aiUser, aiState.previewSessionId, 0,
    { action: 'customer_activity_end_conversation', npcId: 'P1-002', channel: 'email' }, legacyAiDecisionConfig);
  assert.equal(gateCalls, 1, 'a new sales proposal is decided once');
  await execute(aiService, aiUser, aiState.previewSessionId, aiResponse.version,
    { action: 'message', npcId: 'P1-002', channel: 'email', text: '补充普通项目进展，验收材料已更新。' }, legacyAiDecisionConfig);
  const rescanned = aiStore.get(aiUser, aiState.previewSessionId)!;
  assert.equal(gateCalls, 1, 'a later email rescan does not call the AI gate again for a decided proposal');
  assert.equal(rescanned.customerActivities.decisions.length, 1);
  assert.equal(rescanned.customerActivities.tasks.length, 0);
}

function recommendedNumericConfig(revision: number): ActivityDecisionConfig {
  return { ...structuredClone(DEFAULT_ACTIVITY_DECISION_CONFIG), revision };
}

async function runNumericTechnicalDecision(
  userId: string,
  targetNpcId: TestNpcId,
  metrics: Partial<Record<TestNpcId, TestOrganizationMetrics>>,
  config: ActivityDecisionConfig,
  initiator: 'sales' | 'customer' = 'sales',
) {
  const store = new PreviewSessionStore();
  const service = createNumericTechnicalProposalService(store);
  const state = store.create(userId);
  setOrganizationMetrics(state, metrics);
  const messages = initiator === 'sales'
    ? [
        { messageId: `${userId}-proposal`, speaker: 'sales' as const, text: '建议组织一次技术交流会，围绕接口适配讨论。' },
        { messageId: `${userId}-response`, speaker: 'customer' as const, text: '我需要和相关负责人沟通后再回复。' },
      ]
    : [
        { messageId: `${userId}-proposal`, speaker: 'customer' as const, text: '能否安排一次技术交流会？' },
        { messageId: `${userId}-response`, speaker: 'sales' as const, text: '我确认并同意协调这次技术交流会。' },
      ];
  seedEmailConversation(state, messages, targetNpcId);
  const response = await execute(service, userId, state.previewSessionId, 0,
    { action: 'customer_activity_end_conversation', npcId: targetNpcId, channel: 'email' }, config);
  return { store, service, state: store.get(userId, state.previewSessionId)!, response };
}

async function settleWithFakePersistence(
  service: ReturnType<typeof createPreviewAiService>,
  state: ReturnType<typeof createPreviewServerState>,
  config: ActivityDecisionConfig,
) {
  let persistedState = state;
  const persistence: PreviewSessionPersistence = {
    async acquire(_userId, request) {
      return {
        previewSessionId: persistedState.previewSessionId,
        version: persistedState.version,
        state: structuredClone(persistedState),
        leaseToken: `legacy-${request.commandId}`,
      };
    },
    async renew() {},
    async commit(args) {
      persistedState = args.state;
      return args.response;
    },
    async abandon() {},
  };
  const response = await service.executePersistent(
    persistedState.userId,
    requestFor(persistedState.previewSessionId, persistedState.version, { action: 'customer_activity_sync' }),
    persistence,
    undefined,
    config,
  );
  return { state: persistedState, response };
}

async function testOrganizationNumericGateAndLegacyQueue() {
  const config = recommendedNumericConfig(21);
  const baseline = await runNumericTechnicalDecision(
    'preview-org-default-team',
    'P1-001',
    {},
    config,
  );
  assert.equal(baseline.state.customerActivities.decisions[0].decision, 'reject',
    'new preview sessions start at support 0 / pleasantness 50 and do not meet the recommended whole-team threshold');
  assert.deepEqual(baseline.state.customerActivities.decisions[0].relationshipSnapshot.organization?.members.map((member) => member.npcId),
    CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS, 'the decision snapshot freezes all five organization members in canonical order');

  const allAt55 = Object.fromEntries(CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => [npcId, { support: 0, pleasantness: 55 }])) as Record<TestNpcId, TestOrganizationMetrics>;
  const oneHigh = await runNumericTechnicalDecision(
    'preview-org-one-high',
    'P1-002',
    { ...allAt55, 'P1-001': { support: 100, pleasantness: 55 } },
    config,
  );
  assert.equal(oneHigh.state.customerActivities.decisions[0].decision, 'reject',
    'one highly supportive organization member cannot satisfy the two-person OR-of-AND paths');
  assert.equal(oneHigh.state.customerActivities.tasks.length, 0);

  const technicalTeam = {
    ...allAt55,
    'P1-002': { support: 12, pleasantness: 55 },
    'P1-004': { support: 8, pleasantness: 55 },
  } satisfies Record<TestNpcId, TestOrganizationMetrics>;
  const firstTarget = await runNumericTechnicalDecision('preview-org-target-a', 'P1-002', technicalTeam, config);
  const secondTarget = await runNumericTechnicalDecision('preview-org-target-b', 'P1-001', technicalTeam, config);
  assert.equal(firstTarget.state.customerActivities.decisions[0].decision, 'allow',
    'Li Minghui at 12/55 and Zhao Xiaochen at 8/55 satisfy the technical-meeting recommendation');
  assert.equal(secondTarget.state.customerActivities.decisions[0].decision, 'allow',
    'the same five-person team produces the same gate result for another target NPC');
  assert.deepEqual(firstTarget.state.customerActivities.decisions[0].relationshipSnapshot.organization,
    secondTarget.state.customerActivities.decisions[0].relationshipSnapshot.organization,
    'changing the target NPC does not change the frozen team snapshot');

  const belowGlobalPleasantness = await runNumericTechnicalDecision(
    'preview-org-pleasantness-19',
    'P1-002',
    { ...technicalTeam, 'P1-003': { support: 0, pleasantness: 19 } },
    config,
  );
  assert.equal(belowGlobalPleasantness.state.customerActivities.decisions[0].decision, 'reject',
    'one organization member below the global pleasantness floor blocks the otherwise qualified pair');

  const customerInitiated = await runNumericTechnicalDecision(
    'preview-org-customer-proposal',
    'P1-002',
    { ...allAt55, 'P1-001': { support: 100, pleasantness: 55 } },
    config,
    'customer',
  );
  assert.equal(customerInitiated.state.customerActivities.decisions[0].decision, 'reject',
    'a customer-proposed activity still passes through the organization gate in numeric mode');

  const frozenUser = 'preview-org-frozen-retry';
  const frozenStore = new PreviewSessionStore();
  const detectorState = { failuresRemaining: 1 };
  const frozenService = createNumericTechnicalProposalService(frozenStore, detectorState);
  const frozenState = frozenStore.create(frozenUser);
  const initialFrozenTeam = {
    ...allAt55,
    'P1-002': { support: 12, pleasantness: 55 },
  } satisfies Record<TestNpcId, TestOrganizationMetrics>;
  setOrganizationMetrics(frozenState, initialFrozenTeam);
  seedEmailConversation(frozenState, [
    { messageId: 'org-freeze-proposal', speaker: 'customer', text: '能否安排一次技术交流会，围绕接口适配讨论？' },
    { messageId: 'org-freeze-response', speaker: 'sales', text: '我确认并同意协调这次技术交流会。' },
  ], 'P1-002');
  const response = await execute(frozenService, frozenUser, frozenState.previewSessionId, 0,
    { action: 'customer_activity_end_conversation', npcId: 'P1-002', channel: 'email' }, config);
  const queued = frozenStore.get(frozenUser, frozenState.previewSessionId)!;
  const frozenOrganization = structuredClone(queued.pendingCustomerActivityDetections[0].relationshipSnapshot.organization);
  assert.equal(queued.pendingCustomerActivityDetections.length, 1, 'detector failure leaves the ended conversation and decision snapshot queued');
  const serialized = JSON.parse(JSON.stringify(toPersistedPreviewServerState(queued))) as {
    userId: string;
    previewSessionId: string;
    version: number;
    pendingCustomerActivityDetections: Array<Record<string, unknown> & {
      relationshipSnapshot?: Record<string, unknown> & { organization?: unknown };
      decisionConfig?: unknown;
    }>;
  };
  const restored = fromPersistedPreviewServerState(serialized, frozenUser, frozenState.previewSessionId, queued.version);
  assert.deepEqual(restored.pendingCustomerActivityDetections[0].relationshipSnapshot.organization, frozenOrganization,
    'the full team snapshot survives persisted JSON restoration');

  queued.npcStates['P1-004'].support = 8;
  assert.equal(queued.npcStates['P1-002'].support, 12);
  await execute(frozenService, frozenUser, frozenState.previewSessionId, response.version,
    { action: 'customer_activity_sync' }, config);
  const frozenDecisionState = frozenStore.get(frozenUser, frozenState.previewSessionId)!;
  assert.equal(frozenDecisionState.customerActivities.decisions[0].decision, 'reject',
    'a non-target NPC improving after the end boundary cannot change the queued decision');
  assert.equal(frozenDecisionState.customerActivities.decisions[0].relationshipSnapshot.organization?.members.find((member) => member.npcId === 'P1-004')?.support, 0);
  assert.equal(frozenDecisionState.pendingCustomerActivityDetections.length, 0);

  for (const legacyKind of ['snapshot-without-organization', 'no-snapshot'] as const) {
    const legacyUser = `preview-org-legacy-${legacyKind}`;
    const legacySessionId = `legacy-session-${legacyKind}`;
    const oldPersisted = structuredClone(serialized);
    oldPersisted.userId = legacyUser;
    oldPersisted.previewSessionId = legacySessionId;
    const oldQueue = oldPersisted.pendingCustomerActivityDetections[0];
    if (legacyKind === 'snapshot-without-organization') {
      if (oldQueue.relationshipSnapshot) delete oldQueue.relationshipSnapshot.organization;
    } else {
      delete oldQueue.relationshipSnapshot;
      delete oldQueue.decisionConfig;
    }
    const legacyState = fromPersistedPreviewServerState(oldPersisted, legacyUser, legacySessionId, oldPersisted.version);
    assert.equal(legacyState.pendingCustomerActivityDetections[0].relationshipSnapshot.organization, undefined,
      'restoration never synthesizes a missing historical organization snapshot from current state');
    setOrganizationMetrics(legacyState, technicalTeam);
    const legacyService = createNumericTechnicalProposalService(new PreviewSessionStore());
    const legacyResult = await settleWithFakePersistence(legacyService, legacyState, recommendedNumericConfig(22));
    assert.equal(legacyResult.state.customerActivities.decisions[0].decision, 'reject',
      'a legacy pending queue without a frozen team cannot pass by borrowing newer team metrics');
    assert.equal(legacyResult.state.customerActivities.decisions[0].relationshipSnapshot.organization, undefined);
    assert.equal(legacyResult.state.pendingCustomerActivityDetections.length, 0);
  }
}

async function testServerAuthoritativeTimeout() {
  const userId = 'preview-activity-timeout';
  const store = new PreviewSessionStore();
  let evaluationPromptCalls = 0;
  const service = createPreviewAiService({
    store,
    invoker: async (messages) => {
      if (messages[0]?.content.includes('销售活动策划的复盘评价器')) {
        evaluationPromptCalls += 1;
        throw new Error('an empty activity plan must use deterministic evaluation');
      }
      assert.ok(messages[0]?.content.includes('活动提议语义识别器'));
      return json(modelCandidate(messagesFromDetectionPrompt(messages[messages.length - 1].content), 'company_visit'));
    },
    jevInvoker: async () => { throw new Error('customer confirmation and blank evaluation do not need Jev'); },
  });
  const state = store.create(userId);
  seedEmailConversation(state, [
    { messageId: 'company-proposal-1', speaker: 'customer', text: '可以安排一次到你们公司参观吗？' },
    { messageId: 'company-confirm-1', speaker: 'sales', text: '可以，我来协调客户参观我们公司。' },
  ]);
  let response = await execute(service, userId, state.previewSessionId, 0,
    { action: 'customer_activity_end_conversation', npcId: 'P1-002', channel: 'email' }, legacyAiDecisionConfig);
  let current = store.get(userId, state.previewSessionId)!;
  assert.equal(current.customerActivities.tasks[0].type, 'company_visit');
  const taskId = current.customerActivities.tasks[0].id;
  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_start', taskId });
  current = store.get(userId, state.previewSessionId)!;
  current.npcStates['P1-002'].support = 10;
  current.npcStates['P1-002'].pleasantness = 55;
  current.npcStates['P1-002'].dimensionScores.decisionAnalysis = 5;
  current.npcStates['P1-002'].dimensionScores.valuePresentation = 7;
  const deadlineAt = Date.now() - 1;
  current.customerActivities.tasks[0].deadlineAt = deadlineAt;

  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_sync' });
  current = store.get(userId, state.previewSessionId)!;
  const timedOut = current.customerActivities.tasks[0];
  assert.equal(timedOut.status, 'submitted', 'a server sync/save request after expiry performs auto-submit');
  assert.equal(timedOut.submitReason, 'timeout');
  assert.equal(timedOut.submittedAt, deadlineAt, 'timeout records the server deadline, not the later sync time');
  assert.equal(timedOut.draft, '', 'text sent after the deadline cannot replace the last saved server draft');
  assert.equal(timedOut.quiz?.status, 'answering', 'a plan timeout starts the separate quiz timer at the planning deadline');
  assert.equal(timedOut.quiz?.startedAt, deadlineAt);
  assert.equal(timedOut.quiz?.deadlineAt, deadlineAt + 120_000);
  assert.equal(timedOut.evaluation, undefined, 'an empty plan still waits for the quiz deadline before evaluation');
  assert.equal(current.npcStates['P1-002'].support, 10, 'plan timeout does not immediately alter the NPC score');
  assert.equal(current.npcStates['P1-002'].pleasantness, 55);
  assert.equal(current.npcStates['P1-002'].dimensionScores.decisionAnalysis, 5);
  assert.equal(evaluationPromptCalls, 0, 'timeout submission does not call the evaluator during the quiz window');

  const quizStartedAt = Date.now() - 120_001;
  current.customerActivities.tasks[0]!.quiz!.startedAt = quizStartedAt;
  current.customerActivities.tasks[0]!.quiz!.deadlineAt = quizStartedAt + 120_000;
  assert.equal(hasCustomerActivitySettlementWork(current, quizStartedAt + 120_000), true,
    'an expired quiz becomes background settlement work');
  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_sync' });
  current = store.get(userId, state.previewSessionId)!;
  const quizTimedOut = current.customerActivities.tasks[0];
  assert.equal(quizTimedOut?.quiz?.status, 'completed', 'a server sync completes an expired quiz after reload');
  assert.equal(quizTimedOut?.quiz?.completedAt, quizStartedAt + 120_000);
  assert.ok(quizTimedOut?.evaluation, 'the expired quiz then receives its one-time plan evaluation');
  assert.deepEqual(quizTimedOut?.evaluation, {
    supportDelta: -2,
    pleasureDelta: -3,
    dimensionDeltas: {
      decisionAnalysis: -1,
      relationshipBuilding: 0,
      valuePresentation: -1,
      objectionHandling: 0,
      informationDiscovery: 0,
    },
    overallEvaluation: '活动准备不充分，本次未能推进。',
  });
  assert.equal(current.npcStates['P1-002'].support, 8, 'an empty timeout draft applies the fixed support penalty');
  assert.equal(current.npcStates['P1-002'].pleasantness, 52, 'an empty timeout draft applies the fixed pleasure penalty');
  assert.equal(current.npcStates['P1-002'].dimensionScores.decisionAnalysis, 4);
  assert.equal(current.npcStates['P1-002'].dimensionScores.valuePresentation, 6);
  assert.equal(evaluationPromptCalls, 0, 'an empty timeout draft does not call the LLM evaluation prompt');
  assert.ok(response.customerActivities);
  assert.equal(response.customerActivities.tasks[0].evaluation?.overallEvaluation,
    CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE);
  assert.equal(response.customerActivities.serverNow, Math.floor(response.customerActivities.serverNow));

  response = await execute(service, userId, state.previewSessionId, response.version,
    { action: 'customer_activity_sync' });
  current = store.get(userId, state.previewSessionId)!;
  assert.equal(current.npcStates['P1-002'].support, 8, 'repeated preview sync does not reapply the empty-plan penalty');
  assert.equal(current.npcStates['P1-002'].pleasantness, 52);
  assert.equal(current.npcStates['P1-002'].dimensionScores.decisionAnalysis, 4);
  assert.equal(evaluationPromptCalls, 0);
}

async function testFeasibilityRouterAndReplyGuards() {
  const sentinelBase: JevInvoker = async () => { throw new Error('test router base should not run'); };
  let routedTask: string | undefined;
  const routedInvoker = createPreviewCustomerActivityJevInvoker(async (taskId, request, baseInvoker) => {
    routedTask = taskId;
    assert.equal(typeof request.state, 'object', 'activity feasibility receives the new structured state payload');
    assert.equal(baseInvoker, sentinelBase);
    return { answers: { decision: { type: 'choice', choice: 'allow', probabilities: { allow: 1 }, confidence: 1 } } };
  }, sentinelBase);
  await routedInvoker({ state: { activityType: 'technical_meeting' }, questions: { decision: { type: 'choice', instructions: 'test', criteria: { allow: '允许', reject: '拒绝' } } } });
  assert.equal(routedTask, 'customer_activity_feasibility', 'default activity decisions route to the dedicated designer task, not the string-only preview router');

  const prompts: string[] = [];
  let exactRefusalReplyAttempts = 0;
  let followupReplyAttempts = 0;
  const nonProposalActivityInputs = new Set([
    '这次技术交流会不能安排。',
    '我们先不安排一次技术交流会。',
    '取消技术交流会。',
  ]);
  const nonProposalActivityFlags: boolean[] = [];
  const service = createPreviewAiService({
    invoker: async (messages) => {
      const prompt = messages.map((message) => message.content).join('\n');
      prompts.push(prompt);
      if (messages[0]?.content.includes('客户活动回复的上下文语义复核器')) {
        const reviewBlock = messages.at(-1)?.content.match(/<untrusted_data label="customer_activity_reply_review">\r?\n([\s\S]*?)\r?\n<\/untrusted_data>/)?.[1];
        const reviewInput = reviewBlock ? JSON.parse(reviewBlock) as { currentPlayerMessage?: string; actualNpcReply?: string } : {};
        const playerText = reviewInput.currentPlayerMessage ?? '';
        const reply = reviewInput.actualNpcReply ?? '';
        if (/(?:撤回|取消|先不办)/u.test(playerText)) return json({ decision: 'allowed', issue: 'none' });
        const issue = /(?:建议您|请您先|您先).{0,12}(?:联系|找|沟通|对接)/u.test(reply)
          ? 'player_referral'
          : /(?:没法安排|不能安排|不接受|不安排|按正常流程(?:走|来))/u.test(reply)
            ? 'ordinary_refusal'
            : /(?:安排好了|可以安排|欢迎您来|时间已经确定|就下周|下周.{0,8}(?:见|参加|安排))/u.test(reply)
              ? 'premature_acceptance'
              : 'none';
        return issue === 'none'
          ? json({ decision: 'allowed', issue: 'none' })
          : json({ decision: 'violation', issue, evidence: reply });
      }
      if (messages[0]?.content.includes('活动提议语义识别器')) return json({ activities: [] });
      if (messages[0]?.content.includes('独立评估刚刚完成的 NPC 正文')) return json({ memorySuggestions: [] });
      const inputMessage = messages.find((message) => message.content.includes('label="project_one_preview_input"'));
      const inputMatch = inputMessage?.content.match(/<untrusted_data label="project_one_preview_input">\r?\n([\s\S]*?)\r?\n<\/untrusted_data>/);
      const input = inputMatch ? JSON.parse(inputMatch[1]) as { customerActivityProposal?: boolean; playerText?: string } : {};
      if (nonProposalActivityInputs.has(input.playerText ?? '')) nonProposalActivityFlags.push(input.customerActivityProposal === true);
      const appointment = { timeWindow: '下周一上午', location: '客户会议室', agenda: '讨论项目接口与验收安排' };
      if (input.customerActivityProposal && input.playerText?.includes('不是不能安排')) {
        return json({ content: '这个建议我先记下了，会先向上级汇报，再给您反馈。' });
      }
      if (input.customerActivityProposal && input.playerText === '那就下周三？') {
        followupReplyAttempts += 1;
        return json({ content: followupReplyAttempts === 1
          ? '可以，就下周三，时间已经确定了。'
          : '时间还没有确认，我先向上级汇报，再给您反馈。' });
      }
      if (input.customerActivityProposal && /(?:撤回|取消|先不办)/u.test(input.playerText ?? '')) {
        return json({ content: '收到，我记下您先不安排这次活动的决定。' });
      }
      if (input.customerActivityProposal && input.playerText?.includes('贵单位提具体需求')) {
        exactRefusalReplyAttempts += 1;
        return json({ content: exactRefusalReplyAttempts === 1
          ? '嗯……这个我这边暂时还没法安排，具体需求也不是我个人能定的。您看哈，先按正常流程来吧。'
          : '这个建议我先记下了，我会先向上汇报，再给您反馈。' });
      }
      if (input.customerActivityProposal && input.playerText?.includes('流程测试回退')) {
        return json({ content: '请您先按正常流程走。' });
      }
      if (input.customerActivityProposal && input.playerText?.includes('专项技术交流')) {
        return json({ content: '建议您先和实际负责项目的同事沟通，确认后再答复您。' });
      }
      if (input.customerActivityProposal && input.playerText?.includes('检查拒绝守卫')) {
        return json({ content: '这次我不接受，也不安排。' });
      }
      if (input.customerActivityProposal) return json({ content: '已经安排好了，欢迎您來参观。', appointment });
      if (input.playerText?.includes('拜访')) return json({ content: '可以，预约下周一上午在客户会议室讨论验收。', appointment });
      if (input.playerText?.includes('取消')) return json({ content: '收到，这次技术交流会先取消，后续再确认。' });
      return json({ content: '请按正式流程沟通。' });
    },
    jevInvoker: selectionJev((id, state, criteria) => {
      if (id === 'responseAction') return 'reply';
      if (id === 'invitationStatus') return state.includes('明天方便') ? 'accepted' : state.includes('取消') ? 'rejected' : 'none';
      if (criteria['0'] !== undefined) return '0';
      return Object.keys(criteria)[0] ?? 'none';
    }),
  });
  const caseMatrix = [
    { npcId: 'P1-001', text: '建议安排一次技术交流会。', expect: '内部商量' },
    { npcId: 'P1-002', text: '建议安排一次案例现场参观。', expect: '向上级汇报' },
    { npcId: 'P1-004', text: '建议安排一次案例现场参观。', expect: '向上级汇报' },
  ] as const;
  for (const row of caseMatrix) {
    const userId = `reply-guard-${row.npcId}`;
    const response = await service.execute(userId, requestFor('', 0, { action: 'message', npcId: row.npcId, channel: 'email', text: row.text }));
    assert.ok(response.content?.includes(row.expect), `${row.npcId} receives a role-level ambiguous response: ${JSON.stringify(response)}`);
    assert.equal(response.invitationStatus, 'none');
    assert.equal(response.appointment, undefined, 'activity proposals never create normal appointments');
    const state = service.store.get(userId, response.previewSessionId)!;
    assert.equal(state.appointments[row.npcId], undefined);
  }

  const followupUser = 'reply-guard-multiturn-double-negation';
  const firstProposal = await service.execute(followupUser, requestFor('', 0, {
    action: 'message', npcId: 'P1-004', channel: 'work_phone', text: '不是不能安排技术交流会，先讨论具体需求。',
  }));
  const unresolvedDate = await service.execute(followupUser, requestFor(firstProposal.previewSessionId, firstProposal.version, {
    action: 'message', npcId: 'P1-004', channel: 'work_phone', text: '那就下周三？',
  }));
  assert.match(unresolvedDate.content ?? '', /向上级汇报，再给您反馈/u,
    'a date-only follow-up after a double-negated proposal remains unresolved and role-appropriate');
  assert.equal(unresolvedDate.appointment, undefined);
  assert.equal(unresolvedDate.invitationStatus, 'none');
  assert.equal(service.store.get(followupUser, unresolvedDate.previewSessionId)!.appointments['P1-004'], undefined,
    'a date follow-up does not create an ordinary appointment before activity matching');

  const referral = await service.execute('reply-guard-no-referral', requestFor('', 0, {
    action: 'message', npcId: 'P1-001', channel: 'email', text: '我们想安排一次专项技术交流会。',
  }));
  assert.match(referral.content ?? '', /内部商量/,
    'a vague response that redirects the player is repaired or replaced with internal consideration');
  assert.doesNotMatch(referral.content ?? '', /建议您|先和实际负责|联系其他/);

  const refusedActivity = await service.execute('reply-guard-refusal', requestFor('', 0, {
    action: 'message', npcId: 'P1-004', channel: 'work_phone', text: '建议考虑安排一次技术交流会，检查拒绝守卫。',
  }));
  assert.doesNotMatch(refusedActivity.content ?? '', /不接受|不安排/,
    'the NPC quality gate repairs a direct refusal/cancellation of an ordinary activity');
  assert.match(refusedActivity.content ?? '', /向上级汇报/);

  const actualRefusalReply = await service.execute('reply-guard-real-refusal', requestFor('', 0, {
    action: 'message', npcId: 'P1-004', channel: 'work_phone',
    text: '赵老师您好，我觉得咱们可以办一个技术交流会，贵单位提具体需求，我们来提供技术方案，您看能不能安排一下？',
  }));
  assert.equal(exactRefusalReplyAttempts, 2, 'the exact real-world refusal is retried once by the NPC reply quality gate');
  assert.match(actualRefusalReply.content ?? '', /先向上汇报，再给您反馈/,
    'the repaired response keeps the decision internal and promises a follow-up reply');
  assert.doesNotMatch(actualRefusalReply.content ?? '', /没法安排|正常流程/);
  assert.equal(actualRefusalReply.invitationStatus, 'none');

  const fallbackRefusalReply = await service.execute('reply-guard-process-fallback', requestFor('', 0, {
    action: 'message', npcId: 'P1-004', channel: 'email', text: '下周安排一个技术交流会，流程测试回退。',
  }));
  assert.match(fallbackRefusalReply.content ?? '', /向上级汇报，再给您反馈/,
    'the preview fallback uses role-appropriate internal handling and follow-up');
  assert.doesNotMatch(fallbackRefusalReply.content ?? '', /按正常流程走|先走流程|没法安排/);

  const ordinaryUser = 'reply-guard-ordinary-appointment';
  const ordinary = await service.execute(ordinaryUser, requestFor('', 0, {
    action: 'message', npcId: 'P1-002', channel: 'email', text: '明天方便到客户办公室拜访吗？',
  }));
  assert.equal(ordinary.invitationStatus, 'accepted', 'ordinary visit appointments still use the existing invitation flow');
  assert.ok(ordinary.appointment);
  assert.equal(service.store.get(ordinaryUser, ordinary.previewSessionId)!.appointments['P1-002']?.status, 'accepted');

  const redlineUser = 'reply-guard-hard-blocker';
  const redline = await service.execute(redlineUser, requestFor('', 0, {
    action: 'message', npcId: 'P1-003', channel: 'email', text: '我们愿意提供现金回扣，也安排技术交流会。',
  }));
  assert.match(redline.content ?? '', /不能接受或继续讨论/, 'the compliance refusal takes precedence over vague activity wording');
  assert.equal(redline.appointment, undefined);

  const cancelledUser = 'reply-guard-cancelled';
  const cancelled = await service.execute(cancelledUser, requestFor('', 0, {
    action: 'message', npcId: 'P1-002', channel: 'email', text: '这次取消技术交流会，后续再确认。',
  }));
  assert.match(cancelled.content ?? '', /记下|不安排/u);
  const cancellationPrompts = prompts.filter((prompt) => prompt.includes('这次取消技术交流会'));
  assert.equal(cancellationPrompts.some((prompt) => /客户活动提议边界/.test(prompt)), true,
    'an explicit withdrawal still enters contextual review so the NPC can acknowledge it without forcing a report');
  for (const [index, text] of [
    '这次技术交流会不能安排。',
    '我们先不安排一次技术交流会。',
    '取消技术交流会。',
  ].entries()) {
    await service.execute(`reply-guard-negative-prefilter-${index}`, requestFor('', 0, {
      action: 'message', npcId: 'P1-004', channel: 'email', text,
    }));
  }
  assert.ok(nonProposalActivityFlags.length >= nonProposalActivityInputs.size
    && nonProposalActivityFlags.every((flag) => flag),
    'ambiguous negative/cancellation wording is routed through context review rather than filtered by keywords');
}

async function testPersistentPhoneProposalFlowAndDiagnostics() {
  const proposalTexts = [
    '赵老师您好，我想问问看下周要不要开一个技术交流会，这样可以直接对需求。',
    '赵老师您好，我想问问看能不能咱们下周召开一个技术交流会，正好也把您这边的需求和我们对一下，提高效率。',
  ];
  const config = recommendedNumericConfig(47);

  for (const [index, proposalText] of proposalTexts.entries()) {
    const userId = `preview-persisted-phone-proposal-${index}`;
    const previewSessionId = randomUUID().replace(/-/g, '');
    const initialState = createPreviewServerState(userId, previewSessionId);
    let persistedVersion = initialState.version;
    let persistedJson = JSON.stringify(toPersistedPreviewServerState(initialState));
    let activityDetectorCalls = 0;
    let acquireCount = 0;
    let commitCount = 0;

    const persistence: PreviewSessionPersistence = {
      async acquire(requestUserId, request) {
        assert.equal(requestUserId, userId);
        assert.equal(request.previewSessionId, previewSessionId);
        assert.equal(request.expectedVersion, persistedVersion);
        acquireCount += 1;
        return {
          previewSessionId,
          version: persistedVersion,
          state: fromPersistedPreviewServerState(JSON.parse(persistedJson), userId, previewSessionId, persistedVersion),
          leaseToken: `phone-regression-${request.commandId}`,
        };
      },
      async renew() {},
      async commit(args) {
        assert.equal(args.expectedVersion, persistedVersion);
        assert.equal(args.state.version, persistedVersion + 1);
        persistedVersion = args.state.version;
        persistedJson = JSON.stringify(toPersistedPreviewServerState(args.state));
        commitCount += 1;
        return args.response;
      },
      async abandon() {},
    };

    const invoker = async (messages: Array<{ role: string; content: string }>) => {
      const system = messages[0]?.content ?? '';
      if (system.includes('活动提议语义识别器')) {
        activityDetectorCalls += 1;
        if (index === 1) throw new Error('temporary semantic lookup outage');
        return json(modelCandidate(messagesFromDetectionPrompt(messages.at(-1)?.content ?? ''), 'technical_meeting'));
      }
      if (system.includes('独立评估刚刚完成的 NPC 正文')) return json({ memorySuggestions: [] });

      const inputMessage = messages.find((message) => message.content.includes('label="project_one_preview_input"'));
      const inputMatch = inputMessage?.content.match(/<untrusted_data label="project_one_preview_input">\r?\n([\s\S]*?)\r?\n<\/untrusted_data>/);
      const input = inputMatch ? JSON.parse(inputMatch[1]) as { playerText?: string } : {};
      if (input.playerText === proposalText) {
        return json({ content: '这类安排我需要先向上级汇报，确认后再答复。' });
      }
      if (system.includes('只输出正文及可选的预约具体安排')) {
        return json({ content: '您好，我是赵晓晨，请问有什么事？' });
      }
      return json({ content: '我会先核实项目进度，再答复您。' });
    };

    const service = createPreviewAiService({
      invoker,
      leaseRenewIntervalMs: 60_000,
      jevInvoker: selectionJev((id, _state, criteria) => {
        if (id === 'responseAction') return 'reply';
        if (id === 'invitationStatus') return 'none';
        if (criteria['0'] !== undefined) return '0';
        return Object.keys(criteria)[0] ?? 'none';
      }),
    });
    const run = (action: Record<string, unknown>) => service.executePersistent(
      userId,
      requestFor(previewSessionId, persistedVersion, action),
      persistence,
      undefined,
      config,
    );
    const restored = () => fromPersistedPreviewServerState(
      JSON.parse(persistedJson), userId, previewSessionId, persistedVersion,
    );

    let response = await run({
      action: 'phone_connect', npcId: 'P1-004',
      text: '赵老师您好，我给您打电话，想了解一下需求落实进度。',
    });
    let current = restored();
    assert.equal(current.activeCustomerActivityConversation?.npcId, 'P1-004', 'phone_connect state survives a JSON serialize/restore');
    const phoneStarted = current.customerActivityDiagnostics.find((entry) => entry.event === 'phone_conversation_started');
    assert.equal(phoneStarted?.npcId, 'P1-004');
    assert.equal(phoneStarted?.channel, 'work_phone');
    assert.equal(phoneStarted?.conversationId, current.activeCustomerActivityConversation?.conversationId);
    assert.equal(phoneStarted?.details?.startMessageIndex, 0,
      'the server records the conversation boundary when the phone call is actually established');

    response = await run({ action: 'message', npcId: 'P1-004', channel: 'work_phone', text: proposalText });
    current = restored();
    assert.equal(current.activeCustomerActivityConversation?.channel, 'work_phone', 'the proposal remains in the active phone conversation');
    assert.ok(current.conversations['P1-004'].some((message) => message.role === 'player' && message.text === proposalText));
    assert.ok(response.content?.includes('向上级汇报'), 'the player receives the expected vague consideration response');

    await run({
      action: 'test_adjust_npcs',
      adjustments: PREVIEW_NPC_IDS.map((npcId) => ({ npcId, support: 20, pleasantness: 60, effectiveContactCount: 1 })),
    });
    current = restored();
    assert.ok(current.activeCustomerActivityConversation, 'metric changes do not close the active call');
    assert.deepEqual(PREVIEW_NPC_IDS.map((npcId) => [current.npcStates[npcId].support, current.npcStates[npcId].pleasantness]),
      PREVIEW_NPC_IDS.map(() => [20, 60]), 'all five adjusted metrics survive persistence before the call ends');

    response = await run({ action: 'customer_activity_end_conversation', npcId: 'P1-004', channel: 'work_phone' });
    current = restored();
    assert.equal(current.activeCustomerActivityConversation, null);
    const diagnosticEvents = current.customerActivityDiagnostics.map((entry) => entry.event);
    for (const event of ['conversation_queued', 'detection_started']) {
      assert.ok(diagnosticEvents.includes(event), `private diagnostic trail includes ${event}`);
    }
    if (index === 0) {
      assert.equal(current.pendingCustomerActivityDetections.length, 0, 'a model-recognized proposal settles before the response commits');
      assert.equal(current.customerActivities.decisions.length, 1);
      assert.equal(current.customerActivities.tasks.length, 1, 'the five-person 20/60 threshold creates the model-recognized task');
      const task = current.customerActivities.tasks[0];
      assert.equal(task.type, 'technical_meeting');
      assert.equal(task.initiator, 'sales');
      assert.equal(task.responseKind, 'not_required', 'a vague NPC reply is not fabricated into agreement evidence');
      assert.equal(task.decisionRevision, config.revision);
      assert.ok(task.sourceConversation.some((message) => message.speaker === 'customer' && /向上级汇报/.test(message.text)));
      assert.ok(response.customerActivities?.tasks.some((item) => item.id === task.id));
      const acceptedDiagnostic = current.customerActivityDiagnostics.find((entry) => entry.event === 'candidate_accepted');
      assert.equal(acceptedDiagnostic?.reason, 'llm_verified_sales_proposal_enters_feasibility_without_customer_response');
      assert.ok(diagnosticEvents.includes('model_response'));
      for (const event of ['candidate_accepted', 'candidates_count', 'threshold_decision', 'task_created']) {
        assert.ok(diagnosticEvents.includes(event), `model evidence records ${event}`);
      }
      const decisionDiagnostic = current.customerActivityDiagnostics.find((entry) => entry.event === 'threshold_decision');
      assert.equal(decisionDiagnostic?.decision, 'allow');
      assert.equal(decisionDiagnostic?.configRevision, config.revision);
      assert.equal(decisionDiagnostic?.organizationSnapshot?.length, 5);
      assert.ok(decisionDiagnostic?.organizationSnapshot?.every((member) => member.support === 20 && member.pleasantness === 60));
    } else {
      assert.ok(diagnosticEvents.includes('model_error'), 'a semantic model error is recorded');
      assert.ok(diagnosticEvents.includes('detection_retryable_error'));
      assert.equal(current.pendingCustomerActivityDetections.length, 1, 'failed semantic matching leaves the conversation queued for retry');
      assert.equal(current.customerActivities.decisions.length, 0);
      assert.equal(current.customerActivities.tasks.length, 0, 'a provider error does not fall back to a keyword-created task');
      assert.equal(response.customerActivities?.unavailableNotices.length, 0);
      assert.equal(diagnosticEvents.includes('candidate_accepted'), false);
    }
    assert.equal(activityDetectorCalls, 1, 'the detector runs once while settling the ended conversation');

    assert.equal('customerActivityDiagnostics' in toPreviewRecoveryDto(current), false,
      'the internal decision trace is not exposed through the player recovery DTO');
    assert.equal(JSON.stringify(response).includes('customerActivityDiagnostics'), false,
      'the internal decision trace is not exposed in ordinary action responses');
    assert.ok(JSON.parse(persistedJson).customerActivityDiagnostics.length > 0,
      'the diagnostic trail is included in the persisted server session state');

    await run({ action: 'customer_activity_end_conversation', npcId: 'P1-004', channel: 'work_phone' });
    current = restored();
    assert.equal(current.customerActivities.tasks.length, index === 0 ? 1 : 0,
      'repeating end cannot create a task without model evidence');
    assert.equal(current.customerActivities.decisions.length, index === 0 ? 1 : 0,
      'repeating end cannot record a decision without model evidence');
    assert.ok(current.customerActivityDiagnostics.some((entry) => entry.event === 'phone_end_without_active_call'),
      'a hangup with no active call leaves an explicit internal diagnostic');
    assert.equal(acquireCount, 5, 'every command reacquires and restores persisted JSON state');
    assert.equal(commitCount, 5, 'the complete phone interaction sequence persists every command');
  }

  const noReplyUser = 'preview-sales-proposal-without-customer-reply';
  const noReplyStore = new PreviewSessionStore();
  const noReplyService = createNumericTechnicalProposalService(noReplyStore);
  const noReplyState = noReplyStore.create(noReplyUser);
  setOrganizationMetrics(noReplyState, Object.fromEntries(
    CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => [npcId, { support: 20, pleasantness: 60 }]),
  ) as Record<TestNpcId, TestOrganizationMetrics>);
  seedEmailConversation(noReplyState, [
    { messageId: 'sales-proposal-without-reply', speaker: 'sales', text: '建议下周召开技术交流会，讨论现有需求。' },
  ], 'P1-004');
  const noReplyResponse = await execute(noReplyService, noReplyUser, noReplyState.previewSessionId, 0,
    { action: 'customer_activity_end_conversation', npcId: 'P1-004', channel: 'email' }, config);
  const noReplyCurrent = noReplyStore.get(noReplyUser, noReplyState.previewSessionId)!;
  assert.equal(noReplyCurrent.pendingCustomerActivityDetections.length, 0);
  assert.equal(noReplyCurrent.customerActivities.tasks.length, 1,
    'a single salesperson proposal enters feasibility even when the customer produced no response message');
  assert.equal(noReplyResponse.customerActivities?.tasks.length, 1);

  const legacy = toPersistedPreviewServerState(createPreviewServerState('legacy-diagnostic-session', randomUUID().replace(/-/g, '')));
  delete (legacy as Partial<typeof legacy>).customerActivityDiagnostics;
  const restoredLegacy = fromPersistedPreviewServerState(legacy, legacy.userId, legacy.previewSessionId, legacy.version);
  assert.deepEqual(restoredLegacy.customerActivityDiagnostics, [], 'old preview session rows restore with an empty private diagnostic log');
}

async function testProposalMergeAndLowConfidenceFiltering() {
  const conversationId = 'preview-proposal-merge-and-confidence';
  const npcId = 'P1-004';
  const messages = [
    { messageId: 'sales-tech', speaker: 'sales', text: '我建议下周召开技术交流会，先对一下系统需求。' },
    { messageId: 'customer-case', speaker: 'customer', text: '能否安排一次案例现场参观，看看之前项目的实际运行？' },
    { messageId: 'sales-case-confirm', speaker: 'sales', text: '可以，我来协调案例现场参观。' },
    { messageId: 'customer-company', speaker: 'customer', text: '是否能安排到你们公司参观一下？' },
    { messageId: 'sales-company-confirm', speaker: 'sales', text: '可以，我来协调公司参观。' },
  ] satisfies CustomerActivityConversationMessage[];
  const diagnostics: Array<{ event: string; reason?: string; activityType?: string; messageId?: string }> = [];
  let semanticCalls = 0;
  const candidates = await detectCustomerActivityProposals({
    conversationEnded: true,
    conversationId,
    npcId,
    messages,
  }, {
    invoker: async () => {
      semanticCalls += 1;
      return json({
        activities: [
          {
            type: 'technical_meeting',
            initiator: 'sales',
            proposal: { messageId: 'sales-tech', quote: '我建议下周召开技术交流会' },
          },
          {
            type: 'case_site_visit',
            initiator: 'customer',
            proposal: { messageId: 'customer-case', quote: '案例现场参观' },
            response: { messageId: 'sales-case-confirm', quote: '我来协调案例现场参观', kind: 'explicit_acceptance' },
            finalStatus: 'active',
            finalOutcome: { messageId: 'sales-case-confirm', quote: '我来协调案例现场参观' },
            confidence: 0.98,
          },
          {
            type: 'company_visit',
            initiator: 'customer',
            proposal: { messageId: 'customer-company', quote: '到你们公司参观' },
            response: { messageId: 'sales-company-confirm', quote: '我来协调公司参观', kind: 'explicit_acceptance' },
            finalStatus: 'active',
            finalOutcome: { messageId: 'sales-company-confirm', quote: '我来协调公司参观' },
            confidence: 0.2,
          },
        ],
      });
    },
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  assert.equal(semanticCalls, 1, 'the single semantic request supplies the sales proposal and customer proposal evidence');
  assert.deepEqual(candidates.map((candidate) => candidate.type).sort(), ['case_site_visit', 'technical_meeting']);
  const salesCandidate = candidates.find((candidate) => candidate.type === 'technical_meeting');
  assert.equal(salesCandidate?.initiator, 'sales');
  assert.equal(salesCandidate?.responseKind, 'not_required');
  assert.ok(candidates.some((candidate) => candidate.type === 'case_site_visit' && candidate.initiator === 'customer'),
    'a confirmed customer-initiated activity is retained alongside model-recognized sales evidence');
  assert.ok(!candidates.some((candidate) => candidate.type === 'company_visit'),
    'a low-confidence customer proposal is filtered even when another candidate is accepted');
  assert.ok(diagnostics.some((diagnostic) => diagnostic.event === 'candidate_filtered'
    && diagnostic.reason === 'confidence_below_customer_acceptance_threshold'
    && diagnostic.messageId === 'customer-company'));
}

async function main() {
  await testCustomerConfirmationAndPlanning();
  await testFrozenActivityPlanProviderAndJevFailure();
  await testHospitalityPreviewServiceFlow();
  await testP1005HospitalityMessageFlow();
  await testFrozenNumericGateAndDuplicateDecision();
  await testOrganizationNumericGateAndLegacyQueue();
  await testServerAuthoritativeTimeout();
  await testFeasibilityRouterAndReplyGuards();
  await testProposalMergeAndLowConfidenceFiltering();
  await testPersistentPhoneProposalFlowAndDiagnostics();
  console.log('Preview customer activity integration tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
