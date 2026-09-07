import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { previewAiRequestSchema } from '@/lib/contracts/project-one-preview-ai';
import { PreviewAiError, previewAiService } from '@/lib/game/project-one-preview-ai';
import { runWithFastTestObservability } from '@/lib/testing/fast-test-observability';

export const runtime = 'nodejs';

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();

function consumeRequest(userId: string): boolean {
  const now = Date.now();
  if (rateBuckets.size > 1_000) {
    for (const [id, candidate] of rateBuckets) {
      if (now - candidate.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(id);
    }
    if (rateBuckets.size > 1_000 && !rateBuckets.has(userId)) return false;
  }
  const bucket = rateBuckets.get(userId);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const guard = authGuard(request);
  if (!guard.ok) return guard.response!;
  if (!consumeRequest(guard.session!.userId)) {
    return NextResponse.json({ error: '操作过于频繁，请稍后再试。' }, { status: 429 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 12_000) return NextResponse.json({ error: '五人预览 AI 请求过大' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: '五人预览 AI 请求不是有效 JSON' }, { status: 400 }); }
    const parsed = previewAiRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: '五人预览 AI 请求字段无效', details: parsed.error.flatten() }, { status: 400 });
    }
    const response = await runWithFastTestObservability(
      guard.session!.userId,
      () => previewAiService.execute(guard.session!.userId, parsed.data),
    );
    return NextResponse.json({ success: true, previewSessionId: response.previewSessionId, version: response.version, data: response });
  } catch (error) {
    if (error instanceof PreviewAiError || (error instanceof Error && ['protocol', 'unavailable', 'conflict', 'not_found', 'limit'].includes(String((error as PreviewAiError).kind)))) {
      const previewError = error as PreviewAiError;
      console.error('Project one preview AI request failed', { kind: previewError.kind, code: previewError.message.slice(0, 300) });
      const status = previewError.kind === 'unavailable' ? 503 : previewError.kind === 'conflict' ? 409 : previewError.kind === 'not_found' ? 404 : previewError.kind === 'limit' ? 429 : 502;
      const message = previewError.kind === 'unavailable'
        ? 'AI 服务暂时不可用，请稍后重试。'
        : previewError.kind === 'conflict'
          ? '当前预览会话正在处理上一条操作，请勿重复提交。'
          : previewError.kind === 'not_found'
            ? '预览会话不存在或已过期，请重新开始。'
            : previewError.kind === 'limit'
              ? '预览会话或 AI 请求过于繁忙，请稍后重试。'
          : 'AI 返回结果不符合预览协议，请重试。';
      return NextResponse.json({ error: message }, { status });
    }
    console.error('Project one preview AI request failed unexpectedly', error instanceof Error ? error.message : 'UNKNOWN_ERROR');
    return NextResponse.json({ error: '五人预览 AI 服务暂时不可用，请稍后重试。' }, { status: 503 });
  }
}
