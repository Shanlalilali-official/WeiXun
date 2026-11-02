'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CUSTOMER_ACTIVITY_PLANNING_MS,
  type CustomerActivityType,
  type PublicCustomerActivityTask,
} from '@/lib/game/customer-activities';
import type { PublicCustomerActivityQuiz } from '@/lib/game/customer-activity-quiz';
import {
  CustomerActivityEvaluationStatus,
  getCustomerActivityEvaluationUiState,
} from '@/components/customer-activity-evaluation-status';

type ActivityAction = 'start' | 'save' | 'submit' | 'answer' | 'complete_quiz';
type QuizAnswer = { taskId: string; questionId: string; optionId: string | null };
type ActivityWithQuiz = PublicCustomerActivityTask & { quiz?: PublicCustomerActivityQuiz; quizEnabled?: boolean };

type ActivityEnvelope = {
  success?: boolean;
  activities?: PublicCustomerActivityTask[];
  serverNow?: number | string;
  version?: number;
  state?: unknown;
  error?: string;
};

type Props = {
  sessionId: string;
  refreshSignal?: number;
  onGameState?: (state: unknown) => void;
};

const ACTIVITY_LABELS: Record<CustomerActivityType, string> = {
  technical_meeting: '技术交流会',
  case_site_visit: '案例现场参观',
  company_visit: '客户参观我们公司',
  hospitality: '吃饭或喝酒邀约',
};

function epoch(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatQuizDuration(startedAt: number, deadlineAt: number): string {
  const seconds = Math.max(0, Math.ceil((deadlineAt - startedAt) / 1000));
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes} 分 ${remainder} 秒` : `${seconds} 秒`;
}

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function seenStorageKey(sessionId: string): string {
  return `customer-activity-seen:${sessionId}`;
}

function readSeenActivities(sessionId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(seenStorageKey(sessionId)) || '[]');
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveSeenActivities(sessionId: string, seen: Set<string>): void {
  try {
    localStorage.setItem(seenStorageKey(sessionId), JSON.stringify([...seen]));
  } catch {
    // The server remains authoritative if browser storage is unavailable.
  }
}

export function CustomerActivityPlanner({ sessionId, refreshSignal = 0, onGameState }: Props) {
  const [activities, setActivities] = useState<ActivityWithQuiz[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizPendingAnswer, setQuizPendingAnswer] = useState<QuizAnswer | null>(null);
  const [quizCompletionPending, setQuizCompletionPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [action, setAction] = useState<ActivityAction | null>(null);
  const [actionError, setActionError] = useState('');
  const [saved, setSaved] = useState(true);
  const [assessmentStart, setAssessmentStart] = useState<{ taskId: string; startedAt: number } | null>(null);
  const actionRef = useRef<ActivityAction | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const initializedSessionRef = useRef<string | null>(null);
  const draftRef = useRef('');
  const dirtyRef = useRef(false);
  const activitiesRef = useRef<ActivityWithQuiz[]>([]);
  const versionRef = useRef(0);
  const offsetRef = useRef(0);
  const lastTimeoutSubmitRef = useRef<string | null>(null);
  const lastTimeoutQuizRef = useRef<string | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const saveRequestedRef = useRef(false);
  const onGameStateRef = useRef(onGameState);
  const requestRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const assessmentStartRef = useRef<{ taskId: string; startedAt: number } | null>(null);
  const beginAssessment = useCallback((taskId: string, restart = false) => {
    if (!restart && assessmentStartRef.current?.taskId === taskId) return;
    const startedAt = Date.now();
    const next = { taskId, startedAt };
    assessmentStartRef.current = next;
    setAssessmentStart(next);
  }, []);
  const changeAction = (next: ActivityAction | null, expectedSessionId = sessionIdRef.current) => {
    if (expectedSessionId !== sessionIdRef.current) return;
    actionRef.current = next;
    setAction(next);
  };

  useEffect(() => { onGameStateRef.current = onGameState; }, [onGameState]);

  const updateFromEnvelope = useCallback((body: ActivityEnvelope, expectedSessionId = sessionIdRef.current) => {
    if (expectedSessionId !== sessionIdRef.current) return false;
    if (!Array.isArray(body.activities)) throw new Error('活动恢复响应缺少活动列表。');
    if (Number.isInteger(body.version) && (body.version as number) < versionRef.current) return false;
    const timestamp = epoch(body.serverNow);
    if (timestamp !== null) {
      const nextOffset = timestamp - Date.now();
      offsetRef.current = nextOffset;
    }
    if (Number.isInteger(body.version)) versionRef.current = body.version as number;
    activitiesRef.current = body.activities as ActivityWithQuiz[];
    setActivities(body.activities as ActivityWithQuiz[]);
    if (body.state !== undefined) onGameStateRef.current?.(body.state);
    setLoadError('');
    return true;
  }, []);

  const sync = useCallback(async (silent = false) => {
    if (!sessionId) return false;
    if (actionRef.current !== null) return false;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const requestSessionId = sessionId;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/game/sessions/${encodeURIComponent(sessionId)}/customer-activities`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'x-session': localStorage.getItem('weixun_session') || '' },
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null) as ActivityEnvelope | null;
      if (!response.ok || !body || body.success === false) throw new Error(body?.error || '活动状态暂时无法恢复。');
      if (controller.signal.aborted || requestRef.current !== controller || requestSessionId !== sessionIdRef.current) return false;
      updateFromEnvelope(body, requestSessionId);
      return true;
    } catch (error) {
      if (controller.signal.aborted || requestSessionId !== sessionIdRef.current) return false;
      setLoadError(error instanceof Error ? error.message : '活动状态暂时无法恢复。');
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (!silent) setLoading(false);
      }
    }
  }, [sessionId, updateFromEnvelope]);

  const postAction = useCallback(async (
    actionName: ActivityAction,
    taskId: string,
    latestDraft?: string,
    quizAnswer?: Pick<QuizAnswer, 'questionId' | 'optionId'>,
  ) => {
    const requestSessionId = sessionId;
    const response = await fetch(`/api/game/sessions/${encodeURIComponent(sessionId)}/customer-activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session': localStorage.getItem('weixun_session') || '',
      },
      body: JSON.stringify({
        action: actionName,
        taskId,
        commandId: commandId(),
        expectedVersion: versionRef.current,
        ...(latestDraft === undefined ? {} : { draft: latestDraft }),
        ...(quizAnswer ?? {}),
      }),
    });
    const body = await response.json().catch(() => null) as ActivityEnvelope | null;
    if (requestSessionId !== sessionIdRef.current) throw new Error('活动页面已切换，请重试。');
    if (!response.ok || !body || body.success === false) {
      if (body && Array.isArray(body.activities)) updateFromEnvelope(body, requestSessionId);
      throw new Error(body?.error || '活动策划暂时未能保存，请重试。');
    }
    updateFromEnvelope(body, requestSessionId);
    return body;
  }, [sessionId, updateFromEnvelope]);

  useEffect(() => {
    if (!sessionId) return;
    const sessionChanged = initializedSessionRef.current !== sessionId;
    if (sessionChanged) {
      initializedSessionRef.current = sessionId;
      setActivities([]);
      activitiesRef.current = [];
      setActiveId(null);
      setDraft('');
      draftRef.current = '';
      dirtyRef.current = false;
      saveRequestedRef.current = false;
      actionRef.current = null;
      setAction(null);
      versionRef.current = 0;
      lastTimeoutSubmitRef.current = null;
      lastTimeoutQuizRef.current = null;
      setQuizQuestionIndex(0);
      setQuizPendingAnswer(null);
      setQuizCompletionPending(false);
      assessmentStartRef.current = null;
      setAssessmentStart(null);
      const restoredSeen = readSeenActivities(sessionId);
      setSeen(restoredSeen);
    }
    // Refreshes after a conversation ends must not clear a task the user is
    // already drafting. A different session gets a clean, server-restored view.
    void sync();
    return () => {
      requestRef.current?.abort();
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    };
  }, [sessionId, refreshSignal, sync]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now() + offsetRef.current), 200);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void sync(true);
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [sync]);

  const active = useMemo(() => activities.find((item) => item.id === activeId) ?? null, [activities, activeId]);
  const activeStatus = active?.status;
  const activeDeadlineAt = active?.deadlineAt;
  const activeQuizStatus = active?.quiz?.status;
  const activeQuizDeadlineAt = active?.quiz?.deadlineAt;

  useEffect(() => {
    if (!active || active.status !== 'submitted' || active.quiz?.status === 'answering' || active.evaluation) return;
    beginAssessment(active.id);
  }, [active?.id, active?.status, active?.quiz?.status, active?.evaluation, beginAssessment]);

  useEffect(() => {
    if (!sessionId) return;
    setActiveId((current) => {
      const currentActivity = current ? activities.find((item) => item.id === current) : undefined;
      if (currentActivity && (currentActivity.status !== 'submitted' || !seen.has(currentActivity.id))) return current;
      const next = [...activities]
        .sort((left, right) => left.createdAt - right.createdAt)
        .find((item) => item.status !== 'submitted' || !seen.has(item.id));
      return next?.id ?? null;
    });
  }, [activities, seen, sessionId]);

  useEffect(() => {
    if (!activeId) return;
    const current = activitiesRef.current.find((item) => item.id === activeId);
    if (current?.status === 'planning') {
      setDraft(current.draft);
      draftRef.current = current.draft;
      dirtyRef.current = false;
      setSaved(true);
    } else if (current?.status === 'pending') {
      setDraft('');
      draftRef.current = '';
      dirtyRef.current = false;
      setSaved(true);
    }
  }, [activeId, activeStatus]);

  useEffect(() => {
    if (!activeId) return;
    const quiz = activitiesRef.current.find((item) => item.id === activeId)?.quiz;
    const questions = quiz?.questions ?? [];
    const firstUnanswered = questions.findIndex((question) => quiz?.answers[question.id] == null);
    setQuizQuestionIndex(firstUnanswered >= 0 ? firstUnanswered : Math.max(0, questions.length - 1));
    setQuizPendingAnswer(null);
    setQuizCompletionPending(false);
    lastTimeoutQuizRef.current = null;
  }, [activeId, activeQuizStatus]);

  const saveDraft = useCallback((taskId: string): Promise<boolean> => {
    const requestSessionId = sessionIdRef.current;
    saveRequestedRef.current = true;
    if (saveInFlightRef.current) return saveInFlightRef.current;
    if (!dirtyRef.current) {
      saveRequestedRef.current = false;
      return Promise.resolve(true);
    }

    const promise = (async () => {
      let succeeded = true;
      changeAction('save', requestSessionId);
      try {
        while (requestSessionId === sessionIdRef.current && saveRequestedRef.current && dirtyRef.current) {
          saveRequestedRef.current = false;
          const snapshot = draftRef.current;
          await postAction('save', taskId, snapshot);
          const serverTask = activitiesRef.current.find((item) => item.id === taskId);
          if (serverTask?.status === 'submitted' || draftRef.current === snapshot) {
            dirtyRef.current = false;
            setSaved(true);
          } else {
            // Serialize a follow-up write if the user edited while a save was
            // in flight, so an older snapshot can never arrive after a newer one.
            saveRequestedRef.current = true;
          }
          setActionError('');
        }
      } catch (error) {
        succeeded = false;
        if (requestSessionId === sessionIdRef.current) {
          setSaved(false);
          setActionError(error instanceof Error ? error.message : '草稿保存失败。');
        }
      } finally {
        changeAction(null, requestSessionId);
        saveInFlightRef.current = null;
      }
      return succeeded;
    })();
    saveInFlightRef.current = promise;
    return promise;
  }, [postAction]);

  useEffect(() => {
    if (!activeId || activeStatus !== 'planning') return;
    // A fixed max-wait cadence saves even while the user keeps typing. The
    // final interval is aligned to the server deadline for one last flush.
    const interval = window.setInterval(() => {
      if (dirtyRef.current && !saveInFlightRef.current && actionRef.current === null) void saveDraft(activeId);
    }, 1_800);
    let finalFlush: number | null = null;
    const deadlineAt = epoch(activeDeadlineAt);
    if (deadlineAt !== null) {
      const untilFinalFlush = Math.max(0, deadlineAt - (Date.now() + offsetRef.current) - 1_800);
      finalFlush = window.setTimeout(() => {
        if (dirtyRef.current && !saveInFlightRef.current && actionRef.current === null) void saveDraft(activeId);
      }, untilFinalFlush);
    }
    return () => {
      window.clearInterval(interval);
      if (finalFlush !== null) window.clearTimeout(finalFlush);
    };
  }, [activeId, activeStatus, activeDeadlineAt, saveDraft]);

  useEffect(() => {
    const taskId = activeStatus === 'planning' ? activeId : null;
    const deadlineAt = epoch(activeDeadlineAt);
    if (!taskId || deadlineAt === null) return;
    const expired = now >= deadlineAt;
    if (!expired || lastTimeoutSubmitRef.current === taskId || action !== null || actionRef.current !== null) return;
    lastTimeoutSubmitRef.current = taskId;
    void (async () => {
      const requestSessionId = sessionIdRef.current;
      changeAction('submit', requestSessionId);
      setActionError('');
      try {
        // The server accepts only drafts that arrive before its deadline. The
        // latest locally saved draft remains on screen if this request fails.
        await postAction('submit', taskId);
      } catch (error) {
        if (requestSessionId !== sessionIdRef.current) return;
        setActionError(error instanceof Error ? error.message : '到时提交失败，方案仍保留，请重试。');
        lastTimeoutSubmitRef.current = null;
        retryTimerRef.current = window.setTimeout(() => void sync(true), 1_000);
      } finally {
        changeAction(null, requestSessionId);
      }
    })();
  }, [activeId, activeStatus, activeDeadlineAt, action, now, postAction, sync]);

  useEffect(() => {
    if (!active || active.status !== 'submitted' || active.evaluation) return;
    const timer = window.setInterval(() => void sync(true), 2_500);
    return () => window.clearInterval(timer);
  }, [active, sync]);

  const startPlanning = async () => {
    if (!active || active.status !== 'pending' || action) return;
    const requestSessionId = sessionIdRef.current;
    changeAction('start', requestSessionId);
    setActionError('');
    try {
      await postAction('start', active.id);
    } catch (error) {
      if (requestSessionId !== sessionIdRef.current) return;
      setActionError(error instanceof Error ? error.message : '暂时无法开始策划，请重试。');
    } finally {
      changeAction(null, requestSessionId);
    }
  };

  const submitEarly = async () => {
    if (!active || active.status !== 'planning' || (action !== null && action !== 'save')) return;
    const requestSessionId = sessionIdRef.current;
    setActionError('');
    try {
      const draftSaved = await saveDraft(active.id);
      if (requestSessionId !== sessionIdRef.current) return;
      if (!draftSaved) throw new Error('草稿尚未保存成功，请检查网络后重试。');
      changeAction('submit', requestSessionId);
      await postAction('submit', active.id, draftRef.current);
      dirtyRef.current = false;
      setSaved(true);
    } catch (error) {
      if (requestSessionId !== sessionIdRef.current) return;
      setActionError(error instanceof Error ? error.message : '提交失败，方案仍保留，请重试。');
      retryTimerRef.current = window.setTimeout(() => void sync(true), 0);
    } finally {
      changeAction(null, requestSessionId);
    }
  };

  const saveQuizAnswer = useCallback(async (taskId: string, questionId: string, optionId: string | null): Promise<boolean> => {
    if (actionRef.current !== null) return false;
    const requestSessionId = sessionIdRef.current;
    setQuizPendingAnswer({ taskId, questionId, optionId });
    changeAction('answer', requestSessionId);
    setActionError('');
    try {
      await postAction('answer', taskId, undefined, { questionId, optionId });
      if (requestSessionId !== sessionIdRef.current) return false;
      const savedQuiz = activitiesRef.current.find((item) => item.id === taskId)?.quiz;
      if (savedQuiz?.answers[questionId] !== optionId) throw new Error('服务端尚未确认答案保存，请重试。');
      setQuizPendingAnswer((pending) => pending?.taskId === taskId && pending.questionId === questionId ? null : pending);
      setActionError('');
      return true;
    } catch (error) {
      if (requestSessionId !== sessionIdRef.current) return false;
      setActionError(error instanceof Error ? error.message : '答案保存失败，请重试。');
      return false;
    } finally {
      changeAction(null, requestSessionId);
    }
  }, [postAction]);

  const completeQuiz = useCallback(async (taskId: string, deadlineTriggered = false): Promise<boolean> => {
    if (actionRef.current !== null) return false;
    const task = activitiesRef.current.find((item) => item.id === taskId);
    const quiz = task?.quiz;
    if (!task || task.status !== 'submitted' || quiz?.status !== 'answering') return false;

    if (!deadlineTriggered && quiz.questions.length > 0) {
      const index = Math.min(quizQuestionIndex, quiz.questions.length - 1);
      const question = quiz.questions[index];
      const pending = quizPendingAnswer?.taskId === taskId && quizPendingAnswer.questionId === question.id
        ? quizPendingAnswer
        : null;
      const selectedAnswer = pending ? pending.optionId : quiz.answers[question.id];
      const wasSaved = Object.prototype.hasOwnProperty.call(quiz.answers, question.id)
        && quiz.answers[question.id] === selectedAnswer;
      if (pending || !wasSaved) {
        const savedAnswer = await saveQuizAnswer(taskId, question.id, selectedAnswer ?? null);
        if (!savedAnswer) return false;
      }
    }

    if (actionRef.current !== null) return false;
    const requestSessionId = sessionIdRef.current;
    setQuizCompletionPending(true);
    changeAction('complete_quiz', requestSessionId);
    setActionError('');
    beginAssessment(taskId, true);
    try {
      await postAction('complete_quiz', taskId);
      if (requestSessionId !== sessionIdRef.current) return false;
      if (activitiesRef.current.find((item) => item.id === taskId)?.quiz?.status !== 'completed') {
        throw new Error('服务端尚未确认情境推演完成，请重试同步。');
      }
      setQuizCompletionPending(false);
      setActionError('');
      lastTimeoutQuizRef.current = null;
      return true;
    } catch (error) {
      if (requestSessionId !== sessionIdRef.current) return false;
      setActionError(error instanceof Error ? error.message : '情境推演未能提交，请重试。');
      if (deadlineTriggered) {
        lastTimeoutQuizRef.current = taskId;
        retryTimerRef.current = window.setTimeout(() => {
          if (requestSessionId !== sessionIdRef.current) return;
          lastTimeoutQuizRef.current = null;
          void sync(true);
        }, 1_000);
      }
      return false;
    } finally {
      changeAction(null, requestSessionId);
    }
  }, [beginAssessment, postAction, quizPendingAnswer, quizQuestionIndex, saveQuizAnswer, sync]);

  useEffect(() => {
    const taskId = activeStatus === 'submitted' && activeQuizStatus === 'answering' ? activeId : null;
    const deadlineAt = epoch(activeQuizDeadlineAt);
    if (!taskId || deadlineAt === null) return;
    if (now < deadlineAt || lastTimeoutQuizRef.current === taskId || actionRef.current !== null) return;
    lastTimeoutQuizRef.current = taskId;
    void completeQuiz(taskId, true);
  }, [activeId, activeStatus, activeQuizStatus, activeQuizDeadlineAt, action, completeQuiz, now]);

  const retryCurrent = async () => {
    if (!active || action) return;
    const requestSessionId = sessionIdRef.current;
    setActionError('');
    if (active.status === 'submitted' && active.quiz?.status === 'answering') {
      if (quizPendingAnswer?.taskId === active.id) {
        const savedAnswer = await saveQuizAnswer(active.id, quizPendingAnswer.questionId, quizPendingAnswer.optionId);
        if (!savedAnswer) return;
      }
      if (quizCompletionPending || active.quiz.deadlineAt <= now) {
        await completeQuiz(active.id, active.quiz.deadlineAt <= now);
        return;
      }
      await sync();
      return;
    }
    if (active.status === 'pending') return startPlanning();
    if (active.status === 'planning') {
      lastTimeoutSubmitRef.current = active.id;
      changeAction('submit', requestSessionId);
      try {
        const deadlineAt = epoch(active.deadlineAt);
        await postAction('submit', active.id, deadlineAt !== null && now < deadlineAt ? draftRef.current : undefined);
      } catch (error) {
        if (requestSessionId !== sessionIdRef.current) return;
        setActionError(error instanceof Error ? error.message : '提交失败，方案仍保留，请重试。');
        void sync(true);
      } finally {
        changeAction(null, requestSessionId);
      }
      return;
    }
    await sync();
  };

  const continueQueue = () => {
    if (!active || active.status !== 'submitted' || !active.evaluation) return;
    const nextSeen = new Set(seen);
    nextSeen.add(active.id);
    setSeen(nextSeen);
    saveSeenActivities(sessionId, nextSeen);
    setActiveId(null);
    setActionError('');
  };

  useEffect(() => {
    if (!active) return;
    const blockCloseKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockCloseKeys, true);
    return () => window.removeEventListener('keydown', blockCloseKeys, true);
  }, [active]);

  if (!active) {
    if (!loadError) return null;
    return (
      <div className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border border-amber-200 bg-white p-4 text-sm shadow-xl" role="status">
        <div className="font-semibold text-amber-900">活动状态暂时无法同步</div>
        <p className="mt-1 text-xs leading-5 text-slate-600">{loadError}</p>
        <button type="button" onClick={() => void sync()} disabled={loading} className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading ? '正在重试…' : '重试同步'}</button>
      </div>
    );
  }

  const queueCount = activities.filter((item) => item.status !== 'submitted').length;
  const totalCount = Math.max(1, activities.length);
  const position = activities.filter((item) => item.createdAt <= active.createdAt).length;
  const deadlineAt = epoch(active.deadlineAt);
  const remaining = deadlineAt === null ? CUSTOMER_ACTIVITY_PLANNING_MS : deadlineAt - now;
  const canEdit = active.status === 'planning' && remaining > 0 && action !== 'submit';
  const title = ACTIVITY_LABELS[active.type] ?? '客户活动';
  const isHospitality = active.type === 'hospitality';
  const quiz = active.quiz;
  const evaluationStartedAt = assessmentStart?.taskId === active.id ? assessmentStart.startedAt : null;
  const evaluationUiState = active.status === 'submitted'
    ? getCustomerActivityEvaluationUiState(
      quiz?.status,
      action === 'complete_quiz',
      Boolean(active.evaluation),
      evaluationStartedAt,
      Date.now(),
    )
    : null;
  const answeringQuiz = evaluationUiState === 'questionnaire';
  const quizQuestionIndexSafe = Math.min(quizQuestionIndex, Math.max(0, (quiz?.questions.length ?? 1) - 1));
  const quizQuestion = answeringQuiz && quiz ? quiz.questions[quizQuestionIndexSafe] : undefined;
  const quizAnswer = quizQuestion
    ? quizPendingAnswer?.taskId === active.id && quizPendingAnswer.questionId === quizQuestion.id
      ? quizPendingAnswer.optionId
      : quiz?.answers[quizQuestion.id] ?? null
    : null;
  const quizHasPendingAnswer = Boolean(quizQuestion
    && quizPendingAnswer?.taskId === active.id
    && quizPendingAnswer.questionId === quizQuestion.id);
  const quizAnswerSaved = Boolean(quizQuestion
    && quiz
    && typeof quizAnswer === 'string'
    && Object.prototype.hasOwnProperty.call(quiz.answers, quizQuestion.id)
    && quiz.answers[quizQuestion.id] === quizAnswer
    && !quizHasPendingAnswer);
  const quizDeadlineAt = epoch(quiz?.deadlineAt);
  const quizRemaining = quizDeadlineAt === null ? 0 : quizDeadlineAt - now;
  const quizTimedOut = quizRemaining <= 0;
  const showEvaluationSpinner = evaluationUiState === 'evaluating';
  const showEvaluationComplete = evaluationUiState === 'complete';
  const stateTitle = active.status === 'pending'
    ? `活动提议已匹配：「${title}」`
    : active.status === 'planning'
      ? `活动策划：「${title}」`
      : answeringQuiz
        ? `情境推演：「${title}」`
        : showEvaluationSpinner
          ? '活动评估'
          : '评估已结束';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="presentation">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/20 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="customer-activity-title" onKeyDownCapture={(event) => { if (event.key === 'Escape') event.preventDefault(); }}>
        <header className="bg-[#0B1736] px-6 py-5 text-white sm:px-8">
          <div className="text-[10px] font-bold tracking-[0.18em] text-blue-300">客户活动策划 · {Math.min(position, totalCount)} / {totalCount}</div>
          <h2 id="customer-activity-title" className="mt-2 text-xl font-bold sm:text-2xl">{stateTitle}</h2>
        </header>

        <div className="space-y-5 p-5 sm:p-8">
          {active.status === 'pending' && (
            <>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="text-xs font-bold text-blue-900">活动提议</div>
                <p className="mt-2 text-sm leading-6 text-slate-800">{active.summary}</p>
              </div>
              {loadError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">{loadError} <button onClick={() => void sync()} className="ml-2 font-bold underline">重试</button></div>}
              <p className="text-xs leading-5 text-slate-600">开始后有 5 分钟整理方案；活动策划不扣游戏时间和行动点。</p>
              {actionError && <p className="text-sm text-red-700" role="alert">{actionError}</p>}
              <button type="button" onClick={() => void startPlanning()} disabled={action !== null || loading} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50">{action === 'start' ? '正在开始…' : '开始策划 · 5:00'}</button>
            </>
          )}

          {active.status === 'planning' && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div><div className="text-xs font-bold text-amber-900">剩余时间</div><div className="mt-1 text-[11px] text-amber-800">刷新或关闭页面不会暂停</div></div>
                <strong className="font-mono text-2xl tabular-nums text-amber-950" aria-live="off">{formatRemaining(remaining)}</strong>
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700">{isHospitality ? '邀约策略 / 方案' : '活动方案'}</span>
                <textarea
                  value={draft}
                  onChange={(event) => { draftRef.current = event.target.value; dirtyRef.current = true; setSaved(false); setDraft(event.target.value); }}
                  onBlur={() => { if (dirtyRef.current) void saveDraft(active.id); }}
                  disabled={!canEdit}
                  maxLength={12_000}
                  rows={9}
                  placeholder={isHospitality
                    ? '结合客户偏好，说明邀约目的、餐叙或小酌场合、地点与时间的备选安排、预算与礼貌边界、如何尊重对方选择，以及活动后的业务跟进；未确认事项写明商量方式。'
                    : '结合客户已表达的需求，描述活动目标、参与人员、议程或参观安排、准备材料以及活动后的跟进。未确认的时间和人员请写明拟议安排或确认方式。'}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                />
                <span className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{action === 'save' ? '正在保存草稿…' : saved ? '草稿已保存' : '草稿保存中…'}{active.status === 'planning' && ' · 每项最多 12,000 字'}</span><span>{draft.length}/12,000</span></span>
              </label>
              {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800" role="alert"><p>{actionError}</p><button type="button" onClick={() => void retryCurrent()} disabled={action !== null} className="mt-2 font-bold underline disabled:opacity-50">重试并同步状态</button></div>}
              <button type="button" onClick={() => void submitEarly()} disabled={action === 'start' || action === 'submit'} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50">{action === 'submit' ? '正在提交…' : '提交方案，进入情境问答'}</button>
            </>
          )}

          {answeringQuiz && quizQuestion && quiz && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div><div className="text-xs font-bold text-amber-900">情境推演限时 {formatQuizDuration(quiz.startedAt, quiz.deadlineAt)}</div><div className="mt-1 text-[11px] text-amber-800">刷新后继续剩余时间，按服务端截止时间结算</div></div>
                <strong className="font-mono text-2xl tabular-nums text-amber-950">{formatRemaining(quizRemaining)}</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>第 {quizQuestionIndexSafe + 1} / {quiz.questions.length} 题</span>
                <span>已选择 {quiz.questions.filter((question) => Boolean(quiz.answers[question.id])).length} / {quiz.questions.length} 题</span>
              </div>
              <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">以下均为情境假设，不代表客户真实表达。请选择你认为合适的应对方式；可跳过单题。</p>
              <fieldset disabled={action !== null || quizTimedOut || quizHasPendingAnswer} className="space-y-3 disabled:opacity-70">
                <legend className="mb-3 text-base font-bold leading-6 text-slate-900">{quizQuestion.title}</legend>
                {quizQuestion.options.map((option, index) => {
                  const selected = quizAnswer === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => void saveQuizAnswer(active.id, quizQuestion.id, option.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm leading-5 transition ${selected ? 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-100' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-500'}`}>{String.fromCharCode(65 + index)}</span>
                      <span>{option.text}</span>
                    </button>
                  );
                })}
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setQuizQuestionIndex((index) => Math.max(0, index - 1))} disabled={quizQuestionIndexSafe === 0 || action !== null || quizTimedOut || quizHasPendingAnswer} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">上一题</button>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={async () => {
                    const savedAnswer = await saveQuizAnswer(active.id, quizQuestion.id, null);
                    if (savedAnswer && quizQuestionIndexSafe < quiz.questions.length - 1) setQuizQuestionIndex(quizQuestionIndexSafe + 1);
                  }} disabled={action !== null || quizTimedOut || quizHasPendingAnswer} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">跳过本题</button>
                  {quizQuestionIndexSafe < quiz.questions.length - 1 ? (
                    <button type="button" onClick={() => setQuizQuestionIndex((index) => Math.min(quiz.questions.length - 1, index + 1))} disabled={!quizAnswerSaved || action !== null || quizTimedOut} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">下一题</button>
                  ) : (
                    <button type="button" onClick={() => void completeQuiz(active.id)} disabled={action !== null || quizTimedOut || quizCompletionPending || quizHasPendingAnswer} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{action === 'complete_quiz' ? '正在提交…' : '提交并查看结果'}</button>
                  )}
                </div>
              </div>
              {action === 'answer' && <p className="text-xs text-slate-500" role="status">正在保存选择…</p>}
              {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800" role="alert"><p>{actionError}</p><button type="button" onClick={() => void retryCurrent()} disabled={action !== null} className="mt-2 font-bold underline disabled:opacity-50">重试保存或提交</button></div>}
            </div>
          )}

          {active.status === 'submitted' && (showEvaluationSpinner || showEvaluationComplete) && (
            <>
              <CustomerActivityEvaluationStatus
                status={showEvaluationSpinner ? 'evaluating' : 'complete'}
                hasNext={queueCount > 0}
                onContinue={continueQueue}
              />
              {showEvaluationSpinner && !active.evaluation && action !== 'complete_quiz' && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  {actionError && <p className="text-xs text-red-700" role="alert">{actionError}</p>}
                  <button type="button" onClick={() => void sync()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{loading ? '正在同步…' : '重试同步评估状态'}</button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
