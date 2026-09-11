import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authGuard } from '@/lib/auth/guard';
import { projectOnePromptConfigSchema } from '@/lib/designer/prompt-config';
import {
  loadProjectOnePromptConfig,
  saveProjectOnePromptConfig,
} from '@/lib/designer/prompt-config-repository';

export const runtime = 'nodejs';

const saveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  config: projectOnePromptConfigSchema,
}).strict();

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
    const saved = await saveProjectOnePromptConfig(parsed.data.config, parsed.data.expectedRevision, guard.session.userId);
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
