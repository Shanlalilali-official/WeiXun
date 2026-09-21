import { z } from 'zod';
import { invokeLLM, type ChatMessage } from '@/lib/ai/client';
import { parseAiJsonObject } from '@/lib/ai/json';
import { serializeUntrustedPromptData } from '@/lib/ai/prompt-data';
import { COMPETITOR_PROMPT } from '@/lib/ai/prompts/competitor';
import {
  COMPETITOR_TARGET_NPC_IDS,
  isCompetitorStageActionCandidate,
  type CompetitorStageActionCandidate,
  type GameRuntimeState,
} from '@/lib/game/state';
import { PROJECT_ONE_COMPETITORS, PROJECT_ONE_NPCS } from '@/lib/game/project-one';

const competitorStageCandidateSchema = z.object({
  round: z.number().int().min(1).max(5),
  targetNpcId: z.enum([
    'P1-001',
    'P1-002',
    'P1-003',
    'P1-004',
    'P1-005',
  ]),
  kind: z.enum(['relationship', 'price', 'case', 'executive']),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(320),
  pressureDelta: z.number().int().min(1).max(6),
}).strict();

export type CompetitorStageInvoker = (
  messages: ChatMessage[],
  options: {
    temperature: number;
    maxTokens: number;
    jsonMode: boolean;
    thinking: 'disabled';
  },
) => Promise<string>;

export interface CompetitorStageAiDecision {
  candidate?: CompetitorStageActionCandidate;
  source: 'model' | 'fallback' | 'cached' | 'existing';
  validationErrors: string[];
}

interface CachedDecision {
  expiresAt: number;
  decision: CompetitorStageAiDecision;
}

const CACHE_TTL_MS = 60_000;
const completedDecisions = new Map<string, CachedDecision>();
const inFlightDecisions = new Map<string, Promise<CompetitorStageAiDecision>>();

function defaultInvoker(messages: ChatMessage[], options: Parameters<CompetitorStageInvoker>[1]): Promise<string> {
  return invokeLLM(messages, options);
}

function decisionKey(sessionId: string, state: GameRuntimeState): string {
  return `${sessionId}:${state.scenarioCode}:${state.currentRound}`;
}

function cleanupExpiredDecisions(now = Date.now()): void {
  for (const [key, value] of completedDecisions) {
    if (value.expiresAt <= now) completedDecisions.delete(key);
  }
}

export function clearCompetitorStageDecisionCache(): void {
  completedDecisions.clear();
  inFlightDecisions.clear();
}

function buildStageContext(state: GameRuntimeState) {
  return {
    scenarioCode: state.scenarioCode,
    stage: state.currentRound,
    totalStages: state.maxRounds,
    companyId: state.companyId,
    competitorProfiles: PROJECT_ONE_COMPETITORS.map((competitor) => ({
      companyName: competitor.company_name,
      publicAdvantages: competitor.features,
      publicNotes: competitor.more_info,
    })),
    targetPeople: PROJECT_ONE_NPCS.map((npc) => ({
      id: npc.id,
      name: npc.name,
      title: npc.title,
      category: npc.category,
      publicConcern: npc.weakness,
      playerSignals: {
        publicResearchCompleted: Boolean(state.publicResearch[npc.id]),
        completedVisit: state.appointments.some((item) => item.npcId === npc.id && item.status === 'completed'),
        targetedMaterialUsed: state.preparations.some((item) => item.npcId === npc.id && item.usedCount > 0),
      },
    })),
    allowedTargetIds: COMPETITOR_TARGET_NPC_IDS,
  };
}

export function buildCompetitorStageMessages(state: GameRuntimeState): ChatMessage[] {
  const protocol = `
这是项目一单机五阶段的隐藏竞品阶段推演。模板中的旧轮数说明不适用，当前阶段以数据区块中的 stage 为准。
只返回一个 JSON 对象，不要 Markdown、解释或额外字段：
{
  "round": number,
  "targetNpcId": "P1-001|P1-002|P1-003|P1-004|P1-005",
  "kind": "relationship|price|case|executive",
  "title": "不超过120字的竞品动作标题",
  "summary": "不超过320字的竞品动作摘要",
  "pressureDelta": 1到6的整数
}
round 必须等于当前阶段；阶段允许的 kind 为：1=relationship，2=relationship/price，3=price/case，4=case/executive，5=price/case/executive。只描述竞品动作，不输出玩家、NPC支持度、竞品分数或其他隐藏数值。调研、已完成拜访和已使用材料只作为判断依据，是否对冲及实际 supportImpact 由服务端确定性计算。`;
  const basePrompt = COMPETITOR_PROMPT({ scenarioId: state.scenarioCode });
  return [
    { role: 'system', content: `${basePrompt}\n${protocol}` },
    {
      role: 'user',
      content: serializeUntrustedPromptData('competitor_stage_context', buildStageContext(state), {
        maxStringLength: 500,
        maxTotalLength: 12_000,
      }),
    },
  ];
}

function validateModelCandidate(raw: string, round: number): { candidate?: CompetitorStageActionCandidate; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = parseAiJsonObject(raw);
  } catch {
    return { errors: ['AI_JSON_OBJECT_INVALID'] };
  }
  const result = competitorStageCandidateSchema.safeParse(parsed);
  if (!result.success) return { errors: ['COMPETITOR_STAGE_SCHEMA_INVALID'] };
  if (!isCompetitorStageActionCandidate(result.data, round)) {
    return { errors: ['COMPETITOR_STAGE_RULE_INVALID'] };
  }
  return { candidate: result.data, errors: [] };
}

async function runDecision(
  state: GameRuntimeState,
  invoker: CompetitorStageInvoker,
): Promise<CompetitorStageAiDecision> {
  try {
    const raw = await invoker(buildCompetitorStageMessages(state), {
      temperature: 0,
      maxTokens: 500,
      jsonMode: true,
      thinking: 'disabled',
    });
    const validated = validateModelCandidate(raw, state.currentRound);
    if (validated.candidate) {
      return { candidate: validated.candidate, source: 'model', validationErrors: [] };
    }
    console.warn('Competitor stage AI fallback', { stage: state.currentRound, code: validated.errors[0] });
    return { source: 'fallback', validationErrors: validated.errors };
  } catch {
    console.warn('Competitor stage AI fallback', { stage: state.currentRound, code: 'AI_PROVIDER_FAILED' });
    return { source: 'fallback', validationErrors: ['AI_PROVIDER_FAILED'] };
  }
}

/**
 * Generate one hidden stage action for a solo game. The cache is keyed by
 * session + stage so retries and concurrent requests cannot generate two
 * different actions for one committed stage. A missing/invalid model result
 * deliberately returns no candidate, leaving the pure deterministic reducer
 * to apply its existing fallback template.
 */
export async function evaluateCompetitorStageAction(args: {
  sessionId: string;
  state: GameRuntimeState;
  invoker?: CompetitorStageInvoker;
}): Promise<CompetitorStageAiDecision> {
  const { sessionId, state, invoker = defaultInvoker } = args;
  if (state.gameMode !== 'solo') return { source: 'existing', validationErrors: ['MULTIPLAYER_DEFERRED'] };
  if (state.competitorState.actions.some((action) => action.round === state.currentRound)) {
    return { source: 'existing', validationErrors: [] };
  }

  cleanupExpiredDecisions();
  const key = decisionKey(sessionId, state);
  const cached = completedDecisions.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.decision, source: 'cached' };
  }
  const running = inFlightDecisions.get(key);
  if (running) {
    const decision = await running;
    return { ...decision, source: 'cached' };
  }

  const promise = runDecision(state, invoker);
  inFlightDecisions.set(key, promise);
  try {
    const decision = await promise;
    completedDecisions.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, decision });
    return decision;
  } finally {
    inFlightDecisions.delete(key);
  }
}
