import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { FAST_ACCEPTANCE_ACCOUNT } from '@/lib/game/acceptance-mode';
import { replenishActionPointsRequestSchema } from '@/lib/contracts/game';
import { appendGameEvent, getOwnedGameSession, saveGameState } from '@/lib/game/repository';
import { replenishActionPoints } from '@/lib/game/state';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  if (guard.session.userId !== `u_${FAST_ACCEPTANCE_ACCOUNT.username}`) {
    return NextResponse.json({ error: 'FAST_ACCEPTANCE_ONLY' }, { status: 403 });
  }

  const parsed = replenishActionPointsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: '行动点数量无效', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const gameSession = await getOwnedGameSession(id, guard.session.userId);
    const state = await saveGameState(id, replenishActionPoints(gameSession.state, parsed.data.amount));
    await appendGameEvent(id, state.currentRound, 'acceptance.action-points.replenished', {
      amount: parsed.data.amount,
      actionPoints: state.actionPoints,
    });
    return NextResponse.json({ success: true, state, amount: parsed.data.amount });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ACTION_POINTS_REPLENISH_FAILED';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
