import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { getOwnedGameSession } from '@/lib/game/repository';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  const { id } = await context.params;

  try {
    const gameSession = await getOwnedGameSession(id, guard.session.userId);
    return NextResponse.json({ success: true, gameSession });
  } catch {
    return NextResponse.json({ error: '对局不存在或无权访问' }, { status: 404 });
  }
}
