import assert from 'node:assert/strict';
import {
  customerActivityReplyInstruction,
  generateNpcReplyWithCustomerActivityGuard,
} from '../src/lib/ai/customer-activity-reply';
import {
  CUSTOMER_ACTIVITY_PLANNING_MS,
  CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS,
  CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE,
  DEFAULT_ACTIVITY_DECISION_CONFIG,
  RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS,
  decideOrganizationActivityThreshold,
  createEmptyCustomerActivityState,
  finalizeExpiredCustomerActivities,
  completeCustomerActivityQuiz,
  finishCustomerActivityPlanningOnRoomEnd,
  isCustomerActivityReadyForEvaluation,
  getPublicCustomerActivityOutcome,
  parseCustomerActivityState,
  recordCustomerActivityProposalDecision,
  saveCustomerActivityDraft,
  saveCustomerActivityQuizAnswer,
  startCustomerActivityPlanning,
  submitCustomerActivityPlan,
  toPublicCustomerActivityTask,
  toPublicUnavailableCustomerActivityNotice,
  type CustomerActivityFeasibilityDecision,
  type CustomerActivityConversationMessage,
  type CustomerActivityOrganizationMember,
  type CustomerActivityProposalCandidate,
  type CustomerActivityRelationshipSnapshot,
  type ActivityDecisionConfig,
  type OrganizationActivityThreshold,
} from '../src/lib/game/customer-activities';
import { CUSTOMER_ACTIVITY_QUIZ_MS } from '../src/lib/game/customer-activity-quiz';
import { DEFAULT_ACTIVITY_EXECUTION_CONFIG } from '../src/lib/game/customer-activity-execution-config';
import { CustomerActivityDecisionError, CustomerActivityDetectionError, decideCustomerActivityFeasibility, detectCustomerActivityProposals, evaluateCustomerActivityPlan } from '../src/lib/ai/customer-activities';
import type { JevInvoker, JevRequest } from '../src/lib/ai/jev-client';
import { hasCustomerActivityWindowToClose, processPendingCustomerActivityDetections, processSubmittedCustomerActivityEvaluations } from '../src/lib/game/repository';
import {
  applyCustomerActivityEvaluation,
  appendCustomerActivityDiagnostic,
  completeCustomerActivityProposalDetection,
  createProjectOneState,
  executeGameCommand,
  normalizeProjectOneState,
  pauseProjectTimerForCustomerActivity,
  queueCustomerActivityDetection,
  resumeProjectTimerAfterCustomerActivity,
  submitGame,
  synchronizeProjectTimer,
  toPlayerVisibleGameState,
} from '../src/lib/game/state';

const messages = [
  { messageId: 'sales-1', speaker: 'sales' as const, text: '我们可以安排一次技术交流会。' },
  { messageId: 'customer-1', speaker: 'customer' as const, text: '这类活动还得和项目同事商量。' },
];
const candidate: CustomerActivityProposalCandidate = {
  conversationId: 'email:conversation-1',
  npcId: 'P1-001',
  sourceConversation: messages,
  type: 'technical_meeting',
  initiator: 'sales',
  proposalMessageId: 'sales-1',
  responseMessageId: 'customer-1',
  finalOutcomeMessageId: 'customer-1',
  responseKind: 'ambiguous',
  finalStatus: 'active',
  evidence: [
    { messageId: 'sales-1', speaker: 'sales', kind: 'proposal', quote: '安排一次技术交流会' },
    { messageId: 'customer-1', speaker: 'customer', kind: 'response', quote: '和项目同事商量' },
    { messageId: 'customer-1', speaker: 'customer', kind: 'final_outcome', quote: '这类活动还得和项目同事商量。' },
  ],
  summary: '安排一次技术交流会',
  requiresFeasibility: true,
};
const snapshot: CustomerActivityRelationshipSnapshot = {
  npcId: 'P1-001',
  role: '高层',
  title: '主管副总经理',
  context: '关注项目价值和组织协同。',
  stage: '项目限时推进',
  support: 55,
  pleasantness: 60,
  dimensions: {
    decisionAnalysis: 51,
    relationshipBuilding: 52,
    valuePresentation: 53,
    objectionHandling: 54,
    informationDiscovery: 55,
  },
  organization: {
    members: [
      { npcId: 'P1-001', support: 20, pleasantness: 50 },
      { npcId: 'P1-002', support: 35, pleasantness: 50 },
      { npcId: 'P1-003', support: 40, pleasantness: 50 },
      { npcId: 'P1-004', support: 30, pleasantness: 50 },
      { npcId: 'P1-005', support: 35, pleasantness: 50 },
    ],
  },
};
const allowedDecision: CustomerActivityFeasibilityDecision = {
  decision: 'allow',
  mode: 'numeric',
  configRevision: DEFAULT_ACTIVITY_DECISION_CONFIG.revision,
  reason: '测试冻结关系快照允许推进。',
};
const evaluation = {
  supportDelta: 2,
  pleasureDelta: 3,
  dimensionDeltas: {
    decisionAnalysis: 1,
    relationshipBuilding: 1,
    valuePresentation: 2,
    objectionHandling: 0,
    informationDiscovery: 1,
  },
  overallEvaluation: '议题与客户关切相符，建议补齐参会岗位、讨论范围和会后责任人。',
};

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
      'the activity evaluator asks seven independent questions with stable metric keys');
    const answers = Object.fromEntries(activityPlanEvaluationKeys.map((key) => {
      const question = request.questions[key];
      assert.ok(question && question.type === 'choice', `${key} is an integer-choice question`);
      const choice = String(deltas[key]);
      const criteria = Object.keys(question.criteria);
      assert.ok(criteria.every((item) => Number.isInteger(Number(item)) && String(Number(item)) === item),
        `${key} options are canonical integer strings`);
      assert.ok(criteria.includes(choice), `${key} result is present in its frozen allowed range`);
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

const secondCandidate: CustomerActivityProposalCandidate = {
  ...candidate,
  type: 'case_site_visit',
  proposalMessageId: 'sales-2',
  responseMessageId: 'customer-2',
  finalOutcomeMessageId: 'customer-2',
  sourceConversation: [
    { messageId: 'sales-2', speaker: 'sales', text: '可以安排您参观一个过往项目现场。' },
    { messageId: 'customer-2', speaker: 'customer', text: '我需要和项目负责人商量一下。' },
  ],
  evidence: [
    { messageId: 'sales-2', speaker: 'sales', kind: 'proposal', quote: '参观一个过往项目现场' },
    { messageId: 'customer-2', speaker: 'customer', kind: 'response', quote: '和项目负责人商量' },
    { messageId: 'customer-2', speaker: 'customer', kind: 'final_outcome', quote: '我需要和项目负责人商量一下。' },
  ],
  summary: '参观一个过往项目现场',
};

function stateWithAllowedTask(decisionConfig: ActivityDecisionConfig = DEFAULT_ACTIVITY_DECISION_CONFIG) {
  const initialState = createProjectOneState();
  const allowedTeamNpcIds = ['P1-002', 'P1-004'];
  const state = {
    ...initialState,
    npcAttitudes: Object.fromEntries(Object.entries(initialState.npcAttitudes).map(([npcId, attitude]) => [
      npcId,
      allowedTeamNpcIds.includes(npcId) ? { ...attitude, pleasantness: 55 } : attitude,
    ])),
  };
  const queued = queueCustomerActivityDetection(state, {
    conversationId: candidate.conversationId,
    npcId: candidate.npcId,
    messages,
    relationshipSnapshot: snapshot,
    decisionConfig,
  });
  const queuedSnapshot = queued.customerActivityDetectionQueue[0].relationshipSnapshot;
  const recorded = completeCustomerActivityProposalDetection(queued, candidate.conversationId, [
    { candidate, decision: allowedDecision },
  ], 50_000);
  assert.equal(recorded.customerActivityDetectionQueue.length, 0);
  assert.equal(recorded.customerActivities.decisions.length, 1);
  assert.equal(recorded.customerActivities.tasks.length, 1);
  return { state: recorded, queuedSnapshot, task: recorded.customerActivities.tasks[0] };
}

async function testSnapshotFreezeAndQueueDecision() {
  const { state, queuedSnapshot, task } = stateWithAllowedTask();
  const allowedTeamNpcIds = ['P1-002', 'P1-004'];
  assert.equal(task.status, 'pending');
  assert.equal(task.relationshipSnapshot?.support, snapshot.support);
  assert.deepEqual(task.decisionConfig, DEFAULT_ACTIVITY_DECISION_CONFIG);
  assert.equal(queuedSnapshot.support, snapshot.support);
  assert.deepEqual(queuedSnapshot.organization?.members
    .filter((member) => allowedTeamNpcIds.includes(member.npcId))
    .map((member) => member.pleasantness), [55, 55],
  'the task fixture passes the recommended technical path by improving two relevant relationships');

  const existing = parseCustomerActivityState({ version: 1, tasks: [] });
  assert.deepEqual(existing.decisions, [], 'legacy activity state upgrades without dropping tasks');

  const denied = completeCustomerActivityProposalDetection(
    queueCustomerActivityDetection(createProjectOneState(), {
      conversationId: candidate.conversationId,
      npcId: candidate.npcId,
      messages,
      relationshipSnapshot: snapshot,
      decisionConfig: { revision: 1, mode: 'ai', thresholds: {} },
    }),
    candidate.conversationId,
    [{ candidate, decision: { ...allowedDecision, decision: 'reject', mode: 'ai', configRevision: 1, reason: '测试不允许推进。' } }],
    50_000,
  );
  assert.equal(denied.customerActivities.tasks.length, 0, 'reject decisions never create an activity task');
  assert.equal(denied.customerActivities.decisions.length, 1, 'normal reject decisions are consumed and audited');

  const laterCandidate = { ...candidate, conversationId: 'email:conversation-2' };
  const duplicateProposalQueue = queueCustomerActivityDetection(denied, {
    conversationId: laterCandidate.conversationId,
    npcId: laterCandidate.npcId,
    messages,
    relationshipSnapshot: { ...snapshot, support: 100, pleasantness: 100 },
    decisionConfig: DEFAULT_ACTIVITY_DECISION_CONFIG,
  });
  const noRevival = completeCustomerActivityProposalDetection(
    duplicateProposalQueue,
    laterCandidate.conversationId,
    [{ candidate: laterCandidate, decision: allowedDecision }],
    60_000,
  );
  assert.equal(noRevival.customerActivities.tasks.length, 0,
    'a previously rejected source proposal cannot revive under a later transcript/snapshot');
  assert.equal(noRevival.customerActivities.decisions.length, 1);

  const numericConfig = {
    revision: 3,
    mode: 'numeric' as const,
    thresholds: {
      technical_meeting: { supportMin: 50, pleasantnessMin: 50 },
      case_site_visit: { supportMin: 50, pleasantnessMin: 50 },
      company_visit: { supportMin: 50, pleasantnessMin: 50 },
    },
  };
  const numericAllow = await decideCustomerActivityFeasibility(candidate, snapshot, numericConfig);
  assert.equal(numericAllow.decision, 'allow');
  assert.equal(numericAllow.mode, 'numeric');
  const numericRecorded = recordCustomerActivityProposalDecision(
    createEmptyCustomerActivityState(), candidate, snapshot, numericConfig, numericAllow, 60_000,
  );
  assert.equal(numericRecorded.recorded, true);
  assert.equal(numericRecorded.state.tasks.length, 1, 'numeric allow records a task from the frozen snapshot');
  const numericReject = await decideCustomerActivityFeasibility(candidate, { ...snapshot, pleasantness: 49 }, numericConfig);
  assert.equal(numericReject.decision, 'reject');
  const numericRejected = recordCustomerActivityProposalDecision(
    createEmptyCustomerActivityState(), candidate, { ...snapshot, pleasantness: 49 }, numericConfig, numericReject, 60_000,
  );
  assert.equal(numericRejected.recorded, true);
  assert.equal(numericRejected.state.tasks.length, 0, 'numeric reject is audited without creating a task');

  const changedMetrics = {
    ...state,
    npcAttitudes: {
      ...state.npcAttitudes,
      [candidate.npcId]: { ...state.npcAttitudes[candidate.npcId], support: 99, pleasantness: 98 },
    },
  };
  const normalized = normalizeProjectOneState(changedMetrics);
  assert.deepEqual(normalized.customerActivities.tasks[0].relationshipSnapshot, queuedSnapshot,
    'the persisted decision snapshot does not change when current metrics later change');
}

async function testFrozenWholeOrganizationGate() {
  const threshold: OrganizationActivityThreshold = {
    minimumPleasantness: 20,
    paths: [
      {
        id: 'two-person',
        label: '关键两人路径',
        conditions: [
          { npcIds: ['P1-002'], minCount: 1, supportMin: 80, pleasantnessMin: 50 },
          { npcIds: ['P1-004'], minCount: 1, supportMin: 70, pleasantnessMin: 50 },
        ],
      },
      {
        id: 'three-person',
        label: '团队三人路径',
        conditions: [
          { npcIds: [...CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS], minCount: 3, supportMin: 60, pleasantnessMin: 50 },
          { npcIds: ['P1-002', 'P1-004'], minCount: 1, supportMin: 60, pleasantnessMin: 50 },
        ],
      },
    ],
  };
  const organizationConfig: ActivityDecisionConfig = {
    revision: 7,
    mode: 'numeric' as const,
    thresholds: {
      technical_meeting: { organization: threshold },
      case_site_visit: { organization: threshold },
      company_visit: { organization: threshold },
    },
  };

  const initialQueue = queueCustomerActivityDetection(createProjectOneState(), {
    conversationId: 'baseline-organization-snapshot',
    npcId: candidate.npcId,
    messages,
  });
  const initialTeamSnapshot = initialQueue.customerActivityDetectionQueue[0].relationshipSnapshot;
  for (const activityType of ['technical_meeting', 'case_site_visit', 'company_visit'] as const) {
    assert.equal(
      decideOrganizationActivityThreshold(
        initialTeamSnapshot,
        RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS[activityType],
      ).decision,
      'reject',
      `the formal opening team state cannot pass the recommended ${activityType} gate`,
    );
  }

  const oneRelationshipImproved = initialTeamSnapshot.organization!.members.map((member) => member.npcId === 'P1-001'
    ? { ...member, pleasantness: 55 }
    : member);
  const onePersonSnapshot = {
    ...initialTeamSnapshot,
    organization: { members: oneRelationshipImproved },
  };
  for (const activityType of ['technical_meeting', 'case_site_visit', 'company_visit'] as const) {
    assert.equal(
      decideOrganizationActivityThreshold(
        onePersonSnapshot,
        RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS[activityType],
      ).decision,
      'reject',
      `improving one person's pleasantness alone cannot pass ${activityType}`,
    );
  }

  const recommendedTwoPersonTeam = initialTeamSnapshot.organization!.members.map((member) =>
    ['P1-002', 'P1-004'].includes(member.npcId) ? { ...member, pleasantness: 55 } : member);
  assert.equal(
    decideOrganizationActivityThreshold(
      { ...initialTeamSnapshot, organization: { members: recommendedTwoPersonTeam } },
      RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting,
    ).decision,
    'allow',
    'the recommended two-person route passes after both relevant relationships reach 55 pleasantness',
  );

  const recommendedThreePersonTeam = initialTeamSnapshot.organization!.members.map((member) =>
    ['P1-002', 'P1-003', 'P1-005'].includes(member.npcId) ? { ...member, pleasantness: 55 } : member);
  assert.equal(
    decideOrganizationActivityThreshold(
      { ...initialTeamSnapshot, organization: { members: recommendedThreePersonTeam } },
      RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting,
    ).decision,
    'allow',
    'the recommended three-person route passes without satisfying either two-person path',
  );
  const baseTeam: CustomerActivityOrganizationMember[] = CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => ({
    npcId,
    support: 10,
    pleasantness: 55,
  }));
  const teamSnapshot = (members: CustomerActivityOrganizationMember[], npcId = candidate.npcId) => ({
    ...snapshot,
    npcId,
    organization: { members },
  });
  const oneHigh = baseTeam.map((member) => member.npcId === 'P1-002'
    ? { ...member, support: 100 }
    : member);
  assert.equal(decideOrganizationActivityThreshold(teamSnapshot(oneHigh), threshold).decision, 'reject',
    'one high-scoring teammate is insufficient');

  const twoRouteTeam = baseTeam.map((member) => member.npcId === 'P1-002'
    ? { ...member, support: 80 }
    : member.npcId === 'P1-004' ? { ...member, support: 70 } : member);
  assert.equal(decideOrganizationActivityThreshold(teamSnapshot(twoRouteTeam), threshold).decision, 'allow',
    'the configured two-person path passes');

  const threeRouteTeam = baseTeam.map((member) => ['P1-001', 'P1-002', 'P1-003'].includes(member.npcId)
    ? { ...member, support: 60 }
    : member);
  assert.equal(decideOrganizationActivityThreshold(teamSnapshot(threeRouteTeam), threshold).decision, 'allow',
    'the configured three-person path passes');

  const nonTargetLow = twoRouteTeam.map((member) => member.npcId === 'P1-005'
    ? { ...member, pleasantness: 19 }
    : member);
  assert.equal(decideOrganizationActivityThreshold(teamSnapshot(nonTargetLow), threshold).decision, 'reject',
    'a non-target teammate can affect the whole-team result');

  const targetIndependentDecisions = await Promise.all(CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) =>
    decideCustomerActivityFeasibility(
      { ...candidate, npcId },
      teamSnapshot(twoRouteTeam, npcId),
      organizationConfig,
    )));
  assert.deepEqual(targetIndependentDecisions.map((item) => item.decision), ['allow', 'allow', 'allow', 'allow', 'allow'],
    'the same frozen team produces the same gate result regardless of the conversation target');

  const confirmedCustomerProposal: CustomerActivityProposalCandidate = {
    ...candidate,
    initiator: 'customer',
    proposalMessageId: 'customer-proposal',
    responseMessageId: 'sales-confirmation',
    finalOutcomeMessageId: 'sales-confirmation',
    responseKind: 'explicit_acceptance',
    requiresFeasibility: false,
    sourceConversation: [
      { messageId: 'customer-proposal', speaker: 'customer', text: '能安排一次技术交流会吗？' },
      { messageId: 'sales-confirmation', speaker: 'sales', text: '可以，我来协调技术交流会。' },
    ],
    evidence: [
      { messageId: 'customer-proposal', speaker: 'customer', kind: 'proposal', quote: '安排一次技术交流会' },
      { messageId: 'sales-confirmation', speaker: 'sales', kind: 'response', quote: '我来协调技术交流会' },
      { messageId: 'sales-confirmation', speaker: 'sales', kind: 'final_outcome', quote: '可以，我来协调技术交流会。' },
    ],
  };
  const customerProposalDecision = await decideCustomerActivityFeasibility(
    confirmedCustomerProposal,
    teamSnapshot(oneHigh),
    organizationConfig,
  );
  assert.equal(customerProposalDecision.decision, 'reject',
    'numeric whole-team gates also apply when the customer proposed and sales confirmed');

  const teamState = createProjectOneState();
  const npcAttitudes = { ...teamState.npcAttitudes };
  for (const member of twoRouteTeam) {
    npcAttitudes[member.npcId] = { ...npcAttitudes[member.npcId], support: member.support, pleasantness: member.pleasantness };
  }
  const endedState = { ...teamState, npcAttitudes };
  const queued = queueCustomerActivityDetection(endedState, {
    conversationId: candidate.conversationId,
    npcId: candidate.npcId,
    messages,
    decisionConfig: organizationConfig,
  });
  const frozen = queued.customerActivityDetectionQueue[0].relationshipSnapshot;
  assert.deepEqual(frozen.organization?.members, twoRouteTeam,
    'end-of-conversation queueing freezes the full server-side team');
  assert.deepEqual(frozen.organization?.members.map((member) => member.npcId), CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS,
    'the frozen organization contains each of the five NPCs exactly once');
  const updatedAttitudes = Object.fromEntries(CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => [
    npcId,
    { ...queued.npcAttitudes[npcId], support: 100, pleasantness: 0 },
  ]));
  const afterRelationshipChange = normalizeProjectOneState({
    ...queued,
    npcAttitudes: updatedAttitudes,
    npcAffinity: Object.fromEntries(CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => [npcId, 100])),
  });
  assert.deepEqual(afterRelationshipChange.customerActivityDetectionQueue[0].relationshipSnapshot, frozen,
    'reloading after metrics change keeps the original end-of-conversation snapshot for retry');
  const firstDecision = await decideCustomerActivityFeasibility(candidate, frozen, organizationConfig);
  const retryDecision = await decideCustomerActivityFeasibility(
    candidate,
    afterRelationshipChange.customerActivityDetectionQueue[0].relationshipSnapshot,
    organizationConfig,
  );
  assert.equal(firstDecision.decision, 'allow');
  assert.equal(retryDecision.decision, firstDecision.decision,
    'later team improvements cannot change the frozen decision on retry');

  const legacySnapshot = { ...frozen };
  delete legacySnapshot.organization;
  const legacyState = normalizeProjectOneState({
    ...queued,
    customerActivityDetectionQueue: [{
      ...queued.customerActivityDetectionQueue[0],
      relationshipSnapshot: legacySnapshot,
    }],
  });
  assert.equal(legacyState.customerActivityDetectionQueue[0].relationshipSnapshot.organization, undefined,
    'legacy snapshots without an organization are not backfilled from current team metrics');
  const legacyDecision = await decideCustomerActivityFeasibility(
    candidate,
    legacyState.customerActivityDetectionQueue[0].relationshipSnapshot,
    organizationConfig,
  );
  assert.equal(legacyDecision.decision, 'reject', 'numeric organization gates fail closed for legacy snapshots');
}

async function testDecisionCheckpointAndCasMemo() {
  const allMessages = [...messages, ...secondCandidate.sourceConversation];
  const candidates = [
    { ...candidate, sourceConversation: allMessages },
    { ...secondCandidate, sourceConversation: allMessages },
  ];
  const checkpointInitialState = createProjectOneState();
  const checkpointEligibleState = {
    ...checkpointInitialState,
    npcAttitudes: Object.fromEntries(Object.entries(checkpointInitialState.npcAttitudes).map(([npcId, attitude]) => [
      npcId,
      ['P1-002', 'P1-004'].includes(npcId) ? { ...attitude, pleasantness: 55 } : attitude,
    ])),
  };
  const checkpointDecisionConfig: ActivityDecisionConfig = { revision: 1, mode: 'ai', thresholds: {} };
  const queuedState = queueCustomerActivityDetection(checkpointEligibleState, {
    conversationId: candidate.conversationId,
    npcId: candidate.npcId,
    messages: allMessages,
    relationshipSnapshot: snapshot,
    decisionConfig: checkpointDecisionConfig,
  });
  const decideCalls = new Map<string, number>();
  let failSecond = true;
  const decide = async (item: CustomerActivityProposalCandidate) => {
    const calls = (decideCalls.get(item.proposalMessageId) ?? 0) + 1;
    decideCalls.set(item.proposalMessageId, calls);
    if (item.proposalMessageId === 'sales-2' && failSecond) throw new CustomerActivityDecisionError('provider_unavailable');
    return {
      ...allowedDecision,
      mode: 'ai' as const,
      configRevision: checkpointDecisionConfig.revision,
      decision: item.proposalMessageId === 'sales-1' ? 'reject' as const : 'allow' as const,
      reason: item.proposalMessageId === 'sales-1' ? '首次判定拒绝。' : '重试后允许。',
    };
  };
  let storedState = queuedState;
  const firstRun = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: storedState }),
    detect: async () => candidates,
    decide,
    now: () => 70_000,
    commit: async (args) => {
      assert.equal(args.expectedVersion, storedState.version);
      storedState = { ...args.state, version: storedState.version + 1 };
      return { state: storedState, result: args.result ?? {}, replayed: false };
    },
  });
  assert.equal(firstRun.state.customerActivityDetectionQueue.length, 1, 'partial checkpoint keeps the detection retryable');
  assert.equal(firstRun.state.customerActivities.decisions[0].decision, 'reject');
  assert.equal(firstRun.state.customerActivities.tasks.length, 0);

  failSecond = false;
  const retry = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: storedState }),
    detect: async () => candidates,
    decide,
    now: () => 80_000,
    commit: async (args) => {
      assert.equal(args.expectedVersion, storedState.version);
      storedState = { ...args.state, version: storedState.version + 1 };
      return { state: storedState, result: args.result ?? {}, replayed: false };
    },
  });
  assert.equal(decideCalls.get('sales-1'), 1, 'a checkpointed rejection cannot be re-evaluated into an allow');
  assert.equal(decideCalls.get('sales-2'), 2, 'the failed candidate can be retried once the provider recovers');
  assert.equal(retry.state.customerActivityDetectionQueue.length, 0);
  assert.equal(retry.state.customerActivities.tasks.length, 1, 'only the later allowed candidate creates a task');
  assert.equal(retry.state.customerActivities.tasks[0].type, 'case_site_visit');

  const casCalls = new Map<string, number>();
  const casDecide = async (item: CustomerActivityProposalCandidate) => {
    casCalls.set(item.proposalMessageId, (casCalls.get(item.proposalMessageId) ?? 0) + 1);
    return {
      ...allowedDecision,
      mode: 'ai' as const,
      configRevision: checkpointDecisionConfig.revision,
      reason: 'CAS conflict retry keeps this result.',
    };
  };
  let casState = queuedState;
  let casCommitCalls = 0;
  const casRun = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: casState }),
    detect: async () => candidates,
    decide: casDecide,
    now: () => 90_000,
    commit: async (args) => {
      casCommitCalls += 1;
      if (casCommitCalls === 1) {
        casState = { ...casState, version: casState.version + 1 };
        throw new Error('STATE_VERSION_CONFLICT');
      }
      assert.equal(args.expectedVersion, casState.version);
      casState = { ...args.state, version: casState.version + 1 };
      return { state: casState, result: args.result ?? {}, replayed: false };
    },
  });
  assert.equal(casCommitCalls, 2, 'CAS conflict retries the atomic commit');
  assert.deepEqual([...casCalls.values()], [1, 1], 'CAS retry does not re-run any successful AI gate');
  assert.equal(casRun.state.customerActivities.tasks.length, 2);

  let switchedState = queuedState;
  let detectionCalls = 0;
  let switchCommits = 0;
  const otherConversation = queueCustomerActivityDetection(createProjectOneState(), {
    conversationId: 'email:conversation-B',
    npcId: candidate.npcId,
    messages,
    relationshipSnapshot: snapshot,
    decisionConfig: DEFAULT_ACTIVITY_DECISION_CONFIG,
  });
  const switched = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: switchedState }),
    detect: async () => { detectionCalls += 1; return candidates; },
    decide: casDecide,
    commit: async () => {
      switchCommits += 1;
      switchedState = { ...otherConversation, version: switchedState.version + 1 };
      throw new Error('STATE_VERSION_CONFLICT');
    },
  });
  assert.equal(detectionCalls, 1);
  assert.equal(switchCommits, 1);
  assert.equal(switched.state.customerActivityDetectionQueue[0]?.conversationId, 'email:conversation-B');
  assert.equal(switched.state.customerActivities.decisions.length, 0, 'a newly headed conversation never receives stale candidates');
}

async function testSalesOnlyDetectionDiagnostics() {
  const salesOnlyMessage = {
    messageId: 'sales-only-proposal',
    speaker: 'sales' as const,
    text: '下周要不要开一次技术交流会，直接对接项目需求？',
  };
  const salesOnlyCandidate: CustomerActivityProposalCandidate = {
    conversationId: 'phone:sales-only',
    npcId: 'P1-001',
    sourceConversation: [salesOnlyMessage],
    type: 'technical_meeting',
    initiator: 'sales',
    proposalMessageId: salesOnlyMessage.messageId,
    responseMessageId: salesOnlyMessage.messageId,
    finalOutcomeMessageId: salesOnlyMessage.messageId,
    responseKind: 'not_required',
    finalStatus: 'active',
    evidence: [{ messageId: salesOnlyMessage.messageId, speaker: 'sales', kind: 'proposal', quote: '开一次技术交流会' }],
    summary: '安排技术交流会',
    requiresFeasibility: true,
  };
  const decisionConfig: ActivityDecisionConfig = { revision: 4, mode: 'ai', thresholds: {} };
  const initial = createProjectOneState();
  const queued = queueCustomerActivityDetection(initial, {
    conversationId: salesOnlyCandidate.conversationId,
    npcId: salesOnlyCandidate.npcId,
    messages: [salesOnlyMessage],
    relationshipSnapshot: snapshot,
    decisionConfig,
  });
  assert.equal(queued.customerActivityDetectionQueue[0]?.messages.length, 1,
    'a sales-only conversation is queued even without a customer response');
  const queueDiagnostics = queued.customerActivityDiagnostics ?? [];
  assert.equal(queueDiagnostics.at(-1)?.event, 'conversation_queued');
  assert.equal(queueDiagnostics.at(-1)?.decisionConfig?.revision, decisionConfig.revision);
  assert.equal(queueDiagnostics.at(-1)?.relationshipSnapshot?.organization?.members.length, 5,
    'queue logs retain the frozen organization-wide snapshot used by the gate');

  let storedState = queued;
  const allowed = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: storedState }),
    detect: async (args, dependencies) => {
      assert.deepEqual(args.messages, [salesOnlyMessage]);
      return detectCustomerActivityProposals(args, {
        invoker: async (modelMessages) => {
          assert.ok(modelMessages[0]?.content.includes('活动提议语义识别器'));
          return JSON.stringify({ activities: [{
            type: 'technical_meeting',
            initiator: 'sales',
            proposal: { messageId: salesOnlyMessage.messageId, quote: '下周要不要开一次技术交流会' },
          }] });
        },
        onDiagnostic: dependencies?.onDiagnostic,
      });
    },
    decide: async (_candidate, _snapshot, config) => ({
      decision: 'allow', mode: 'ai', configRevision: config.revision, reason: '整体条件允许继续。',
    }),
    now: () => 120_000,
    commit: async (args) => {
      storedState = { ...args.state, version: storedState.version + 1 };
      return { state: storedState, result: args.result ?? {}, replayed: false };
    },
  });
  assert.equal(allowed.state.customerActivityDetectionQueue.length, 0);
  assert.equal(allowed.state.customerActivities.tasks.length, 1, 'the sales proposal can create a task after the gate allows it');
  const events = allowed.state.customerActivityDiagnostics ?? [];
  assert.ok(events.some((item) => item.event === 'detection_started'));
  const accepted = events.find((item) => item.event === 'candidate_accepted');
  assert.equal(accepted?.details?.detection_source, 'llm_semantic_detection');
  assert.equal('raw_output' in (accepted?.details ?? {}), false, 'diagnostics never store arbitrary model output');
  assert.ok(events.some((item) => item.event === 'candidate_count' && item.details?.candidate_count === 1));
  const allowDecision = events.find((item) => item.event === 'threshold_decision');
  assert.equal(allowDecision?.details?.threshold_decision, 'allow');
  assert.equal(allowDecision?.details?.config_revision, decisionConfig.revision);
  assert.equal(events.at(-1)?.event, 'task_created');
  const publicState = toPlayerVisibleGameState(allowed.state);
  assert.equal('customerActivityDiagnostics' in publicState, false, 'internal activity diagnostics never cross the player projection');

  const emptyModelDiagnostics: Array<{ event: string }> = [];
  const modelEmpty = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'phone:model-empty', npcId: 'P1-001', messages: [salesOnlyMessage],
  }, {
    invoker: async () => JSON.stringify({ activities: [] }),
    onDiagnostic: (diagnostic) => emptyModelDiagnostics.push(diagnostic),
  });
  assert.deepEqual(modelEmpty, [], 'keyword-like text is not promoted when the semantic model returns no proposal');
  assert.ok(emptyModelDiagnostics.some((item) => item.event === 'model_response'));
  await assert.rejects(() => detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'phone:model-error', npcId: 'P1-001', messages: [salesOnlyMessage],
  }, { invoker: async () => { throw new Error('temporary detector outage'); } }),
  (error) => error instanceof CustomerActivityDetectionError && error.code === 'provider_unavailable',
  'a detector error does not promote a keyword-like message as fallback');

  const withdrawnMessages = [
    salesOnlyMessage,
    { messageId: 'sales-only-withdrawal', speaker: 'sales' as const, text: '这次取消技术交流会，后续再确认。' },
  ];
  const withdrawnCandidates = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'phone:model-withdrawal', npcId: 'P1-001', messages: withdrawnMessages,
  }, { invoker: async () => JSON.stringify({ activities: [] }) });
  assert.deepEqual(withdrawnCandidates, [], 'the model can classify a later seller withdrawal without creating a task');

  const historicalMessage = {
    messageId: 'sales-historical-meeting',
    speaker: 'sales' as const,
    text: '上周已经举办过一次技术交流会，效果不错。',
  };
  const historicalCandidates = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'email:model-historical', npcId: 'P1-001', messages: [historicalMessage],
  }, { invoker: async () => JSON.stringify({ activities: [] }) });
  assert.deepEqual(historicalCandidates, [], 'a historical activity mention remains absent when the model finds no new proposal');

  const idiomaticInvite = {
    messageId: 'sales-idiomatic-meal-invite',
    speaker: 'sales' as const,
    text: '刘老师，周末找家小馆子坐坐，边尝尝当地菜边聊聊项目近况，您看合适吗？',
  };
  assert.equal(/技术交流会|技术研讨|吃(?:个|顿)?(?:饭|便饭)|用餐|聚餐|饭局|喝酒|喝一杯|小酌/u.test(idiomaticInvite.text), false,
    'the idiomatic invite does not contain the existing activity keywords');
  const idiomaticCandidates = await detectCustomerActivityProposals({
    conversationEnded: true, conversationId: 'email:idiomatic-invite', npcId: 'P1-001', messages: [idiomaticInvite],
  }, {
    invoker: async (modelMessages) => {
      assert.ok(modelMessages[0]?.content.includes('活动提议语义识别器'));
      return JSON.stringify({ activities: [{
        type: 'hospitality',
        initiator: 'sales',
        proposal: { messageId: idiomaticInvite.messageId, quote: idiomaticInvite.text },
      }] });
    },
  });
  assert.equal(idiomaticCandidates.length, 1, 'the model can classify an idiomatic meal invitation without a keyword match');
  assert.equal(idiomaticCandidates[0]?.type, 'hospitality');
  assert.equal(idiomaticCandidates[0]?.proposalMessageId, idiomaticInvite.messageId);

  const rejectedCandidate = {
    ...salesOnlyCandidate,
    conversationId: 'phone:sales-only-rejected',
    proposalMessageId: 'sales-only-proposal-rejected',
    responseMessageId: 'sales-only-proposal-rejected',
    finalOutcomeMessageId: 'sales-only-proposal-rejected',
    sourceConversation: [{ ...salesOnlyMessage, messageId: 'sales-only-proposal-rejected' }],
    evidence: [{ ...salesOnlyCandidate.evidence[0], messageId: 'sales-only-proposal-rejected' }],
  } satisfies CustomerActivityProposalCandidate;
  let rejectedState = queueCustomerActivityDetection(createProjectOneState(), {
    conversationId: rejectedCandidate.conversationId,
    npcId: rejectedCandidate.npcId,
    messages: rejectedCandidate.sourceConversation,
    relationshipSnapshot: snapshot,
    decisionConfig,
  });
  const rejected = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: rejectedState }),
    detect: async () => [rejectedCandidate],
    decide: async (_candidate, _snapshot, config) => ({
      decision: 'reject', mode: 'ai', configRevision: config.revision, reason: '组织整体支持条件未达到。',
    }),
    now: () => 130_000,
    commit: async (args) => {
      rejectedState = { ...args.state, version: rejectedState.version + 1 };
      return { state: rejectedState, result: args.result ?? {}, replayed: false };
    },
  });
  const rejectDecision = (rejected.state.customerActivityDiagnostics ?? []).find((item) => item.event === 'threshold_decision');
  assert.equal(rejectDecision?.details?.threshold_decision, 'reject');
  assert.equal(rejectDecision?.reason, '组织整体支持条件未达到。');
  assert.equal(rejected.state.customerActivities.tasks.length, 0);
  const publicUnavailable = toPublicUnavailableCustomerActivityNotice(rejected.state.customerActivities.decisions[0]!);
  assert.deepEqual(Object.keys(publicUnavailable ?? {}), ['id', 'npcId', 'type', 'decidedAt'],
    'the unavailable notice uses the narrow public projection only');
  assert.equal(JSON.stringify(publicUnavailable).includes('组织整体支持条件未达到'), false,
    'the public unavailable notice hides the internal feasibility reason');
  const needMoreNotice = toPublicUnavailableCustomerActivityNotice({
    ...rejected.state.customerActivities.decisions[0]!,
    decision: 'need_more',
    reason: '还需要补充条件。',
  });
  assert.equal(needMoreNotice, null,
    'a legacy persisted need_more remains private and does not create a new unavailable notice');
  assert.equal(toPublicUnavailableCustomerActivityNotice({
    ...rejected.state.customerActivities.decisions[0]!,
    decision: 'allow',
    reason: '可以推进。',
  }), null, 'allow decisions do not create an unavailable notice');

  let failedState = queueCustomerActivityDetection(createProjectOneState(), {
    conversationId: 'phone:detection-failure',
    npcId: 'P1-001',
    messages: [salesOnlyMessage],
    relationshipSnapshot: snapshot,
    decisionConfig,
  });
  const failed = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: failedState }),
    detect: async (_args, dependencies) => {
      dependencies?.onDiagnostic?.({ event: 'model_error', reason: 'provider_unavailable' });
      throw new CustomerActivityDetectionError('provider_unavailable');
    },
    now: () => 140_000,
    commit: async (args) => {
      failedState = { ...args.state, version: failedState.version + 1 };
      return { state: failedState, result: args.result ?? {}, replayed: false };
    },
  });
  assert.equal(failed.state.customerActivityDetectionQueue.length, 1, 'failed detection remains retryable');
  assert.equal(failed.state.customerActivities.decisions.length, 0,
    'a provider failure does not persist a decision and therefore cannot create an unavailable notice');
  const failureDiagnostics = failed.state.customerActivityDiagnostics ?? [];
  assert.ok(failureDiagnostics.some((item) => item.event === 'model_error'));
  assert.ok(failureDiagnostics.some((item) => item.event === 'detection_failed'));

  const failureVersion = failed.state.version;
  let repeatedDetectorCalls = 0;
  let repeatedCommitCalls = 0;
  const repeatedFailure = await processPendingCustomerActivityDetections('test-session', 'test-user', {
    load: async () => ({ id: 'test-session', userId: 'test-user', state: failedState }),
    detect: async (_args, dependencies) => {
      repeatedDetectorCalls += 1;
      dependencies?.onDiagnostic?.({ event: 'model_error', reason: 'provider_unavailable' });
      throw new CustomerActivityDetectionError('provider_unavailable');
    },
    commit: async (args) => {
      repeatedCommitCalls += 1;
      failedState = { ...args.state, version: failedState.version + 1 };
      return { state: failedState, result: args.result ?? {}, replayed: false };
    },
  });
  assert.equal(repeatedDetectorCalls, 1, 'the retry rechecks the still-queued conversation');
  assert.equal(repeatedCommitCalls, 0, 'the same provider failure does not write another diagnostic checkpoint');
  assert.equal(repeatedFailure.state.version, failureVersion, 'repeating the same failure does not bump the session version');
  assert.equal(repeatedFailure.state.customerActivityDetectionQueue.length, 1,
    'the conversation remains retryable after a deduplicated failure');

  let bounded = createProjectOneState();
  for (let index = 0; index < 105; index += 1) {
    bounded = appendCustomerActivityDiagnostic(bounded, { event: `test_${index}`, at: index });
  }
  const boundedDiagnostics = bounded.customerActivityDiagnostics ?? [];
  assert.equal(boundedDiagnostics.length, 100, 'diagnostic history is bounded');
  assert.equal(boundedDiagnostics[0]?.event, 'test_5');
  const migrated = normalizeProjectOneState({ ...createProjectOneState(), customerActivityDiagnostics: undefined });
  assert.deepEqual(migrated.customerActivityDiagnostics, [], 'old saves restore without diagnostic history');
}

function testServerClockDeadlineAndNoFreeProjectTime() {
  const { state, task } = stateWithAllowedTask();
  const startedAt = 100_000;
  const startWithTimer = {
    ...state,
    projectTimer: { ...state.projectTimer, lastResumedAt: new Date(startedAt - 30_000).toISOString() },
  };
  const activities = startCustomerActivityPlanning(startWithTimer.customerActivities, task.id, startedAt);
  const paused = pauseProjectTimerForCustomerActivity({ ...startWithTimer, customerActivities: activities }, startedAt);
  const planning = paused.customerActivities.tasks[0];
  assert.equal(planning.status, 'planning');
  assert.equal(planning.deadlineAt, startedAt + CUSTOMER_ACTIVITY_PLANNING_MS);
  assert.equal(paused.projectTimer.elapsedMs, 30_000, 'project clock is materialised up to the planning start');
  assert.equal(paused.projectTimer.visitPaused, true);

  const saved = saveCustomerActivityDraft(paused.customerActivities, task.id, '明确议题、参会角色、案例材料和会后责任人。', startedAt + 60_000);
  assert.equal(saved.accepted, true);
  const stillPaused = synchronizeProjectTimer({ ...paused, customerActivities: saved.state }, planning.deadlineAt! + 120_000, true);
  assert.equal(stillPaused.projectTimer.elapsedMs, 30_000, 'a closed browser does not let the paused project clock advance');
  assert.equal(stillPaused.actionPoints, paused.actionPoints, 'no AP recovers during the activity-planning window');

  const timedOut = finalizeExpiredCustomerActivities(saved.state, planning.deadlineAt!);
  const submitted = timedOut.tasks[0];
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.submitReason, 'timeout');
  assert.equal(submitted.submittedAt, planning.deadlineAt, 'timeout is anchored to the original server deadline');
  assert.equal(submitted.draft, '明确议题、参会角色、案例材料和会后责任人。', 'timeout submits the last server-saved draft');
  assert.equal(submitted.quiz?.status, 'answering', 'a timeout submission begins its separate quiz window');
  assert.equal(submitted.quiz?.startedAt, planning.deadlineAt);
  assert.equal(submitted.quiz?.deadlineAt, planning.deadlineAt! + CUSTOMER_ACTIVITY_QUIZ_MS);
  assert.equal(isCustomerActivityReadyForEvaluation(submitted), false,
    'plan submission is not ready for evaluation until its quiz is completed');

  const duringQuiz = synchronizeProjectTimer({ ...paused, customerActivities: timedOut }, submitted.quiz!.deadlineAt - 1, true);
  assert.equal(duringQuiz.projectTimer.elapsedMs, 30_000, 'the separate quiz window does not consume project time');
  assert.equal(duringQuiz.actionPoints, paused.actionPoints, 'answering the separate quiz does not recover AP');
  const reloaded = parseCustomerActivityState(JSON.parse(JSON.stringify(timedOut)));
  assert.deepEqual(reloaded.tasks[0]?.quiz, submitted.quiz, 'quiz questions, answers, and deadline survive persisted-state reload');
  const offlineBothExpired = finalizeExpiredCustomerActivities(saved.state, submitted.quiz!.deadlineAt + 1);
  const quizExpired = offlineBothExpired;
  assert.equal(quizExpired.tasks[0]?.quiz?.status, 'completed', 'server deadline completes an unanswered quiz');
  assert.equal(quizExpired.tasks[0]?.quiz?.completedAt, submitted.quiz!.deadlineAt);
  const resumed = resumeProjectTimerAfterCustomerActivity({ ...paused, customerActivities: quizExpired }, submitted.quiz!.deadlineAt);
  const afterDeadline = synchronizeProjectTimer(resumed, submitted.quiz!.deadlineAt + 20_000, true);
  assert.equal(afterDeadline.projectTimer.elapsedMs, 50_000, 'only time after the quiz deadline resumes the project timer');
  assert.equal(afterDeadline.actionPoints, paused.actionPoints, 'short post-quiz time does not create an AP recovery');

  const submittedEarly = submitCustomerActivityPlan(saved.state, task.id, startedAt + 90_000);
  assert.equal(submittedEarly.tasks[0].submitReason, 'manual');
  assert.equal(submittedEarly.tasks[0].submittedAt, startedAt + 90_000);
  assert.deepEqual(submitCustomerActivityPlan(submittedEarly, task.id, startedAt + 100_000), submittedEarly,
    'manual submit replay does not alter the submitted plan');

  const blocked = { ...paused, customerActivities: activities };
  assert.throws(() => executeGameCommand(blocked, {
    commandId: 'activity-blocks-action',
    expectedVersion: blocked.version,
    type: 'research_public_info',
    payload: { npcId: 'P1-004' },
  }), /CUSTOMER_ACTIVITY_PLANNING_ACTIVE/u);
}

function testEvaluationOnceAndPublicProjection() {
  const { state, task } = stateWithAllowedTask();
  const now = 200_000;
  const started = startCustomerActivityPlanning(state.customerActivities, task.id, now);
  const withPlan = saveCustomerActivityDraft(started, task.id,
    '围绕客户目标准备活动议题、参会角色和后续跟进安排。', now + 5_000);
  const submitted = submitCustomerActivityPlan(withPlan.state, task.id, now + 10_000);
  const beforeEvaluation = { ...state, customerActivities: submitted };
  const before = {
    support: beforeEvaluation.npcAttitudes[candidate.npcId].support,
    pleasantness: beforeEvaluation.npcAttitudes[candidate.npcId].pleasantness,
    dimensions: { ...beforeEvaluation.dimensions },
    actionPoints: beforeEvaluation.actionPoints,
    elapsedMs: beforeEvaluation.projectTimer.elapsedMs,
  };

  const stillAnswering = applyCustomerActivityEvaluation(beforeEvaluation, task.id, evaluation, now + 11_000);
  assert.deepEqual(stillAnswering, beforeEvaluation, 'AI evaluation cannot be recorded or applied while the quiz is active');
  assert.equal(stillAnswering.customerActivities.tasks[0]?.evaluation, undefined);
  let answered = saveCustomerActivityQuizAnswer(submitted, task.id, 'technical-preparation', 'option-1', now + 11_500);
  assert.equal(answered.accepted, true);
  answered = saveCustomerActivityQuizAnswer(answered.state, task.id, 'technical-discussion', 'option-2', now + 12_000);
  assert.equal(answered.accepted, true);
  answered = saveCustomerActivityQuizAnswer(answered.state, task.id, 'technical-follow-up', 'option-4', now + 12_500);
  assert.equal(answered.accepted, true);
  const selectedQuizDelta = answered.state.tasks[0]!.quiz!.questions.reduce((sum, question) => {
    const option = question.options.find((choice) => choice.id === answered.state.tasks[0]!.quiz!.answers[question.id]);
    return { supportDelta: sum.supportDelta + (option?.supportDelta ?? 0), pleasureDelta: sum.pleasureDelta + (option?.pleasureDelta ?? 0) };
  }, { supportDelta: 0, pleasureDelta: 0 });
  const completedQuiz = completeCustomerActivityQuiz(answered.state, task.id, now + 13_000);
  assert.equal(isCustomerActivityReadyForEvaluation(completedQuiz.tasks[0]!), true);
  const readyForEvaluation = { ...beforeEvaluation, customerActivities: completedQuiz };
  const evaluated = applyCustomerActivityEvaluation(readyForEvaluation, task.id, evaluation, now + 14_000);
  const finalEvaluation = evaluated.customerActivities.tasks[0]!.evaluation!;
  assert.equal(finalEvaluation.supportDelta, evaluation.supportDelta + selectedQuizDelta.supportDelta);
  assert.equal(finalEvaluation.pleasureDelta, evaluation.pleasureDelta + selectedQuizDelta.pleasureDelta);
  assert.equal(evaluated.npcAttitudes[candidate.npcId].support,
    Math.max(0, Math.min(100, before.support + finalEvaluation.supportDelta)),
    'formal NPC support combines the independent AI plan score with the quiz score once');
  assert.equal(evaluated.npcAttitudes[candidate.npcId].pleasantness,
    Math.max(0, Math.min(100, before.pleasantness + finalEvaluation.pleasureDelta)),
    'formal NPC pleasantness combines the independent AI plan score with the quiz score once');
  assert.equal(evaluated.dimensions.valuePresentation, before.dimensions.valuePresentation + 2);
  assert.equal(evaluated.actionPoints, before.actionPoints, 'activity scoring does not grant AP');
  assert.equal(evaluated.projectTimer.elapsedMs, before.elapsedMs, 'activity scoring does not add game time');
  assert.deepEqual(applyCustomerActivityEvaluation(evaluated, task.id, evaluation, now + 15_000), evaluated,
    'the evaluation marker and metric changes are idempotent');

  const publicTask = toPublicCustomerActivityTask(evaluated.customerActivities.tasks[0]);
  assert.deepEqual(Object.keys(publicTask.evaluation ?? {}), ['overallEvaluation']);
  assert.equal(publicTask.evaluation?.overallEvaluation, CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE);
  assert.notEqual(publicTask.evaluation?.overallEvaluation, evaluation.overallEvaluation,
    'the player projection does not expose model-generated commentary');
  assert.deepEqual(evaluated.customerActivities.tasks[0].evaluationBreakdown?.aiPlan, evaluation,
    'the original AI evaluation remains in the private breakdown');
  assert.deepEqual(evaluated.customerActivities.tasks[0].evaluationBreakdown?.quiz, selectedQuizDelta,
    'the private breakdown records the deterministic quiz contribution separately');
  for (const [draft, result] of [
    ['方案内容', { supportDelta: 3, pleasureDelta: 2 }],
    ['方案内容', { supportDelta: -2, pleasureDelta: -3 }],
    ['方案内容', { supportDelta: 0, pleasureDelta: 0 }],
    ['方案内容', { supportDelta: 1, pleasureDelta: -1 }],
    ['', { supportDelta: 3, pleasureDelta: 4 }],
    ['  \n ', { supportDelta: -3, pleasureDelta: -4 }],
  ] as const) {
    assert.equal(getPublicCustomerActivityOutcome(draft, result), CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE,
      'plan wording and private score direction never change the public completion message');
  }
  assert.equal(/support|pleasure|支持度|愉悦度|\d/u.test(publicTask.evaluation?.overallEvaluation ?? ''), false,
    'the public result reveals neither metric labels nor numeric values');
  assert.equal('evidence' in publicTask, false);
  assert.equal('sourceConversation' in publicTask, false);
  assert.equal(JSON.stringify(publicTask).includes('supportDelta'), false, 'public activity quiz and evaluation omit private score deltas');
  assert.equal(JSON.stringify(publicTask).includes('pleasureDelta'), false, 'public activity quiz omits scoring metadata');
  const publicState = toPlayerVisibleGameState(evaluated);
  assert.equal(Array.isArray(publicState.customerActivities), true);
  assert.equal('customerActivityDetectionQueue' in publicState, false);
  assert.equal(JSON.stringify(publicState).includes('supportDelta'), false, 'numeric deltas stay server-side');

  const { state: blankState, task: blankTask } = stateWithAllowedTask();
  const lowBaseline = {
    ...blankState,
    npcAttitudes: {
      ...blankState.npcAttitudes,
      [candidate.npcId]: { ...blankState.npcAttitudes[candidate.npcId], support: 1, pleasantness: 2 },
    },
    dimensions: { ...blankState.dimensions, decisionAnalysis: 0, valuePresentation: 0 },
  };
  const blankSubmitted = submitCustomerActivityPlan(
    startCustomerActivityPlanning(lowBaseline.customerActivities, blankTask.id, now), blankTask.id, now + 10_000,
  );
  const blankBeforeEvaluation = { ...lowBaseline, customerActivities: blankSubmitted };
  const blankEvaluation = {
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
  const blankComplete = completeCustomerActivityQuiz(blankSubmitted, blankTask.id, now + 10_500);
  const blankReady = { ...blankBeforeEvaluation, customerActivities: blankComplete };
  const blankEvaluated = applyCustomerActivityEvaluation(blankReady, blankTask.id, blankEvaluation, now + 11_000);
  assert.equal(blankEvaluated.npcAttitudes[candidate.npcId].support, 0, 'negative support effect clamps at its lower bound');
  assert.equal(blankEvaluated.npcAttitudes[candidate.npcId].pleasantness, 0, 'negative pleasure effect clamps at its lower bound');
  assert.equal(blankEvaluated.dimensions.decisionAnalysis, 0, 'negative dimension effect clamps at its lower bound');
  assert.equal(blankEvaluated.dimensions.valuePresentation, 0, 'all negative dimensions stay within their lower bounds');
  assert.equal(blankEvaluated.actionPoints, blankBeforeEvaluation.actionPoints, 'blank-plan scoring does not cost or grant AP');
  assert.equal(blankEvaluated.projectTimer.elapsedMs, blankBeforeEvaluation.projectTimer.elapsedMs, 'blank-plan scoring does not advance game time');
  assert.deepEqual(applyCustomerActivityEvaluation(blankEvaluated, blankTask.id, blankEvaluation, now + 12_000), blankEvaluated,
    'an empty-plan penalty is applied once even if evaluation recovery is replayed');
  const blankPublicTask = toPublicCustomerActivityTask(blankEvaluated.customerActivities.tasks[0]);
  assert.equal(blankPublicTask.evaluation?.overallEvaluation, CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE);

  const unresolved = {
    ...state,
    customerActivities: submitCustomerActivityPlan(
      startCustomerActivityPlanning(state.customerActivities, task.id, now), task.id, now + 10_000,
    ),
  };
  assert.equal(submitGame(unresolved, 'activity-unsettled').status, 'playing',
    'submitGame cannot settle before activity evaluation');
  assert.throws(() => executeGameCommand(unresolved, {
    commandId: 'activity-evaluation-blocks-action',
    expectedVersion: unresolved.version,
    type: 'research_public_info',
    payload: { npcId: 'P1-004' },
  }), /CUSTOMER_ACTIVITY_EVALUATION_PENDING/u);
}

async function testFormalEvaluationReadinessAndLegacyTasks() {
  const { state, task } = stateWithAllowedTask();
  const now = Date.now();
  const startedActivities = startCustomerActivityPlanning(state.customerActivities, task.id, now);
  const pausedState = pauseProjectTimerForCustomerActivity({ ...state, customerActivities: startedActivities }, now);
  const saved = saveCustomerActivityDraft(pausedState.customerActivities, task.id,
    '按客户确认的关注点安排交流议题、人员和后续核验事项。', now + 1_000);
  const submittedActivities = submitCustomerActivityPlan(saved.state, task.id, now + 2_000);
  let storedState = { ...pausedState, customerActivities: submittedActivities };
  const beforeMetrics = {
    support: storedState.npcAttitudes[task.npcId].support,
    pleasantness: storedState.npcAttitudes[task.npcId].pleasantness,
    dimensions: { ...storedState.dimensions },
    actionPoints: storedState.actionPoints,
    elapsedMs: storedState.projectTimer.elapsedMs,
  };
  let evaluatorCalls = 0;
  let commits = 0;
  const dependencies = {
    load: async () => ({ id: 'quiz-test-session', userId: 'quiz-test-user', state: storedState }),
    evaluate: async () => {
      evaluatorCalls += 1;
      return evaluation;
    },
    commit: async (args: Parameters<typeof import('../src/lib/game/repository').commitGameCommand>[0]) => {
      commits += 1;
      storedState = { ...args.state, version: storedState.version + 1 };
      return { state: storedState, result: args.result ?? {}, replayed: false };
    },
    now: () => now + 20_000,
  };

  const beforeQuizResult = await processSubmittedCustomerActivityEvaluations(
    'quiz-test-session', 'quiz-test-user', dependencies,
  );
  assert.equal(beforeQuizResult.state.customerActivities.tasks[0]?.evaluation, undefined);
  assert.equal(evaluatorCalls, 0, 'formal service does not invoke AI while a submitted task quiz is answering');
  assert.equal(commits, 0, 'formal service does not persist an evaluation before quiz completion');
  assert.equal(storedState.npcAttitudes[task.npcId].support, beforeMetrics.support);
  assert.equal(storedState.npcAttitudes[task.npcId].pleasantness, beforeMetrics.pleasantness);
  assert.deepEqual(storedState.dimensions, beforeMetrics.dimensions);
  assert.equal(storedState.actionPoints, beforeMetrics.actionPoints);
  assert.equal(storedState.projectTimer.elapsedMs, beforeMetrics.elapsedMs);

  let answered = saveCustomerActivityQuizAnswer(storedState.customerActivities, task.id,
    'technical-preparation', 'option-1', now + 3_000);
  answered = saveCustomerActivityQuizAnswer(answered.state, task.id,
    'technical-discussion', 'option-1', now + 4_000);
  answered = saveCustomerActivityQuizAnswer(answered.state, task.id,
    'technical-follow-up', 'option-1', now + 5_000);
  const answers = answered.state.tasks[0]!.quiz!;
  const quizDelta = answers.questions.reduce((total, question) => {
    const option = question.options.find((item) => item.id === answers.answers[question.id]);
    return { supportDelta: total.supportDelta + (option?.supportDelta ?? 0), pleasureDelta: total.pleasureDelta + (option?.pleasureDelta ?? 0) };
  }, { supportDelta: 0, pleasureDelta: 0 });
  const completed = completeCustomerActivityQuiz(answered.state, task.id, now + 6_000);
  storedState = {
    ...resumeProjectTimerAfterCustomerActivity({ ...storedState, customerActivities: completed }, now + 6_000),
    version: storedState.version + 1,
  };
  const result = await processSubmittedCustomerActivityEvaluations(
    'quiz-test-session', 'quiz-test-user', dependencies,
  );
  const evaluatedTask = result.state.customerActivities.tasks[0]!;
  assert.equal(evaluatorCalls, 1, 'formal AI evaluation starts once after the quiz is completed');
  assert.equal(commits, 1);
  assert.deepEqual(evaluatedTask.evaluationBreakdown?.aiPlan, evaluation);
  assert.deepEqual(evaluatedTask.evaluationBreakdown?.quiz, quizDelta);
  assert.equal(evaluatedTask.evaluation?.supportDelta,
    Math.min(4, Math.max(-5, evaluation.supportDelta + quizDelta.supportDelta)));
  assert.equal(evaluatedTask.evaluation?.pleasureDelta,
    Math.min(6, Math.max(-8, evaluation.pleasureDelta + quizDelta.pleasureDelta)));
  assert.equal(result.state.npcAttitudes[task.npcId].support,
    Math.max(0, Math.min(100, beforeMetrics.support + evaluatedTask.evaluation!.supportDelta)));
  assert.equal(result.state.npcAttitudes[task.npcId].pleasantness,
    Math.max(0, Math.min(100, beforeMetrics.pleasantness + evaluatedTask.evaluation!.pleasureDelta)));
  assert.equal(result.state.actionPoints, beforeMetrics.actionPoints, 'formal settlement does not charge or grant AP');
  const settledMetrics = { support: result.state.npcAttitudes[task.npcId].support, pleasantness: result.state.npcAttitudes[task.npcId].pleasantness };
  const repeated = await processSubmittedCustomerActivityEvaluations('quiz-test-session', 'quiz-test-user', dependencies);
  assert.equal(evaluatorCalls, 1, 'settled tasks are not sent to AI again');
  assert.equal(commits, 1, 'settled task evaluation is persisted once');
  assert.deepEqual({
    support: repeated.state.npcAttitudes[task.npcId].support,
    pleasantness: repeated.state.npcAttitudes[task.npcId].pleasantness,
  }, settledMetrics, 'recovery does not apply the combined score twice');

  const legacyFixture = stateWithAllowedTask();
  const legacyTask = { ...legacyFixture.task };
  delete legacyTask.quizEnabled;
  const legacyActivities = { ...legacyFixture.state.customerActivities, tasks: [legacyTask] };
  const legacyStart = {
    ...legacyActivities,
    tasks: legacyActivities.tasks.map((item) => item.id === legacyTask.id
      ? { ...item, status: 'planning' as const, startedAt: now, deadlineAt: now + CUSTOMER_ACTIVITY_PLANNING_MS }
      : item),
  };
  const legacySubmitted = submitCustomerActivityPlan(legacyStart, legacyTask.id, now + 1_000);
  assert.equal(legacySubmitted.tasks[0]?.quiz, undefined, 'legacy task schema retains its old no-quiz behavior');
  let legacyStoredState = { ...legacyFixture.state, customerActivities: legacySubmitted };
  let legacyEvaluationCalls = 0;
  const legacyResult = await processSubmittedCustomerActivityEvaluations('legacy-test-session', 'legacy-test-user', {
    load: async () => ({ id: 'legacy-test-session', userId: 'legacy-test-user', state: legacyStoredState }),
    evaluate: async () => {
      legacyEvaluationCalls += 1;
      return evaluation;
    },
    commit: async (args) => {
      legacyStoredState = { ...args.state, version: legacyStoredState.version + 1 };
      return { state: legacyStoredState, result: args.result ?? {}, replayed: false };
    },
    now: () => now + 2_000,
  });
  assert.equal(legacyEvaluationCalls, 1, 'legacy submitted tasks still follow the former immediate evaluation path');
  assert.equal(legacyResult.state.customerActivities.tasks[0]?.evaluation?.overallEvaluation, evaluation.overallEvaluation);
}

async function testFrozenExecutionConfigAffectsFormalService() {
  const execution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  execution.quizDurationSeconds = 90;
  execution.questionBanks.technical_meeting[0].title = '情境推演（假设）：冻结配置里的正式服务题？';
  execution.aiInstructions = '正式服务冻结规则：只评价当前任务创建时的方案要求。';
  execution.weights = { plan: 0.5, quiz: 0.5 };
  execution.limits.supportMax = 1;
  execution.limits.pleasureMax = 1;
  execution.limits.dimensionMax = 0;
  const decisionConfig: ActivityDecisionConfig = { ...DEFAULT_ACTIVITY_DECISION_CONFIG, execution };
  const frozenExecution = structuredClone(execution);
  const { state, task } = stateWithAllowedTask(decisionConfig);
  const now = Date.now();
  const started = startCustomerActivityPlanning(state.customerActivities, task.id, now);
  const saved = saveCustomerActivityDraft(started, task.id, '确认议题、参会角色和会后核验责任人。', now + 500);
  const submitted = submitCustomerActivityPlan(saved.state, task.id, now + 1_000);
  const submittedTask = submitted.tasks[0]!;
  assert.ok(submittedTask.quiz, 'a new formal submission snapshots an activity quiz');
  assert.equal(submittedTask.quiz.deadlineAt - submittedTask.quiz.startedAt, 90_000,
    'formal submission snapshots the configured quiz duration');
  assert.equal(submittedTask.quiz?.questions[0]?.title, '情境推演（假设）：冻结配置里的正式服务题？',
    'formal submission snapshots the configured question bank');

  execution.quizDurationSeconds = 30;
  execution.questionBanks.technical_meeting[0].title = '后台后来修改的题';
  execution.aiInstructions = '后台后来修改的提示词';
  let answered = submitted;
  for (const question of submittedTask.quiz!.questions) {
    const bestOption = question.options.reduce((best, option) =>
      option.supportDelta + option.pleasureDelta > best.supportDelta + best.pleasureDelta ? option : best);
    answered = saveCustomerActivityQuizAnswer(answered, task.id, question.id, bestOption.id, now + 2_000).state;
  }
  const completed = completeCustomerActivityQuiz(answered, task.id, now + 3_000);
  let storedState = { ...state, customerActivities: completed };
  let evaluatedExecution: unknown;
  const result = await processSubmittedCustomerActivityEvaluations('frozen-formal-session', 'test-user', {
    load: async () => ({ id: 'frozen-formal-session', userId: 'test-user', state: storedState }),
    evaluate: async (args) => {
      evaluatedExecution = args.executionConfig;
      return evaluation;
    },
    commit: async (args) => {
      storedState = { ...args.state, version: storedState.version + 1 };
      return { state: storedState, result: args.result ?? {}, replayed: false };
    },
    now: () => now + 4_000,
  });
  const settledTask = result.state.customerActivities.tasks[0]!;
  assert.deepEqual(evaluatedExecution, frozenExecution,
    'formal AI evaluation receives the frozen execution rubric after the designer config changes');
  assert.equal(settledTask.evaluation?.supportDelta, 1,
    'formal service combines weighted plan and quiz contributions within the frozen support cap');
  assert.equal(settledTask.evaluation?.pleasureDelta, 1,
    'formal service combines weighted plan and quiz contributions within the frozen pleasure cap');
  assert.equal(result.state.npcAttitudes[task.npcId].support, state.npcAttitudes[task.npcId].support + 1,
    'the custom weighted and capped evaluation changes the target NPC support');
  assert.equal(result.state.npcAttitudes[task.npcId].pleasantness, state.npcAttitudes[task.npcId].pleasantness + 1,
    'the custom weighted and capped evaluation changes the target NPC experience');
  const publicTask = toPublicCustomerActivityTask(settledTask);
  const publicJson = JSON.stringify(publicTask);
  assert.equal(publicJson.includes('execution'), false, 'the public task DTO hides execution settings');
  assert.equal(publicJson.includes('aiInstructions'), false, 'the public task DTO hides the private AI rubric');
  assert.equal(publicJson.includes('supportDelta'), false, 'the public task DTO hides option and evaluation scoring');
  assert.equal(publicJson.includes('evaluationBreakdown'), false, 'the public task DTO hides private score details');
}

async function testActivityEvaluationProviderSettlement() {
  const planDeltas = {
    supportDelta: 2,
    pleasureDelta: 2,
    decisionAnalysis: 1,
    relationshipBuilding: -1,
    valuePresentation: 2,
    objectionHandling: 0,
    informationDiscovery: 1,
  };
  const makeReadyTask = (decisionConfig: ActivityDecisionConfig, now: number) => {
    const fixture = stateWithAllowedTask(decisionConfig);
    const planning = startCustomerActivityPlanning(fixture.state.customerActivities, fixture.task.id, now);
    const saved = saveCustomerActivityDraft(planning, fixture.task.id,
      '先核对客户关注点和参会角色，准备接口议题、待确认事项及会后责任人。', now + 100);
    const submitted = submitCustomerActivityPlan(saved.state, fixture.task.id, now + 200);
    return { ...fixture, activities: submitted, now };
  };
  const completeBestAnswerQuiz = (activities: ReturnType<typeof createEmptyCustomerActivityState>, taskId: string, now: number) => {
    let answered = activities;
    const task = activities.tasks.find((item) => item.id === taskId);
    for (const question of task?.quiz?.questions ?? []) {
      const result = saveCustomerActivityQuizAnswer(answered, taskId, question.id, 'option-1', now);
      assert.equal(result.accepted, true);
      answered = result.state;
    }
    return completeCustomerActivityQuiz(answered, taskId, now + 1);
  };

  const execution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  execution.evaluationProvider = 'jev';
  execution.weights = { plan: 0.5, quiz: 0.5 };
  const decisionConfig: ActivityDecisionConfig = { ...DEFAULT_ACTIVITY_DECISION_CONFIG, execution };
  const fixture = makeReadyTask(decisionConfig, 60_000);
  assert.equal(fixture.task.decisionConfig?.execution?.evaluationProvider, 'jev',
    'a new formal task snapshots the Jev plan-evaluation provider');
  const initial = { ...fixture.state, customerActivities: fixture.activities };
  let storedState = initial;
  const beforeTarget = { ...storedState.npcAttitudes[fixture.task.npcId] };
  const beforeOther = { ...storedState.npcAttitudes['P1-002'] };
  const beforeDimensions = { ...storedState.dimensions };
  let jevCalls = 0;
  let llmEvaluationCalls = 0;
  let commits = 0;
  const jevInvoker = activityPlanJevInvoker(planDeltas, () => { jevCalls += 1; });
  const dependencies = {
    load: async () => ({ id: 'formal-jev-session', userId: 'test-user', state: storedState }),
    evaluate: (args: Parameters<typeof evaluateCustomerActivityPlan>[0]) => evaluateCustomerActivityPlan(args, {
      invoker: async () => {
        llmEvaluationCalls += 1;
        return JSON.stringify(evaluation);
      },
      jevInvoker,
    }),
    commit: async (args: Parameters<typeof import('../src/lib/game/repository').commitGameCommand>[0]) => {
      commits += 1;
      storedState = { ...args.state, version: storedState.version + 1 };
      return { state: storedState, result: args.result ?? {}, replayed: false };
    },
    now: () => fixture.now + 1_000,
  };

  const beforeQuiz = await processSubmittedCustomerActivityEvaluations('formal-jev-session', 'test-user', dependencies);
  assert.equal(beforeQuiz.state.customerActivities.tasks[0]?.evaluation, undefined);
  assert.equal(jevCalls, 0, 'formal service does not call Jev before the submitted plan quiz is complete');
  assert.equal(llmEvaluationCalls, 0, 'formal service does not call LLM before the submitted plan quiz is complete');
  assert.equal(commits, 0, 'no evaluation is persisted before quiz completion');
  assert.equal(storedState.npcAttitudes[fixture.task.npcId].support, beforeTarget.support);
  assert.equal(storedState.npcAttitudes[fixture.task.npcId].pleasantness, beforeTarget.pleasantness);
  assert.deepEqual(storedState.dimensions, beforeDimensions);

  let answered = storedState.customerActivities;
  for (const question of fixture.activities.tasks[0]!.quiz!.questions) {
    const result = saveCustomerActivityQuizAnswer(answered, fixture.task.id, question.id, 'option-1', fixture.now + 300);
    assert.equal(result.accepted, true);
    answered = result.state;
  }
  storedState = {
    ...storedState,
    customerActivities: completeCustomerActivityQuiz(answered, fixture.task.id, fixture.now + 400),
  };
  // A later designer setting must not mutate the already-created task's provider snapshot.
  execution.evaluationProvider = 'llm';
  assert.equal(storedState.customerActivities.tasks[0]?.decisionConfig?.execution?.evaluationProvider, 'jev');

  const settled = await processSubmittedCustomerActivityEvaluations('formal-jev-session', 'test-user', dependencies);
  const settledTask = settled.state.customerActivities.tasks[0]!;
  assert.equal(jevCalls, 1, 'formal Jev evaluation runs once after quiz completion');
  assert.equal(llmEvaluationCalls, 0, 'Jev evaluation does not fall through to LLM');
  assert.equal(commits, 1, 'plan and quiz effects are committed together once');
  assert.deepEqual(settledTask.evaluationBreakdown?.aiPlan, {
    supportDelta: 2,
    pleasureDelta: 2,
    dimensionDeltas: {
      decisionAnalysis: 1,
      relationshipBuilding: -1,
      valuePresentation: 2,
      objectionHandling: 0,
      informationDiscovery: 1,
    },
    overallEvaluation: CUSTOMER_ACTIVITY_EVALUATION_COMPLETED_MESSAGE,
  });
  assert.equal(settledTask.evaluation?.supportDelta, 3,
    'the Jev plan support result is combined with the weighted three-answer quiz result');
  assert.equal(settledTask.evaluation?.pleasureDelta, 3,
    'the Jev plan pleasure result is combined with the weighted three-answer quiz result');
  assert.deepEqual(settledTask.evaluation?.dimensionDeltas, {
    decisionAnalysis: 1,
    relationshipBuilding: -1,
    valuePresentation: 1,
    objectionHandling: 0,
    informationDiscovery: 1,
  }, 'the five Jev integer choices produce weighted ability changes');
  assert.equal(settled.state.npcAttitudes[fixture.task.npcId].support,
    Math.max(0, Math.min(100, beforeTarget.support + 3)), 'the combined result changes the target NPC support');
  assert.equal(settled.state.npcAttitudes[fixture.task.npcId].pleasantness,
    Math.max(0, Math.min(100, beforeTarget.pleasantness + 3)), 'the combined result changes the target NPC experience');
  assert.deepEqual(settled.state.npcAttitudes['P1-002'], beforeOther,
    'formal settlement does not change another NPC');
  assert.deepEqual(settled.state.dimensions, {
    decisionAnalysis: beforeDimensions.decisionAnalysis + 1,
    relationshipBuilding: beforeDimensions.relationshipBuilding - 1,
    valuePresentation: beforeDimensions.valuePresentation + 1,
    objectionHandling: beforeDimensions.objectionHandling,
    informationDiscovery: beforeDimensions.informationDiscovery + 1,
  }, 'the five Jev answers update the existing player dimensions');
  const settledMetrics = {
    support: settled.state.npcAttitudes[fixture.task.npcId].support,
    pleasantness: settled.state.npcAttitudes[fixture.task.npcId].pleasantness,
  };
  await processSubmittedCustomerActivityEvaluations('formal-jev-session', 'test-user', dependencies);
  assert.equal(jevCalls, 1, 'a settled task is not evaluated by Jev a second time');
  assert.equal(llmEvaluationCalls, 0);
  assert.equal(commits, 1, 'a settled task is committed only once');
  assert.deepEqual({
    support: storedState.npcAttitudes[fixture.task.npcId].support,
    pleasantness: storedState.npcAttitudes[fixture.task.npcId].pleasantness,
  }, settledMetrics, 'recovery does not apply target relationship changes twice');

  const failureFixture = makeReadyTask({
    ...DEFAULT_ACTIVITY_DECISION_CONFIG,
    execution: { ...DEFAULT_ACTIVITY_EXECUTION_CONFIG, evaluationProvider: 'jev' },
  }, 70_000);
  let failureState = {
    ...failureFixture.state,
    customerActivities: completeBestAnswerQuiz(failureFixture.activities, failureFixture.task.id, failureFixture.now + 300),
  };
  const failureSupport = failureState.npcAttitudes[failureFixture.task.npcId].support;
  let failedJevCalls = 0;
  let fallbackLlmCalls = 0;
  let failureCommits = 0;
  const failureDependencies = {
    load: async () => ({ id: 'formal-jev-failure-session', userId: 'test-user', state: failureState }),
    evaluate: (args: Parameters<typeof evaluateCustomerActivityPlan>[0]) => evaluateCustomerActivityPlan(args, {
      invoker: async () => { fallbackLlmCalls += 1; return JSON.stringify(evaluation); },
      jevInvoker: async () => { failedJevCalls += 1; throw new Error('Jev unavailable'); },
    }),
    commit: async (args: Parameters<typeof import('../src/lib/game/repository').commitGameCommand>[0]) => {
      failureCommits += 1;
      failureState = { ...args.state, version: failureState.version + 1 };
      return { state: failureState, result: args.result ?? {}, replayed: false };
    },
    now: () => failureFixture.now + 1_000,
  };
  const failed = await processSubmittedCustomerActivityEvaluations('formal-jev-failure-session', 'test-user', failureDependencies);
  assert.equal(failed.state.customerActivities.tasks[0]?.evaluation, undefined,
    'a Jev failure leaves the formal activity task retryable');
  assert.equal(failedJevCalls, 1);
  assert.equal(fallbackLlmCalls, 0, 'a failed formal Jev evaluation never falls back to LLM');
  assert.equal(failureCommits, 0, 'a failed Jev evaluation does not commit an evaluation marker');
  assert.equal(failed.state.npcAttitudes[failureFixture.task.npcId].support, failureSupport,
    'a failed Jev evaluation does not change the target NPC');

  const legacyFixture = makeReadyTask(DEFAULT_ACTIVITY_DECISION_CONFIG, 80_000);
  const legacyTask = legacyFixture.activities.tasks[0]!;
  const legacyExecution = legacyTask.decisionConfig?.execution as unknown as Record<string, unknown>;
  delete legacyExecution.evaluationProvider;
  let legacyState = {
    ...legacyFixture.state,
    customerActivities: completeBestAnswerQuiz(legacyFixture.activities, legacyFixture.task.id, legacyFixture.now + 300),
  };
  let legacyLlmCalls = 0;
  let legacyJevCalls = 0;
  const legacyResult = await processSubmittedCustomerActivityEvaluations('formal-legacy-provider-session', 'test-user', {
    load: async () => ({ id: 'formal-legacy-provider-session', userId: 'test-user', state: legacyState }),
    evaluate: (args: Parameters<typeof evaluateCustomerActivityPlan>[0]) => evaluateCustomerActivityPlan(args, {
      invoker: async () => { legacyLlmCalls += 1; return JSON.stringify(evaluation); },
      jevInvoker: async () => { legacyJevCalls += 1; throw new Error('legacy task must retain LLM'); },
    }),
    commit: async (args) => {
      legacyState = { ...args.state, version: legacyState.version + 1 };
      return { state: legacyState, result: args.result ?? {}, replayed: false };
    },
    now: () => legacyFixture.now + 1_000,
  });
  assert.ok(legacyResult.state.customerActivities.tasks[0]?.evaluation,
    'an old formal task without evaluationProvider still settles through LLM');
  assert.equal(legacyLlmCalls, 1);
  assert.equal(legacyJevCalls, 0);
}

function testTerminalRoomEndSqlQuizRecovery() {
  const { state, task } = stateWithAllowedTask();
  const submittedAt = 120_000;
  const execution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  execution.quizDurationSeconds = 75;
  execution.questionBanks.technical_meeting[0].title = '终局恢复配置题';
  const terminalDecisionConfig: ActivityDecisionConfig = { ...DEFAULT_ACTIVITY_DECISION_CONFIG, execution };
  const sqlTask = {
    ...task,
    decisionConfig: terminalDecisionConfig,
    status: 'submitted' as const,
    startedAt: 100_000,
    deadlineAt: 400_000,
    submittedAt,
    submitReason: 'room_ended' as const,
    quizEnabled: true,
  };
  const { quiz: _missingQuiz, ...sqlTaskWithoutQuiz } = sqlTask;
  const sqlTerminalState = {
    ...state,
    gameMode: 'multiplayer' as const,
    status: 'lost' as const,
    lastAction: 'multiplayer_room_ended',
    customerActivities: { ...state.customerActivities, tasks: [sqlTaskWithoutQuiz] },
  };

  const normalized = normalizeProjectOneState(sqlTerminalState);
  const recoveredTask = normalized.customerActivities.tasks[0]!;
  assert.equal(recoveredTask.status, 'submitted');
  assert.equal(recoveredTask.quiz?.status, 'completed', 'terminal multiplayer SQL submission recovers as a completed quiz');
  assert.equal(recoveredTask.quiz?.startedAt, submittedAt, 'recovered quiz uses the SQL submission time as its start');
  assert.equal(recoveredTask.quiz?.deadlineAt, submittedAt + 75_000,
    'terminal SQL recovery respects the task’s frozen configured quiz duration');
  assert.equal(recoveredTask.quiz?.questions[0]?.title, '终局恢复配置题',
    'terminal SQL recovery rebuilds questions from the task snapshot');
  assert.equal(recoveredTask.quiz?.completedAt, submittedAt, 'SQL room closure has no remaining answer window');
  assert.deepEqual(Object.values(recoveredTask.quiz?.answers ?? {}), [null, null, null],
    'the recovered room-end quiz records unanswered questions as null');
  assert.equal(recoveredTask.evaluation, undefined);

  const restored = normalizeProjectOneState(JSON.parse(JSON.stringify(normalized)));
  assert.deepEqual(restored.customerActivities.tasks[0]?.quiz, recoveredTask.quiz,
    'the reconstructed quiz survives persisted-state reload without being regenerated');

  const evaluated = applyCustomerActivityEvaluation(normalized, task.id, evaluation, submittedAt + 10);
  const finalEvaluation = evaluated.customerActivities.tasks[0]?.evaluation;
  assert.ok(finalEvaluation, 'the recovered terminal task is ready for one AI evaluation');
  assert.deepEqual(evaluated.customerActivities.tasks[0]?.evaluationBreakdown?.quiz,
    { supportDelta: 0, pleasureDelta: 0 }, 'unanswered room-end questions have no quiz score');
  assert.equal(evaluated.npcAttitudes[task.npcId].support,
    Math.max(0, Math.min(100, normalized.npcAttitudes[task.npcId].support + finalEvaluation.supportDelta)));
  assert.equal(evaluated.npcAttitudes[task.npcId].pleasantness,
    Math.max(0, Math.min(100, normalized.npcAttitudes[task.npcId].pleasantness + finalEvaluation.pleasureDelta)));
  assert.deepEqual(applyCustomerActivityEvaluation(evaluated, task.id, evaluation, submittedAt + 20), evaluated,
    'terminal SQL recovery and scoring remain idempotent');

  const legacySqlTask = { ...sqlTaskWithoutQuiz };
  Reflect.deleteProperty(legacySqlTask, 'quizEnabled');
  const legacyTerminalState = {
    ...sqlTerminalState,
    customerActivities: { ...sqlTerminalState.customerActivities, tasks: [legacySqlTask] },
  };
  assert.equal(normalizeProjectOneState(legacyTerminalState).customerActivities.tasks[0]?.quiz, undefined,
    'a terminal legacy task without quizEnabled keeps its old schema and is not backfilled');

  const legacyExecutionTask = { ...sqlTaskWithoutQuiz, decisionConfig: { ...DEFAULT_ACTIVITY_DECISION_CONFIG } };
  delete (legacyExecutionTask.decisionConfig as Partial<ActivityDecisionConfig>).execution;
  const legacyExecutionState = {
    ...sqlTerminalState,
    customerActivities: { ...sqlTerminalState.customerActivities, tasks: [legacyExecutionTask] },
  };
  assert.equal(normalizeProjectOneState(legacyExecutionState).customerActivities.tasks[0]?.quiz?.deadlineAt,
    submittedAt + CUSTOMER_ACTIVITY_QUIZ_MS,
    'legacy valid decision snapshots without execution settings recover with default quiz settings');

  const invalidExecutionState = {
    ...sqlTerminalState,
    customerActivities: {
      ...sqlTerminalState.customerActivities,
      tasks: [{ ...sqlTaskWithoutQuiz, decisionConfig: { ...terminalDecisionConfig, execution: { ...execution, quizDurationSeconds: 10 } } }],
    },
  };
  assert.throws(() => normalizeProjectOneState(invalidExecutionState), /INVALID_CUSTOMER_ACTIVITY_STATE/u,
    'terminal recovery does not silently replace an invalid frozen execution snapshot with defaults');

  const ordinaryPlayingState = {
    ...sqlTerminalState,
    status: 'playing' as const,
    lastAction: null,
  };
  assert.throws(() => normalizeProjectOneState(ordinaryPlayingState), /INVALID_CUSTOMER_ACTIVITY_STATE/u,
    'an ordinary playing state with the same missing quiz still fails strict validation');
}

function testRoomClosureFinalizesActiveActivityOnlyOnce() {
  const { state, task } = stateWithAllowedTask();
  const startedAt = Date.now();
  const planning = startCustomerActivityPlanning(state.customerActivities, task.id, startedAt);
  const submitted = submitCustomerActivityPlan(planning, task.id, startedAt + 1_000);
  assert.equal(submitted.tasks[0]?.quiz?.status, 'answering');
  assert.equal(hasCustomerActivityWindowToClose({ ...state, customerActivities: submitted }), true);
  const roomEnded = finishCustomerActivityPlanningOnRoomEnd(submitted, startedAt + 10_000);
  assert.equal(roomEnded.tasks[0]?.status, 'submitted');
  assert.equal(roomEnded.tasks[0]?.submitReason, 'manual', 'room closure preserves the already committed plan submission reason');
  assert.equal(roomEnded.tasks[0]?.quiz?.status, 'completed', 'room closure skips the remaining quiz countdown');
  assert.equal(roomEnded.tasks[0]?.quiz?.completedAt, startedAt + 10_000);
  assert.equal(hasCustomerActivityWindowToClose({ ...state, customerActivities: roomEnded }), false,
    'a finalized room activity no longer appears as pending room-end work');
  const repeatedClose = finishCustomerActivityPlanningOnRoomEnd(roomEnded, startedAt + 20_000);
  assert.deepEqual(repeatedClose, roomEnded, 'repeated room-end polling does not change the activity state again');
  assert.equal(hasCustomerActivityWindowToClose({ ...state, customerActivities: repeatedClose }), false);
  assert.equal(hasCustomerActivityWindowToClose(state), false, 'a finished room without an active activity does not need a write');
}

async function testRoleAwareActivityReplyGuard() {
  const senior = { id: 'P1-001', name: '张建国', title: '主管副总经理', category: '高层' as const };
  const context = {
    playerMessage: '下周三方便安排一次技术交流会吗？',
    recentConversation: [{ speaker: 'sales' as const, text: '我们想安排一次技术交流会。' }],
  };
  assert.match(customerActivityReplyInstruction(senior.category), /本人.*考虑|内部商量/u);
  let calls = 0;
  const ambiguous = await generateNpcReplyWithCustomerActivityGuard(senior, 'offline', async () => {
    calls += 1;
    return '我先结合项目情况考虑，必要时和公司内部商量，再给您反馈。';
  }, { context, invoker: async () => JSON.stringify({ decision: 'allowed', issue: 'none' }) });
  assert.equal(ambiguous.source, 'generated');
  assert.equal(calls, 1, 'valid role-aware ambiguity passes without repair');

  calls = 0;
  const corrected = await generateNpcReplyWithCustomerActivityGuard(senior, 'email', async () => {
    calls += 1;
    return calls === 1
      ? '可以安排技术交流会，不过价格暂时不能定。'
      : '我先结合项目情况考虑，必要时和公司内部商量，再给您反馈。';
  }, { context, invoker: async () => calls === 1
    ? JSON.stringify({ decision: 'violation', issue: 'premature_acceptance', evidence: '可以安排技术交流会' })
    : JSON.stringify({ decision: 'allowed', issue: 'none' }) });
  assert.equal(corrected.source, 'repaired');
  assert.equal(calls, 2, 'a definite agreement clause is corrected once despite a later caveat');
}

async function testHospitalityFormalServiceFlow() {
  const targetNpcId = 'P1-002' as const;
  const decisionConfig: ActivityDecisionConfig = { revision: 21, mode: 'ai', thresholds: {} };
  const plan = '先确认客户的用餐与饮酒偏好，选择安静合规的场合，控制交流时长；围绕项目问题交流，不劝酒、不作采购承诺，会后发送简短纪要并确认下一步。';
  const salesMessages: CustomerActivityConversationMessage[] = [
    { messageId: 'formal-hospitality-sales', speaker: 'sales', text: '赵老师，周末要不要喝酒？我也想听听您对项目安排的想法。' },
    { messageId: 'formal-hospitality-customer', speaker: 'customer', text: '我先结合工作安排考虑一下，之后再给您反馈。' },
  ];

  async function runDetection(
    key: string,
    messages: CustomerActivityConversationMessage[],
    support: number,
    pleasantness: number,
  ) {
    const initial = createProjectOneState();
    const npcAttitudes = Object.fromEntries(CUSTOMER_ACTIVITY_ORGANIZATION_NPC_IDS.map((npcId) => [
      npcId,
      { ...initial.npcAttitudes[npcId], support: npcId === targetNpcId ? support : 0, pleasantness: npcId === targetNpcId ? pleasantness : 0 },
    ])) as typeof initial.npcAttitudes;
    const queued = queueCustomerActivityDetection({ ...initial, npcAttitudes }, {
      conversationId: `email:${key}`,
      npcId: targetNpcId,
      messages,
      decisionConfig,
    });
    let storedState = queued;
    let decisionCount = 0;
    const result = await processPendingCustomerActivityDetections(`session-${key}`, 'test-user', {
      load: async () => ({ id: `session-${key}`, userId: 'test-user', state: storedState }),
      detect: async (args) => detectCustomerActivityProposals(args, {
        invoker: async () => {
          if (messages === salesMessages) return JSON.stringify({ activities: [{
            type: 'hospitality',
            initiator: 'sales',
            proposal: { messageId: salesMessages[0]!.messageId, quote: salesMessages[0]!.text },
          }] });
          const customerProposal = messages.find((message) => message.speaker === 'customer' && /吃饭|聚餐|饭局|喝酒/u.test(message.text));
          const salesConfirmation = messages.find((message) => message.speaker === 'sales' && /吃饭|聚餐|饭局|喝酒/u.test(message.text));
          assert.ok(customerProposal && salesConfirmation, 'the customer proposal and sales confirmation are present in the ended conversation');
          return JSON.stringify({ activities: [{
            type: 'hospitality',
            initiator: 'customer',
            proposal: { messageId: customerProposal.messageId, quote: '一起吃个饭' },
            response: { messageId: salesConfirmation.messageId, quote: '可以，我愿意一起吃饭', kind: 'explicit_acceptance' },
            finalStatus: 'active',
            finalOutcome: { messageId: salesConfirmation.messageId, quote: salesConfirmation.text },
            confidence: 0.99,
          }] });
        },
      }),
      decide: async (candidate, frozenSnapshot, frozenConfig) => {
        decisionCount += 1;
        return decideCustomerActivityFeasibility(candidate, frozenSnapshot, frozenConfig, {
          invoker: async () => { throw new Error('hospitality uses its numeric gate under global AI mode'); },
          jevInvoker: async () => { throw new Error('hospitality must not use Jev'); },
        });
      },
      now: () => 310_000,
      commit: async (args) => {
        storedState = { ...args.state, version: storedState.version + 1 };
        return { state: storedState, result: args.result ?? {}, replayed: false };
      },
    });
    assert.equal(decisionCount, result.state.customerActivities.decisions.length,
      'each detected hospitality candidate records one authoritative numeric decision');
    return { result, get state() { return storedState; } };
  }

  const allowed = await runDetection('formal-hospitality-allowed', salesMessages, 15, 55);
  assert.equal(allowed.state.customerActivities.tasks.length, 1,
    'target metrics at 15/55 pass even when the other four organization members are 0/0');
  const task = allowed.state.customerActivities.tasks[0];
  assert.equal(task.type, 'hospitality');
  assert.equal(task.npcId, targetNpcId);
  assert.equal(task.decisionMode, 'numeric');
  assert.equal(allowed.state.customerActivities.decisions[0]?.mode, 'numeric',
    'global AI configuration cannot bypass the hospitality numeric gate');
  assert.equal(allowed.state.customerActivityDetectionQueue.length, 0,
    'the ended conversation is consumed after matching');

  let planning = startCustomerActivityPlanning(allowed.state.customerActivities, task.id, 311_000);
  const saved = saveCustomerActivityDraft(planning, task.id, plan, 312_000);
  assert.equal(saved.state.tasks[0]?.draft, plan, 'the player strategy draft is saved by the formal activity domain');
  const submitted = submitCustomerActivityPlan(saved.state, task.id, 313_000);
  assert.equal(submitted.tasks[0]?.status, 'submitted');
  assert.equal(submitted.tasks[0]?.draft, plan);
  assert.equal(submitted.tasks[0]?.quiz?.status, 'answering');
  const beforeEvaluation = { ...allowed.state, customerActivities: submitted };
  const completed = completeCustomerActivityQuiz(submitted, task.id, 313_500);
  const readyForEvaluation = { ...allowed.state, customerActivities: completed };
  assert.deepEqual(applyCustomerActivityEvaluation(beforeEvaluation, task.id, evaluation, 313_700), beforeEvaluation,
    'the hospitality plan has no numerical effect before its quiz is complete');
  const evaluated = applyCustomerActivityEvaluation(readyForEvaluation, task.id, evaluation, 314_000);
  assert.equal(evaluated.customerActivities.tasks[0]?.evaluation?.overallEvaluation, evaluation.overallEvaluation);
  assert.deepEqual(applyCustomerActivityEvaluation(evaluated, task.id, evaluation, 315_000), evaluated,
    'formal activity settlement is idempotent');
  const publicState = toPlayerVisibleGameState(evaluated);
  assert.equal(JSON.stringify(publicState).includes('relationshipSnapshot'), false,
    'the formal player projection hides the frozen relationship snapshot');
  assert.equal(JSON.stringify(publicState).includes('supportMin'), false,
    'the formal player projection hides numeric hospitality thresholds');

  const belowSupport = await runDetection('formal-hospitality-low-support', salesMessages, 14, 55);
  assert.equal(belowSupport.state.customerActivities.tasks.length, 0);
  assert.equal(belowSupport.state.customerActivities.decisions[0]?.decision, 'reject',
    'a target support score below 15 blocks the hospitality event');
  const belowPleasantness = await runDetection('formal-hospitality-low-pleasantness', salesMessages, 15, 54);
  assert.equal(belowPleasantness.state.customerActivities.tasks.length, 0);
  assert.equal(belowPleasantness.state.customerActivities.decisions[0]?.decision, 'reject',
    'a target pleasantness score below 55 blocks the hospitality event');

  const customerMessages: CustomerActivityConversationMessage[] = [
    { messageId: 'formal-hospitality-customer-proposal', speaker: 'customer', text: '我们周五项目组聚餐，您要不要一起吃个饭？' },
    { messageId: 'formal-hospitality-sales-confirmation', speaker: 'sales', text: '可以，我愿意一起吃饭。' },
  ];
  const customerConfirmed = await runDetection('formal-hospitality-customer-confirmed', customerMessages, 15, 55);
  assert.equal(customerConfirmed.state.customerActivities.tasks.length, 1,
    'a customer-initiated proposal becomes an event after sales explicitly confirms');
  assert.equal(customerConfirmed.state.customerActivities.tasks[0]?.initiator, 'customer');
  assert.equal(customerConfirmed.state.customerActivities.tasks[0]?.responseKind, 'explicit_acceptance');
  assert.equal(customerConfirmed.state.customerActivities.tasks[0]?.decisionMode, 'numeric',
    'customer confirmation still runs the target-customer threshold');
  planning = startCustomerActivityPlanning(customerConfirmed.state.customerActivities, customerConfirmed.state.customerActivities.tasks[0].id, 320_000);
  assert.equal(planning.tasks[0]?.status, 'planning');
}

async function main() {
  await testSnapshotFreezeAndQueueDecision();
  await testFrozenWholeOrganizationGate();
  await testDecisionCheckpointAndCasMemo();
  await testSalesOnlyDetectionDiagnostics();
  testServerClockDeadlineAndNoFreeProjectTime();
  testEvaluationOnceAndPublicProjection();
  await testFormalEvaluationReadinessAndLegacyTasks();
  await testFrozenExecutionConfigAffectsFormalService();
  await testActivityEvaluationProviderSettlement();
  testTerminalRoomEndSqlQuizRecovery();
  testRoomClosureFinalizesActiveActivityOnlyOnce();
  await testRoleAwareActivityReplyGuard();
  await testHospitalityFormalServiceFlow();
  console.log('Formal customer activity queue, snapshot gating, planning timer, settlement idempotency and privacy tests passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
