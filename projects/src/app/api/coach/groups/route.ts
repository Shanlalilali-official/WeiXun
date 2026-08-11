import { NextResponse } from 'next/server';
import { createAdminClient } from '@/storage/database/supabase-client';

// GET /api/coach/groups - 获取小组列表
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
