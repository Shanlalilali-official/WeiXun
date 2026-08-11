import { NextResponse } from 'next/server';
import { createServerClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: initiations, error } = await supabase
      .from('game_initiations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const records = (initiations || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      room_code: r.room_code || `RM-${String(r.id).padStart(4, '0')}`,
      delegate_to_coach: r.is_multiplayer,
      allow_coach_view: r.allow_coach_view_reports,
      status: r.status === 'pending' ? '等待中' : r.status === 'active' ? '进行中' : '已结束',
      player_count: 0,
      created_at: r.created_at,
    }));

    return NextResponse.json({ data: records });
  } catch (error) {
    console.error('Failed to fetch initiations:', error);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      delegate_to_coach,
      allow_coach_view,
    } = body;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('game_initiations')
      .insert({
        is_multiplayer: delegate_to_coach ?? false,
        allow_coach_view_reports: allow_coach_view ?? false,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: {
      id: data.id,
      room_code: data.room_code || `RM-${String(data.id).padStart(4, '0')}`,
      delegate_to_coach: data.is_multiplayer,
      allow_coach_view: data.allow_coach_view_reports,
      status: data.status,
      player_count: 0,
      created_at: data.created_at,
    }});
  } catch (error) {
    console.error('Failed to create initiation:', error);
    return NextResponse.json({ error: 'Failed to create initiation' }, { status: 500 });
  }
}
