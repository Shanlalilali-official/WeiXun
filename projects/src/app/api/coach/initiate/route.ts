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

    return NextResponse.json({ initiations: initiations || [] });
  } catch (error) {
    console.error('Failed to fetch initiations:', error);
    return NextResponse.json({ initiations: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      game_name,
      initiated_by,
      initiated_by_role,
      assigned_coach_id,
      is_multiplayer,
      allow_coach_view_reports,
      lock_id,
    } = body;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('game_initiations')
      .insert({
        game_name,
        initiated_by,
        initiated_by_role,
        assigned_coach_id,
        is_multiplayer,
        allow_coach_view_reports,
        lock_id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, initiation: data });
  } catch (error) {
    console.error('Failed to create initiation:', error);
    return NextResponse.json({ error: 'Failed to create initiation' }, { status: 500 });
  }
}
