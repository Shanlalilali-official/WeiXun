import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { createGameSessionRequestSchema } from '@/lib/contracts/game';
import { createGameSession } from '@/lib/game/repository';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;

  const parsed = createGameSessionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: '对局创建参数无效', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const gameSession = await createGameSession(
      guard.session.userId,
      guard.session.displayName,
      parsed.data.scenarioCode,
    );
    return NextResponse.json({ success: true, gameSession });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SESSION_CREATE_FAILED';
    const status = code === 'SCENARIO_NOT_CONFIGURED' ? 409 : 503;
    return NextResponse.json({ error: code }, { status });
  }
}
