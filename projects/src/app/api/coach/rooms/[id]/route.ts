import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { createServerClient } from '@/storage/database/supabase-client';

const COACH_ROLES = new Set(['trainer', 'enterprise_admin', 'platform_designer']);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = authGuard(request);
  if (!g.ok || !g.session) return g.response!;
  const { id } = await context.params;
  const { data, error } = await createServerClient().from('multiplayer_rooms').select('*, multiplayer_company_slots(*)').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'ROOM_NOT_FOUND' }, { status: 404 });
  if (data.host_user_id !== g.session.userId && !COACH_ROLES.has(g.session.role)) return NextResponse.json({ error: '权限不足' }, { status: 403 });
  return NextResponse.json({ data });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = authGuard(request);
  if (!g.ok || !g.session) return g.response!;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const supabase = createServerClient();
  const { data: room } = await supabase.from('multiplayer_rooms').select('host_user_id,status,current_stage').eq('id', id).single();
  if (!room || (room.host_user_id !== g.session.userId && !COACH_ROLES.has(g.session.role))) return NextResponse.json({ error: '权限不足' }, { status: 403 });
  if (body.action === 'force_ready' && typeof body.slotId === 'string') {
    const stage = body.stage === undefined ? room.current_stage : body.stage;
    if (!Number.isInteger(stage) || stage !== room.current_stage || stage < 1 || stage > 5 || room.status !== 'running') {
      return NextResponse.json({ error: 'ROOM_STAGE_INVALID' }, { status: 400 });
    }
    const { error } = await supabase.from('multiplayer_company_slots').update({ ready_stage: stage, ready_by_admin: true, updated_at: new Date().toISOString() }).eq('id', body.slotId).eq('room_id', id);
    return error ? NextResponse.json({ error: 'FORCE_READY_FAILED' }, { status: 503 }) : NextResponse.json({ success: true });
  }
  if (body.action === 'remove_player' && typeof body.slotId === 'string') {
    const { error } = await supabase.from('multiplayer_company_slots').update({ player_user_id: null, game_session_id: null, connected: false, ready_stage: null, ready_by_admin: false, updated_at: new Date().toISOString() }).eq('id', body.slotId).eq('room_id', id);
    return error ? NextResponse.json({ error: 'REMOVE_PLAYER_FAILED' }, { status: 503 }) : NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'ROOM_ACTION_INVALID' }, { status: 400 });
}
