import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { relationshipActionRequestSchema } from '@/lib/contracts/game';
import { appendGameEvent, getOwnedGameSession, saveGameState } from '@/lib/game/repository';
import { applyRelationshipAction } from '@/lib/game/state';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  const parsed = relationshipActionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: '关系动作参数无效', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const gameSession = await getOwnedGameSession(id, guard.session.userId);
    const changedState = applyRelationshipAction(gameSession.state, parsed.data.npcId, parsed.data.actionId);
    const state = await saveGameState(id, changedState);
    await appendGameEvent(id, state.currentRound, 'relationship.action', {
      actionId: parsed.data.actionId,
      actionPoints: state.actionPoints,
      affinity: state.npcAffinity[parsed.data.npcId],
    }, parsed.data.npcId);
    return NextResponse.json({ success: true, state });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ACTION_FAILED';
    const status = code === 'ACTION_POINTS_INSUFFICIENT' ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
