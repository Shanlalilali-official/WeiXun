import { z } from 'zod';
import { invokeLLM } from '@/lib/ai/client';
import { parseAiJsonObject } from '@/lib/ai/json';
import { serializeUntrustedPromptData } from '@/lib/ai/prompt-data';
import { PROJECT_ONE_NPCS, PROJECT_ONE_PUBLIC_PROFILES, getProjectOneNpc } from '@/lib/game/project-one';
import { PROJECT_ONE_FIVE_PERSON_NPCS, PROJECT_ONE_FIVE_PERSON_IDS, type ProjectOneFivePersonId } from '@/lib/designer/project-one-five-person';

const planSchema = z.object({
  recommendations: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
});
const briefSchema = z.object({
  strengths: z.array(z.string().trim().min(1).max(300)).max(4),
  risks: z.array(z.string().trim().min(1).max(300)).max(4),
  nextStep: z.string().trim().min(1).max(300),
});
export type FormalPlanEvaluation = { recommendations: string[]; disclosures: Array<{ npcId: string; facts: string[]; clues: string[] }> };
export type FormalBriefVisitEvaluation = z.infer<typeof briefSchema>;

function publicPeople(scope: 'global' | 'npc', npcId?: string) {
  const ids = scope === 'npc' && npcId ? [npcId] : PROJECT_ONE_NPCS.map((npc) => npc.id);
  return ids.flatMap((id) => {
    const npc = getProjectOneNpc(id);
    const profile = PROJECT_ONE_PUBLIC_PROFILES[id];
    return npc && profile ? [{ id, name: npc.name, title: npc.title, publicFacts: profile.facts.slice(0, 2) }] : [];
  });
}

/** Mirrors the preview's server whitelist: only keyword-matched master facts/clues may be revealed. */
function matchedPlanDisclosures(scope: 'global' | 'npc', npcId: string | undefined, content: string): FormalPlanEvaluation['disclosures'] {
  const normalized = content.toLowerCase();
  const ids: readonly ProjectOneFivePersonId[] = scope === 'npc' && npcId && npcId in PROJECT_ONE_FIVE_PERSON_NPCS
    ? [npcId as ProjectOneFivePersonId]
    : PROJECT_ONE_FIVE_PERSON_IDS;
  return ids.flatMap((id) => {
    const npc = PROJECT_ONE_FIVE_PERSON_NPCS[id];
    const facts = npc.facts.filter((_, index) => (npc.factKeywords[index] ?? npc.clueKeywords).some((keyword) => normalized.includes(keyword.toLowerCase()))).slice(0, 2);
    const clues = npc.clues.filter(() => npc.clueKeywords.some((keyword) => normalized.includes(keyword.toLowerCase()))).slice(0, 2);
    return facts.length || clues.length ? [{ npcId: id, facts: [...facts], clues: [...clues] }] : [];
  });
}

/** Real-AI planner, constrained to public project-one facts and bounded output. */
export async function evaluateFormalWorkPlan(args: { scope: 'global' | 'npc'; npcId?: string; content: string }): Promise<FormalPlanEvaluation> {
  const people = publicPeople(args.scope, args.npcId);
  const raw = await invokeLLM([
    { role: 'system', content: '你是销售训练中的工作计划教练。仅依据给定公开人物资料，给出可执行建议。不得判断或透露客户支持度、内部关系分、竞争对手后台信息，也不得编造事实。严格输出JSON：{recommendations:string[]}。' },
    { role: 'user', content: serializeUntrustedPromptData('formal_work_plan', { plan: args.content, scope: args.scope, people }, { maxStringLength: 4_000, maxTotalLength: 12_000 }) },
  ], { temperature: 0.2, maxTokens: 900, jsonMode: true });
  const parsed = planSchema.parse(parseAiJsonObject(raw));
  return {
    recommendations: parsed.recommendations,
    disclosures: matchedPlanDisclosures(args.scope, args.npcId, args.content),
  };
}

/** This evaluates a proposed visit; it never starts or completes a meeting. */
export async function evaluateFormalBriefVisit(args: { npcId: string; content: string }): Promise<FormalBriefVisitEvaluation> {
  const npc = getProjectOneNpc(args.npcId);
  const profile = PROJECT_ONE_PUBLIC_PROFILES[args.npcId];
  if (!npc || !profile) throw new Error('NPC_UNKNOWN');
  const raw = await invokeLLM([
    { role: 'system', content: '你是销售拜访方案教练。评估玩家的拜访简述，只输出方案优点、风险和下一步；这不是实际会面，不能声称客户已经同意、已拜访、已完成任务，也不得评价或透露支持度。严格输出JSON：{strengths:string[],risks:string[],nextStep:string}。' },
    { role: 'user', content: serializeUntrustedPromptData('formal_brief_visit', { npc: { id: npc.id, name: npc.name, title: npc.title, publicFacts: profile.facts.slice(0, 2) }, brief: args.content }, { maxStringLength: 4_000, maxTotalLength: 8_000 }) },
  ], { temperature: 0.2, maxTokens: 800, jsonMode: true });
  return briefSchema.parse(parseAiJsonObject(raw));
}
