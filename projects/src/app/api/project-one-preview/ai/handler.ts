import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { PreviewAiError, toPreviewRecoveryDto, type PreviewServerState } from '@/lib/game/project-one-preview-ai';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PreviewRecoveryRepository = {
  load(userId: string, previewSessionId: string): Promise<PreviewServerState>;
};

function recoveryErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PreviewAiError && error.kind === 'not_found') {
    return NextResponse.json({ error: '预览会话不存在或已过期，请重新开始。' }, { status: 404 });
  }
  return null;
}

/**
 * Restore the authenticated designer's preview state. Keeping the repository
 * injectable makes the ownership boundary testable without a live database.
 */
export async function getPreviewRecoveryResponse(
  request: NextRequest,
  repository: PreviewRecoveryRepository,
) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  if (guard.session.role !== 'platform_designer') return NextResponse.json({ error: '权限不足' }, { status: 403 });
  const previewSessionId = request.nextUrl.searchParams.get('previewSessionId')?.trim();
  if (!previewSessionId || !UUID_PATTERN.test(previewSessionId)) {
    return NextResponse.json({ error: '预览会话不存在或已过期，请重新开始。' }, { status: 404 });
  }
  try {
    const state = await repository.load(guard.session.userId, previewSessionId);
    return NextResponse.json({ success: true, data: toPreviewRecoveryDto(state, { includeNpcTestStates: true }) });
  } catch (error) {
    const known = recoveryErrorResponse(error);
    if (known) return known;
    console.error('Project one preview recovery failed', { code: 'PREVIEW_RECOVERY_UNEXPECTED_ERROR' });
    return NextResponse.json({ error: '五人预览状态暂时不可恢复，请稍后重试。' }, { status: 503 });
  }
}
