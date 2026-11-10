import type { ChatMessage, InvokeOptions } from '@/lib/ai/client';
import { resolveRuntimeRulePrompt } from '@/lib/ai/runtime-rule-prompts';
import { z } from 'zod';

export type SystemEvaluationMetricKey =
  | 'role_consistency'
  | 'naturalness'
  | 'state_consistency'
  | 'boundary';

export interface SystemEvaluationRound {
  round: number;
  salesMessage: string;
  npcResponse: string | null;
  responseAction?: 'reply' | 'read_no_reply';
  beforeState: unknown;
  afterState: unknown;
  generationRequests: Array<{
    messages: ChatMessage[];
    options?: InvokeOptions;
    rawResponse: string;
  }>;
}

export interface SystemEvaluationJudgeInput {
  npcName: string;
  expectation: string;
  threshold: number;
  rounds: SystemEvaluationRound[];
  initialState: unknown;
  finalState: unknown;
  history: unknown;
}

export interface SystemEvaluationJudgeResultMetric {
  key: SystemEvaluationMetricKey;
  name: string;
  score: number | null;
  reason: string;
  passed: boolean;
  error?: string;
}

export interface SystemEvaluationJudgeResult {
  engine: 'deepeval';
  metrics: SystemEvaluationJudgeResultMetric[];
  passed: boolean;
  total100: number | null;
}

export interface SystemEvaluationJudgeDependencies {
  invoker?: (messages: ChatMessage[], options?: InvokeOptions) => Promise<string>;
  modelName?: string;
}

const METRIC_DEFINITIONS: Array<{ key: SystemEvaluationMetricKey; name: string }> = [
  { key: 'role_consistency', name: 'NPC角色一致性' },
  { key: 'naturalness', name: '商务对话自然性' },
  { key: 'state_consistency', name: '跨轮状态与记忆一致性' },
  { key: 'boundary', name: '信息与承诺边界' },
];

const MAX_SCENARIO_CHARS = 200_000;

function jsonForJudge(value: unknown): { scenario?: string; error?: string } {
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized === undefined) {
      return { error: '评测上下文无法序列化，未发送给评委。' };
    }
    if (serialized.length > MAX_SCENARIO_CHARS) {
      return {
        error: `完整评测上下文共${serialized.length}个字符，超过${MAX_SCENARIO_CHARS}字符上限。请缩短轮次或历史后重试；本次未截断上下文，也未评分。`,
      };
    }
    return { scenario: serialized };
  } catch {
    return { error: '评测上下文包含无法序列化的数据，未发送给评委。' };
  }
}

function makeScenario(input: SystemEvaluationJudgeInput): { scenario?: string; error?: string } {
  const generationMessageRegistry = new Map<string, string>();
  const generationMessageReferences = new Map<string, string>();
  const registerGenerationMessage = (content: string): string => {
    const existingReference = generationMessageReferences.get(content);
    if (existingReference) return existingReference;
    const reference = `generation-message-${generationMessageRegistry.size + 1}`;
    generationMessageRegistry.set(reference, content);
    generationMessageReferences.set(content, reference);
    return reference;
  };
  const rounds = input.rounds.map((round) => ({
    round: round.round,
    beforeState: round.beforeState,
    salesMessage: round.salesMessage,
    npcResponse: round.npcResponse,
    responseAction: round.responseAction,
    afterState: round.afterState,
    // These are the exact messages used by the live preview AI call, including
    // the composed system prompt and rolling history. Repeated message strings
    // are retained once in the registry below and referenced by each request.
    actualGenerationRequests: round.generationRequests.map((request) => ({
      messages: request.messages.map((message) => ({
        role: message.role,
        contentReference: registerGenerationMessage(message.content),
      })),
      options: request.options,
      rawResponse: request.rawResponse,
    })),
  }));
  const context = {
    npcName: input.npcName,
    initialRuntimeState: input.initialState,
    finalRuntimeState: input.finalState,
    existingConversationHistory: input.history,
    actualGenerationMessageRegistry: Object.fromEntries(generationMessageRegistry),
    rounds,
    familiarityGuidance: '应用没有独立熟悉度等级字段。不得从支持度推断熟悉度；仅可依据有效接触次数和实际对话历史中明示的关系证据。',
    readNoReplyGuidance: '若 NPC 在某轮已读但未回复，assistant 轮是系统事件说明，不是NPC说出的台词。',
  };
  return jsonForJudge(context);
}

function notEvaluableResult(reason: string): SystemEvaluationJudgeResult {
  return {
    engine: 'deepeval',
    passed: false,
    total100: null,
    metrics: METRIC_DEFINITIONS.map(({ key, name }) => ({
      key,
      name,
      score: null,
      reason,
      passed: false,
      error: reason,
    })),
  };
}

function readResponseAction(round: SystemEvaluationRound): 'reply' | 'read_no_reply' | undefined {
  if (round.responseAction === 'reply' || round.responseAction === 'read_no_reply') {
    return round.responseAction;
  }
  return undefined;
}

export async function judgeSystemEvaluation(
  input: SystemEvaluationJudgeInput,
  deps: SystemEvaluationJudgeDependencies = {},
): Promise<SystemEvaluationJudgeResult> {
  const scorableRounds = input.rounds.filter((round) => (
    (typeof round.npcResponse === 'string' && round.npcResponse.trim().length > 0)
    || readResponseAction(round) === 'read_no_reply'
  ));
  if (scorableRounds.length === 0) {
    return notEvaluableResult('评测中没有可评分的NPC回复或已读未回复事件，未判为通过。');
  }
  if (!Number.isFinite(input.threshold) || input.threshold < 0 || input.threshold > 1) {
    return notEvaluableResult('评测阈值必须是0到1之间的有限数值。');
  }
  const missingActualRequests = scorableRounds.some((round) => (
    round.generationRequests.length === 0
    || round.generationRequests.some((request) => request.messages.length === 0)
  ));
  if (missingActualRequests) {
    return notEvaluableResult('至少一轮缺少实际NPC生成请求或消息，无法确认评委使用了真实提示词和上下文。');
  }
  const scenarioResult = makeScenario(input);
  if (!scenarioResult.scenario) {
    return notEvaluableResult(scenarioResult.error || '评测上下文不可用，未发送给评委。');
  }

  // DeepEval's TypeScript package reads telemetry configuration during import.
  // Scoring stays on this server and never uses the Confident AI evaluation API.
  process.env.DEEPEVAL_TELEMETRY_OPT_OUT = 'true';
  let deepevalModules: Awaited<ReturnType<typeof loadDeepEvalModules>>;
  try {
    deepevalModules = await loadDeepEvalModules();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepEval模块加载失败。';
    return notEvaluableResult(`DeepEval初始化失败：${message}`);
  }
  const { ConversationalGEval, ConversationalTestCase, MultiTurnParams, Turn, DeepEvalBaseLLM } = deepevalModules;

  const invoke = deps.invoker ?? (await import('@/lib/ai/client')).invokeLLM;
  const requestedModel = deps.modelName?.trim() || '当前AI服务端已配置模型';
  const [judgeRules, metricRules] = await Promise.all([
    resolveRuntimeRulePrompt('system_evaluation_judge'),
    Promise.all(METRIC_DEFINITIONS.map(({ key }) => resolveRuntimeRulePrompt(`system_evaluation_${key}`))),
  ]);

  class AppAiJudgeModel extends DeepEvalBaseLLM {
    constructor() {
      super(requestedModel);
    }

    getModelName(): string {
      return `${requestedModel}（SellSmart统一AI Provider）`;
    }

    async generate<T = string>(prompt: string, schema?: import('zod').ZodType<T>): Promise<{ output: T; cost: number | null }> {
      const outputSchema = schema ? z.toJSONSchema(schema) : null;
      const response = await invoke([
        {
          role: 'system',
          content: judgeRules,
        },
        {
          role: 'user',
          content: outputSchema
            ? `${prompt}\n\n输出必须符合以下JSON Schema，字段及类型不得增删：\n${JSON.stringify(outputSchema)}`
            : prompt,
        },
      ], {
        temperature: 0,
        jsonMode: Boolean(schema),
        thinking: 'disabled',
      });

      if (!schema) return { output: response as T, cost: null };
      let decoded: unknown;
      try {
        decoded = JSON.parse(response);
      } catch (error) {
        throw new Error(`评委模型未返回有效JSON：${error instanceof Error ? error.message : 'JSON解析失败'}`);
      }
      return { output: schema.parse(decoded), cost: null };
    }
  }

  const turns = scorableRounds.flatMap((round) => {
    const npcContent = typeof round.npcResponse === 'string'
      ? round.npcResponse
      : '【系统事件：NPC已读但未回复。这不是NPC说出的台词。】';
    return [
      new Turn({ role: 'user', content: round.salesMessage }),
      new Turn({ role: 'assistant', content: npcContent }),
    ];
  });
  const testCase = new ConversationalTestCase({
    turns,
    scenario: scenarioResult.scenario,
    expectedOutcome: input.expectation,
    chatbotRole: `${input.npcName}（只评估此NPC，不评价销售）`,
  });
  const model = new AppAiJudgeModel();
  const metrics: SystemEvaluationJudgeResultMetric[] = [];

  for (const [index, definition] of METRIC_DEFINITIONS.entries()) {
    try {
      const [criteria, ...evaluationSteps] = metricRules[index].split('\n').map((line) => line.trim()).filter(Boolean);
      const metric = new ConversationalGEval({
        name: definition.name,
        criteria,
        evaluationSteps,
        evaluationParams: [
          MultiTurnParams.SCENARIO,
          MultiTurnParams.EXPECTED_OUTCOME,
          MultiTurnParams.CONTENT,
          MultiTurnParams.ROLE,
        ],
        threshold: input.threshold,
        model,
        showIndicator: false,
      });
      const score = await metric.measure(testCase);
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        throw new Error(`DeepEval返回了范围外的分数：${String(score)}`);
      }
      metrics.push({
        key: definition.key,
        name: definition.name,
        score,
        reason: metric.reason || '评委没有返回理由。',
        passed: score >= input.threshold,
      });
    } catch (error) {
      metrics.push({
        key: definition.key,
        name: definition.name,
        score: null,
        reason: error instanceof Error ? error.message : '评委评分失败。',
        passed: false,
        error: error instanceof Error ? error.message : 'DEEP_EVAL_METRIC_FAILED',
      });
    }
  }

  const metricFailure = metrics.some((metric) => metric.error || metric.score === null);
  const scores = metrics.flatMap((metric) => (metric.score === null ? [] : [metric.score]));
  return {
    engine: 'deepeval',
    metrics,
    passed: !metricFailure && metrics.length === METRIC_DEFINITIONS.length && metrics.every((metric) => metric.passed),
    total100: metricFailure || scores.length !== METRIC_DEFINITIONS.length
      ? null
      : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 1000) / 10,
  };
}

export const systemEvaluationJudgeMetricKeys = METRIC_DEFINITIONS.map(({ key }) => key);

async function loadDeepEvalModules() {
  const [{ ConversationalGEval }, { ConversationalTestCase, MultiTurnParams, Turn }, { DeepEvalBaseLLM }] = await Promise.all([
    import('deepeval/metrics'),
    import('deepeval/test-case'),
    import('deepeval/models'),
  ]);
  return { ConversationalGEval, ConversationalTestCase, MultiTurnParams, Turn, DeepEvalBaseLLM };
}
