import { NextResponse } from 'next/server';
import { createAdminClient } from '@/storage/database/supabase-client';

// GET /api/coach/players - 获取玩家数据（含房间、小组信息）
export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // 获取所有玩家及其对局信息
    const { data, error } = await supabase
      .from('user_identities')
      .select(`
        *,
        game_sessions(
          id,
          room_code,
          group_name,
          status,
          score
        )
      `)
      .eq('role', 'player')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 扁平化数据
    const players = (data || []).map((player: any) => ({
      id: player.id,
      username: player.username,
      room_code: player.game_sessions?.[0]?.room_code || '-',
      group_name: player.game_sessions?.[0]?.group_name || '-',
      status: player.game_sessions?.[0]?.status || '未开始',
      score: player.game_sessions?.[0]?.score || 0,
    }));

    return NextResponse.json({ success: true, data: players });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
