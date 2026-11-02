import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const html = readFileSync(resolve(process.cwd(), 'public/project1-prototype-v9.html'), 'utf8');
let source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(source, '预览页缺少应用脚本');
const reproduceStaleBusy = process.env.WEIXUN_REPRODUCE_STALE_QUIZ_BUSY === '1';
if (reproduceStaleBusy) {
  const before = source;
  source = source
    .replace('activeRequestAction=\'\';state.aiStatus=\'\';save();syncCustomerActivityQuizControls();if(options.renderPending===false', 'activeRequestAction=\'\';state.aiStatus=\'\';save();if(options.renderPending===false')
    .replace('customerActivityRenderedTaskKey===key){syncCustomerActivityQuizControls(task);customerActivitySetStatus(', 'customerActivityRenderedTaskKey===key){customerActivitySetStatus(');
  assert.notEqual(source, before, '内存反证已移除 API finally 与 same-key 快捷路径的解锁逻辑');
}
const planner = readFileSync(resolve(process.cwd(), 'src/components/customer-activity-planner.tsx'), 'utf8');
assert.match(planner, /提交方案，进入情境问答/);
assert.match(planner, /postAction\('answer'/, '正式 UI 使用答案保存 API action');
assert.match(planner, /postAction\('complete_quiz'/, '正式 UI 使用问答完成 API action');
assert.match(planner, /formatQuizDuration\(quiz\.startedAt, quiz\.deadlineAt\)/, '正式 UI 从问答快照展示实际时限');
assert.match(planner, /quizHasPendingAnswer/, '未保存答案期间锁住题目导航和最终提交');
assert.match(planner, /typeof quizAnswer === 'string'/, '未选择选项时不能直接点下一题');
assert.match(planner, /以下均为情境假设/);
assert.doesNotMatch(planner, /supportDelta|pleasureDelta|分数|得分/, '正式 UI 不暴露答案分值');
const end = source.lastIndexOf('})();');
assert.notEqual(end, -1, '预览页 IIFE 不完整');

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}

class FakeElement {
  disabled = false;
  textContent = '';
  value = '';
  className = '';
  private listeners = new Map<string, ((event: { target: FakeElement; preventDefault: () => void }) => unknown)[]>();
  addEventListener(name: string, listener: (event: { target: FakeElement; preventDefault: () => void }) => unknown) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  async click() {
    if (this.disabled) return;
    for (const listener of this.listeners.get('click') ?? []) {
      await listener({ target: this, preventDefault() {} });
    }
  }
}

class FakeModalRoot {
  private markup = '';
  elements = new Map<string, FakeElement>();
  fieldset = new FakeElement();
  get innerHTML() { return this.markup; }
  set innerHTML(value: string) {
    this.markup = value;
    this.elements = new Map();
    this.fieldset = new FakeElement();
    this.fieldset.disabled = /<fieldset\b[^>]*\bdisabled(?:\s|=|>)/i.test(value);
    for (const match of value.matchAll(/<([a-z]+)\b([^>]*?)\bid="([^"]+)"([^>]*)>/gi)) {
      const element = new FakeElement();
      element.disabled = /\bdisabled(?:\s|=|$)/i.test(`${match[2]} ${match[4]}`);
      this.elements.set(match[3], element);
    }
  }
  querySelector(selector: string) { return selector === '.modal-backdrop' ? new FakeElement() : selector === 'fieldset' ? this.fieldset : null; }
}

let now = 1_700_000_000_000;
class ClockDate extends Date {
  static override now() { return now; }
}

type TestOption = { id: string; text: string; supportDelta?: number };
type TestQuestion = { id: string; title: string; options: TestOption[] };
type TestQuiz = {
  version: number;
  status: 'answering' | 'completed';
  startedAt: number;
  deadlineAt: number;
  completedAt?: number;
  questions: TestQuestion[];
  answers: Record<string, string | null>;
};
type TestTask = {
  id: string;
  type: string;
  status: string;
  createdAt: number;
  startedAt: number;
  deadlineAt: number;
  submittedAt: number;
  draft: string;
  quiz?: TestQuiz;
  evaluation?: { overallEvaluation: string };
};
type TestRequest = {
  action?: string;
  taskId?: string;
  questionId?: string;
  optionId?: string | null;
  commandId?: string;
  expectedVersion?: number;
  previewSessionId?: string;
};

const localStorage = new MemoryStorage();
localStorage.setItem('weixun_identity', JSON.stringify({ userId: 'quiz-test-user' }));
localStorage.setItem('weixun_session', 'quiz-test-token');
const sessionStorage = new MemoryStorage();
const modalRoot = new FakeModalRoot();
const app = { innerHTML: '' };
const document = {
  hidden: false,
  visibilityState: 'visible',
  body: { appendChild() {} },
  getElementById(id: string) { return id === 'app' ? app : id === 'modal-root' ? modalRoot : id === 'toast-root' ? { appendChild() {} } : modalRoot.elements.get(id) ?? null; },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  createElement() { return new FakeElement(); },
  addEventListener() {},
};

const questionBank: TestQuestion[] = [
  { id: 'q1', title: '情境推演（假设）：问题一？', options: ['甲项', '乙项', '丙项', '丁项'].map((text, index) => ({ id: `q1-o${index + 1}`, text, supportDelta: 99 })) },
  { id: 'q2', title: '情境推演（假设）：问题二？', options: ['甲项', '乙项', '丙项', '丁项'].map((text, index) => ({ id: `q2-o${index + 1}`, text })) },
  { id: 'q3', title: '情境推演（假设）：问题三？', options: ['甲项', '乙项', '丙项', '丁项'].map((text, index) => ({ id: `q3-o${index + 1}`, text })) },
];
const makeTask = (id = 'quiz-task', deadlineAt = now + 120_000, durationMs = 120_000): TestTask => ({
  id,
  type: 'hospitality',
  status: 'submitted',
  createdAt: now - 10_000,
  startedAt: now - 310_000,
  deadlineAt: now - 10_000,
  submittedAt: now - 10_000,
  draft: '邀约方案',
  quiz: { version: 1, status: 'answering', startedAt: deadlineAt - durationMs, deadlineAt, questions: questionBank, answers: { q1: null, q2: null, q3: null } },
});
const serverState: { tasks: TestTask[] } = { tasks: [] };
let failNextAction: string | null = null;
const requests: TestRequest[] = [];
const runtimeControl: {
  evaluationOnComplete: { overallEvaluation: string } | null;
  deferNextSync: boolean;
  releaseDeferredSync: (() => void) | null;
  deferredSync: Promise<void> | null;
  deferNextComplete: boolean;
  releaseDeferredComplete: (() => void) | null;
  deferredComplete: Promise<void> | null;
  conflictNextSync: boolean;
  recoveryReadCount: number;
} = { evaluationOnComplete: null, deferNextSync: false, releaseDeferredSync: null, deferredSync: null, deferNextComplete: false, releaseDeferredComplete: null, deferredComplete: null, conflictNextSync: false, recoveryReadCount: 0 };
const fetch = async (_url: string, init?: { body?: string; method?: string }) => {
  if (init?.method === 'GET') {
    runtimeControl.recoveryReadCount += 1;
    const npcIds = ['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005'];
    return { ok: true, status: 200, async json() { return { success: true, data: { previewSessionId: 'quiz-preview-session', version: 100 + runtimeControl.recoveryReadCount, conversations: Object.fromEntries(npcIds.map((id) => [id, []])), appointments: [], wechat: {}, activeMeeting: null, customerActivities: { version: 1, tasks: JSON.parse(JSON.stringify(serverState.tasks)) }, npcTestStates: npcIds.map((npcId) => ({ npcId, support: 42, pleasantness: 60, effectiveContactCount: 2, node: 'N2' })), approvedVisitPreparationNpcIds: [] } }; } };
  }
  const request = JSON.parse(init?.body || '{}') as TestRequest;
  requests.push(request);
  if (request.action === 'customer_activity_sync' && runtimeControl.conflictNextSync) {
    runtimeControl.conflictNextSync = false;
    return { ok: false, status: 409, async json() { return { error: 'PREVIEW_SESSION_VERSION_CONFLICT' }; } };
  }
  if (request.action === 'customer_activity_sync' && runtimeControl.deferNextSync) {
    runtimeControl.deferNextSync = false;
    await runtimeControl.deferredSync;
    runtimeControl.deferredSync = null;
  }
  if (request.action === 'customer_activity_complete_quiz' && runtimeControl.deferNextComplete) {
    runtimeControl.deferNextComplete = false;
    await runtimeControl.deferredComplete;
    runtimeControl.deferredComplete = null;
  }
  if (failNextAction === request.action) {
    failNextAction = null;
    return { ok: false, status: 503, async json() { return { error: '模拟网络故障' }; } };
  }
  if (request.action === 'customer_activity_answer') {
    serverState.tasks = serverState.tasks.map((task) => {
      if (task.id !== request.taskId || !task.quiz || !request.questionId) return task;
      return { ...task, quiz: { ...task.quiz, answers: { ...task.quiz.answers, [request.questionId]: request.optionId ?? null } } };
    });
  } else if (request.action === 'customer_activity_start') {
    serverState.tasks = serverState.tasks.map((task) => task.id !== request.taskId ? task : { ...task, status: 'planning', startedAt: now, deadlineAt: now + 300_000 });
  } else if (request.action === 'customer_activity_complete_quiz') {
    serverState.tasks = serverState.tasks.map((task) => !task.quiz || task.id !== request.taskId ? task : {
      ...task,
      quiz: { ...task.quiz, status: 'completed', completedAt: Math.min(now, task.quiz.deadlineAt) },
      ...(runtimeControl.evaluationOnComplete ? { evaluation: runtimeControl.evaluationOnComplete } : {}),
    });
    runtimeControl.evaluationOnComplete = null;
  }
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        success: true,
        previewSessionId: 'quiz-preview-session',
        version: requests.length,
        data: { customerActivities: { version: requests.length, tasks: JSON.parse(JSON.stringify(serverState.tasks)) }, serverNow: now },
      };
    },
  };
};

const injected = `${source.slice(0, end)}
globalThis.__customerActivityQuizHooks={
  setTasks(tasks){state.previewSessionId='quiz-preview-session';state.previewVersion=0;state.customerActivities={version:0,tasks:[]};previewRecoveredKey=previewRecoveryKey();serverState.tasks=JSON.parse(JSON.stringify(tasks));customerActivitySeenIds=new Set();customerActivityLastSyncAt=Date.now();customerActivityModalLocked=false;customerActivityRenderedTaskKey='';customerActivityQuizProgressTaskId=null;customerActivityQuizPendingAnswer=null;customerActivityQuizCompletionPending=false;customerActivityEvaluationStartedAtByTask.clear();modalRoot.innerHTML='';applyPreviewCustomerActivities({version:1,tasks:serverState.tasks,serverNow:Date.now()},Date.now());presentCustomerActivityPlanner(true)},
  reloadView(){customerActivityQuizProgressTaskId=null;customerActivityQuizIndex=0;customerActivityQuizPendingAnswer=null;customerActivityQuizCompletionPending=false;customerActivityLastSyncAt=Date.now();customerActivityModalLocked=false;customerActivityRenderedTaskKey='';modalRoot.innerHTML='';presentCustomerActivityPlanner(true)},
  setIndex(index){customerActivityQuizIndex=index;customerActivityModalLocked=false;presentCustomerActivityPlanner(true)},
  markSeen(taskId){customerActivitySeenIds.add(taskId);customerActivityModalLocked=false;customerActivityRenderedTaskKey='';modalRoot.innerHTML='';presentCustomerActivityPlanner(true)},
  setDraft(text){customerActivityDraft=text;customerActivityDirty=true;const field=document.getElementById('customer-activity-draft');if(field)field.value=text},
  sync(){return refreshCustomerActivityQueue()},
  deferSync(){runtimeControl.deferNextSync=true;runtimeControl.deferredSync=new Promise(resolve=>{runtimeControl.releaseDeferredSync=resolve})},
  releaseSync(){runtimeControl.releaseDeferredSync?.();runtimeControl.releaseDeferredSync=null},
  deferComplete(){runtimeControl.deferNextComplete=true;runtimeControl.deferredComplete=new Promise(resolve=>{runtimeControl.releaseDeferredComplete=resolve})},
  releaseComplete(){runtimeControl.releaseDeferredComplete?.();runtimeControl.releaseDeferredComplete=null},
  start(){return customerActivityStart(currentCustomerActivity())},
  tick(){customerActivityUpdateClock()},
  snapshot(){const task=currentCustomerActivity();return {action:customerActivityAction,error:customerActivityError,pending:customerActivityQuizPendingAnswer,quiz:task?.quiz||null,quizRemaining:task?.quiz?customerActivityRemaining({deadlineAt:task.quiz.deadlineAt}):null,index:customerActivityQuizIndex,now:Date.now(),serverNow:customerActivityServerNow(),requestBusy,draft:customerActivityDraft,modal:modalRoot.innerHTML}},
};
})();`;

const context = vm.createContext({
  console,
  document,
  localStorage,
  sessionStorage,
  window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
  fetch,
  AbortController,
  TextDecoder,
  TextEncoder,
  URL,
  Event,
  Math,
  Date: ClockDate,
  crypto: { randomUUID: () => 'quiz-command-id' },
  setTimeout: () => 0,
  clearTimeout() {},
  setInterval: () => 0,
  clearInterval() {},
  requestAnimationFrame: () => 0,
  performance: { now: () => 0 },
  serverState,
  runtimeControl,
});
vm.runInContext(injected, context, { filename: 'project1-prototype-v9.customer-activity-quiz.js' });
const hooks = vm.runInContext('globalThis.__customerActivityQuizHooks', context) as {
  setTasks: (tasks: TestTask[]) => void;
  reloadView: () => void;
  setIndex: (index: number) => void;
  markSeen: (taskId: string) => void;
  setDraft: (text: string) => void;
  start: () => Promise<void>;
  sync: () => Promise<boolean>;
  deferSync: () => void;
  releaseSync: () => void;
  deferComplete: () => void;
  releaseComplete: () => void;
  tick: () => void;
  snapshot: () => { action: string; error: string; pending: unknown; quiz: TestQuiz | null; quizRemaining: number | null; index: number; now: number; serverNow: number; requestBusy: boolean; draft: string; modal: string };
};

async function waitForIdle() {
  for (let i = 0; i < 100; i += 1) {
    const snapshot = hooks.snapshot();
    if (!snapshot.action && !snapshot.requestBusy) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('活动问答请求未在预期时间内结束');
}

async function click(id: string) {
  const element = modalRoot.elements.get(id);
  assert.ok(element, `缺少交互控件 ${id}`);
  await element.click();
  await waitForIdle();
}

function currentQuiz(): TestQuiz {
  const quiz = hooks.snapshot().quiz;
  assert.ok(quiz, '当前活动应有问答快照');
  return quiz;
}

async function main() {
  hooks.setTasks([makeTask()]);
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题一？/);
  assert.match(modalRoot.innerHTML, /第 1 \/ 3 题/);
  assert.match(modalRoot.innerHTML, /按服务端截止时间结算/);
  assert.match(modalRoot.innerHTML, /情境推演限时 2 分钟/);
  assert.match(modalRoot.innerHTML, /以下均为假设情境/);
  assert.match(modalRoot.innerHTML, /跳过本题/);
  assert.doesNotMatch(modalRoot.innerHTML, /supportDelta|pleasureDelta|分数|得分/);
  assert.equal(modalRoot.fieldset.disabled, false, '当前题的 fieldset 初始可交互');
  for (let optionIndex = 0; optionIndex < 4; optionIndex += 1) assert.equal(modalRoot.elements.get(`customer-activity-option-${optionIndex}`)?.disabled, false, '四个选项初始均可点击');

  const answersBeforeSync = structuredClone(currentQuiz().answers);
  hooks.deferSync();
  const syncRequest = hooks.sync();
  for (let attempt = 0; attempt < 100 && !hooks.snapshot().requestBusy; attempt += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hooks.snapshot().requestBusy, true, '实际活动同步请求进入全局 busy');
  assert.equal(modalRoot.fieldset.disabled, true, '后台同步期间暂时禁用 fieldset');
  assert.equal(modalRoot.elements.get('customer-activity-option-0')?.disabled, true, '后台同步期间暂时禁用选项');
  hooks.releaseSync();
  assert.equal(await syncRequest, true);
  assert.equal(hooks.snapshot().requestBusy, false);
  if (reproduceStaleBusy) {
    assert.equal(modalRoot.fieldset.disabled, true, '反证：requestBusy=false 后 fieldset 仍卡在禁用态');
    assert.equal(modalRoot.elements.get('customer-activity-option-0')?.disabled, true, '反证：requestBusy=false 后选项仍全灰');
    console.log('内存反证复现：同题同答案的同步请求已完成且 requestBusy=false，但 fieldset/选项仍 disabled');
    return;
  }
  assert.equal(modalRoot.fieldset.disabled, false, '同一份问答与答案经 sync → API finally → queue finally 后立即解锁');
  assert.equal(modalRoot.elements.get('customer-activity-option-0')?.disabled, false, '同一 key 不重绘时四选项仍恢复可点');
  assert.deepEqual(currentQuiz().answers, answersBeforeSync, '同步期间服务端问答答案保持不变');

  now += 30_000;
  hooks.reloadView();
  assert.match(modalRoot.innerHTML, /1:30/, '刷新后按服务端 deadline 显示剩余时间');
  await click('customer-activity-option-0');
  assert.equal(requests.at(-1)?.action, 'customer_activity_answer');
  const answerRequest = requests.at(-1);
  assert.deepEqual({ ...answerRequest, expectedVersion: 0 }, {
    action: 'customer_activity_answer', taskId: 'quiz-task', questionId: 'q1', optionId: 'q1-o1',
    commandId: 'quiz-command-id', expectedVersion: 0, previewSessionId: 'quiz-preview-session',
  });
  assert.ok(Number.isInteger(answerRequest?.expectedVersion), '答案保存仍使用当前预览版本');
  assert.equal(currentQuiz().answers.q1, 'q1-o1', '选择成功后以服务端答案更新');
  assert.match(modalRoot.innerHTML, /aria-checked="true"/);

  await click('customer-activity-quiz-next');
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题二？/);
  await click('customer-activity-quiz-previous');
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题一？/);
  await click('customer-activity-quiz-skip');
  assert.equal(requests.at(-1)?.optionId, null, '跳过本题也向服务端记录 null');
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题二？/);

  failNextAction = 'customer_activity_answer';
  await click('customer-activity-option-1');
  assert.match(hooks.snapshot().error, /模拟网络故障|暂时不可用|答案未能保存/);
  assert.ok(hooks.snapshot().pending, '保存失败时保留当前选项，供重试');
  assert.match(modalRoot.innerHTML, /aria-checked="true"/);
  assert.match(modalRoot.innerHTML, /重试保存或提交/);
  assert.equal(modalRoot.elements.get('customer-activity-quiz-previous')?.disabled, true, '保存失败时不能切回上一题丢失待保存选择');
  assert.equal(modalRoot.elements.get('customer-activity-quiz-skip')?.disabled, true, '保存失败时先重试再跳过，避免静默覆盖选择');
  await click('customer-activity-quiz-previous');
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题二？/, '未保存选择期间导航保持在当前题');
  await click('customer-activity-quiz-retry');
  assert.equal(currentQuiz().answers.q2, 'q2-o2', '重试成功后确认服务端已保存答案');

  hooks.reloadView();
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题一？/, '刷新后定位到第一个未选择的情境题');
  await click('customer-activity-quiz-skip');
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题二？/);
  assert.match(modalRoot.innerHTML, /aria-checked="true"/, '刷新后从服务端答案恢复已选高亮');
  await click('customer-activity-quiz-next');
  assert.match(modalRoot.innerHTML, /情境推演（假设）：问题三？/);
  assert.match(modalRoot.innerHTML, /提交并查看结果/);
  runtimeControl.evaluationOnComplete = { overallEvaluation: '本次方案有效推动了后续活动沟通，评分 95 分。' };
  hooks.deferComplete();
  const finishClick = modalRoot.elements.get('customer-activity-quiz-finish')?.click();
  assert.ok(finishClick, '找到最终提交按钮');
  for (let attempt = 0; attempt < 100 && !requests.some((request) => request.action === 'customer_activity_complete_quiz'); attempt += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hooks.snapshot().requestBusy, true, '实际提交评价请求仍在处理中');
  assert.match(modalRoot.innerHTML, /正在评估/, '评价调用期间显示动画');
  assert.doesNotMatch(modalRoot.innerHTML, /提交并查看结果|情境推演（假设）：问题三？/, '评价调用期间不留在问答页');
  hooks.releaseComplete();
  await finishClick;
  await waitForIdle();
  assert.equal(requests.at(-1)?.action, 'customer_activity_complete_quiz');
  assert.equal(currentQuiz().status, 'completed');
  assert.match(modalRoot.innerHTML, /正在评估/, '服务端快速返回真实评价时先显示评估动效');
  assert.equal((modalRoot.innerHTML.match(/customer-activity-evaluation-ring/g) || []).length >= 4, true, '评估动效包含旋转圆环');
  assert.match(modalRoot.innerHTML, /整理方案内容/);
  assert.match(modalRoot.innerHTML, /汇总情境作答/);
  assert.doesNotMatch(modalRoot.innerHTML, /有效推动|评分|95 分/, '动效期间不公开评价内容');
  now += 901;
  hooks.tick();
  assert.match(modalRoot.innerHTML, /评估已结束，请您继续开展您的销售工作/);
  assert.match(modalRoot.innerHTML, /继续销售工作/);
  assert.doesNotMatch(modalRoot.innerHTML, /活动结果|完成活动策划/);
  assert.doesNotMatch(modalRoot.innerHTML, /有效推动|评分|95 分|客户满意|实际效果/, '结束页只显示固定中性文案');

  const legacy = { id: 'legacy-task', type: 'technical_meeting', status: 'submitted', createdAt: now, startedAt: now, deadlineAt: now + 300_000, submittedAt: now, draft: '旧方案' };
  hooks.setTasks([legacy]);
  assert.match(modalRoot.innerHTML, /正在评估/, '没有 quiz 字段的旧 submitted 任务仍显示评估动效');
  for (const [id, outcome] of [
    ['legacy-positive', '本次方案推动后续活动沟通，评分 95 分。'],
    ['legacy-negative', '本次方案未能推动后续活动沟通，得分 0 分。'],
    ['legacy-blank', ''],
  ] as const) {
    const evaluated = { ...legacy, id, evaluation: { overallEvaluation: outcome } };
    hooks.setTasks([evaluated]);
    assert.match(modalRoot.innerHTML, /评估已结束，请您继续开展您的销售工作/);
    assert.doesNotMatch(modalRoot.innerHTML, /推动|未能|评分|得分|95 分|0 分|实际效果/, '正向、负向、空白及历史结算内容均不向玩家展示');
  }
  hooks.setTasks([{ ...legacy, id: 'legacy-result', evaluation: { overallEvaluation: '旧结果：未推进 0 分' } }]);
  assert.match(modalRoot.innerHTML, /评估已结束，请您继续开展您的销售工作/);
  assert.doesNotMatch(modalRoot.innerHTML, /旧结果|未推进|0 分/, '旧评价 payload 不泄漏');

  hooks.setTasks([makeTask('custom-duration-task', now + 90_000, 90_000)]);
  assert.match(modalRoot.innerHTML, /情境推演限时 1 分 30 秒/, '预览 UI 展示配置写入问答快照的自定义时限');

  const timeoutTask = makeTask('timeout-task', now + 120_000);
  hooks.setTasks([timeoutTask]);
  now += 120_000;
  runtimeControl.evaluationOnComplete = { overallEvaluation: '超时方案推进成功，评分 88 分。' };
  hooks.tick();
  await waitForIdle();
  assert.equal(requests.filter((request) => request.action === 'customer_activity_complete_quiz' && request.taskId === 'timeout-task').length, 1, '到期只提交一次情境推演完成请求');
  assert.equal(currentQuiz().status, 'completed', '截止后由服务端确认完成');
  assert.match(modalRoot.innerHTML, /正在评估/, '超时自动提交后也显示评估动效');
  assert.doesNotMatch(modalRoot.innerHTML, /推进成功|评分|88 分/);
  now += 901;
  hooks.tick();
  assert.match(modalRoot.innerHTML, /评估已结束，请您继续开展您的销售工作/);
  assert.doesNotMatch(modalRoot.innerHTML, /推进成功|评分|88 分/);

  const completedFirst = { ...legacy, id: 'first-finished-activity', status: 'submitted', evaluation: { overallEvaluation: 'private first result' } };
  const pendingSecond: TestTask = { id: 'second-pending-activity', type: 'hospitality', status: 'pending', createdAt: now + 1, startedAt: now, deadlineAt: now + 300_000, submittedAt: now, draft: '' };
  hooks.setTasks([completedFirst, pendingSecond]);
  hooks.markSeen(completedFirst.id);
  assert.match(modalRoot.innerHTML, /second-pending-activity|活动提议已匹配/, '第一项完成后队列进入第二项待处理活动');
  runtimeControl.conflictNextSync = true;
  const recoveryPostsBefore = requests.filter((request) => request.action === 'customer_activity_sync').length;
  const recoveryReadsBefore = runtimeControl.recoveryReadCount;
  assert.equal(await hooks.sync(), true, '活动同步遇到版本冲突后读取服务端权威快照恢复');
  assert.equal(runtimeControl.recoveryReadCount, recoveryReadsBefore + 1, '版本冲突只触发一次既有会话 GET 恢复');
  assert.equal(requests.filter((request) => request.action === 'customer_activity_sync').length, recoveryPostsBefore + 1, '恢复不会重放同步 POST');
  assert.equal(requests.filter((request) => ['customer_activity_start', 'customer_activity_answer', 'customer_activity_complete_quiz'].includes(request.action || '') && request.taskId === pendingSecond.id).length, 0, 'GET 恢复不会重放活动开始、答题或交卷写操作');
  assert.equal(hooks.snapshot().error, '', '快照恢复后清除旧的同步错误');
  assert.equal(modalRoot.elements.get('customer-activity-start')?.disabled, false, '第二项活动在服务端快照同步完成后可开始');
  await hooks.start();
  await waitForIdle();
  assert.equal(requests.at(-1)?.action, 'customer_activity_start', '同步完成后玩家可正常开始第二项活动');

  hooks.setTasks([pendingSecond]);
  failNextAction = 'customer_activity_sync';
  assert.equal(await hooks.sync(), false, '普通网络错误保留为可恢复状态');
  assert.match(hooks.snapshot().error, /模拟网络故障/, '界面保留底层网络错误原因');
  assert.match(modalRoot.innerHTML, /重试同步/, 'pending 状态展示手动同步入口');
  assert.equal(modalRoot.elements.get('customer-activity-retry-sync')?.disabled, false, '同步 finally 清 busy 后同 key 快路径恢复重试按钮');
  await click('customer-activity-retry-sync');
  assert.equal(hooks.snapshot().error, '', '实际点击重试成功后清除同步错误提示');
  assert.doesNotMatch(modalRoot.innerHTML, /模拟网络故障/, '同 key 成功同步会移除旧错误 DOM');

  const planningSecond: TestTask = { ...pendingSecond, id: 'second-planning-activity', status: 'planning', draft: 'server copy', deadlineAt: now + 300_000 };
  hooks.setTasks([planningSecond]);
  const unsavedPlan = '玩家尚未保存的第二场活动方案';
  hooks.setDraft(unsavedPlan);
  runtimeControl.conflictNextSync = true;
  assert.equal(await hooks.sync(), true, '正在策划时的版本冲突也只读恢复服务端状态');
  assert.equal(hooks.snapshot().draft, unsavedPlan, '会话恢复保留当前页面未保存的活动草稿');

  console.log('客户活动情境问答 UI、答案保存/重试、刷新恢复、截止结算与旧任务兼容回归通过');
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
