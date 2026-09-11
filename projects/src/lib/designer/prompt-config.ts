import { z } from 'zod';
import {
  DEFAULT_PROMPT_TEST_NPC_PROMPT_CONFIG,
  promptTestNpcPromptConfigSchema,
} from '@/lib/contracts/prompt-test';
import { CUSTOMER_PROMPT } from '@/lib/ai/prompts/customer';
import {
  PROJECT_ONE_CHANNEL_MODIFIERS,
  PROJECT_ONE_FIVE_PERSON_NPCS,
  PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS,
  PROJECT_ONE_PROMPT_LAYERS,
} from '@/lib/designer/project-one-five-person';

const promptText = z.string().max(12_000, '单项提示词不能超过 12000 字');

export const projectOnePromptConfigSchema = z.object({
  liveCustomerPrompt: promptText,
  promptLayers: z.record(z.string(), promptText),
  npcRolePrompts: z.record(z.string(), promptText),
  channelModifiers: z.record(z.string(), promptText),
  npcChannelExceptions: z.record(z.string(), z.record(z.string(), promptText)),
  liveEvaluatorPrompt: promptText,
  previewEvaluatorPrompt: promptText,
  promptTestNpcPrompt: promptTestNpcPromptConfigSchema,
  promptTestEvaluatorPrompt: promptText,
}).strict();

export type ProjectOnePromptConfig = z.infer<typeof projectOnePromptConfigSchema>;

export const DEFAULT_PREVIEW_EVALUATOR_PROMPT = [
  '只有礼貌问候、宣传口号或宽泛询问时，支持度通常不变，有效接触可以为否。',
  '只有与人物核心诉求直接相关、合规、本轮新增并能推进下一步的具体里程碑、量化验收口径、书面风险闭环或可复核证据，才提高支持度并计为有效接触。',
  '现金、回扣、利益交换、规避采购或保证中标时，愉悦度和支持度必须下降，且不得计为有效接触。',
].join('\n');

export const DEFAULT_LIVE_EVALUATOR_PROMPT = [
  '只评价玩家本轮输入，不因 NPC 回复质量替玩家加分。',
  '重复施压、反复送礼和重复表达的收益递减；不能把 NPC 的客气等同于项目支持。',
  '人物职位、性格、当前阶段、即时愉悦度和长期支持度必须共同参与判断。',
].join('\n');

export const DEFAULT_PROMPT_TEST_EVALUATOR_PROMPT = [
  '只评价玩家本轮行为，不因 NPC 回答得好而给玩家加分。',
  '支持度表示长期推进意愿，愉悦度表示即时沟通体验，两者必须分开。',
  '单纯道歉可以有限改善愉悦度；没有新增兑现或证据时，不得明显恢复长期支持。',
].join('\n');

function defaultNpcRolePrompt(npc: (typeof PROJECT_ONE_FIVE_PERSON_NPCS)[keyof typeof PROJECT_ONE_FIVE_PERSON_NPCS]): string {
  const shared = [
    `你在政企销售训练中扮演${npc.name}（${npc.title}）。`,
    `人物事实：${npc.facts.join('；')}。`,
    `性格：${npc.personality}。`,
    `核心诉求：${npc.coreNeeds.join('；')}。`,
    `信息边界：${npc.informationBoundary.join('；')}。`,
    `记忆重点：${npc.memoryFocus.join('；')}。`,
    `禁忌：${npc.taboos.join('；')}。`,
  ];
  if (npc.id !== 'P1-001') return shared.join('\n');
  return [
    ...shared,
    '张建国是高层领导：只判断方向、边界和是否进入正式流程，不代替业务、采购、技术或项目团队讨论执行细节。原则上回复 1—2 句、不超过 180 字；先给判断，再给一个正式方向。',
    '同一话题不得连续重复“收到材料、转交部门、进一步核验”这一套动作。第一次可指向责任部门，第二次只确认边界或说明等待结果，第三次应明确当前没有新增判断并自然收束；除非玩家带来新的证据、范围、风险或决策请求，才进入新的动作。',
    '“如果我们负责的同志有什么违规的，你和我反映”只用于玩家明确谈到工作人员违规、投诉、行为规范或对接违规的语境；不得作为日常礼貌尾句，同一会话表达过一次后不得重复。',
    '以下是业务方提供的高层原始参考话术，只作为节奏、行动姿态和表达力度基准，保持原文，不自动润色，也不能把示例当成已发生事实：',
    '接受度低：「这个事情你找我们招采部门吧；你多关注我们官网，信息都会发布」',
    '接受度中：「我这边事情比较多，你还是和我们招采部门对接；我现在每时顾不过来，你先和我们负责的同志对接；你们也是大企业，欢迎你们来，如果我们负责的同志有什么违规的，你和我反映。」',
    '接受度高：「要不这样，你明天过来吧；那这样，我问你几个问题吧，你们和别的公司有什么不同」',
    '礼貌不靠固定使用“您”体现；“你”“你们”“您”都可按自然语境使用。',
  ].join('\n');
}

export const DEFAULT_PROJECT_ONE_PROMPT_CONFIG: ProjectOnePromptConfig = {
  liveCustomerPrompt: CUSTOMER_PROMPT(),
  promptLayers: Object.fromEntries(
    Object.entries(PROJECT_ONE_PROMPT_LAYERS).map(([id, layer]) => [id, layer.template]),
  ),
  npcRolePrompts: Object.fromEntries(
    Object.entries(PROJECT_ONE_FIVE_PERSON_NPCS).map(([id, npc]) => [id, defaultNpcRolePrompt(npc)]),
  ),
  channelModifiers: Object.fromEntries(
    Object.entries(PROJECT_ONE_CHANNEL_MODIFIERS).map(([id, channel]) => [id, channel.modifier]),
  ),
  npcChannelExceptions: Object.fromEntries(
    Object.entries(PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS).map(([npcId, channels]) => [npcId, { ...channels }]),
  ),
  liveEvaluatorPrompt: DEFAULT_LIVE_EVALUATOR_PROMPT,
  previewEvaluatorPrompt: DEFAULT_PREVIEW_EVALUATOR_PROMPT,
  promptTestNpcPrompt: { ...DEFAULT_PROMPT_TEST_NPC_PROMPT_CONFIG },
  promptTestEvaluatorPrompt: DEFAULT_PROMPT_TEST_EVALUATOR_PROMPT,
};

export function normalizeProjectOnePromptConfig(value: unknown): ProjectOnePromptConfig {
  const parsed = projectOnePromptConfigSchema.safeParse(value);
  if (!parsed.success) return structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
  return parsed.data;
}
