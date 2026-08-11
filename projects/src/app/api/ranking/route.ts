// 排行榜 API
import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { createServerClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = authGuard(request);
  if (!guard.ok) return guard.response!;

  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') ?? 'room'; // room | platform
  const timeframe = url.searchParams.get('timeframe') ?? 'all';
  const track = url.searchParams.get('track') ?? 'all';
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20');

  const supabase = createServerClient();

  // 房间榜：当前房间玩家的对局成绩
  if (tab === 'room') {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('status', 'finished')
      .order('total_score', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tab: 'room',
      items: data ?? [],
      summary: {
        avgScore: data ? Math.round(data.reduce((s, d) => s + (d.total_score ?? 0), 0) / data.length) : 0,
        maxScore: data ? Math.max(...data.map(d => d.total_score ?? 0)) : 0,
        totalCount: data?.length ?? 0,
      },
    });
  }

  // 全平台榜：所有用户总积分
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('player_ability')
    .select('*', { count: 'exact' })
    .order('best_score', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tab: 'platform',
    items: data ?? [],
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  });
}
