type CustomerActivityEvaluationStatusProps = {
  status: 'evaluating' | 'complete';
  hasNext?: boolean;
  onContinue?: () => void;
};

export const CUSTOMER_ACTIVITY_EVALUATION_MINIMUM_MS = 900;

export type CustomerActivityEvaluationUiState = 'questionnaire' | 'evaluating' | 'complete';

export function shouldShowCustomerActivityEvaluationSpinner(
  hasEvaluation: boolean,
  startedAt: number | null,
  now: number,
): boolean {
  if (!hasEvaluation) return true;
  if (startedAt === null) return false;
  return now - startedAt < CUSTOMER_ACTIVITY_EVALUATION_MINIMUM_MS;
}

export function getCustomerActivityEvaluationUiState(
  quizStatus: 'answering' | 'completed' | undefined,
  completionRequestInFlight: boolean,
  hasEvaluation: boolean,
  startedAt: number | null,
  now: number,
): CustomerActivityEvaluationUiState {
  if (completionRequestInFlight) return 'evaluating';
  if (quizStatus === 'answering') return 'questionnaire';
  return shouldShowCustomerActivityEvaluationSpinner(hasEvaluation, startedAt, now)
    ? 'evaluating'
    : 'complete';
}

export function CustomerActivityEvaluationStatus({
  status,
  hasNext = false,
  onContinue,
}: CustomerActivityEvaluationStatusProps) {
  if (status === 'evaluating') {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-5 rounded-2xl border border-blue-100 bg-slate-50 px-5 py-8 text-center" role="status" aria-live="polite" aria-label="正在评估活动方案">
        <div className="relative h-24 w-24" aria-hidden="true">
          <span className="absolute inset-1 rounded-full border-[3px] border-blue-100 border-t-blue-600 motion-safe:animate-spin motion-reduce:animate-none" />
          <span className="absolute inset-3 rounded-full border-[3px] border-indigo-100 border-r-indigo-500 motion-safe:animate-[spin_1.8s_linear_infinite] motion-reduce:animate-none" />
          <span className="absolute inset-6 rounded-full border-[3px] border-sky-100 border-b-sky-500 motion-safe:animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none" />
          <span className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full bg-blue-600 motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">正在评估活动方案</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">请稍候，评估完成后即可继续开展销售工作。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5" role="status" aria-live="polite">
      <div>
        <h3 className="text-lg font-bold text-slate-900">评估已结束</h3>
        <p className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">评估已结束，请您继续开展您的销售工作</p>
      </div>
      <button type="button" onClick={onContinue} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-700">
        {hasNext ? '继续下一项活动' : '继续销售工作'}
      </button>
    </div>
  );
}
