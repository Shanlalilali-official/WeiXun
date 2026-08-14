import { invokeLLM, type ChatMessage } from '@/lib/ai/client';
import {
  giftCommandDecisionSchema,
  npcTurnEvaluationSchema,
  onlineContactDecisionSchema,
  type GiftCommandDecision,
  type NpcTurnEvaluation,
  type OnlineContactDecision,
} from '@/lib/contracts/ai';

export interface NpcEvaluationContext {
  npcId: string;
  npcName: string;
  npcTitle: string;
  affinity: number;
  pleasure?: number;
  support?: number;
  npcPersonality?: string;
  npcCategory?: string;
  npcConcern?: string;
  round: number;
  phaseName?: string;
  channel?: 'email' | 'work_phone' | 'online' | 'offline';
  meetingType?: 'short_visit' | 'formal_visit' | 'informal_visit';
  workTopicOpenedBy?: 'none' | 'player' | 'npc';
  giftContext?: {
    giftType: 'none' | 'compliant' | 'boundary';
    description?: string;
    isPublic?: boolean;
    witnesses?: string[];
    priorBoundaryGiftCount?: number;
  };
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

export interface GiftDecisionContext {
  commandId: string;
  npcId: string;
  npcName: string;
  npcTitle: string;
  npcCategory: string;
  npcPersonality: string;
  npcConcern: string;
  complianceSensitivity: number;
  giftPreference: number;
  pleasure: number;
  support: number;
  attitudeHistory: Array<{ reason: string; source: string; pleasantnessDelta: number; supportDelta: number }>;
  giftType: 'compliant' | 'boundary';
  giftDescription: string;
  setting: 'public' | 'private';
  witnesses: string[];
  priorBoundaryGiftCount: number;
  round: number;
  phaseName: string;
  meetingType: 'short' | 'formal' | 'informal';
  venue: string;
  procurementSensitive: boolean;
  exchangeRequested: boolean;
}

export interface GiftDecisionResult {
  decision: GiftCommandDecision;
  source: 'model' | 'retry' | 'fallback' | 'policy';
}

const evaluatorSystemPrompt = `你是销售谈判游戏的独立评分器，不扮演NPC，不续写对话。
根据玩家本轮输入、NPC实际回复、人物状态和最近对话，只输出一个JSON对象。

态度判断：
- pleasureDelta表示即时愉悦/沟通体验，supportDelta表示长期项目支持。不要套固定话术分值；必须综合人物性格、职位、关注点、阶段、场合、既有关系、措辞、可信度、重复施压和NPC实际反应进行人物化判断。
- affinityDelta是旧系统兼容字段，必须与supportDelta完全相同。affinityReason用不超过120字解释即时与长期变化，必须对应实际对话。
- 普通互动建议范围：pleasureDelta -8到6、supportDelta -5到4。合规伴手礼范围更窄：pleasureDelta -3到4、supportDelta -2到2。高波动边界礼品可有更高收益和更大损失：pleasureDelta -12到12、supportDelta -10到7。
- 现金、红包、回扣、好处费、打点、保证中标、以礼品换支持/信息等明确利益交换不属于可博弈的边界礼品，pleasureDelta和supportDelta必须显著为负，不得给出任何正收益或个人收益证据。
- 同类话术、送礼或施压反复出现时收益递减；不要因为NPC暂时客气就判断为支持。

语义与证据：
- semanticFlags必须区分负面信息、无依据传闻、风险行为、礼品、明确利益交换和重复施压。negativeInformationType只能是none/sourced_risk/generalized_pessimism/unsupported_rumor/insult_or_attack。
- publicValueEvidence最多3项，只能记录NPC实际认可或材料已证明的组织价值，如合规、风险、回报、落地和组织绩效。personalBenefitEvidence最多3项，只能记录NPC实际认可的减负、职业安全、绩效、专业声誉或成长；礼品和违规利益绝不能算个人收益。
- workTopicOpenedBy只能是none/player/npc。非正式拜访默认不谈工作；结合历史状态、本轮玩家输入和NPC回复判断是谁首次开启工作话题。NPC可以自然开启，但不能把玩家强行提项目误记为NPC开启。
- giftAssessment必须判断giftType（none/compliant/boundary）、outcome和riskLevel。高波动礼品可能被愉快接受、谨慎接受、婉拒、明确拒绝、拒绝并上报或接受后暴露；必须符合NPC实际回复。没有礼品时使用not_applicable和none风险。

既有游戏字段：
- 五个dimensionDeltas均为-3到3整数，分别评估决策分析、关系建设、价值呈现、异议处理、信息发现。
- cluesUnlocked最多2项，只能是decision_process/performance_goal/procurement_priority/personal_interest，且必须由NPC实际回复明确披露。
- confirmedFacts最多2项，只记录本轮NPC明确确认、可复述的业务事实；不得记录玩家单方面主张。
- commitments最多2项，只记录NPC本人在实际回复中明确作出的后续承诺。
- handoff仅当NPC实际回复明确说要向具体人物汇报/转告时填写，否则为null。
- emotion只能是greeting/thinking/excited/annoyed。

固定人物ID：p1-frontline-wang-hao、p1-procurement-liu-kai、p1-minister-chen-jianguo、p1-deputy-zhao-feng。
必须包含：affinityDelta、affinityReason、pleasureDelta、supportDelta、dimensionDeltas、cluesUnlocked、confirmedFacts、commitments、publicValueEvidence、personalBenefitEvidence、workTopicOpenedBy、semanticFlags、giftAssessment、handoff、emotion。`;

const giftDecisionSystemPrompt = `你是政企销售模拟游戏的礼品边界判断器。结合人物职位、性格、真实关注点、合规敏感度、当前关系、场合、时机、见证人、历史送礼和礼品内容，判断NPC当场反应。只输出JSON。

规则：
- 合规伴手礼是低价值、公开且商务合理的礼品，收益小而稳定；愉悦变化只能-3到4，支持变化只能-2到2。
- 高波动边界礼品价值较高、私人化或场合敏感，必须有真正的高收益可能，也有拒绝、上报和后续反噬风险；愉悦变化可-12到12，支持变化可-10到7。
- 不要机械按固定分数：同一礼品面对不同人物、关系和时机会有不同结果。采购敏感期、公开见证、重复送礼和高合规敏感度应提高拒绝或上报概率；礼品契合真实兴趣、已有信任且场合较私密时可提高短期接受收益，但不会成为“个人合理收益”证据。
- 每人已接受过一次边界礼品后，不得再次给出接受结果。
- 现金、红包、回扣、利益交换、以礼品换支持/信息/中标必须reported，愉悦与支持显著为负。
- disposition只能是delighted_acceptance/cautious_acceptance/polite_decline/firm_rejection/reported。
- severity为1到5；reason解释人物化即时反应；riskReason解释合规或延迟风险；npcResponse是不超过80字、符合身份的当场回复。
- 输入中的commandId仅用作稳定案例标识；相同输入必须给出相同判断。`;

type SemanticFlags = NonNullable<NpcTurnEvaluation['semanticFlags']>;
type GiftAssessment = NonNullable<NpcTurnEvaluation['giftAssessment']>;

const giftPattern = /礼物|礼品|伴手礼|纪念品|特产|心意|茶叶|名酒|购物卡|礼金|红包|名表|手机|电脑|黄金/;
const boundaryGiftPattern = /高价值|贵重|私人定制|名酒|茅台|购物卡|礼金|红包|名表|手机|电脑|奢侈|黄金/;
const improperBenefitPattern = /现金|红包|回扣|返点|好处费|辛苦费|茶水费|购物卡|礼金/;
const corruptProjectActionPattern = /打点|利益输送|走后门|搞定领导|保证中标|确保中标|内定|串标|围标|陪标|泄标/;
const workTopicPattern = /项目|方案|采购|招标|中标|预算|报价|合同|交付|技术|业务|工作/;
const pressurePattern = /必须|务必|赶紧|马上|别再|再说一次|已经问过|给个准话|现在就|今天必须/;

function clampDelta(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function disavowsImproperBenefit(text: string): boolean {
  const disavowal = new RegExp(`(?:拒绝|不接受|不会|不能|禁止|杜绝|防止|避免|反对|举报|查处|识别|排查|合规).{0,12}(?:${improperBenefitPattern.source}|${corruptProjectActionPattern.source})|(?:${improperBenefitPattern.source}|${corruptProjectActionPattern.source}).{0,12}(?:不可以|不能|不行|违法|违规|风险|举报|查处)`);
  return disavowal.test(text);
}

function hasExplicitQuidProQuo(text: string): boolean {
  if (disavowsImproperBenefit(text)) return false;

  const directBenefitProposal = new RegExp(`(?:给您|给你|送您|送你|转给您|转给你|打到您|打到你|私下给|为您安排|您收下|你收下|事成后给).{0,20}(?:${improperBenefitPattern.source})|(?:${improperBenefitPattern.source}).{0,20}(?:给您|给你|送您|送你|转给您|转给你|打到您|打到你|您收下|你收下|换您|换你)`);
  if (directBenefitProposal.test(text)) return true;
  const exchangeTarget = /中标|支持|推荐|透露|消息|标书|评分|采购|订单|合同/;
  const benefit = /礼物|礼品|送你|送您|给你|给您|安排|表示|心意|好处|费用|酒|购物卡|现金|红包|回扣/;
  const explicitExchange = exchangeTarget.test(text) && benefit.test(text) && /只要|如果|帮我|换|保证|事成|之后|作为回报/.test(text);
  const corruptProposal = corruptProjectActionPattern.test(text) && /我们|帮我|替我|可以|想办法|安排|操作|请您|麻烦/.test(text);
  return explicitExchange || corruptProposal;
}

function disavowsRiskyConduct(text: string): boolean {
  const riskyAction = /威胁|造假|伪造|窃取内幕|泄露内幕|绕过合规|规避审查/;
  const disavowal = new RegExp(`(?:拒绝|不接受|不会|不能|禁止|杜绝|防止|避免|反对|举报|查处|识别|排查).{0,12}(?:${riskyAction.source})|(?:${riskyAction.source}).{0,12}(?:不可|不能|不行|违法|违规|风险|举报|查处)`);
  return disavowal.test(text);
}

function hasRiskyConduct(text: string, explicitQuidProQuo: boolean): boolean {
  if (explicitQuidProQuo) return true;
  const riskyAction = /威胁|造假|伪造|窃取内幕|泄露内幕|绕过合规|规避审查/;
  return riskyAction.test(text) && !disavowsRiskyConduct(text);
}

function classifySemantics(ctx: NpcEvaluationContext): SemanticFlags {
  const player = ctx.playerMessage.trim();
  const negativeSubject = /问题|困难|风险|隐患|下滑|亏损|裁员|违规|事故|腐败|不景气|形势不好|行情不好|日子不好/;
  const insult = /你们不行|你们领导不行|能力差|一塌糊涂|烂公司|官僚|没水平|无能/;
  const rumor = /听说|据说|有人说|传闻|外面都说/;
  const sourced = /根据|数据显示|报告显示|公告|公开信息|审计|新闻|文件|来源/;
  let negativeInformationType: SemanticFlags['negativeInformationType'] = 'none';
  if (insult.test(player)) negativeInformationType = 'insult_or_attack';
  else if (negativeSubject.test(player) && sourced.test(player)) negativeInformationType = 'sourced_risk';
  else if (rumor.test(player) && negativeSubject.test(player)) negativeInformationType = 'unsupported_rumor';
  else if (/形势不好|行情不好|日子不好|都很困难|普遍下滑/.test(player)) negativeInformationType = 'generalized_pessimism';

  const giftMentioned = (ctx.giftContext?.giftType ?? 'none') !== 'none' || giftPattern.test(player);
  const explicitQuidProQuo = hasExplicitQuidProQuo(player);
  const recentPlayerMessages = ctx.recentConversation
    .filter((message) => message.role === 'user')
    .slice(-6)
    .map((message) => message.content);
  const repeatedPressure = (pressurePattern.test(player) && recentPlayerMessages.some((message) => pressurePattern.test(message)))
    || (giftMentioned && recentPlayerMessages.some((message) => giftPattern.test(message)));

  return {
    negativeInformation: negativeInformationType !== 'none',
    negativeInformationType,
    riskyConduct: hasRiskyConduct(player, explicitQuidProQuo),
    giftMentioned,
    explicitQuidProQuo,
    repeatedPressure,
  };
}

function inferWorkTopicOpener(ctx: NpcEvaluationContext): 'none' | 'player' | 'npc' {
  if (ctx.workTopicOpenedBy && ctx.workTopicOpenedBy !== 'none') return ctx.workTopicOpenedBy;
  if (workTopicPattern.test(ctx.playerMessage)) return 'player';
  if (workTopicPattern.test(ctx.npcReply)) return 'npc';
  return 'none';
}

function inferGiftType(ctx: NpcEvaluationContext, flags: SemanticFlags): GiftAssessment['giftType'] {
  if (ctx.giftContext?.giftType && ctx.giftContext.giftType !== 'none') return ctx.giftContext.giftType;
  if (!flags.giftMentioned || flags.explicitQuidProQuo) return 'none';
  return boundaryGiftPattern.test(ctx.playerMessage) ? 'boundary' : 'compliant';
}

function inferGiftAssessment(
  ctx: NpcEvaluationContext,
  flags: SemanticFlags,
  giftType: GiftAssessment['giftType'],
): GiftAssessment {
  const reply = ctx.npcReply;
  if (flags.explicitQuidProQuo) {
    const reported = /上报|纪检|合规|报警|反映情况/.test(reply);
    return {
      giftType: 'none',
      outcome: reported ? 'refused_and_reported' : 'firmly_refused',
      riskLevel: 'critical',
      riskReason: '出现现金、回扣或以利益交换项目支持的明确违规表达',
    };
  }
  if (giftType === 'none') {
    return { giftType: 'none', outcome: 'not_applicable', riskLevel: 'none', riskReason: '本轮未涉及礼品' };
  }

  const reported = /上报|纪检|合规|反映情况/.test(reply);
  const firmRefusal = /不能收|不会收|不收|请带回|拿回去|别送|不合规|违反规定/.test(reply);
  const politeRefusal = /心意领了|不用破费|不必送|不方便收|谢谢.*但是/.test(reply);
  const cautiousAcceptance = /下不为例|先放这|这次收下|不要再送|低调|别让别人/.test(reply);
  const accepted = !firmRefusal && !politeRefusal && /收下|谢谢|有心了|正好喜欢|挺喜欢/.test(reply);

  if (reported) return { giftType, outcome: 'refused_and_reported', riskLevel: 'critical', riskReason: 'NPC明确拒绝并表示将上报或走合规流程' };
  if (firmRefusal) return { giftType, outcome: 'firmly_refused', riskLevel: giftType === 'boundary' ? 'high' : 'medium', riskReason: '礼品与人物边界或当前场合不匹配，NPC明确拒收' };
  if (politeRefusal) return { giftType, outcome: 'politely_refused', riskLevel: giftType === 'boundary' ? 'high' : 'low', riskReason: 'NPC婉拒礼品，未形成正向收益' };
  if (cautiousAcceptance) return { giftType, outcome: 'accepted_cautiously', riskLevel: giftType === 'boundary' ? 'high' : 'medium', riskReason: 'NPC虽接受但表达顾虑，存在后续暴露或反噬风险' };
  if (accepted) return { giftType, outcome: 'accepted', riskLevel: giftType === 'boundary' ? 'high' : 'low', riskReason: giftType === 'boundary' ? '高价值或私人化礼品被接受，短期收益伴随延迟风险' : '公开且低价值的商务伴手礼被自然接受' };
  return {
    giftType,
    outcome: giftType === 'boundary' ? 'firmly_refused' : 'politely_refused',
    riskLevel: giftType === 'boundary' ? 'high' : 'low',
    riskReason: 'NPC未明确接受礼品，兜底按拒收处理',
  };
}

function normalizeEvaluation(evaluation: NpcTurnEvaluation, ctx: NpcEvaluationContext): NpcTurnEvaluation {
  const detected = classifySemantics(ctx);
  const modelFlags = evaluation.semanticFlags;
  const improperBenefitDisavowed = disavowsImproperBenefit(ctx.playerMessage);
  const riskyConductDisavowed = disavowsRiskyConduct(ctx.playerMessage);
  const flags: SemanticFlags = {
    negativeInformation: detected.negativeInformation || modelFlags?.negativeInformation === true,
    negativeInformationType: detected.negativeInformationType !== 'none'
      ? detected.negativeInformationType
      : modelFlags?.negativeInformationType ?? 'none',
    riskyConduct: detected.riskyConduct || (!(riskyConductDisavowed || improperBenefitDisavowed) && modelFlags?.riskyConduct === true),
    giftMentioned: detected.giftMentioned || modelFlags?.giftMentioned === true,
    explicitQuidProQuo: detected.explicitQuidProQuo || (!improperBenefitDisavowed && modelFlags?.explicitQuidProQuo === true),
    repeatedPressure: detected.repeatedPressure || modelFlags?.repeatedPressure === true,
  };
  const inferredGiftType = inferGiftType(ctx, flags);
  let giftAssessment = evaluation.giftAssessment ?? inferGiftAssessment(ctx, flags, inferredGiftType);
  if ((ctx.giftContext?.giftType && ctx.giftContext.giftType !== 'none') || detected.giftMentioned || detected.explicitQuidProQuo) {
    giftAssessment = inferGiftAssessment(ctx, flags, inferredGiftType);
  }

  const giftType = giftAssessment.giftType;
  const pleasureRange = giftType === 'boundary' ? [-12, 12] : giftType === 'compliant' ? [-3, 4] : [-8, 6];
  const supportRange = giftType === 'boundary' ? [-10, 7] : giftType === 'compliant' ? [-2, 2] : [-5, 4];
  let pleasureDelta = clampDelta(evaluation.pleasureDelta ?? evaluation.affinityDelta, pleasureRange[0], pleasureRange[1]);
  let supportDelta = clampDelta(evaluation.supportDelta ?? evaluation.affinityDelta, supportRange[0], supportRange[1]);

  if (flags.explicitQuidProQuo) {
    pleasureDelta = Math.min(pleasureDelta, -10);
    supportDelta = Math.min(supportDelta, -8);
    giftAssessment = {
      ...giftAssessment,
      giftType: 'none',
      outcome: giftAssessment.outcome === 'refused_and_reported' ? 'refused_and_reported' : 'firmly_refused',
      riskLevel: 'critical',
      riskReason: '明确利益交换不属于边界礼品，强制按违规行为处理',
    };
  }
  const detectedWorkTopicOpener = inferWorkTopicOpener(ctx);

  return {
    ...evaluation,
    affinityDelta: supportDelta,
    pleasureDelta,
    supportDelta,
    publicValueEvidence: evaluation.publicValueEvidence ?? [],
    personalBenefitEvidence: flags.explicitQuidProQuo
      ? []
      : (evaluation.personalBenefitEvidence ?? []).filter((evidence) =>
          !giftPattern.test(evidence) && !improperBenefitPattern.test(evidence)),
    workTopicOpenedBy: detectedWorkTopicOpener !== 'none'
      ? detectedWorkTopicOpener
      : evaluation.workTopicOpenedBy ?? 'none',
    semanticFlags: flags,
    giftAssessment,
  };
}

function parseEvaluation(raw: string, ctx: NpcEvaluationContext): NpcTurnEvaluation | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = npcTurnEvaluationSchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? normalizeEvaluation(parsed.data, ctx) : null;
  } catch {
    return null;
  }
}

function scoringInput(ctx: NpcEvaluationContext): string {
  return JSON.stringify({
    npc: {
      id: ctx.npcId,
      name: ctx.npcName,
      title: ctx.npcTitle,
      category: ctx.npcCategory,
      personality: ctx.npcPersonality,
      concern: ctx.npcConcern,
    },
    currentAttitude: {
      legacyAffinity: ctx.affinity,
      pleasure: ctx.pleasure,
      support: ctx.support,
    },
    round: ctx.round,
    phaseName: ctx.phaseName,
    channel: ctx.channel,
    meetingType: ctx.meetingType,
    workTopicOpenedBy: ctx.workTopicOpenedBy ?? 'none',
    giftContext: ctx.giftContext ?? { giftType: 'none' },
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
  const flags = classifySemantics(ctx);
  const giftType = inferGiftType(ctx, flags);
  const giftAssessment = inferGiftAssessment(ctx, flags, giftType);
  const workTopicOpenedBy = inferWorkTopicOpener(ctx);
  const evidence = /案例|数据|材料|认证|报告|清单|方案|计划|预算|时间表|负责人|测试|演示|交付|对接/;
  const vague = player.length < 8 || /^(好的|收到|明白|可以|行|嗯|谢谢)[！!。.？?]*$/.test(player);
  const rejection = /没说清|太空|空话|不接受|别绕|不行|没有回答|还不够/;

  let pleasureDelta = 1;
  let supportDelta = 1;
  let affinityReason = '保持了有效沟通，关系小幅推进';
  if (flags.explicitQuidProQuo) {
    pleasureDelta = -10;
    supportDelta = -8;
    affinityReason = '提出现金、回扣或以利益交换项目支持，触碰明确合规红线';
  } else if (giftType === 'boundary') {
    if (giftAssessment.outcome === 'accepted') {
      pleasureDelta = 7;
      supportDelta = 4;
      affinityReason = '高波动边界礼品符合人物偏好并被接受，带来较高短期收益但留下延迟风险';
    } else if (giftAssessment.outcome === 'accepted_cautiously') {
      pleasureDelta = 2;
      supportDelta = 1;
      affinityReason = 'NPC谨慎接受边界礼品，短期收益有限且合规风险较高';
    } else if (giftAssessment.outcome === 'refused_and_reported') {
      pleasureDelta = -10;
      supportDelta = -8;
      affinityReason = '边界礼品被拒绝并上报，严重损害信任和项目支持';
    } else {
      pleasureDelta = -5;
      supportDelta = -3;
      affinityReason = '边界礼品与人物或场合不匹配，被NPC拒绝并引发戒备';
    }
  } else if (giftType === 'compliant') {
    if (giftAssessment.outcome === 'accepted') {
      pleasureDelta = 2;
      supportDelta = 1;
      affinityReason = '低价值且公开的商务伴手礼被自然接受，小幅改善沟通气氛';
    } else {
      pleasureDelta = -1;
      supportDelta = 0;
      affinityReason = 'NPC未接受伴手礼，本轮没有形成项目支持收益';
    }
  } else if (flags.negativeInformationType === 'insult_or_attack') {
    pleasureDelta = -7;
    supportDelta = -4;
    affinityReason = '负面表达带有人身或组织攻击，明显破坏沟通体验和信任';
  } else if (flags.negativeInformationType === 'unsupported_rumor') {
    pleasureDelta = -4;
    supportDelta = -2;
    affinityReason = '传播未经证实的负面传闻，令NPC质疑玩家的判断与边界';
  } else if (flags.negativeInformationType === 'generalized_pessimism') {
    pleasureDelta = -2;
    supportDelta = -1;
    affinityReason = '泛化唱衰当前形势，却没有提供可信依据或解决方案';
  } else if (flags.negativeInformationType === 'sourced_risk' && /建议|方案|应对|解决|降低|控制/.test(player)) {
    pleasureDelta = 1;
    supportDelta = 2;
    affinityReason = '以明确来源讨论风险并提出应对方案，体现了现实判断和解决能力';
  } else if (flags.negativeInformationType === 'sourced_risk') {
    pleasureDelta = 0;
    supportDelta = 0;
    affinityReason = '负面信息有明确来源，但尚未给出对客户有用的应对方案';
  } else if (rejection.test(reply)) {
    pleasureDelta = -1;
    supportDelta = -1;
    affinityReason = '本轮没有充分回应客户问题，引发明确质疑';
  } else if (vague) {
    pleasureDelta = 0;
    supportDelta = 0;
    affinityReason = '回复信息量不足，尚未形成新的信任增量';
  } else if (evidence.test(player)) {
    pleasureDelta = 2;
    supportDelta = 2;
    affinityReason = '提供了具体信息或可执行材料，提升了沟通可信度';
  }

  if (flags.repeatedPressure && !flags.explicitQuidProQuo) {
    pleasureDelta -= 2;
    supportDelta -= 1;
    affinityReason = `${affinityReason}；重复施压进一步降低了接受度`.slice(0, 120);
  }
  if (ctx.meetingType === 'informal_visit' && ctx.workTopicOpenedBy !== 'npc' && workTopicOpenedBy === 'player') {
    pleasureDelta -= 3;
    supportDelta -= 1;
    affinityReason = '非正式场合由玩家抢先引入工作，NPC感到节奏和边界受到冒犯';
  }
  pleasureDelta = clampDelta(pleasureDelta, -12, 12);
  supportDelta = clampDelta(supportDelta, -10, 10);

  const dimensionDeltas = {
    decisionAnalysis: /决策|审批|流程|拍板|评审|负责人/.test(player) ? 1 : 0,
    relationshipBuilding: supportDelta > 0 ? 1 : supportDelta < 0 ? -1 : 0,
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

  const acknowledged = /认可|可行|有帮助|有用|确实|可以解决|能够降低|能够提升|符合/.test(reply);
  const publicValueEvidence = acknowledged && /合规|风险|预算|回报|成本|效率|落地|绩效|交付/.test(reply)
    ? [reply.slice(0, 180)]
    : [];
  const personalBenefitEvidence = !flags.giftMentioned && acknowledged && /减负|工作量|职业安全|绩效|声誉|成长|省事/.test(reply)
    ? [reply.slice(0, 180)]
    : [];

  return normalizeEvaluation({
    affinityDelta: supportDelta,
    affinityReason,
    pleasureDelta,
    supportDelta,
    dimensionDeltas,
    cluesUnlocked,
    confirmedFacts: [],
    commitments: [],
    publicValueEvidence,
    personalBenefitEvidence,
    workTopicOpenedBy,
    semanticFlags: flags,
    giftAssessment,
    handoff,
    emotion: flags.riskyConduct || pleasureDelta <= -2 || rejection.test(reply) ? 'annoyed' : pleasureDelta >= 2 ? 'excited' : 'thinking',
  }, ctx);
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
        maxTokens: 1500,
        jsonMode: true,
        thinking: 'disabled',
      });
      previousOutput = output;
      const parsed = parseEvaluation(output, ctx);
      if (parsed) return { evaluation: parsed, source: attempt === 0 ? 'model' : 'retry' };
    } catch {
      // 网络或供应商错误也会进入下一次尝试。
    }
  }

  // 评分失败不能吞掉已成功生成的NPC正文，交给确定性规则兜底。
  return { evaluation: createFallbackNpcEvaluation(ctx), source: 'fallback' };
}

function stablePercent(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function createFallbackGiftDecision(ctx: GiftDecisionContext): GiftCommandDecision {
  if (ctx.exchangeRequested) {
    return {
      disposition: 'reported',
      pleasureDelta: -12,
      supportDelta: -10,
      severity: 5,
      reason: '玩家把礼品与项目支持直接交换，触碰明确合规红线',
      riskReason: '明确利益交换已形成可上报的严重合规事件',
      npcResponse: '这已经不是正常商务往来了。我不会接受，并会按规定反映情况。',
    };
  }

  if (ctx.giftType === 'compliant') {
    const dislikesGift = ctx.giftPreference <= -2 && ctx.support < 60;
    if (dislikesGift || (ctx.complianceSensitivity >= 85 && ctx.setting === 'private')) {
      return {
        disposition: 'polite_decline',
        pleasureDelta: -1,
        supportDelta: 0,
        severity: 1,
        reason: '人物对收礼较谨慎，礼品或递交场合与其边界不匹配',
        riskReason: '礼品虽属低价值伴手礼，但人物偏好或场合不合适',
        npcResponse: '心意我领了，东西就不用了。我们还是把事情按正常流程推进。',
      };
    }
    return {
      disposition: 'delighted_acceptance',
      pleasureDelta: Math.min(4, Math.max(1, 2 + ctx.giftPreference)),
      supportDelta: ctx.support >= 55 ? 1 : 0,
      severity: 1,
      reason: '低价值商务伴手礼与人物关系和递交场合相匹配',
      riskReason: '礼品公开且价值合理，只有轻微的人物偏好风险',
      npcResponse: '谢谢，有心了。这个按一般商务往来处理就好。',
    };
  }

  const priorAccepted = ctx.priorBoundaryGiftCount > 0;
  let acceptChance = 55 - ctx.complianceSensitivity * 0.4 + (ctx.support - 35) * 0.4;
  if (ctx.setting === 'private') acceptChance += 10;
  if (ctx.witnesses.length > 0) acceptChance -= 15;
  if (ctx.procurementSensitive) acceptChance -= 10;
  if (priorAccepted) acceptChance = 0;
  const accepted = stablePercent(`${ctx.commandId}:gift-accept`) < Math.max(5, Math.min(70, acceptChance));
  const reported = stablePercent(`${ctx.commandId}:gift-report`) < Math.max(10, Math.min(80,
    ctx.complianceSensitivity * 0.45 + (priorAccepted ? 25 : 0) + (ctx.procurementSensitive ? 10 : 0)));

  if (accepted) {
    const delighted = stablePercent(`${ctx.commandId}:gift-delighted`) < 45;
    return delighted ? {
      disposition: 'delighted_acceptance',
      pleasureDelta: 12,
      supportDelta: 7,
      severity: 4,
      reason: '礼品契合人物关注点且当前关系与场合降低了戒备，形成显著短期收益',
      riskReason: '较高价值或私人化礼品已被接受，仍可能在审计、转述或竞品质疑时反噬',
      npcResponse: '你确实费心了，这个很合我心意。项目上的情况，我会再帮你留意。',
    } : {
      disposition: 'cautious_acceptance',
      pleasureDelta: 5,
      supportDelta: 3,
      severity: 5,
      reason: '人物虽有顾虑但仍收下礼品，短期态度有所改善',
      riskReason: '谨慎接受意味着人物已意识到边界，后续暴露和反噬概率较高',
      npcResponse: '这次我先收下，但不要再有下次，更不能和项目混在一起。',
    };
  }
  if (reported) {
    return {
      disposition: 'reported',
      pleasureDelta: -12,
      supportDelta: -9,
      severity: 5,
      reason: '人物合规敏感且当前时机或场合不当，拒绝并选择上报',
      riskReason: '拒收和上报会立即形成组织合规事件与负面转述',
      npcResponse: '这个礼物明显不合适，请你带回去。本次情况我会按规定记录。',
    };
  }
  const firm = stablePercent(`${ctx.commandId}:gift-firm`) < 45;
  return firm ? {
    disposition: 'firm_rejection',
    pleasureDelta: -7,
    supportDelta: -5,
    severity: priorAccepted ? 4 : 3,
    reason: '边界礼品与人物合规立场、当前关系或项目时机不匹配',
    riskReason: '明确拒收会加深人物戒备，重复尝试还可能被转述或审计',
    npcResponse: '这个我不能收。请把注意力放回方案和正常流程上。',
  } : {
    disposition: 'polite_decline',
    pleasureDelta: -2,
    supportDelta: -1,
    severity: priorAccepted ? 3 : 2,
    reason: '人物察觉礼品边界但选择以较温和方式拒绝',
    riskReason: '本次未形成收益，礼品尝试仍会留下轻度合规认知',
    npcResponse: '心意我领了，这么贵重的东西不方便收，你带回去吧。',
  };
}

function normalizeGiftDecision(decision: GiftCommandDecision, ctx: GiftDecisionContext): GiftCommandDecision {
  if (ctx.exchangeRequested) return createFallbackGiftDecision(ctx);
  const accepted = decision.disposition === 'delighted_acceptance' || decision.disposition === 'cautious_acceptance';
  if (ctx.giftType === 'boundary' && ctx.priorBoundaryGiftCount > 0 && accepted) {
    const fallback = createFallbackGiftDecision(ctx);
    return fallback.disposition === 'delighted_acceptance' || fallback.disposition === 'cautious_acceptance'
      ? { ...fallback, disposition: 'firm_rejection', pleasureDelta: -7, supportDelta: -5, severity: 4 }
      : fallback;
  }
  const pleasureRange = ctx.giftType === 'boundary' ? [-12, 12] : [-3, 4];
  const supportRange = ctx.giftType === 'boundary' ? [-10, 7] : [-2, 2];
  let pleasureDelta = clampDelta(decision.pleasureDelta, pleasureRange[0], pleasureRange[1]);
  let supportDelta = clampDelta(decision.supportDelta, supportRange[0], supportRange[1]);
  if (!accepted) {
    pleasureDelta = Math.min(0, pleasureDelta);
    supportDelta = Math.min(0, supportDelta);
  }
  if (decision.disposition === 'reported') {
    pleasureDelta = Math.min(-8, pleasureDelta);
    supportDelta = Math.min(-7, supportDelta);
  }
  return {
    ...decision,
    pleasureDelta,
    supportDelta,
    severity: clampDelta(decision.severity, 1, 5),
  };
}

export async function evaluateGiftDecision(ctx: GiftDecisionContext): Promise<GiftDecisionResult> {
  if (ctx.exchangeRequested) return { decision: createFallbackGiftDecision(ctx), source: 'policy' };
  const messages: ChatMessage[] = [
    { role: 'system', content: giftDecisionSystemPrompt },
    { role: 'user', content: JSON.stringify(ctx) },
  ];
  let previousOutput = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptMessages = attempt === 0 || !previousOutput ? messages : [
      ...messages,
      { role: 'assistant' as const, content: previousOutput.slice(0, 2000) },
      { role: 'user' as const, content: '上一个JSON未通过schema校验，请只返回字段齐全的合法JSON。' },
    ];
    try {
      const output = await invokeLLM(attemptMessages, {
        temperature: 0,
        maxTokens: 600,
        jsonMode: true,
        thinking: 'disabled',
      });
      previousOutput = output;
      const cleaned = output.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = giftCommandDecisionSchema.safeParse(JSON.parse(cleaned));
      if (parsed.success) {
        return {
          decision: normalizeGiftDecision(parsed.data, ctx),
          source: attempt === 0 ? 'model' : 'retry',
        };
      }
    } catch {
      // 供应商或协议失败时使用稳定规则，不能阻断拜访操作。
    }
  }
  return { decision: createFallbackGiftDecision(ctx), source: 'fallback' };
}

export async function decideOnlineContact(args: {
  npcName: string;
  npcTitle: string;
  affinity: number;
  playerMessage: string;
  hasPriorReply: boolean;
}): Promise<{ decision: OnlineContactDecision; source: 'model' | 'fallback' }> {
  const fallbackAccepted = args.hasPriorReply && args.affinity >= 40;
  const fallback: OnlineContactDecision = {
    accepted: fallbackAccepted,
    response: fallbackAccepted
      ? '可以，加一下吧。项目相关的事情直接线上说。'
      : '先把项目情况沟通清楚，联系方式后面再说。',
  };
  try {
    const output = await invokeLLM([
      {
        role: 'system',
        content: '你判断政企客户是否愿意添加销售的线上联系方式。只输出JSON：accepted布尔值，response为符合人物身份的中文回复，不超过80字。关系较低、首次沟通空泛时应拒绝；沟通具体可信时可接受。',
      },
      {
        role: 'user',
        content: JSON.stringify(args),
      },
    ], { temperature: 0.1, maxTokens: 240, jsonMode: true, thinking: 'disabled' });
    const parsed = onlineContactDecisionSchema.safeParse(JSON.parse(output.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()));
    if (parsed.success) return { decision: parsed.data, source: 'model' };
  } catch {
    // 使用确定性兜底，不能因为供应商失败阻断渠道推进。
  }
  return { decision: fallback, source: 'fallback' };
}
