import assert from 'node:assert/strict';
import {
  DEFAULT_ACTIVITY_DECISION_CONFIG,
  CUSTOMER_ACTIVITY_PLANNING_MS,
  completeCustomerActivityQuiz,
  combineCustomerActivityEvaluation,
  createCustomerActivityTasks,
  createEmptyCustomerActivityState,
  customerActivityStateSchema,
  finalizeExpiredCustomerActivities,
  finishCustomerActivityPlanningOnRoomEnd,
  isCustomerActivityReadyForEvaluation,
  readCustomerActivityState,
  recordCustomerActivityEvaluation,
  saveCustomerActivityDraft,
  saveCustomerActivityQuizAnswer,
  startCustomerActivityPlanning,
  submitCustomerActivityPlan,
  toPublicCustomerActivityTask,
  type CustomerActivityAgreement,
  type CustomerActivityEvaluation,
} from '@/lib/game/customer-activities';
import { createCustomerActivityQuiz, publicCustomerActivityQuizSchema } from '@/lib/game/customer-activity-quiz';
import { DEFAULT_ACTIVITY_EXECUTION_CONFIG, resolveActivityExecutionConfig } from '@/lib/game/customer-activity-execution-config';

const agreement: CustomerActivityAgreement = {
  conversationId: 'quiz-test-conversation',
  npcId: 'P1-002',
  sourceConversation: [
    { messageId: 'proposal', speaker: 'sales', text: '可以安排一次技术交流。' },
    { messageId: 'acceptance', speaker: 'customer', text: '可以，安排技术团队参加。' },
  ],
  type: 'technical_meeting',
  proposalMessageId: 'proposal',
  agreementMessageId: 'acceptance',
  evidence: [
    { messageId: 'proposal', speaker: 'sales', kind: 'proposal', quote: '安排一次技术交流' },
    { messageId: 'acceptance', speaker: 'customer', kind: 'acceptance', quote: '安排技术团队参加' },
    { messageId: 'acceptance', speaker: 'customer', kind: 'final_outcome', quote: '安排技术团队参加' },
  ],
  summary: '安排一次技术交流',
};

const neutralEvaluation: CustomerActivityEvaluation = {
  supportDelta: 0,
  pleasureDelta: 0,
  dimensionDeltas: {
    decisionAnalysis: 0,
    relationshipBuilding: 0,
    valuePresentation: 0,
    objectionHandling: 0,
    informationDiscovery: 0,
  },
  overallEvaluation: '本次方案暂未带来进一步推进。',
};

function makeSubmittedTask(draft: string, now: number) {
  const state = createCustomerActivityTasks(createEmptyCustomerActivityState(), [agreement], now);
  const task = state.tasks[0];
  const started = startCustomerActivityPlanning(state, task.id, now + 1);
  const saved = saveCustomerActivityDraft(started, task.id, draft, now + 2);
  const submitted = submitCustomerActivityPlan(saved.state, task.id, now + 3);
  return { state: submitted, taskId: task.id };
}

async function main() {
  for (const type of ['hospitality', 'technical_meeting', 'case_site_visit', 'company_visit'] as const) {
    const quiz = createCustomerActivityQuiz(type, 1_000);
    assert.equal(quiz.status, 'answering');
    assert.equal(quiz.deadlineAt - quiz.startedAt, 120_000);
    assert.equal(quiz.questions.length, 3, `${type} has preparation, event, and follow-up scenarios`);
    assert.ok(quiz.questions.every((question) => question.title.includes('情境推演（假设）')),
      'questions explicitly present hypothetical scenario exercises');
    assert.ok(quiz.questions.every((question) => question.options.length === 4));
  }
  const stablePresentation = createCustomerActivityQuiz('technical_meeting', 1_000, '', 'task-alpha');
  assert.deepEqual(createCustomerActivityQuiz('technical_meeting', 1_000, '', 'task-alpha'), stablePresentation,
    'the same seed produces the same stored option order');
  const firstOptionIds = new Set(Array.from({ length: 24 }, (_, index) =>
    createCustomerActivityQuiz('technical_meeting', 2_000 + index, '', `task-${index}`).questions[0].options[0].id));
  assert.ok(firstOptionIds.has('option-1') && firstOptionIds.size > 1,
    'best answer is not always displayed first, while its stable ID is preserved');
  const configuredExecution = resolveActivityExecutionConfig();
  configuredExecution.quizDurationSeconds = 45;
  configuredExecution.questionBanks.technical_meeting[0].title = '设计师自定义的技术准备题';
  configuredExecution.questionBanks.technical_meeting[0].options[0].supportDelta = 4;
  const configuredQuiz = createCustomerActivityQuiz('technical_meeting', 2_500, '', 'configured', configuredExecution);
  assert.equal(configuredQuiz.deadlineAt - configuredQuiz.startedAt, 45_000,
    'configured duration is copied into the quiz deadline snapshot');
  assert.equal(configuredQuiz.questions[0].title, '设计师自定义的技术准备题');
  assert.deepEqual(configuredQuiz.questions[0].options.map((option) => option.id).sort(), ['option-1', 'option-2', 'option-3', 'option-4']);
  configuredExecution.questionBanks.technical_meeting[0].title = '后续修改不会影响已生成题目';
  configuredExecution.questionBanks.technical_meeting[0].options[0].supportDelta = -5;
  assert.equal(configuredQuiz.questions[0].title, '设计师自定义的技术准备题',
    'question wording is snapshotted when the player submits');
  assert.equal(configuredQuiz.questions[0].options.find(({ id }) => id === 'option-1')?.supportDelta, 4,
    'question scoring is also snapshotted');
  assert.equal(DEFAULT_ACTIVITY_EXECUTION_CONFIG.quizDurationSeconds, 120,
    'mutating a resolved designer config cannot alter shared defaults');
  const hospitalityQuiz = createCustomerActivityQuiz('hospitality', 3_000, '先询问是否接受无酒精安排。', 'hospitality-alpha');
  const hospitalityEvent = hospitalityQuiz.questions.find(({ id }) => id === 'hospitality-event-respect-plan');
  assert.ok(hospitalityEvent?.title.includes('方案已提前安排无酒精选项'));
  assert.deepEqual(hospitalityEvent?.options.find(({ id }) => id === 'option-1') && {
    supportDelta: hospitalityEvent.options.find(({ id }) => id === 'option-1')?.supportDelta,
    pleasureDelta: hospitalityEvent.options.find(({ id }) => id === 'option-1')?.pleasureDelta,
  }, { supportDelta: 0, pleasureDelta: 2 },
  'respecting hospitality preferences improves comfort without implying business support');
  const disabledReplacement = resolveActivityExecutionConfig();
  disabledReplacement.hospitalityNonAlcoholQuestion = null;
  const unchangedHospitalityQuiz = createCustomerActivityQuiz('hospitality', 3_100, '先询问是否接受无酒精安排。', 'hospitality-null', disabledReplacement);
  assert.ok(unchangedHospitalityQuiz.questions.some(({ id }) => id === 'hospitality-event'),
    'null disables the configured hospitality replacement');
  const renamedHospitalityQuestions = resolveActivityExecutionConfig();
  renamedHospitalityQuestions.questionBanks.hospitality[1].id = 'designer-hospitality-event';
  renamedHospitalityQuestions.hospitalityNonAlcoholQuestion!.id = 'designer-hospitality-nonalcohol';
  const renamedHospitalityQuiz = createCustomerActivityQuiz(
    'hospitality', 3_200, '客户表示不喝酒，希望选择无酒精安排。', 'hospitality-custom-id', renamedHospitalityQuestions,
  );
  assert.ok(renamedHospitalityQuiz.questions.some(({ id }) => id === 'designer-hospitality-nonalcohol'),
    'the replacement follows the event-question position after the designer changes its ID');
  assert.deepEqual(hospitalityQuiz.questions.find(({ id }) => id === 'hospitality-follow-up')?.options.find(({ id }) => id === 'option-1') && {
    supportDelta: hospitalityQuiz.questions.find(({ id }) => id === 'hospitality-follow-up')?.options.find(({ id }) => id === 'option-1')?.supportDelta,
    pleasureDelta: hospitalityQuiz.questions.find(({ id }) => id === 'hospitality-follow-up')?.options.find(({ id }) => id === 'option-1')?.pleasureDelta,
  }, { supportDelta: 1, pleasureDelta: 1 }, 'only an explicit and appropriate business follow-up increases support');

  const manual = makeSubmittedTask('先确认议题、参会角色，再准备交流内容。', 10_000);
  const submittedTask = manual.state.tasks[0];
  assert.equal(submittedTask.quizEnabled, true);
  assert.equal(submittedTask.quiz?.status, 'answering');
  assert.equal(submittedTask.quiz?.startedAt, submittedTask.submittedAt);
  assert.equal(isCustomerActivityReadyForEvaluation(submittedTask), false);
  assert.equal(recordCustomerActivityEvaluation(manual.state, manual.taskId, neutralEvaluation, 20_000).applied, false,
    'AI evaluation cannot settle before the second phase completes');

  let answered = manual.state;
  for (const question of submittedTask.quiz!.questions) {
    const saved = saveCustomerActivityQuizAnswer(answered, manual.taskId, question.id, 'option-1', 20_000);
    assert.equal(saved.accepted, true);
    answered = saved.state;
  }
  assert.equal(answered.tasks[0].quiz?.status, 'answering', 'answers alone do not settle until quiz completion');
  const refreshed = customerActivityStateSchema.parse(JSON.parse(JSON.stringify(answered)));
  assert.deepEqual(refreshed, answered, 'quiz snapshot and answer map survive JSON persistence');
  const completed = completeCustomerActivityQuiz(refreshed, manual.taskId, 21_000);
  assert.equal(isCustomerActivityReadyForEvaluation(completed.tasks[0]), true);
  assert.deepEqual(completeCustomerActivityQuiz(completed, manual.taskId, 22_000), completed,
    'completion is idempotent and cannot reset the completion time');
  const positiveAi: CustomerActivityEvaluation = {
    ...neutralEvaluation,
    supportDelta: 4,
    pleasureDelta: 6,
  };
  const cappedPositive = combineCustomerActivityEvaluation(completed.tasks[0], positiveAi);
  assert.equal(cappedPositive.evaluation.supportDelta, 4, 'combined support respects its upper bound');
  assert.equal(cappedPositive.evaluation.pleasureDelta, 6, 'combined pleasantness respects its upper bound');
  assert.deepEqual(cappedPositive.breakdown.quiz, { supportDelta: 3, pleasureDelta: 3 });
  const weightedExecution = resolveActivityExecutionConfig();
  weightedExecution.weights = { plan: 0.5, quiz: 0.5 };
  weightedExecution.limits = {
    supportMin: -1,
    supportMax: 3,
    pleasureMin: -2,
    pleasureMax: 2,
    dimensionMin: -1,
    dimensionMax: 1,
  };
  const weightedTask = {
    ...completed.tasks[0],
    decisionConfig: { ...DEFAULT_ACTIVITY_DECISION_CONFIG, execution: weightedExecution },
  };
  const weightedAndLimited = combineCustomerActivityEvaluation(weightedTask, {
    ...positiveAi,
    dimensionDeltas: {
      decisionAnalysis: 2,
      relationshipBuilding: 2,
      valuePresentation: 2,
      objectionHandling: 2,
      informationDiscovery: 2,
    },
  });
  assert.equal(weightedAndLimited.evaluation.supportDelta, 3,
    'weighted plan and quiz deltas are added before rounding and custom support cap');
  assert.equal(weightedAndLimited.evaluation.pleasureDelta, 2,
    'weighted plan and quiz deltas are added before rounding and custom pleasure cap');
  assert.deepEqual(Object.values(weightedAndLimited.evaluation.dimensionDeltas), [1, 1, 1, 1, 1],
    'plan weight scales each dimension and applies designer dimension limits');
  assert.deepEqual(weightedAndLimited.breakdown.quiz, { supportDelta: 1.5, pleasureDelta: 1.5 },
    'evaluation breakdown records the effective weighted quiz contribution');
  const recorded = recordCustomerActivityEvaluation(completed, manual.taskId, positiveAi, 23_000);
  assert.equal(recorded.applied, true);
  assert.deepEqual(recorded.evaluation, cappedPositive.evaluation, 'recording returns the exact once-combined deltas for game-state application');
  assert.equal(recorded.state.tasks[0].evaluationBreakdown?.aiPlan.supportDelta, 4);
  assert.equal(recordCustomerActivityEvaluation(recorded.state, manual.taskId, positiveAi, 24_000).applied, false,
    'settlement marker makes repeated calls a no-op');

  const publicTask = toPublicCustomerActivityTask(recorded.state.tasks[0]);
  const publicQuiz = publicCustomerActivityQuizSchema.parse(publicTask.quiz);
  assert.equal('quizEnabled' in publicTask, false);
  assert.equal('evaluationBreakdown' in publicTask, false);
  assert.equal('supportDelta' in (publicTask.evaluation ?? {}), false);
  assert.deepEqual(Object.keys(publicQuiz.questions[0].options[0]).sort(), ['id', 'text']);
  assert.ok(publicQuiz.questions.every((question) => question.title.includes('假设')));

  const timed = createCustomerActivityTasks(createEmptyCustomerActivityState(), [agreement], 100_000);
  const timedTask = timed.tasks[0];
  const timedStarted = startCustomerActivityPlanning(timed, timedTask.id, 101_000);
  const timedSaved = saveCustomerActivityDraft(timedStarted, timedTask.id, '按客户关注点准备议题。', 102_000);
  const planDeadline = timedStarted.tasks[0].deadlineAt!;
  const planExpired = finalizeExpiredCustomerActivities(timedSaved.state, planDeadline);
  const quizDeadline = planDeadline + 120_000;
  assert.equal(planExpired.tasks[0].submittedAt, planDeadline);
  assert.equal(planExpired.tasks[0].quiz?.deadlineAt, quizDeadline, 'planning timeout starts the quiz at the stored planning deadline');
  const preDeadlineAnswer = saveCustomerActivityQuizAnswer(planExpired, timedTask.id,
    planExpired.tasks[0].quiz!.questions[0].id, 'option-4', quizDeadline - 1);
  assert.equal(preDeadlineAnswer.accepted, true);
  const quizExpired = finalizeExpiredCustomerActivities(preDeadlineAnswer.state, quizDeadline);
  assert.equal(quizExpired.tasks[0].quiz?.status, 'completed');
  assert.equal(quizExpired.tasks[0].quiz?.completedAt, quizDeadline);
  assert.equal(quizExpired.tasks[0].quiz?.answers[quizExpired.tasks[0].quiz!.questions[0].id], 'option-4');
  assert.equal(Object.values(quizExpired.tasks[0].quiz!.answers).filter((answer) => answer === null).length, 2,
    'quiz timeout keeps the saved choice and marks unanswered questions skipped');
  assert.equal(saveCustomerActivityQuizAnswer(quizExpired, timedTask.id,
    quizExpired.tasks[0].quiz!.questions[0].id, 'option-1', quizDeadline + 1).accepted, false,
  'answers are locked at the deadline');
  assert.deepEqual(finalizeExpiredCustomerActivities(quizExpired, quizDeadline + 1), quizExpired,
    'quiz timeout finalization is idempotent');

  const negativePlan = makeSubmittedTask('客户需要评估兼容方案。', 600_000);
  let negativeAnswered = negativePlan.state;
  for (const question of negativePlan.state.tasks[0].quiz!.questions) {
    const saved = saveCustomerActivityQuizAnswer(negativeAnswered, negativePlan.taskId, question.id, 'option-4', 610_000);
    assert.equal(saved.accepted, true);
    negativeAnswered = saved.state;
  }
  const negativeComplete = completeCustomerActivityQuiz(negativeAnswered, negativePlan.taskId, 611_000);
  const negativeCombined = combineCustomerActivityEvaluation(negativeComplete.tasks[0], neutralEvaluation);
  assert.equal(negativeCombined.evaluation.supportDelta, -3, 'unwise choices can reduce support');
  assert.equal(negativeCombined.evaluation.pleasureDelta, -6, 'unwise choices can reduce pleasantness');
  const lowerBounded = combineCustomerActivityEvaluation(negativeComplete.tasks[0], {
    ...neutralEvaluation,
    supportDelta: -5,
    pleasureDelta: -8,
  });
  assert.equal(lowerBounded.evaluation.supportDelta, -5, 'combined support respects its lower bound');
  assert.equal(lowerBounded.evaluation.pleasureDelta, -8, 'combined pleasantness respects its lower bound');

  const blankPlan = makeSubmittedTask('', 700_000);
  let blankAnswered = blankPlan.state;
  for (const question of blankPlan.state.tasks[0].quiz!.questions) {
    const saved = saveCustomerActivityQuizAnswer(blankAnswered, blankPlan.taskId, question.id, 'option-1', 710_000);
    blankAnswered = saved.state;
  }
  const blankComplete = completeCustomerActivityQuiz(blankAnswered, blankPlan.taskId, 711_000);
  const noPlanEvaluation: CustomerActivityEvaluation = {
    ...neutralEvaluation,
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
  const blankCombined = combineCustomerActivityEvaluation(blankComplete.tasks[0], noPlanEvaluation);
  assert.equal(blankCombined.evaluation.supportDelta, -2, 'blank plan cannot gain positive support from quiz answers');
  assert.equal(blankCombined.evaluation.pleasureDelta, -3, 'blank plan cannot gain positive pleasantness from quiz answers');
  assert.deepEqual(blankCombined.evaluation.dimensionDeltas, noPlanEvaluation.dimensionDeltas);
  const blankWithZeroPlanWeight = combineCustomerActivityEvaluation({
    ...blankComplete.tasks[0],
    decisionConfig: {
      ...DEFAULT_ACTIVITY_DECISION_CONFIG,
      execution: {
        ...weightedExecution,
        limits: {
          supportMin: 0,
          supportMax: 0,
          pleasureMin: 0,
          pleasureMax: 0,
          dimensionMin: 0,
          dimensionMax: 0,
        },
        weights: { plan: 0, quiz: 1 },
      },
    },
  }, noPlanEvaluation);
  assert.equal(blankWithZeroPlanWeight.evaluation.supportDelta, -2,
    'a blank plan keeps its deterministic support penalty even with a zero configured lower bound and plan weight');
  assert.equal(blankWithZeroPlanWeight.evaluation.pleasureDelta, -3,
    'a blank plan keeps its deterministic pleasure penalty even with a zero configured lower bound and plan weight');

  const roomEnded = finishCustomerActivityPlanningOnRoomEnd(timedSaved.state, planDeadline - 1_000);
  assert.equal(roomEnded.tasks[0].quiz?.status, 'completed', 'room end completes the quiz immediately');
  assert.equal(roomEnded.tasks[0].quiz?.completedAt, planDeadline - 1_000, 'room end adds no extra quiz time');
  assert.deepEqual(Object.values(roomEnded.tasks[0].quiz!.answers), [null, null, null],
    'room end skips all unsaved questions');
  assert.equal(isCustomerActivityReadyForEvaluation(roomEnded.tasks[0]), true);
  const submittedRoomEnd = finishCustomerActivityPlanningOnRoomEnd(manual.state, 25_000);
  assert.equal(submittedRoomEnd.tasks[0].quiz?.status, 'completed',
    'room end also completes a quiz that was already in progress');

  const createdLegacy = createCustomerActivityTasks(createEmptyCustomerActivityState(), [agreement], 800_000);
  const oldTask = { ...createdLegacy.tasks[0] };
  delete oldTask.quizEnabled;
  const legacyPending = readCustomerActivityState({ version: 1, decisions: [], tasks: [oldTask] });
  const legacyPendingStarted = startCustomerActivityPlanning(legacyPending, oldTask.id, 800_001);
  assert.equal(legacyPendingStarted.tasks[0].quizEnabled, true,
    'a legacy pending task opts into the new second phase when the player starts it');
  assert.equal(legacyPendingStarted.tasks[0].quiz, undefined,
    'starting a legacy pending task only enables a quiz; it does not create questions before plan submission');
  const legacyPendingSubmitted = submitCustomerActivityPlan(legacyPendingStarted, oldTask.id, 800_002);
  assert.equal(legacyPendingSubmitted.tasks[0].quiz?.status, 'answering',
    'a legacy pending task receives a quiz after its player submits the plan');
  const legacyPlanning = readCustomerActivityState({
    version: 1,
    decisions: [],
    tasks: [{
      ...oldTask,
      status: 'planning',
      startedAt: 800_001,
      deadlineAt: 800_001 + CUSTOMER_ACTIVITY_PLANNING_MS,
    }],
  });
  const legacyPlanningExpired = finalizeExpiredCustomerActivities(legacyPlanning, 800_001 + CUSTOMER_ACTIVITY_PLANNING_MS);
  assert.equal(legacyPlanningExpired.tasks[0].status, 'submitted');
  assert.equal(legacyPlanningExpired.tasks[0].quiz, undefined,
    'an already-active legacy planning task keeps its original no-quiz submission behavior');
  const legacyState = readCustomerActivityState({
    version: 1,
    decisions: [],
    tasks: [{
      ...oldTask,
      status: 'submitted',
      startedAt: 800_001,
      deadlineAt: 1_100_001,
      submittedAt: 800_100,
      submitReason: 'manual',
      draft: '旧版已提交方案',
    }],
  });
  assert.equal(isCustomerActivityReadyForEvaluation(legacyState.tasks[0]), true,
    'old submitted tasks without quizzes remain evaluable');
  assert.equal(recordCustomerActivityEvaluation(legacyState, legacyState.tasks[0].id, neutralEvaluation, 801_000).applied, true,
    'old submitted tasks retain their existing no-quiz settlement path');
  assert.equal(CUSTOMER_ACTIVITY_PLANNING_MS, 300_000);

  console.log('Customer activity quiz stages, deadlines, scoring, persistence and public DTO checks passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
