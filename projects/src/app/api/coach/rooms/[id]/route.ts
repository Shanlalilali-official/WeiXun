import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/storage/database/supabase-client';

// GET /api/coach/rooms/[id] - 获取房间详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PUT /api/coach/rooms/[id] - 更新房间（修改游戏模式等）
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { game_mode } = body;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_rooms')
      .update({ game_mode })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
