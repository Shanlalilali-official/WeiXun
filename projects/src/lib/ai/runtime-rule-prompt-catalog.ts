import { activityRuntimeRulePrompts } from '@/lib/ai/runtime-rule-prompts-activity';
import { npcRuntimeRulePrompts } from '@/lib/ai/runtime-rule-prompts-npc';
import { platformRuntimeRulePrompts } from '@/lib/ai/runtime-rule-prompts-platform';
import { workflowRuntimeRulePrompts } from '@/lib/ai/runtime-rule-prompts-workflow';

export const runtimeRulePromptDefinitions = {
  ...activityRuntimeRulePrompts,
  ...npcRuntimeRulePrompts,
  ...workflowRuntimeRulePrompts,
  ...platformRuntimeRulePrompts,
};

export type RuntimeRulePromptId = keyof typeof runtimeRulePromptDefinitions;

export const runtimeRulePromptCatalog = Object.entries(runtimeRulePromptDefinitions).map(([id, definition]) => ({
  id,
  ...definition,
}));

export const RUNTIME_RULE_PROMPT_MAX_CHARS = 12_000;
export type RuntimeRulePromptOverrides = Partial<Record<RuntimeRulePromptId, string>>;

export function parseRuntimeRulePromptOverrides(
  value: unknown,
  { ignoreRetiredIds = false } = {},
): RuntimeRulePromptOverrides | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: RuntimeRulePromptOverrides = {};
  for (const [id, text] of Object.entries(value)) {
    if (!Object.hasOwn(runtimeRulePromptDefinitions, id)) {
      if (ignoreRetiredIds) continue;
      return null;
    }
    if (typeof text !== 'string' || !text.trim() || text.length > RUNTIME_RULE_PROMPT_MAX_CHARS) return null;
    result[id as RuntimeRulePromptId] = text;
  }
  return result;
}

export function formatRuntimeRulePrompt(id: RuntimeRulePromptId, text: string = runtimeRulePromptDefinitions[id].defaultText): string {
  const { boundary } = runtimeRulePromptDefinitions[id];
  return `${text}\n\n## 固定约束\n${boundary}`;
}
