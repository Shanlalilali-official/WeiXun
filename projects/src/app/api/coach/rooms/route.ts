import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/storage/database/supabase-client';

// GET /api/coach/rooms - 获取房间列表
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST /api/coach/rooms - 创建房间
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { max_groups = 33, players_per_group = 3 } = body;

    const supabase = createAdminClient();
    
    // 生成随机房间号
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: roomCode,
        max_players: max_groups * players_per_group,
        current_players: 0,
        status: '未开始',
        game_mode: 'overview',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
