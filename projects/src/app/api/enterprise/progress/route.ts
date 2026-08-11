import { NextResponse } from 'next/server';
import { createAdminClient } from '@/storage/database/supabase-client';

// GET /api/enterprise/progress - 获取游戏进度
export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // 统计不同状态的对局数量
    const { data: sessions, error } = await supabase
      .from('game_sessions')
      .select('status');

    if (error) throw error;

    const progress = [
      { status: '未开始', count: sessions?.filter((s: any) => s.status === '未开始').length || 0 },
      { status: '进行中', count: sessions?.filter((s: any) => s.status === '进行中').length || 0 },
      { status: '已完成', count: sessions?.filter((s: any) => s.status === '已完成').length || 0 },
    ];

    return NextResponse.json({ success: true, data: progress });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
