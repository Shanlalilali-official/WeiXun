import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authGuard } from '@/lib/auth/guard';
import { parseRuntimeRulePromptOverrides, runtimeRulePromptCatalog } from '@/lib/ai/runtime-rule-prompt-catalog';
import {
  loadRuntimeRulePromptConfig,
  RUNTIME_RULE_PROMPT_VERSION_CONFLICT,
  saveRuntimeRulePromptConfig,
} from '@/lib/ai/runtime-rule-prompts';
import { DEFAULT_PROJECT_ONE_PROMPT_CONFIG } from '@/lib/designer/prompt-config';
import { loadProjectOnePromptConfig } from '@/lib/designer/prompt-config-repository';

export const runtime = 'nodejs';

const saveSchema = z.object({
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
  overrides: z.record(z.string(), z.string()),
}).strict();

async function loadEffectiveCatalog() {
  const { config } = await loadProjectOnePromptConfig();
  const legacyDefaults: Record<string, string> = {
    live_npc_evaluator_legacy_guidance: config.liveEvaluatorPrompt,
    prompt_test_evaluator_legacy_guidance: config.promptTestEvaluatorPrompt,
    preview_evaluator_business_guidance: config.previewEvaluatorPrompt,
  };
  if (config.liveCustomerPrompt && config.liveCustomerPrompt !== DEFAULT_PROJECT_ONE_PROMPT_CONFIG.liveCustomerPrompt) {
    legacyDefaults.formal_customer_dialogue = config.liveCustomerPrompt;
  }
  for (const [channel, modifier] of Object.entries(config.channelModifiers)) {
    legacyDefaults[`preview_channel_modifier_${channel}`] = modifier;
  }
  for (const [layer, wording] of Object.entries(config.promptLayers)) {
    legacyDefaults[`preview_prompt_layer_${layer}`] = wording;
  }
  return runtimeRulePromptCatalog.map((item) => ({
    ...item,
    defaultText: legacyDefaults[item.id] ?? item.defaultText,
  }));
}

export async function GET(request: NextRequest) {
  const guard = authGuard(request, '工作流编辑');
  if (!guard.ok) return guard.response!;
  try {
    const [catalog, stored] = await Promise.all([loadEffectiveCatalog(), loadRuntimeRulePromptConfig()]);
    return NextResponse.json({ success: true, catalog, ...stored });
  } catch {
    return NextResponse.json({ error: '规则提示词暂时无法读取。' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = authGuard(request, '工作流编辑');
  if (!guard.ok || !guard.session) return guard.response!;
  const raw = await request.text().catch(() => '');
  if (raw.length > 800_000) return NextResponse.json({ error: '规则提示词配置过大。' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: '规则提示词配置格式无效。' }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(body);
  const overrides = parsed.success ? parseRuntimeRulePromptOverrides(parsed.data.overrides) : null;
  if (!parsed.success || !overrides) {
    return NextResponse.json({ error: '规则提示词编号或文本无效。' }, { status: 400 });
  }
  try {
    const catalog = await loadEffectiveCatalog();
    const saved = await saveRuntimeRulePromptConfig(overrides, parsed.data.expectedRevision, guard.session.userId);
    return NextResponse.json({ success: true, catalog, ...saved });
  } catch (error) {
    if (error instanceof Error && error.message === RUNTIME_RULE_PROMPT_VERSION_CONFLICT) {
      return NextResponse.json({ error: '其他设计师已保存新版本，请读取最新版本后重试。' }, { status: 409 });
    }
    return NextResponse.json({ error: '规则提示词暂时无法保存。' }, { status: 503 });
  }
}
