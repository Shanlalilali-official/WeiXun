import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { multiplayerReadyRequestSchema } from '@/lib/contracts/game';
import { createServerClient } from '@/storage/database/supabase-client';

const RPC_ERROR_STATUS: Record<string, number> = {
  ROOM_NOT_FOUND: 404,
  NOT_A_ROOM_PLAYER: 403,
  ROOM_NOT_RUNNING: 409,
  ALL_COMPANIES_REQUIRE_PLAYERS: 409,
  ROOM_VERSION_CONFLICT: 409,
};

const RPC_ERROR_CODES = new Set(Object.keys(RPC_ERROR_STATUS));

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ROOM_NOT_FOUND' }, { status: 404 });
  const parsed = multiplayerReadyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ROOM_READY_INVALID', details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await createServerClient().rpc('mark_multiplayer_ready', {
    p_room_id: id,
    p_user_id: guard.session.userId,
    p_expected_stage: parsed.data.expectedStage,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error || !data) {
    const code = error?.message?.split(/\s|:/, 1)[0] ?? 'ROOM_READY_FAILED';
    return NextResponse.json({ error: RPC_ERROR_CODES.has(code) ? code : 'ROOM_READY_FAILED' }, { status: RPC_ERROR_STATUS[code] ?? 503 });
  }
  return NextResponse.json(data);
}
