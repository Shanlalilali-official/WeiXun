import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/storage/database/supabase-client';

// POST /api/coach/rooms/[id]/end - 结束对局
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_rooms')
      .update({ status: '已结束' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
