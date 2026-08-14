import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  await context.params;
  return NextResponse.json({
    error: 'SIMULATED_TIME_DOES_NOT_REQUIRE_PAUSE',
    message: '模拟时间只会在成功操作后推进，离开页面即自然停留。',
  }, { status: 410 });
}
