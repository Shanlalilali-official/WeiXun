import { z } from 'zod';
import {
  DEFAULT_PROMPT_TEST_NPC_PROMPT_CONFIG,
  promptTestNpcPromptConfigSchema,
} from '@/lib/contracts/prompt-test';
import { CUSTOMER_PROMPT } from '@/lib/ai/prompts/customer';
import { PROJECT_ONE_NPC_ROLE_PROMPTS } from '@/lib/designer/npc-role-prompts';
import {
  PROJECT_ONE_CHANNEL_MODIFIERS,
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

export const DEFAULT_PROJECT_ONE_PROMPT_CONFIG: ProjectOnePromptConfig = {
  liveCustomerPrompt: CUSTOMER_PROMPT(),
  promptLayers: Object.fromEntries(
    Object.entries(PROJECT_ONE_PROMPT_LAYERS).map(([id, layer]) => [id, layer.template]),
  ),
  npcRolePrompts: { ...PROJECT_ONE_NPC_ROLE_PROMPTS },
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
