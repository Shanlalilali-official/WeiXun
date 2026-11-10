import {
  formatRuntimeRulePrompt,
  parseRuntimeRulePromptOverrides,
  type RuntimeRulePromptId,
  type RuntimeRulePromptOverrides,
} from '@/lib/ai/runtime-rule-prompt-catalog';
import { createServerClient } from '@/storage/database/supabase-client';

export const RUNTIME_RULE_PROMPT_CONFIG_ID = 'project-one-runtime-rules';
export const RUNTIME_RULE_PROMPT_VERSION_CONFLICT = 'RUNTIME_RULE_PROMPT_VERSION_CONFLICT';

type RuntimeRulePromptConfig = {
  revision: number;
  overrides: RuntimeRulePromptOverrides;
};

let pendingRead: Promise<RuntimeRulePromptConfig> | undefined;

function parseConfigRow(row: { revision: number; config: unknown }): RuntimeRulePromptConfig {
  const stored = row.config;
  const overrides = stored && typeof stored === 'object' && 'overrides' in stored
    ? parseRuntimeRulePromptOverrides(stored.overrides, { ignoreRetiredIds: true })
    : null;
  if (!overrides) throw new Error('RUNTIME_RULE_PROMPT_CONFIG_INVALID');
  return { revision: row.revision, overrides };
}

export async function loadRuntimeRulePromptConfig(): Promise<RuntimeRulePromptConfig> {
  const { data, error } = await createServerClient().from('designer_prompt_configs')
    .select('revision, config').eq('id', RUNTIME_RULE_PROMPT_CONFIG_ID).maybeSingle();
  if (error) throw new Error('RUNTIME_RULE_PROMPT_CONFIG_READ_FAILED');
  return data ? parseConfigRow(data) : { revision: 0, overrides: {} };
}

export async function saveRuntimeRulePromptConfig(
  overrides: RuntimeRulePromptOverrides,
  expectedRevision: number,
  userId: string,
): Promise<RuntimeRulePromptConfig> {
  const table = createServerClient().from('designer_prompt_configs');
  const values = {
    config: { overrides },
    revision: expectedRevision + 1,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const query = expectedRevision === 0
    ? table.insert({ id: RUNTIME_RULE_PROMPT_CONFIG_ID, ...values })
    : table.update(values).eq('id', RUNTIME_RULE_PROMPT_CONFIG_ID).eq('revision', expectedRevision);
  const { data, error } = await query.select('revision, config').maybeSingle();
  if (error?.code === '23505' || (!error && !data)) throw new Error(RUNTIME_RULE_PROMPT_VERSION_CONFLICT);
  if (error || !data) throw new Error('RUNTIME_RULE_PROMPT_CONFIG_WRITE_FAILED');
  pendingRead = undefined;
  return parseConfigRow(data);
}

/** Coalesce simultaneous reads without retaining stale text across requests. */
async function loadRuntimeOverrides(): Promise<RuntimeRulePromptOverrides> {
  const read = pendingRead ??= loadRuntimeRulePromptConfig();
  try {
    return (await read).overrides;
  } catch {
    // Gameplay can still run on the code defaults if configuration storage is unavailable.
    return {};
  } finally {
    if (pendingRead === read) pendingRead = undefined;
  }
}

export async function resolveRuntimeRulePrompt(id: RuntimeRulePromptId, legacyText?: string): Promise<string> {
  const overrides = await loadRuntimeOverrides();
  return formatRuntimeRulePrompt(id, overrides[id] ?? legacyText);
}
