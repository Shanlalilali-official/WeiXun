import assert from 'node:assert/strict';
import {
  CUSTOMER_ACTIVITY_PLANNING_MS,
  CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE,
  CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS,
  HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD,
  createResolvedCustomerActivityAgreement,
  createCustomerActivityTasks,
  createEmptyCustomerActivityState,
  DEFAULT_ACTIVITY_DECISION_CONFIG,
  RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS,
  customerActivityRelationshipSnapshotSchema,
  decideOrganizationActivityThreshold,
  finishCustomerActivityPlanningOnRoomEnd,
  finalizeExpiredCustomerActivities,
  completeCustomerActivityQuiz,
  isCustomerActivityReadyForEvaluation,
  isCustomerActivityState,
  parseActivityDecisionConfig,
  parseCustomerActivityState,
  readCustomerActivityState,
  recordCustomerActivityProposalDecision,
  recordCustomerActivityEvaluation,
  saveCustomerActivityDraft,
  startCustomerActivityPlanning,
  submitCustomerActivityPlan,
  toPublicCustomerActivityTask,
  toPublicUnavailableCustomerActivityNotice,
  type ActivityDecisionConfig,
  type CustomerActivityAgreement,
  type CustomerActivityEvaluation,
  type CustomerActivityProposalCandidate,
  type CustomerActivityRelationshipSnapshot,
} from '@/lib/game/customer-activities';
import {
  CustomerActivityDetectionError,
  CustomerActivityDecisionError,
  detectAgreedCustomerActivities,
  detectCustomerActivityProposals,
  decideCustomerActivityFeasibility,
  evaluateCustomerActivityPlan,
} from '@/lib/ai/customer-activities';
import {
  generateNpcReplyWithCustomerActivityGuard,
  hasCustomerActivityDisposition,
  hasCustomerActivityComplianceRefusal,
  hasCustomerActivityRefusal,
} from '@/lib/ai/customer-activity-reply';

const sourceConversation = [
  { messageId: 'm1', speaker: 'sales' as const, text: '我们可以安排一次技术交流会，重点讲接口适配。' },
  { messageId: 'm2', speaker: 'customer' as const, text: '可以，安排技术团队参加。' },
];

const agreement: CustomerActivityAgreement = {
  conversationId: 'meeting-1',
  npcId: 'P1-002',
  sourceConversation,
  type: 'technical_meeting',
  proposalMessageId: 'm1',
  agreementMessageId: 'm2',
  evidence: [
    { messageId: 'm1', speaker: 'sales', kind: 'proposal', quote: '安排一次技术交流会' },
    { messageId: 'm2', speaker: 'customer', kind: 'acceptance', quote: '可以，安排技术团队参加。' },
    { messageId: 'm2', speaker: 'customer', kind: 'final_outcome', quote: '可以，安排技术团队参加。' },
  ],
  summary: '可以，安排技术团队参加。',
};

function makeAgreement(
  conversationId: string,
  type: CustomerActivityAgreement['type'],
  proposal: { messageId: string; speaker: 'sales' | 'customer'; text: string; quote: string },
  acceptance: { messageId: string; speaker: 'sales' | 'customer'; text: string; quote: string },
): CustomerActivityAgreement {
  return {
    conversationId,
    npcId: 'P1-002',
    sourceConversation: [
      { messageId: proposal.messageId, speaker: proposal.speaker, text: proposal.text },
      { messageId: acceptance.messageId, speaker: acceptance.speaker, text: acceptance.text },
    ],
    type,
    proposalMessageId: proposal.messageId,
    agreementMessageId: acceptance.messageId,
    evidence: [
      { messageId: proposal.messageId, speaker: proposal.speaker, kind: 'proposal', quote: proposal.quote },
      { messageId: acceptance.messageId, speaker: acceptance.speaker, kind: 'acceptance', quote: acceptance.quote },
      { messageId: acceptance.messageId, speaker: acceptance.speaker, kind: 'final_outcome', quote: acceptance.quote },
    ],
    summary: acceptance.quote,
  };
}

const evaluation: CustomerActivityEvaluation = {
  supportDelta: 2,
  pleasureDelta: 1,
  dimensionDeltas: {
    decisionAnalysis: 1,
    relationshipBuilding: 0,
    valuePresentation: 2,
    objectionHandling: 0,
    informationDiscovery: 1,
  },
  overallEvaluation: '客户对交流安排更有信心，愿意继续推进。',
};

function taskFrom(state: ReturnType<typeof createEmptyCustomerActivityState>) {
  assert.equal(state.tasks.length, 1);
  return state.tasks[0];
}

async function main() {
  assert.deepEqual(readCustomerActivityState(undefined), createEmptyCustomerActivityState());
  assert.throws(() => readCustomerActivityState({ version: 1, tasks: [{ id: 'corrupt' }] }), /INVALID_CUSTOMER_ACTIVITY_STATE/);
  assert.equal(isCustomerActivityState(createEmptyCustomerActivityState()), true);

  const created = createCustomerActivityTasks(createEmptyCustomerActivityState(), [agreement, agreement], 1_000);
  assert.equal(created.tasks.length, 1, 'duplicate detections in one ended conversation create one task');
  const sameAcceptanceDifferentConversation = {
    ...agreement,
    conversationId: 'late-rescan-conversation-id',
  };
  const deduped = createCustomerActivityTasks(created, [sameAcceptanceDifferentConversation], 2_000);
  assert.equal(deduped.tasks.length, 1, 'stable NPC/type/acceptance message dedupes across channel rescans');
  const sameProposalDifferentAcceptance = makeAgreement(
    'rescanned-email-thread',
    'technical_meeting',
    { messageId: 'm1', speaker: 'sales', text: sourceConversation[0].text, quote: '安排一次技术交流会' },
    { messageId: 'm3', speaker: 'customer', text: '好，就按这个安排。', quote: '好，就按这个安排。' },
  );
  assert.equal(createCustomerActivityTasks(created, [sameProposalDifferentAcceptance], 2_000).tasks.length, 1,
    'the same proposal cannot create a second task when a rescan cites another acceptance message');
  const restored = parseCustomerActivityState(JSON.parse(JSON.stringify(created)));
  assert.equal(restored.tasks[0].id, created.tasks[0].id, 'persisted JSON restores the same task ID');

  const task = taskFrom(created);
  const started = startCustomerActivityPlanning(created, task.id, 10_000);
  assert.equal(started.tasks[0].status, 'planning');
  assert.equal(started.tasks[0].deadlineAt, 10_000 + CUSTOMER_ACTIVITY_PLANNING_MS);
  const repeatedStart = startCustomerActivityPlanning(started, task.id, 50_000);
  assert.equal(repeatedStart.tasks[0].deadlineAt, started.tasks[0].deadlineAt, 'start retries cannot extend the timer');
  assert.deepEqual(startCustomerActivityPlanning(started, 'unknown', 50_000), started, 'another task cannot start while one is planning');

  const saved = saveCustomerActivityDraft(started, task.id, '准备接口适配议题，并邀请技术负责人参加。', 20_000);
  assert.equal(saved.accepted, true);
  const lateSave = saveCustomerActivityDraft(saved.state, task.id, '迟到的新草稿不能覆盖服务端已保存内容', 310_000);
  assert.equal(lateSave.accepted, false);
  assert.equal(lateSave.state.tasks[0].status, 'submitted');
  assert.equal(lateSave.state.tasks[0].draft, '准备接口适配议题，并邀请技术负责人参加。');
  assert.equal(lateSave.state.tasks[0].submittedAt, started.tasks[0].deadlineAt, 'timeout records the actual deadline');
  assert.equal(lateSave.state.tasks[0].submitReason, 'timeout');
  assert.deepEqual(finalizeExpiredCustomerActivities(lateSave.state, 400_000), lateSave.state, 'timeout finalization is idempotent');

  const evaluationBeforeQuiz = recordCustomerActivityEvaluation(lateSave.state, task.id, evaluation, 311_000);
  assert.equal(evaluationBeforeQuiz.applied, false, 'plan submission opens a quiz before evaluation can settle');
  assert.equal(isCustomerActivityReadyForEvaluation(lateSave.state.tasks[0]), false);
  const quizCompleted = completeCustomerActivityQuiz(lateSave.state, task.id, 312_000);
  assert.equal(quizCompleted.tasks[0].quiz?.status, 'completed');
  const recorded = recordCustomerActivityEvaluation(quizCompleted, task.id, evaluation, 313_000);
  assert.equal(recorded.applied, true);
  assert.ok(recorded.evaluation, 'the recorded result includes the combined evaluation used for NPC updates');
  assert.deepEqual(recordCustomerActivityEvaluation(recorded.state, task.id, evaluation, 314_000), {
    state: recorded.state,
    applied: false,
  }, 'settlement marker prevents duplicate metric application');
  const publicTask = toPublicCustomerActivityTask(recorded.state.tasks[0]);
  assert.deepEqual(publicTask.basis, ['安排一次技术交流会', '可以，安排技术团队参加。']);
  assert.deepEqual(publicTask.evaluation, { overallEvaluation: CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE });
  assert.equal('evidence' in publicTask, false);
  assert.equal('sourceConversation' in publicTask, false);
  assert.equal('supportDelta' in (publicTask.evaluation ?? {}), false);
  const legacyCommentaryTask = toPublicCustomerActivityTask({
    ...recorded.state.tasks[0],
    evaluation: {
      ...evaluation,
      overallEvaluation: '<p>支持度增加2分，愉悦度提升1分；活动已推进，请继续下一步。</p>',
    },
  });
  assert.equal(legacyCommentaryTask.evaluation?.overallEvaluation, CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE,
    'legacy stored HTML, outcome commentary, and numeric values are replaced by the neutral public status');
  assert.doesNotMatch(legacyCommentaryTask.evaluation?.overallEvaluation ?? '', /\d|支持度|愉悦度|建议/u);

  const caseAgreement = makeAgreement(
    'visit-and-cases', 'case_site_visit',
    { messageId: 'c1', speaker: 'customer', text: '能安排去看一下之前的项目现场吗？', quote: '安排去看一下之前的项目现场' },
    { messageId: 'c2', speaker: 'sales', text: '可以，我来协调案例现场参观。', quote: '可以，我来协调案例现场参观。' },
  );
  const companyAgreement = makeAgreement(
    'visit-and-cases', 'company_visit',
    { messageId: 'o1', speaker: 'sales', text: '欢迎您来我们公司参观。', quote: '来我们公司参观' },
    { messageId: 'o2', speaker: 'customer', text: '好，我安排时间过去。', quote: '好，我安排时间过去。' },
  );
  const queued = createCustomerActivityTasks(created, [caseAgreement, companyAgreement], 2_000);
  assert.deepEqual(queued.tasks.map(({ type }) => type), ['technical_meeting', 'case_site_visit', 'company_visit']);
  const firstQueueItem = queued.tasks[0];
  const secondQueueItem = queued.tasks[1];
  assert.deepEqual(startCustomerActivityPlanning(queued, secondQueueItem.id, 3_000), queued,
    'the second queued activity cannot start ahead of the first');
  const firstQueueStarted = startCustomerActivityPlanning(queued, firstQueueItem.id, 3_000);
  assert.deepEqual(startCustomerActivityPlanning(firstQueueStarted, secondQueueItem.id, 4_000), firstQueueStarted,
    'the second activity cannot start while the first timer is active');
  const firstQueueExpired = finalizeExpiredCustomerActivities(firstQueueStarted, firstQueueStarted.tasks[0].deadlineAt!);
  const secondQueueStarted = startCustomerActivityPlanning(firstQueueExpired, secondQueueItem.id, 900_000);
  assert.equal(secondQueueStarted.tasks[1].status, 'planning');
  assert.equal(secondQueueStarted.tasks[1].startedAt, 900_000, 'the next item starts a separate timer when activated');
  assert.equal(secondQueueStarted.tasks[1].deadlineAt, 900_000 + CUSTOMER_ACTIVITY_PLANNING_MS);
  assert.deepEqual(startCustomerActivityPlanning(secondQueueStarted, queued.tasks[2].id, 900_001), secondQueueStarted,
    'the third activity waits for the second timer');

  const manualStarted = startCustomerActivityPlanning(created, task.id, 1_000_000);
  const manualSubmitted = submitCustomerActivityPlan(manualStarted, task.id, 1_001_000);
  assert.equal(manualSubmitted.tasks[0].submitReason, 'manual');
  assert.deepEqual(submitCustomerActivityPlan(manualSubmitted, task.id, 1_002_000), manualSubmitted, 'manual submission is idempotent');

  const decisionSnapshot: CustomerActivityRelationshipSnapshot = {
    npcId: 'P1-002', role: '项目负责人', title: '技术负责人', context: '负责项目实施与集成', stage: 'N3',
    support: 70, pleasantness: 60,
    dimensions: { decisionAnalysis: 50, relationshipBuilding: 50, valuePresentation: 50, objectionHandling: 50, informationDiscovery: 50 },
  };
  const salesVagueConversation = [
    { messageId: 'sales-proposal', speaker: 'sales' as const, text: '下周找个时间，把贵方需求和我们的技术方案当面掰开讲讲。' },
  ];
  let semanticCalls = 0;
  const detectedProposals = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-sales-proposal', npcId: 'P1-002', messages: salesVagueConversation,
  }, { invoker: async (messages) => {
    semanticCalls += 1;
    assert.match(messages[0]?.content ?? '', /语义识别器/);
    return JSON.stringify({ activities: [{
      type: 'technical_meeting', initiator: 'sales',
      proposal: { messageId: 'sales-proposal', quote: '把贵方需求和我们的技术方案当面掰开讲讲' },
    }] });
  } });
  assert.equal(semanticCalls, 1, 'one ended conversation receives one typed semantic classification');
  assert.equal(detectedProposals.length, 1);
  assert.equal(detectedProposals[0]?.responseKind, 'not_required', 'a sales proposal needs no customer reply');

  const middleLevelCandidate = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-middle-level', npcId: 'P1-003',
    messages: [{ messageId: 'middle-sales', speaker: 'sales', text: '安排一次技术交流会，专门过一遍接口方案。' }],
  }, { invoker: async () => JSON.stringify({ activities: [{
    type: 'technical_meeting', initiator: 'sales', proposal: { messageId: 'middle-sales', quote: '安排一次技术交流会' },
  }] }) });
  assert.equal(middleLevelCandidate.length, 1);

  const customerConversation = [
    { messageId: 'customer-proposal', speaker: 'customer' as const, text: '能不能带我看看已经落地的现场？' },
    { messageId: 'sales-confirmation', speaker: 'sales' as const, text: '可以，我来协调您去案例现场参观。' },
  ];
  const customerInitiates = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-customer-proposal', npcId: 'P1-002', messages: customerConversation,
  }, { invoker: async () => JSON.stringify({ activities: [{
    type: 'case_site_visit', initiator: 'customer',
    proposal: { messageId: 'customer-proposal', quote: '带我看看已经落地的现场' },
    response: { messageId: 'sales-confirmation', quote: '可以，我来协调', kind: 'explicit_acceptance' },
    finalStatus: 'active', finalOutcome: { messageId: 'sales-confirmation', quote: '去案例现场参观' }, confidence: 0.99,
  }] }) });
  assert.equal(customerInitiates.length, 1, 'customer proposal requires an explicit sales acceptance');

  const customerHospitalityCandidates = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-hospitality', npcId: 'P1-002',
    messages: [
      { messageId: 'meal-customer', speaker: 'customer', text: '改天一起吃顿饭，把项目的事聊透。' },
      { messageId: 'meal-sales', speaker: 'sales', text: '好，我来安排晚宴。' },
    ],
  }, { invoker: async () => JSON.stringify({ activities: [{
    type: 'hospitality', initiator: 'customer',
    proposal: { messageId: 'meal-customer', quote: '一起吃顿饭' },
    response: { messageId: 'meal-sales', quote: '好，我来安排', kind: 'explicit_acceptance' },
    finalStatus: 'active', finalOutcome: { messageId: 'meal-sales', quote: '安排晚宴' }, confidence: 0.99,
  }] }) });
  assert.equal(customerHospitalityCandidates.length, 1);

  const allTypes = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-all-types', npcId: 'P1-002',
    messages: [
      { messageId: 'type-case', speaker: 'sales', text: '带您去已经交付的项目走一圈。' },
      { messageId: 'type-company', speaker: 'sales', text: '请您到我们办公区看看研发环境。' },
      { messageId: 'type-meal', speaker: 'sales', text: '晚上我做东，边吃边聊。' },
    ],
  }, { invoker: async () => JSON.stringify({ activities: [
    { type: 'case_site_visit', initiator: 'sales', proposal: { messageId: 'type-case', quote: '已经交付的项目走一圈' } },
    { type: 'company_visit', initiator: 'sales', proposal: { messageId: 'type-company', quote: '到我们办公区看看研发环境' } },
    { type: 'hospitality', initiator: 'sales', proposal: { messageId: 'type-meal', quote: '晚上我做东，边吃边聊' } },
  ] }) });
  assert.deepEqual(allTypes.map(({ type }) => type), ['case_site_visit', 'company_visit', 'hospitality']);

  const unconfirmedCustomer = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-unconfirmed-customer', npcId: 'P1-002', messages: customerConversation,
  }, { invoker: async () => JSON.stringify({ activities: [{
    type: 'case_site_visit', initiator: 'customer', proposal: { messageId: 'customer-proposal', quote: '带我看看已经落地的现场' },
    response: { messageId: 'sales-confirmation', quote: '可以，我来协调', kind: 'ambiguous' },
    finalStatus: 'active', finalOutcome: { messageId: 'sales-confirmation', quote: '去案例现场参观' }, confidence: 0.99,
  }] }) });
  assert.deepEqual(unconfirmedCustomer, [], 'an unconfirmed customer proposal is not eligible');

  const emptySemanticResult = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-empty', npcId: 'P1-002', messages: salesVagueConversation,
  }, { invoker: async () => JSON.stringify({ activities: [] }) });
  assert.deepEqual(emptySemanticResult, [], 'an empty typed model result has no heuristic fallback');
  await assert.rejects(detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-provider-error', npcId: 'P1-002', messages: salesVagueConversation,
  }, { invoker: async () => { throw new Error('provider unavailable'); } }),
  (error: unknown) => error instanceof CustomerActivityDetectionError && error.code === 'provider_unavailable');
  await assert.rejects(detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'semantic-invalid-source', npcId: 'P1-002', messages: salesVagueConversation,
  }, { invoker: async () => JSON.stringify({ activities: [{
    type: 'technical_meeting', initiator: 'sales', proposal: { messageId: 'sales-proposal', quote: '不存在的原文' },
  }] }) }),
  (error: unknown) => error instanceof CustomerActivityDetectionError && error.code === 'invalid_source');

  const aiConfig: ActivityDecisionConfig = { revision: 3, mode: 'ai', thresholds: {} };
  const jevResult = (choice: 'allow' | 'reject') => ({
    answers: { decision: {
      type: 'choice' as const, choice,
      probabilities: { allow: choice === 'allow' ? 1 : 0, reject: choice === 'reject' ? 1 : 0 },
      confidence: 1,
    } },
  });
  for (const [candidate, snapshot] of [
    [detectedProposals[0], decisionSnapshot] as const,
    [middleLevelCandidate[0], { ...decisionSnapshot, npcId: 'P1-003', role: '中层采购负责人', title: '采购经理' }] as const,
  ]) for (const outcome of ['allow', 'reject'] as const) {
    let jevCalls = 0;
    const result = await decideCustomerActivityFeasibility(candidate, snapshot, aiConfig, {
      jevInvoker: async (request) => {
        jevCalls += 1;
        assert.equal(Object.keys(request.questions).join(','), 'decision');
        assert.match(String(request.questions.decision.instructions), /不可信数据/,
          'the feasibility decision treats source conversation as untrusted input');
        const frozen = (request.state as { relationshipSnapshot: CustomerActivityRelationshipSnapshot }).relationshipSnapshot;
        assert.equal(frozen.support, 70);
        assert.equal(frozen.role, snapshot.role, 'role-aware vague replies are evaluated against the frozen NPC role');
        return jevResult(outcome);
      },
    });
    assert.equal(jevCalls, 1);
    assert.equal(result.decision, outcome);
    assert.equal(result.mode, 'ai');
    const stored = recordCustomerActivityProposalDecision(createEmptyCustomerActivityState(), candidate, snapshot, aiConfig, result, 20_000);
    assert.equal(stored.recorded, true);
    assert.equal(stored.state.decisions.length, 1, 'all normal AI outcomes are recorded once');
    assert.equal(stored.state.tasks.length, outcome === 'allow' ? 1 : 0, 'only allow creates an activity task');
    if (outcome === 'allow') {
      const task = stored.state.tasks[0];
      assert.equal(task.relationshipSnapshot?.support, 70, 'the decision-time metric snapshot is stored on the task');
      assert.equal('relationshipSnapshot' in toPublicCustomerActivityTask(task), false, 'internal decision metrics are never public');
    }
  }

  await assert.rejects(decideCustomerActivityFeasibility(detectedProposals[0], decisionSnapshot, aiConfig, {
    jevInvoker: async () => ({ answers: { decision: {
      type: 'choice' as const,
      choice: 'need_more' as const,
      probabilities: { allow: 0, reject: 0, need_more: 1 },
      confidence: 1,
    } } }),
  }), (error: unknown) => error instanceof CustomerActivityDecisionError && error.code === 'invalid_response',
  'a third feasibility output is invalid rather than a new persisted decision');

  const customerConfirmation = await decideCustomerActivityFeasibility(customerInitiates[0], decisionSnapshot, aiConfig, {
    jevInvoker: async () => { throw new Error('customer confirmation does not call Jev'); },
  });
  assert.equal(customerConfirmation.mode, 'customer_confirmed');
  assert.equal(customerConfirmation.decision, 'allow');
  assert.ok(createResolvedCustomerActivityAgreement(customerInitiates[0], decisionSnapshot, aiConfig, customerConfirmation));

  assert.deepEqual(HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD, { supportMin: 15, pleasantnessMin: 55 });
  const hospitalityBoundarySnapshot: CustomerActivityRelationshipSnapshot = {
    ...decisionSnapshot,
    support: 15,
    pleasantness: 55,
    organization: {
      members: CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => ({
        npcId,
        support: npcId === 'P1-002' ? 15 : 0,
        pleasantness: npcId === 'P1-002' ? 55 : 0,
      })),
    },
  };
  let hospitalityJevCalls = 0;
  const hospitalityAtBoundary = await decideCustomerActivityFeasibility(
    customerHospitalityCandidates[0], hospitalityBoundarySnapshot, aiConfig,
    { jevInvoker: async () => { hospitalityJevCalls += 1; throw new Error('hospitality always uses its numeric gate'); } },
  );
  assert.equal(hospitalityAtBoundary.decision, 'allow', 'hospitality thresholds pass inclusively at 15/55');
  assert.equal(hospitalityAtBoundary.mode, 'numeric', 'customer confirmation does not bypass the hospitality threshold');
  assert.equal(hospitalityJevCalls, 0, 'global AI mode does not call Jev for hospitality');
  const hospitalityAgreement = createResolvedCustomerActivityAgreement(customerHospitalityCandidates[0],
    hospitalityBoundarySnapshot, aiConfig, hospitalityAtBoundary);
  assert.equal(hospitalityAgreement?.type, 'hospitality',
    'the verified hospitality decision creates an ordinary activity agreement');
  const hospitalityTaskState = createCustomerActivityTasks(
    createEmptyCustomerActivityState(), hospitalityAgreement ? [hospitalityAgreement] : [], 22_000,
  );
  assert.equal(hospitalityTaskState.tasks[0]?.decisionMode, 'numeric', 'hospitality task schema retains its numeric gate mode');
  assert.equal(readCustomerActivityState(JSON.parse(JSON.stringify(hospitalityTaskState))).tasks[0]?.type, 'hospitality',
    'hospitality tasks and frozen snapshots survive persisted-state readback');
  const hospitalityRecorded = recordCustomerActivityProposalDecision(
    createEmptyCustomerActivityState(), customerHospitalityCandidates[0], hospitalityBoundarySnapshot,
    aiConfig, hospitalityAtBoundary, 23_000,
  );
  assert.equal(hospitalityRecorded.recorded, true, 'hospitality numeric decisions persist under the normal record schema');
  assert.equal(readCustomerActivityState(JSON.parse(JSON.stringify(hospitalityRecorded.state))).decisions[0]?.mode, 'numeric',
    'hospitality numeric decision records survive persisted-state readback');
  const forgedHospitalityState = {
    ...hospitalityRecorded.state,
    decisions: [{ ...hospitalityRecorded.state.decisions[0], mode: 'ai' }],
  };
  assert.equal(isCustomerActivityState(forgedHospitalityState), false,
    'state schema rejects an AI-mode hospitality decision that bypasses its numeric gate');
  const hospitalityBelowSupport = await decideCustomerActivityFeasibility(
    customerHospitalityCandidates[0], { ...hospitalityBoundarySnapshot, support: 14 }, aiConfig,
  );
  const hospitalityBelowPleasantness = await decideCustomerActivityFeasibility(
    customerHospitalityCandidates[0], { ...hospitalityBoundarySnapshot, pleasantness: 54 }, aiConfig,
  );
  assert.equal(hospitalityBelowSupport.decision, 'reject', 'support below the hospitality threshold blocks the proposal');
  assert.equal(hospitalityBelowPleasantness.decision, 'reject', 'pleasantness below the hospitality threshold blocks the proposal');

  assert.equal(parseActivityDecisionConfig({ revision: 1, mode: 'numeric', thresholds: {} }), null,
    'numeric mode cannot be enabled before every activity threshold is configured');
  assert.ok(parseActivityDecisionConfig({ revision: 1, mode: 'ai', thresholds: { company_visit: { supportMin: 30 } } }),
    'AI mode persists partially configured numeric thresholds for later editing');
  const numericConfig: ActivityDecisionConfig = {
    revision: 8, mode: 'numeric', thresholds: {
      technical_meeting: { supportMin: 70, pleasantnessMin: 60 },
      case_site_visit: { supportMin: 0, pleasantnessMin: 0 },
      company_visit: { supportMin: 100, pleasantnessMin: 100 },
    },
  };
  let numericJevCalls = 0;
  const numericAtBoundary = await decideCustomerActivityFeasibility(detectedProposals[0], decisionSnapshot, numericConfig, {
    jevInvoker: async () => { numericJevCalls += 1; throw new Error('numeric mode cannot call Jev'); },
  });
  assert.equal(numericAtBoundary.decision, 'allow', 'support and pleasantness thresholds are inclusive');
  assert.equal(numericJevCalls, 0);
  const belowSupport = await decideCustomerActivityFeasibility(detectedProposals[0], { ...decisionSnapshot, support: 69 }, numericConfig);
  assert.equal(belowSupport.decision, 'reject', 'one metric below threshold blocks numeric eligibility');
  const belowPleasantness = await decideCustomerActivityFeasibility(detectedProposals[0], { ...decisionSnapshot, pleasantness: 59 }, numericConfig);
  assert.equal(belowPleasantness.decision, 'reject', 'both numeric conditions must pass');
  const zeroThreshold = await decideCustomerActivityFeasibility({ ...detectedProposals[0], type: 'case_site_visit' }, { ...decisionSnapshot, support: 0, pleasantness: 0 }, numericConfig);
  assert.equal(zeroThreshold.decision, 'allow', '0 is a valid inclusive threshold');
  const maxThreshold = await decideCustomerActivityFeasibility({ ...detectedProposals[0], type: 'company_visit' }, { ...decisionSnapshot, support: 100, pleasantness: 100 }, numericConfig);
  assert.equal(maxThreshold.decision, 'allow', '100 is a valid inclusive threshold');

  assert.equal(DEFAULT_ACTIVITY_DECISION_CONFIG.mode, 'numeric', 'recommended organization thresholds are the default decision mode');
  assert.ok(parseActivityDecisionConfig(DEFAULT_ACTIVITY_DECISION_CONFIG), 'the complete recommended organization config validates');
  assert.deepEqual(Object.keys(RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS).sort(),
    ['case_site_visit', 'company_visit', 'technical_meeting'], 'recommended thresholds cover all three activity types');
  const makeOrganizationSnapshot = (
    npcId: string,
    support: Partial<Record<(typeof CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS)[number], number>> = {},
    pleasantness: Partial<Record<(typeof CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS)[number], number>> = {},
  ): CustomerActivityRelationshipSnapshot => ({
    ...decisionSnapshot,
    npcId,
    organization: {
      members: CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((memberNpcId) => ({
        npcId: memberNpcId,
        support: support[memberNpcId] ?? 0,
        pleasantness: pleasantness[memberNpcId] ?? 55,
      })),
    },
  });
  const organizationConfig: ActivityDecisionConfig = { ...DEFAULT_ACTIVITY_DECISION_CONFIG, revision: 9 };
  const technicalTwoPersonTeam = makeOrganizationSnapshot('P1-002', { 'P1-002': 12, 'P1-004': 8 }, { 'P1-002': 55 });
  const technicalTwoPersonGate = decideOrganizationActivityThreshold(
    technicalTwoPersonTeam,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting,
  );
  assert.equal(technicalTwoPersonGate.decision, 'allow', 'the two-person technical path accepts inclusive support and pleasantness thresholds');
  assert.doesNotMatch(technicalTwoPersonGate.reason, /\d|路径|路线/u, 'organization explanations do not expose numbers or route names');
  const technicalOneBelowPathPleasantness = makeOrganizationSnapshot('P1-002',
    { 'P1-002': 12, 'P1-004': 8 }, { 'P1-002': 55, 'P1-004': 54 });
  assert.equal(decideOrganizationActivityThreshold(technicalOneBelowPathPleasantness,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting).decision, 'reject',
  'one point below an applicable member pleasantness threshold blocks the otherwise complete two-person path');

  const organizationJev = { jevInvoker: async () => { throw new Error('numeric mode must not call Jev'); } };
  const technicalAtEquality = await decideCustomerActivityFeasibility(detectedProposals[0], technicalTwoPersonTeam, organizationConfig, organizationJev);
  assert.equal(technicalAtEquality.decision, 'allow', 'the AI decision API applies the organization path at equality');
  assert.equal(technicalAtEquality.mode, 'numeric');
  const organizationAgreement = createResolvedCustomerActivityAgreement(detectedProposals[0], technicalTwoPersonTeam, organizationConfig, technicalAtEquality);
  assert.ok(organizationAgreement,
    'the agreement creator revalidates and accepts a qualifying frozen team');
  assert.deepEqual(organizationAgreement.relationshipSnapshot?.organization, technicalTwoPersonTeam.organization,
    'the full team snapshot is frozen with the resolved agreement');
  const organizationRecorded = recordCustomerActivityProposalDecision(createEmptyCustomerActivityState(),
    detectedProposals[0], technicalTwoPersonTeam, organizationConfig, technicalAtEquality, 20_000);
  assert.equal(organizationRecorded.recorded, true, 'the team decision can be recorded through the normal persistence path');
  assert.equal(organizationRecorded.state.decisions[0].relationshipSnapshot.organization?.members.length, 5,
    'the decision record keeps all five members for idempotent audit');
  assert.equal(organizationRecorded.task?.relationshipSnapshot?.organization?.members.length, 5,
    'the created task freezes the same full team snapshot');
  assert.equal('relationshipSnapshot' in toPublicCustomerActivityTask(organizationRecorded.task!), false,
    'the public task projection does not expose frozen team metrics');
  assert.equal('decisionConfig' in toPublicCustomerActivityTask(organizationRecorded.task!), false,
    'the public task projection does not expose configured paths or thresholds');

  const technicalThreePersonTeam = makeOrganizationSnapshot('P1-002', {
    'P1-001': 8, 'P1-002': 8, 'P1-003': 8, 'P1-005': 8,
  });
  assert.equal(decideOrganizationActivityThreshold(technicalThreePersonTeam,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting).decision, 'allow',
  'the three-person technical path accepts a qualifying team');
  assert.equal(decideOrganizationActivityThreshold(makeOrganizationSnapshot('P1-002', {
    'P1-001': 12, 'P1-002': 12, 'P1-004': 12,
  }, { 'P1-001': 55, 'P1-002': 55, 'P1-004': 55 }), RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.case_site_visit).decision, 'allow',
  'the three-person case path accepts its inclusive support/pleasantness thresholds');
  assert.equal(decideOrganizationActivityThreshold(makeOrganizationSnapshot('P1-002', {
    'P1-001': 12, 'P1-002': 12, 'P1-004': 12,
  }, { 'P1-001': 55, 'P1-002': 55, 'P1-004': 55 }),
  RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.company_visit).decision, 'allow',
  'the three-person company-visit path accepts its inclusive thresholds');

  const onePersonOnly = makeOrganizationSnapshot('P1-002', { 'P1-001': 100 });
  assert.equal(decideOrganizationActivityThreshold(onePersonOnly,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting).decision, 'reject',
  'one person at 100 cannot satisfy a team-level route');
  const otherMemberBlocks = makeOrganizationSnapshot('P1-002', { 'P1-002': 100 });
  assert.equal(decideOrganizationActivityThreshold(otherMemberBlocks,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting).decision, 'reject',
  'the contacted NPC alone cannot satisfy an organization-level route');
  const otherMemberUnlocks = makeOrganizationSnapshot('P1-002', { 'P1-002': 12, 'P1-004': 8 }, { 'P1-002': 55 });
  assert.equal(decideOrganizationActivityThreshold(otherMemberUnlocks,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting).decision, 'allow',
  'a second member can change the frozen team decision');
  const belowGlobalPleasantness = makeOrganizationSnapshot('P1-002', { 'P1-002': 12, 'P1-004': 8 }, { 'P1-002': 55, 'P1-005': 19 });
  assert.equal(decideOrganizationActivityThreshold(belowGlobalPleasantness,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting).decision, 'reject',
  'one member below the global pleasantness minimum blocks all routes');

  const missingOrganization = decideOrganizationActivityThreshold(decisionSnapshot,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting);
  assert.equal(missingOrganization.decision, 'reject', 'missing team context cannot allow a new organization threshold');
  const incompleteOrganization = {
    ...technicalTwoPersonTeam,
    organization: { members: technicalTwoPersonTeam.organization!.members.slice(0, 4) },
  };
  const duplicateOrganization = {
    ...technicalTwoPersonTeam,
    organization: { members: [
      ...technicalTwoPersonTeam.organization!.members.slice(0, 4),
      { ...technicalTwoPersonTeam.organization!.members[0] },
    ] },
  };
  assert.equal(customerActivityRelationshipSnapshotSchema.safeParse(incompleteOrganization).success, false,
    'a team snapshot must contain exactly five members');
  assert.equal(customerActivityRelationshipSnapshotSchema.safeParse(duplicateOrganization).success, false,
    'a team snapshot must contain each NPC exactly once');
  assert.equal(decideOrganizationActivityThreshold(duplicateOrganization,
    RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting).decision, 'reject',
  'an invalid team snapshot cannot pass a threshold');

  const customerInitiatedTechnical = {
    ...detectedProposals[0],
    npcId: 'P1-001',
    type: 'technical_meeting' as const,
    initiator: 'customer' as const,
    requiresFeasibility: false,
    responseKind: 'explicit_acceptance' as const,
    proposalMessageId: 'customer-tech-proposal',
    responseMessageId: 'sales-tech-confirmation',
    finalOutcomeMessageId: 'sales-tech-confirmation',
    sourceConversation: [
      { messageId: 'customer-tech-proposal', speaker: 'customer' as const, text: '建议下周安排一次技术交流会。' },
      { messageId: 'sales-tech-confirmation', speaker: 'sales' as const, text: '可以，我来安排技术交流会。' },
    ],
    evidence: [
      { messageId: 'customer-tech-proposal', speaker: 'customer' as const, kind: 'proposal' as const, quote: '安排一次技术交流会' },
      { messageId: 'sales-tech-confirmation', speaker: 'sales' as const, kind: 'response' as const, quote: '可以，我来安排技术交流会。' },
      { messageId: 'sales-tech-confirmation', speaker: 'sales' as const, kind: 'final_outcome' as const, quote: '可以，我来安排技术交流会。' },
    ],
  };
  const customerTechnicalDecision = await decideCustomerActivityFeasibility(customerInitiatedTechnical,
    { ...technicalTwoPersonTeam, npcId: 'P1-001' }, organizationConfig, organizationJev);
  assert.equal(customerTechnicalDecision.decision, technicalAtEquality.decision,
    'the same frozen team produces the same decision when the customer initiated the proposal');
  assert.equal(customerTechnicalDecision.mode, 'numeric', 'customer initiation does not bypass numeric organization gates');
  const customerTechnicalBlocked = await decideCustomerActivityFeasibility(customerInitiatedTechnical,
    { ...onePersonOnly, npcId: 'P1-001' }, organizationConfig, organizationJev);
  assert.equal(customerTechnicalBlocked.decision, 'reject', 'a customer confirmation cannot bypass an unmet organization gate');
  assert.equal(createResolvedCustomerActivityAgreement(customerInitiatedTechnical,
    { ...onePersonOnly, npcId: 'P1-001' }, organizationConfig,
    { ...customerTechnicalBlocked, decision: 'allow' }), null,
  'agreement creation independently rejects a forged allow decision for an unqualified team');

  const legacyNumericConfig = {
    revision: 10,
    mode: 'numeric' as const,
    thresholds: {
      technical_meeting: { supportMin: 70, pleasantnessMin: 60 },
      case_site_visit: { supportMin: 0, pleasantnessMin: 0 },
      company_visit: { supportMin: 100, pleasantnessMin: 100 },
    },
  };
  assert.ok(parseActivityDecisionConfig(legacyNumericConfig), 'legacy numeric configurations remain readable');
  const legacyCustomerDecision = await decideCustomerActivityFeasibility(customerInitiates[0], decisionSnapshot, legacyNumericConfig, organizationJev);
  assert.equal(legacyCustomerDecision.decision, 'allow', 'legacy snapshots and paired thresholds retain historical behavior');
  assert.equal(legacyCustomerDecision.mode, 'numeric', 'legacy customer proposals still pass the stored numeric gate');
  assert.deepEqual(parseActivityDecisionConfig(legacyNumericConfig)?.thresholds.hospitality,
    HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD, 'legacy configs receive the hospitality default threshold when loaded');
  const legacyHospitalityDecision = await decideCustomerActivityFeasibility(
    customerHospitalityCandidates[0], hospitalityBoundarySnapshot, legacyNumericConfig, organizationJev,
  );
  assert.equal(legacyHospitalityDecision.decision, 'allow', 'legacy configs still apply the default hospitality gate');
  assert.equal(legacyHospitalityDecision.mode, 'numeric');
  assert.equal(parseActivityDecisionConfig({
    revision: 11, mode: 'ai', thresholds: { hospitality: { supportMin: 20 } },
  }), null, 'hospitality thresholds must always be a complete support/pleasantness pair');

  await assert.rejects(decideCustomerActivityFeasibility(detectedProposals[0], decisionSnapshot, aiConfig, {
    jevInvoker: async () => { throw new Error('Jev unavailable'); },
  }), (error: unknown) => error instanceof CustomerActivityDecisionError && error.code === 'provider_unavailable',
  'provider failures do not become normal rejection decisions');

  for (const outcome of ['reject'] as const) {
    const frozenDecision = await decideCustomerActivityFeasibility(detectedProposals[0], decisionSnapshot, aiConfig, {
      jevInvoker: async () => jevResult(outcome),
    });
    const initial = recordCustomerActivityProposalDecision(createEmptyCustomerActivityState(), detectedProposals[0], decisionSnapshot, aiConfig, frozenDecision, 30_000);
    const laterRetryCandidate = { ...detectedProposals[0], conversationId: 'new-email-conversation' };
    const laterConfig = { ...aiConfig, revision: aiConfig.revision + 1 };
    const laterAllow = await decideCustomerActivityFeasibility(laterRetryCandidate, { ...decisionSnapshot, support: 100, pleasantness: 100 }, laterConfig, {
      jevInvoker: async () => jevResult('allow'),
    });
    const noResurrection = recordCustomerActivityProposalDecision(initial.state, laterRetryCandidate,
      { ...decisionSnapshot, support: 100, pleasantness: 100 }, laterConfig, laterAllow, 40_000);
    assert.equal(noResurrection.recorded, false, `a normal ${outcome} cannot be reconsidered under newer metrics/config or conversation IDs`);
    assert.equal(noResurrection.state.decisions[0].relationshipSnapshot.support, 70, 'the original metric snapshot remains frozen');
    assert.equal(noResurrection.state.decisions[0].configRevision, aiConfig.revision, 'the original config revision remains frozen');
    assert.equal(noResurrection.state.tasks.length, 0);
  }

  const legacyReject = await decideCustomerActivityFeasibility(detectedProposals[0], decisionSnapshot, aiConfig, {
    jevInvoker: async () => jevResult('reject'),
  });
  const legacyRecorded = recordCustomerActivityProposalDecision(
    createEmptyCustomerActivityState(), detectedProposals[0], decisionSnapshot, aiConfig, legacyReject, 35_000,
  );
  const legacyNeedMoreState = parseCustomerActivityState({
    ...legacyRecorded.state,
    decisions: legacyRecorded.state.decisions.map((decision) => ({ ...decision, decision: 'need_more' })),
  });
  assert.equal(legacyNeedMoreState.decisions[0]?.decision, 'need_more', 'old saved need_more decisions remain readable');
  assert.equal(toPublicUnavailableCustomerActivityNotice(legacyNeedMoreState.decisions[0]!), null,
    'old need_more decisions do not create a new unavailable notice');
  const legacyRetry = recordCustomerActivityProposalDecision(
    legacyNeedMoreState, detectedProposals[0], decisionSnapshot, aiConfig,
    await decideCustomerActivityFeasibility(detectedProposals[0], decisionSnapshot, aiConfig, { jevInvoker: async () => jevResult('allow') }),
    36_000,
  );
  assert.equal(legacyRetry.recorded, false, 'an old need_more decision is not re-run or replaced');

  const noProposal = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'no-proposal', npcId: 'P1-002',
    messages: [
      { messageId: 'n1', speaker: 'sales', text: '我们的技术团队能力很强。' },
      { messageId: 'n2', speaker: 'customer', text: '我知道了，谢谢。' },
    ],
  }, { invoker: async () => JSON.stringify({ activities: [] }) });
  assert.deepEqual(noProposal, [], 'high metrics cannot create an activity without a real proposal');

  const roomStarted = startCustomerActivityPlanning(created, task.id, 500_000);
  const roomSaved = saveCustomerActivityDraft(roomStarted, task.id, '先联系项目负责人确认参加人员。', 510_000);
  const endedRoom = finishCustomerActivityPlanningOnRoomEnd(roomSaved.state, 520_000);
  assert.equal(endedRoom.tasks[0].submitReason, 'room_ended');
  assert.equal(endedRoom.tasks[0].submittedAt, 520_000);
  assert.equal(endedRoom.tasks[0].draft, '先联系项目负责人确认参加人员。');
  const endedAfterDeadline = finishCustomerActivityPlanningOnRoomEnd(roomStarted, roomStarted.tasks[0].deadlineAt! + 10);
  assert.equal(endedAfterDeadline.tasks[0].submitReason, 'timeout');
  assert.equal(endedAfterDeadline.tasks[0].submittedAt, roomStarted.tasks[0].deadlineAt);

  const emptyPlanEvaluation = {
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
  };
  let blankPlanAiCalls = 0;
  for (const activityType of ['technical_meeting', 'case_site_visit', 'company_visit'] as const) {
    for (const draft of ['', '   \n\t ']) {
      const blankEvaluation = await evaluateCustomerActivityPlan({
        activityType, summary: '客户活动', conversation: sourceConversation, draft,
      }, { invoker: async () => { blankPlanAiCalls += 1; throw new Error('blank plan is deterministic'); } });
      assert.deepEqual(blankEvaluation, emptyPlanEvaluation,
        `${activityType} treats empty and whitespace-only plans as insufficient preparation`);
    }
  }
  const emptySubmissions = [
    submitCustomerActivityPlan(roomStarted, task.id, 515_000),
    finishCustomerActivityPlanningOnRoomEnd(roomStarted, 520_000),
    finishCustomerActivityPlanningOnRoomEnd(roomStarted, roomStarted.tasks[0].deadlineAt! + 10),
  ];
  for (const [index, submittedBlank] of emptySubmissions.entries()) {
    const blankTask = submittedBlank.tasks[0];
    assert.equal(blankTask.status, 'submitted');
    assert.equal(blankTask.draft, '', 'manual, room-end, and timeout submission preserve an empty draft');
    const blankEvaluation = await evaluateCustomerActivityPlan({
      activityType: blankTask.type, summary: blankTask.summary, conversation: sourceConversation, draft: blankTask.draft,
    }, { invoker: async () => { blankPlanAiCalls += 1; throw new Error('blank plan is deterministic'); } });
    assert.deepEqual(blankEvaluation, emptyPlanEvaluation, `empty submit path ${index} uses the common deterministic rule`);
  }
  assert.equal(blankPlanAiCalls, 0, 'empty activity plans are resolved without an LLM request');

  const validEvaluation = await evaluateCustomerActivityPlan({
    activityType: 'technical_meeting', summary: '围绕接口适配开展技术交流', conversation: sourceConversation,
    draft: '安排客户技术负责人参加，围绕接口适配准备技术演示和问答。',
  }, { invoker: async (messages, options) => {
    assert.equal(options?.jsonMode, true);
    assert.match(messages[0].content, /overallEvaluation只写一句简短的方案结果/u);
    assert.match(messages[0].content, /不作点评、不解释问题、不提供建议或改进项/u);
    assert.match(messages[0].content, /不要写任何数值、数量、日期、时长/u);
    return JSON.stringify(evaluation);
  } });
  assert.deepEqual(validEvaluation, evaluation);
  const metricLeakEvaluation = await evaluateCustomerActivityPlan({
    activityType: 'technical_meeting', summary: '技术交流会', conversation: sourceConversation, draft: '安排议题和人员。',
  }, { invoker: async () => JSON.stringify({
    ...evaluation,
    overallEvaluation: '准备充分，支持度增加2分，愉悦度-1，关系建立得分为0。',
  }) });
  assert.equal(metricLeakEvaluation, null, 'overall prose cannot disclose numeric existing-metric changes');
  const totalScoreLeakEvaluation = await evaluateCustomerActivityPlan({
    activityType: 'technical_meeting', summary: '技术交流会', conversation: sourceConversation, draft: '安排议题和人员。',
  }, { invoker: async () => JSON.stringify({
    ...evaluation,
    overallEvaluation: '总体方案评价为85分。',
  }) });
  assert.equal(totalScoreLeakEvaluation, null, 'overall prose cannot disclose a new total score');
  const businessNumbersEvaluation = await evaluateCustomerActivityPlan({
    activityType: 'technical_meeting', summary: '技术交流会', conversation: sourceConversation, draft: '安排议题和人员。',
  }, { invoker: async () => JSON.stringify({
    ...evaluation,
    overallEvaluation: '客户对安排有信心，愿意邀请3名技术负责人继续推进。',
  }) });
  assert.ok(businessNumbersEvaluation, 'non-metric wording in legacy/internal evaluation data remains accepted');
  const adviceEvaluation = await evaluateCustomerActivityPlan({
    activityType: 'technical_meeting', summary: '技术交流会', conversation: sourceConversation, draft: '安排议题和人员。',
  }, { invoker: async () => JSON.stringify({
    ...evaluation,
    overallEvaluation: '客户愿意继续沟通，建议补充参会人员和会后安排。',
  }) });
  assert.ok(adviceEvaluation, 'commentary in internal legacy/provider output does not block evaluation settlement');
  const invalidEvaluation = await evaluateCustomerActivityPlan({
    activityType: 'technical_meeting', summary: '技术交流会', conversation: sourceConversation, draft: '安排议题和人员。',
  }, { invoker: async () => JSON.stringify({ ...evaluation, totalScore: 100 }) });
  assert.equal(invalidEvaluation, null, 'unexpected scoring fields are rejected');
  const failedEvaluation = await evaluateCustomerActivityPlan({
    activityType: 'technical_meeting', summary: '技术交流会', conversation: sourceConversation, draft: '安排议题和人员。',
  }, { invoker: async () => { throw new Error('provider unavailable'); } });
  assert.equal(failedEvaluation, null, 'provider failures remain retryable without fabricated deltas');

  console.log('Customer activity contract, state transitions, idempotency, source validation and AI failure checks passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
