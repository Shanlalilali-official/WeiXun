import { invokeLLM, type ChatMessage } from '@/lib/ai/client';
import { npcTurnEvaluationSchema, type NpcTurnEvaluation } from '@/lib/contracts/ai';

export interface NpcEvaluationContext {
  npcId: string;
  npcName: string;
  npcTitle: string;
  affinity: number;
  round: number;
  playerMessage: string;
  npcReply: string;
  recentConversation: Array<{ role: 'user' | 'assistant'; content: string }>;
  confirmedFacts: string[];
  commitments: string[];
}

export interface NpcEvaluationResult {
  evaluation: NpcTurnEvaluation;
  source: 'model' | 'retry' | 'fallback';
}

const evaluatorSystemPrompt = `你是销售谈判游戏的独立评分器，不扮演NPC，不续写对话。
根据玩家本轮输入、NPC实际回复、人物状态和最近对话，只输出一个JSON对象。

评分规则：
- affinityDelta为-8到8整数。具体、可信、回应NPC问题通常为+1到+4；提供证据或明确可执行安排可到+5；空泛重复通常为0；回避问题、强行承诺、冒犯或违规利益输送为负分。
- affinityReason用不超过120字说明本轮为什么增减或为0，必须对应实际对话。
- 五个dimensionDeltas均为-3到3整数，分别评估决策分析、关系建设、价值呈现、异议处理、信息发现。
- cluesUnlocked最多2项，只能是decision_process/performance_goal/procurement_priority/personal_interest，且必须由NPC实际回复明确披露。
- confirmedFacts最多2项，只记录本轮NPC明确确认、可复述的业务事实；不得记录玩家单方面主张。
- commitments最多2项，只记录NPC本人在实际回复中明确作出的后续承诺。
- handoff仅当NPC实际回复明确说要向具体人物汇报/转告时填写，否则为null。
- emotion只能是greeting/thinking/excited/annoyed。

固定人物ID：p1-frontline-wang-hao、p1-procurement-liu-kai、p1-minister-chen-jianguo、p1-deputy-zhao-feng。
必须包含：affinityDelta、affinityReason、dimensionDeltas、cluesUnlocked、confirmedFacts、commitments、handoff、emotion。`;

function parseEvaluation(raw: string): NpcTurnEvaluation | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = npcTurnEvaluationSchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function scoringInput(ctx: NpcEvaluationContext): string {
  return JSON.stringify({
    npc: { id: ctx.npcId, name: ctx.npcName, title: ctx.npcTitle },
    currentAffinity: ctx.affinity,
    round: ctx.round,
    confirmedFacts: ctx.confirmedFacts,
    commitments: ctx.commitments,
    recentConversation: ctx.recentConversation.slice(-8),
    playerMessage: ctx.playerMessage,
    npcActualReply: ctx.npcReply,
  });
}

export function createFallbackNpcEvaluation(ctx: NpcEvaluationContext): NpcTurnEvaluation {
  const player = ctx.playerMessage.trim();
  const reply = ctx.npcReply.trim();
  const risky = /红包|回扣|打点|搞定领导|保证中标|绝对没问题|肯定能中标/;
  const evidence = /案例|数据|材料|认证|报告|清单|方案|计划|预算|时间表|负责人|测试|演示|交付|对接/;
  const vague = player.length < 8 || /^(好的|收到|明白|可以|行|嗯|谢谢)[！!。.？?]*$/.test(player);
  const rejection = /没说清|太空|空话|不接受|别绕|不行|没有回答|还不够/;

  let affinityDelta = 1;
  let affinityReason = '保持了有效沟通，关系小幅推进';
  if (risky.test(player)) {
    affinityDelta = -3;
    affinityReason = '提出违规或不可信的推进方式，损害客户信任';
  } else if (rejection.test(reply)) {
    affinityDelta = -1;
    affinityReason = '本轮没有充分回应客户问题，引发明确质疑';
  } else if (vague) {
    affinityDelta = 0;
    affinityReason = '回复信息量不足，尚未形成新的信任增量';
  } else if (evidence.test(player)) {
    affinityDelta = 2;
    affinityReason = '提供了具体信息或可执行材料，提升了沟通可信度';
  }

  const dimensionDeltas = {
    decisionAnalysis: /决策|审批|流程|拍板|评审|负责人/.test(player) ? 1 : 0,
    relationshipBuilding: affinityDelta > 0 ? 1 : affinityDelta < 0 ? -1 : 0,
    valuePresentation: /价值|收益|成本|效率|案例|数据|方案/.test(player) ? 1 : 0,
    objectionHandling: /针对|关于|您提到|对接|国产化|价格|风险/.test(player) ? 1 : 0,
    informationDiscovery: /谁|什么|如何|怎么|是否|流程|预算|需求|重点/.test(player) ? 1 : 0,
  };

  const cluesUnlocked: NpcTurnEvaluation['cluesUnlocked'] = [];
  if (/审批|决策链|拍板|评审流程/.test(reply)) cluesUnlocked.push('decision_process');
  if (cluesUnlocked.length < 2 && /采购|预算|价格|招标/.test(reply)) cluesUnlocked.push('procurement_priority');
  if (cluesUnlocked.length < 2 && /绩效|政绩|成果目标/.test(reply)) cluesUnlocked.push('performance_goal');

  const names: Array<[string, NonNullable<NpcTurnEvaluation['handoff']>['targetNpcId']]> = [
    ['王浩', 'p1-frontline-wang-hao'],
    ['刘凯', 'p1-procurement-liu-kai'],
    ['陈建国', 'p1-minister-chen-jianguo'],
    ['赵峰', 'p1-deputy-zhao-feng'],
  ];
  const target = names.find(([name]) => reply.includes(name));
  const handoff = target && /汇报|上报|转告|转达/.test(reply)
    ? { targetNpcId: target[1], summary: reply.slice(0, 180) }
    : null;

  return {
    affinityDelta,
    affinityReason,
    dimensionDeltas,
    cluesUnlocked,
    confirmedFacts: [],
    commitments: [],
    handoff,
    emotion: risky.test(player) || rejection.test(reply) ? 'annoyed' : affinityDelta >= 2 ? 'excited' : 'thinking',
  };
}

export async function evaluateNpcTurn(ctx: NpcEvaluationContext): Promise<NpcEvaluationResult> {
  const input = scoringInput(ctx);
  const baseMessages: ChatMessage[] = [
    { role: 'system', content: evaluatorSystemPrompt },
    { role: 'user', content: input },
  ];
  let previousOutput = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages = attempt === 0 || !previousOutput
      ? baseMessages
      : [
          ...baseMessages,
          { role: 'assistant' as const, content: previousOutput.slice(0, 3000) },
          { role: 'user' as const, content: '上一个JSON未通过schema校验。请重新输出完整、合法且字段齐全的JSON对象，不要解释。' },
        ];
    try {
      const output = await invokeLLM(messages, {
        temperature: attempt === 0 ? 0.1 : 0,
        maxTokens: 900,
        jsonMode: true,
        thinking: 'disabled',
      });
      previousOutput = output;
      const parsed = parseEvaluation(output);
      if (parsed) return { evaluation: parsed, source: attempt === 0 ? 'model' : 'retry' };
    } catch {
      // 网络或供应商错误也会进入下一次尝试。
    }
  }

  // 评分失败不能吞掉已成功生成的NPC正文，交给确定性规则兜底。
  return { evaluation: createFallbackNpcEvaluation(ctx), source: 'fallback' };
}
