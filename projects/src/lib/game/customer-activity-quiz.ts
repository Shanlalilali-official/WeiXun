import { z } from 'zod';
import type { CustomerActivityType } from './customer-activities';
import {
  resolveActivityExecutionConfig,
  type ActivityExecutionConfig,
  type ActivityQuestion,
} from './customer-activity-execution-config';

export const CUSTOMER_ACTIVITY_QUIZ_MS = 120_000;

const quizOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(320),
  supportDelta: z.number().int().min(-5).max(4),
  pleasureDelta: z.number().int().min(-8).max(6),
}).strict();

const quizQuestionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(600),
  options: z.array(quizOptionSchema).length(4),
}).strict().superRefine((question, context) => {
  if (new Set(question.options.map(({ id }) => id)).size !== question.options.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'quiz option IDs must be unique' });
  }
});

export const customerActivityQuizSchema = z.object({
  version: z.literal(1),
  status: z.enum(['answering', 'completed']),
  startedAt: z.number().int().nonnegative(),
  deadlineAt: z.number().int().nonnegative(),
  questions: z.array(quizQuestionSchema).length(3),
  answers: z.record(z.string(), z.string().nullable()),
  completedAt: z.number().int().nonnegative().optional(),
}).strict().superRefine((quiz, context) => {
  const duration = quiz.deadlineAt - quiz.startedAt;
  if (duration < 30_000 || duration > 600_000 || duration % 1_000 !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deadlineAt'], message: 'quiz deadline must be 30 to 600 whole seconds after it starts' });
  }
  const ids = quiz.questions.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['questions'], message: 'quiz question IDs must be unique' });
  }
  if (Object.keys(quiz.answers).length !== ids.length || ids.some((id) => !(id in quiz.answers))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['answers'], message: 'quiz answers must match the question snapshot' });
  }
  for (const [index, question] of quiz.questions.entries()) {
    const answer = quiz.answers[question.id];
    if (answer !== null && answer !== undefined && !question.options.some((option) => option.id === answer)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['answers', question.id], message: 'answer must match a snapshotted option' });
    }
    if (answer === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['answers', question.id], message: `missing answer for question ${index + 1}` });
    }
  }
  if ((quiz.status === 'answering') !== (quiz.completedAt === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['completedAt'], message: 'completion timestamp must match quiz status' });
  }
  if (quiz.completedAt !== undefined && quiz.completedAt < quiz.startedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['completedAt'], message: 'quiz cannot complete before it starts' });
  }
});

const publicQuizOptionSchema = quizOptionSchema.pick({ id: true, text: true });
const publicQuizQuestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  options: z.array(publicQuizOptionSchema).length(4),
}).strict();

/** Browser-safe quiz contract. Scoring metadata is deliberately absent. */
export const publicCustomerActivityQuizSchema = z.object({
  version: z.literal(1),
  status: z.enum(['answering', 'completed']),
  startedAt: z.number().int().nonnegative(),
  deadlineAt: z.number().int().nonnegative(),
  questions: z.array(publicQuizQuestionSchema).length(3),
  answers: z.record(z.string(), z.string().nullable()),
  completedAt: z.number().int().nonnegative().optional(),
}).strict();

export type CustomerActivityQuiz = z.infer<typeof customerActivityQuizSchema>;
export type PublicCustomerActivityQuiz = z.infer<typeof publicCustomerActivityQuizSchema>;

type QuizOptionInput = ActivityQuestion['options'][number];
type QuizQuestionInput = ActivityQuestion;

function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (const character of seedText) {
    seed ^= character.codePointAt(0) ?? 0;
    seed = Math.imul(seed, 16777619);
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffledOptions(question: QuizQuestionInput, seedText: string): QuizOptionInput[] {
  const random = seededRandom(`${seedText}:${question.id}`);
  const shuffled = [...question.options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function createCustomerActivityQuiz(
  type: CustomerActivityType,
  startedAt: number,
  draft = '',
  taskSeed = '',
  executionInput?: ActivityExecutionConfig,
): CustomerActivityQuiz {
  const execution = resolveActivityExecutionConfig(executionInput);
  const timestamp = Math.floor(startedAt);
  const usesNonAlcoholPlan = type === 'hospitality'
    && /不(?:喝|飲|饮)酒|无酒精|無酒精|不谈工作|不談工作|不聊工作|不谈项目|不談項目|不聊项目|不聊項目/u.test(draft);
  const bank = execution.questionBanks[type].map((question, index) => {
    const selected = usesNonAlcoholPlan && index === 1 && execution.hospitalityNonAlcoholQuestion
      ? execution.hospitalityNonAlcoholQuestion
      : question;
    return { ...selected, options: shuffledOptions(selected, `${type}:${timestamp}:${taskSeed}`) };
  });
  return customerActivityQuizSchema.parse({
    version: 1,
    status: 'answering',
    startedAt: timestamp,
    deadlineAt: timestamp + execution.quizDurationSeconds * 1_000,
    questions: bank,
    answers: Object.fromEntries(bank.map(({ id }) => [id, null])),
  });
}

export function saveCustomerActivityQuizSnapshotAnswer(
  quizInput: CustomerActivityQuiz,
  questionId: string,
  optionId: string | null,
  serverNow: number,
): { quiz: CustomerActivityQuiz; accepted: boolean } {
  const quiz = customerActivityQuizSchema.parse(quizInput);
  if (!Number.isFinite(serverNow) || serverNow < 0 || quiz.status !== 'answering' || serverNow >= quiz.deadlineAt) {
    return { quiz, accepted: false };
  }
  const question = quiz.questions.find((item) => item.id === questionId);
  if (!question || (optionId !== null && !question.options.some((option) => option.id === optionId))) {
    return { quiz, accepted: false };
  }
  return {
    quiz: customerActivityQuizSchema.parse({ ...quiz, answers: { ...quiz.answers, [questionId]: optionId } }),
    accepted: true,
  };
}

export function completeCustomerActivityQuizSnapshot(quizInput: CustomerActivityQuiz, completedAt: number): CustomerActivityQuiz {
  const quiz = customerActivityQuizSchema.parse(quizInput);
  if (quiz.status === 'completed') return quiz;
  const timestamp = Math.max(quiz.startedAt, Math.min(Math.floor(completedAt), quiz.deadlineAt));
  return customerActivityQuizSchema.parse({
    ...quiz,
    status: 'completed',
    answers: Object.fromEntries(quiz.questions.map(({ id }) => [id, quiz.answers[id] ?? null])),
    completedAt: timestamp,
  });
}

export function sumCustomerActivityQuizDeltas(quizInput: CustomerActivityQuiz): { supportDelta: number; pleasureDelta: number } {
  const quiz = customerActivityQuizSchema.parse(quizInput);
  return quiz.questions.reduce((total, question) => {
    const answer = quiz.answers[question.id];
    const option = question.options.find((candidate) => candidate.id === answer);
    if (!option) return total;
    return {
      supportDelta: total.supportDelta + option.supportDelta,
      pleasureDelta: total.pleasureDelta + option.pleasureDelta,
    };
  }, { supportDelta: 0, pleasureDelta: 0 });
}

export function toPublicCustomerActivityQuiz(quizInput: CustomerActivityQuiz): PublicCustomerActivityQuiz {
  const quiz = customerActivityQuizSchema.parse(quizInput);
  return publicCustomerActivityQuizSchema.parse({
    version: quiz.version,
    status: quiz.status,
    startedAt: quiz.startedAt,
    deadlineAt: quiz.deadlineAt,
    questions: quiz.questions.map(({ id, title, options: choices }) => ({
      id,
      title,
      options: choices.map(({ id: optionId, text }) => ({ id: optionId, text })),
    })),
    answers: quiz.answers,
    ...(quiz.completedAt === undefined ? {} : { completedAt: quiz.completedAt }),
  });
}
