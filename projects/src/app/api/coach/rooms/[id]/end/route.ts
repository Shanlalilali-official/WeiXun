import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { createServerClient } from '@/storage/database/supabase-client';

const COACH_ROLES = new Set(['trainer', 'enterprise_admin', 'platform_designer']);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = authGuard(request);
  if (!g.ok || !g.session) return g.response!;
  const { id } = await context.params;
  const supabase = createServerClient();
  const { data: room } = await supabase.from('multiplayer_rooms').select('host_user_id,status').eq('id', id).single();
  if (!room) return NextResponse.json({ error: 'ROOM_NOT_FOUND' }, { status: 404 });
  if (room.host_user_id !== g.session.userId && !COACH_ROLES.has(g.session.role)) return NextResponse.json({ error: '权限不足' }, { status: 403 });
  if (room.status === 'finished' || room.status === 'cancelled') return NextResponse.json({ success: true, idempotent: true });
  const { error } = await supabase.from('multiplayer_rooms').update({ status: 'finished', stage_deadline_at: null, updated_at: new Date().toISOString() }).eq('id', id).in('status', ['waiting', 'running']);
  if (error) return NextResponse.json({ error: 'ROOM_END_FAILED' }, { status: 503 });
  return NextResponse.json({ success: true });
}
