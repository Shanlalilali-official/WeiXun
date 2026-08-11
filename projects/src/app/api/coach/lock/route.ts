import { NextResponse } from 'next/server';
import { createServerClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: locks, error } = await supabase
      .from('scenario_locks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ locks: locks || [] });
  } catch (error) {
    console.error('Failed to fetch locks:', error);
    return NextResponse.json({ locks: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locked_client, locked_vendor, locked_scenario, locked_by, invite_code } = body;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('scenario_locks')
      .insert({
        locked_client,
        locked_vendor,
        locked_scenario,
        locked_by,
        invite_code,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, lock: data });
  } catch (error) {
    console.error('Failed to create lock:', error);
    return NextResponse.json({ error: 'Failed to create lock' }, { status: 500 });
  }
}
