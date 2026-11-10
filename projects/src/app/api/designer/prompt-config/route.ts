import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authGuard } from '@/lib/auth/guard';
import { projectOnePromptConfigSchema, type NpcRolePrompt } from '@/lib/designer/prompt-config';
import {
  PROJECT_ONE_CHANNEL_MODIFIERS,
  PROJECT_ONE_FIVE_PERSON_IDS,
  type ProjectOneChannelId,
} from '@/lib/designer/project-one-five-person';
import {
  loadProjectOnePromptConfig,
  saveProjectOnePromptConfig,
} from '@/lib/designer/prompt-config-repository';

export const runtime = 'nodejs';

const saveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  // Older prompt-library clients do not know later JSON fields. Their narrow
  // saves remain valid and are merged with the current server record below.
  config: projectOnePromptConfigSchema.partial(),
}).strict();

const REGISTERED_CHANNEL_IDS = Object.keys(PROJECT_ONE_CHANNEL_MODIFIERS) as ProjectOneChannelId[];

function hasOwn<T extends object>(value: T | null | undefined, key: PropertyKey): boolean {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Merge the only designer-editable part of the prompt configuration.
 *
 * The request still carries the legacy full config shape, but the server must
 * treat every field outside the two person-scoped maps as read-only.  Building
 * fresh maps from the registries also prevents stale or client-invented IDs
 * from being persisted.  An explicitly empty prompt is retained so a designer
 * can clear a person or person/channel exception; omitted entries keep the
 * currently saved value for backwards-compatible partial payloads.
 */
export function mergeEditablePromptConfig(
  current: z.infer<typeof projectOnePromptConfigSchema>,
  requested: Partial<z.infer<typeof projectOnePromptConfigSchema>>,
): z.infer<typeof projectOnePromptConfigSchema> {
  const npcRolePrompts: Record<string, NpcRolePrompt> = {};
  const npcChannelExceptions: Record<string, Record<string, string>> = {};
  const npcChannelDecisionPrompts: Record<string, Record<'email' | 'work_phone', string>> = {};

  for (const npcId of PROJECT_ONE_FIVE_PERSON_IDS) {
    if (hasOwn(current.npcRolePrompts, npcId)) {
      npcRolePrompts[npcId] = current.npcRolePrompts[npcId];
    }
    const requestedRolePrompts = requested.npcRolePrompts;
    if (requestedRolePrompts && hasOwn(requestedRolePrompts, npcId)) {
      npcRolePrompts[npcId] = requestedRolePrompts[npcId];
    }

    const currentExceptions = current.npcChannelExceptions[npcId];
    const requestedExceptions = requested.npcChannelExceptions?.[npcId];
    const mergedExceptions: Record<string, string> = {};
    for (const channelId of REGISTERED_CHANNEL_IDS) {
      if (hasOwn(currentExceptions, channelId)) {
        mergedExceptions[channelId] = currentExceptions[channelId];
      }
      if (requestedExceptions && hasOwn(requestedExceptions, channelId)) {
        mergedExceptions[channelId] = requestedExceptions[channelId];
      }
    }
    if (Object.keys(mergedExceptions).length > 0) {
      npcChannelExceptions[npcId] = mergedExceptions;
    }

    const currentDecisionPrompts = current.npcChannelDecisionPrompts[npcId];
    const requestedDecisionPrompts = requested.npcChannelDecisionPrompts?.[npcId];
    const mergedDecisionPrompts: Partial<Record<'email' | 'work_phone', string>> = {};
    for (const channelId of ['email', 'work_phone'] as const) {
      if (hasOwn(currentDecisionPrompts, channelId)) mergedDecisionPrompts[channelId] = currentDecisionPrompts[channelId];
      if (requestedDecisionPrompts && hasOwn(requestedDecisionPrompts, channelId)) {
        mergedDecisionPrompts[channelId] = requestedDecisionPrompts[channelId];
      }
    }
    if (Object.keys(mergedDecisionPrompts).length > 0) {
      npcChannelDecisionPrompts[npcId] = mergedDecisionPrompts as Record<'email' | 'work_phone', string>;
    }
  }

  return {
    ...current,
    // Thresholds are a designer-controlled deterministic rule. All other
    // workflow fields remain protected from this page's write request.
    supportTierThresholds: requested.supportTierThresholds ?? current.supportTierThresholds,
    npcRolePrompts,
    npcChannelExceptions,
    npcChannelDecisionPrompts,
  };
}

export async function GET(request: NextRequest) {
  const guard = authGuard(request, '工作流编辑');
  if (!guard.ok) return guard.response!;
  try {
    return NextResponse.json({ success: true, ...(await loadProjectOnePromptConfig()) });
  } catch (error) {
    console.error('Prompt config read failed', { code: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: '提示词配置暂时无法读取，请确认数据库迁移已执行。' }, { status: 503 });
  }
}
export async function PUT(request: NextRequest) {
  const guard = authGuard(request, '工作流编辑');
  if (!guard.ok || !guard.session) return guard.response!;
  try {
    const raw = await request.text();
    if (raw.length > 200_000) return NextResponse.json({ error: '提示词配置过大。' }, { status: 413 });
    const parsed = saveSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: '提示词配置字段无效。', details: parsed.error.flatten() }, { status: 400 });
    const current = await loadProjectOnePromptConfig();
    const editableConfig = mergeEditablePromptConfig(current.config, parsed.data.config);
    const saved = await saveProjectOnePromptConfig(editableConfig, parsed.data.expectedRevision, guard.session.userId);
    return NextResponse.json({ success: true, ...saved });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown';
    if (code === 'PROMPT_CONFIG_VERSION_CONFLICT') {
      return NextResponse.json({ error: '提示词已被其他设计师更新，请刷新后再保存。' }, { status: 409 });
    }
    console.error('Prompt config write failed', { code });
    return NextResponse.json({ error: '提示词保存失败，请确认数据库迁移已执行。' }, { status: 503 });
  }
}
