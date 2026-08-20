import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { createServerClient } from '@/storage/database/supabase-client';
import { allCompaniesOccupied, nextStageDeadline } from '@/lib/game/multiplayer';

const COACH_ROLES = new Set(['trainer', 'enterprise_admin', 'platform_designer']);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = authGuard(request);
  if (!g.ok || !g.session) return g.response!;
  const { id } = await context.params;
  const supabase = createServerClient();
  const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', id).single();
  if (!room) return NextResponse.json({ error: 'ROOM_NOT_FOUND' }, { status: 404 });
  if (room.host_user_id !== g.session.userId && !COACH_ROLES.has(g.session.role)) return NextResponse.json({ error: '权限不足' }, { status: 403 });
  const { data: slots } = await supabase.from('multiplayer_company_slots').select('player_user_id').eq('room_id', id);
  if (!allCompaniesOccupied((slots ?? []).map((slot) => ({ playerUserId: slot.player_user_id, readyStage: null, connected: true })))) return NextResponse.json({ error: 'ALL_COMPANIES_REQUIRE_PLAYERS' }, { status: 409 });
  const deadline = nextStageDeadline(room.stage_duration_seconds);
  const { data, error } = await supabase.from('multiplayer_rooms').update({ status: 'running', current_stage: 1, stage_deadline_at: deadline, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'waiting').select('*').single();
  if (error || !data) return NextResponse.json({ error: 'ROOM_START_FAILED' }, { status: 409 });
  return NextResponse.json({ data });
}
