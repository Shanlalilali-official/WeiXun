import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { advanceRound } from '@/lib/game/state';
import { appendGameEvent, getOwnedGameSession, saveGameState } from '@/lib/game/repository';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  const { id } = await context.params;

  try {
    const gameSession = await getOwnedGameSession(id, guard.session.userId);
    const state = await saveGameState(id, advanceRound(gameSession.state));
    await appendGameEvent(id, state.currentRound, state.status === 'playing' ? 'round.advanced' : 'session.finished', {
      status: state.status,
      dimensions: state.dimensions,
    });
    return NextResponse.json({ success: true, state });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ROUND_ADVANCE_FAILED';
    return NextResponse.json({ error: code }, { status: 409 });
  }
}
