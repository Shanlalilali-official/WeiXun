import assert from 'node:assert/strict';
import { createElement, type ComponentType } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CustomerActivityEvaluationStatus,
  CUSTOMER_ACTIVITY_EVALUATION_MINIMUM_MS,
  getCustomerActivityEvaluationUiState,
  shouldShowCustomerActivityEvaluationSpinner,
} from '../src/components/customer-activity-evaluation-status';

const fixedCompletionText = '评估已结束，请您继续开展您的销售工作';
const hostileEvaluationText = '本次方案未能推进，客户支持度下降 12 分';
const currentTime = 1_900_000_000_000;
const plannerSource = readFileSync(resolve(process.cwd(), 'src/components/customer-activity-planner.tsx'), 'utf8');

assert.match(plannerSource, /getCustomerActivityEvaluationUiState\(/, '正式 planner 使用共享评估阶段判定');
assert.match(plannerSource, /action === 'complete_quiz'/, '问答提交请求期间进入评估状态，即使服务端仍标记答题中');
assert.match(plannerSource, /onClick=\{\(\) => void retryCurrent\(\)\} disabled=\{action !== null\} className="[^"]*">重试保存或提交/, '问答提交失败后仍提供可用的 retryCurrent 入口');
assert.doesNotMatch(plannerSource, /active\.evaluation\.overallEvaluation/, '正式 planner 不读取服务端的实际评价文本');

assert.equal(
  shouldShowCustomerActivityEvaluationSpinner(false, null, currentTime),
  true,
  '服务端尚未确认评估时持续显示评估中',
);
assert.equal(
  shouldShowCustomerActivityEvaluationSpinner(true, null, currentTime),
  false,
  '刷新后恢复的旧已评活动直接显示中性完成状态',
);
assert.equal(
  shouldShowCustomerActivityEvaluationSpinner(true, currentTime, currentTime + CUSTOMER_ACTIVITY_EVALUATION_MINIMUM_MS - 1),
  true,
  '即时返回的评估结果仍保留短暂动效',
);
assert.equal(
  shouldShowCustomerActivityEvaluationSpinner(true, currentTime, currentTime + CUSTOMER_ACTIVITY_EVALUATION_MINIMUM_MS),
  false,
  '最短动效结束且服务端已确认评估后显示完成状态',
);
assert.equal(
  getCustomerActivityEvaluationUiState('answering', true, false, currentTime, currentTime + 20_000),
  'evaluating',
  '服务端仍标记答题中但提交请求在飞时显示评估动画',
);
assert.equal(
  getCustomerActivityEvaluationUiState('answering', false, false, currentTime, currentTime + 20_000),
  'questionnaire',
  '提交失败后恢复问答状态，仍可进入现有重试操作',
);
assert.notEqual(
  getCustomerActivityEvaluationUiState('answering', false, false, currentTime, currentTime + 20_000),
  'complete',
  '请求失败且没有评估时不能误报完成',
);
assert.equal(
  getCustomerActivityEvaluationUiState('completed', false, false, currentTime, currentTime + 20_000),
  'evaluating',
  '服务端已完成问答但尚无评估时，超过最短动画时间也持续显示评估中',
);
assert.equal(
  getCustomerActivityEvaluationUiState('completed', false, true, currentTime, currentTime + CUSTOMER_ACTIVITY_EVALUATION_MINIMUM_MS - 1),
  'evaluating',
  '服务端实际评估到达前的最短动画阶段不可跳过',
);
assert.equal(
  getCustomerActivityEvaluationUiState('completed', false, true, currentTime, currentTime + CUSTOMER_ACTIVITY_EVALUATION_MINIMUM_MS),
  'complete',
  '服务端确认评估且最短动效结束后进入完成状态',
);

const evaluatingMarkup = renderToStaticMarkup(createElement(CustomerActivityEvaluationStatus, {
  status: 'evaluating',
}));
assert.match(evaluatingMarkup, /正在评估活动方案/);
assert.match(evaluatingMarkup, /motion-safe:animate-spin/);
assert.match(evaluatingMarkup, /motion-reduce:animate-none/);
assert.doesNotMatch(evaluatingMarkup, /评估已结束，请您继续开展您的销售工作/);
assert.doesNotMatch(evaluatingMarkup, /本次方案未能推进/);

const untrustedResultProps = {
  status: 'complete' as const,
  hasNext: false,
  onContinue: () => undefined,
  evaluation: { overallEvaluation: hostileEvaluationText },
};
const completeMarkup = renderToStaticMarkup(createElement(
  CustomerActivityEvaluationStatus as ComponentType<typeof untrustedResultProps>,
  untrustedResultProps,
));
assert.match(completeMarkup, /评估已结束/);
assert.match(completeMarkup, new RegExp(fixedCompletionText));
assert.match(completeMarkup, /继续销售工作/);
assert.match(completeMarkup, /bg-slate-50/);
assert.doesNotMatch(completeMarkup, /本次方案未能推进/);
assert.doesNotMatch(completeMarkup, /支持度下降/);

const nextActivityMarkup = renderToStaticMarkup(createElement(CustomerActivityEvaluationStatus, {
  status: 'complete',
  hasNext: true,
  onContinue: () => undefined,
}));
assert.match(nextActivityMarkup, /继续下一项活动/);

console.log('Customer activity neutral UI tests passed.');
