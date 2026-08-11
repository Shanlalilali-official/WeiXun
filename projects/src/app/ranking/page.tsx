'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Trophy, ArrowUp, ChevronUp, Award, ArrowUpRight, ArrowDownRight, Crown, Users, BarChart3 } from 'lucide-react';

interface RoomPlayer { rank: number; name: string; enterprise: string; role: string; score: number; bid: number; margin: number; approval: number; duration: string; isMe?: boolean; }
interface PlatformPlayer { rank: number; name: string; region: string; enterprise: string; level: number; score: number; wins: number; winRate: number; streak: number; lastActive: string; }

export default function RankingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">加载中...</div>}>
      <RankingInner />
    </Suspense>
  );
}

function RankingInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialTab = params.get('tab') === 'platform' ? 'platform' : 'room';
  const [tab, setTab] = useState<'room' | 'platform'>(initialTab);
  const [roomData, setRoomData] = useState<{ me: any; roomPlayers: RoomPlayer[]; roomSummary: any } | null>(null);
  const [platformData, setPlatformData] = useState<{ me: any; platformPlayers: PlatformPlayer[] } | null>(null);
  const [timeRange, setTimeRange] = useState('all');
  const [track, setTrack] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ranking?tab=${tab}&range=${timeRange}&track=${track}`)
      .then((r) => r.json())
      .then((data) => {
        if (tab === 'room') {
          setRoomData({
            me: null,
            roomPlayers: (data.items || []).map((item: any, idx: number) => ({
              rank: idx + 1,
              name: item.player_name || `玩家${item.player_id || idx + 1}`,
              enterprise: item.enterprise || '未知企业',
              role: item.role || '玩家',
              score: item.total_score || 0,
              bid: item.bid_amount || 0,
              margin: item.profit_margin || 0,
              approval: item.approval_rate || 0,
              duration: item.duration || '0分钟',
              isMe: false,
            })),
            roomSummary: data.summary || null,
          });
        } else {
          setPlatformData({
            me: null,
            platformPlayers: (data.items || []).map((item: any, idx: number) => ({
              rank: idx + 1,
              name: item.player_name || `玩家${item.player_id || idx + 1}`,
              region: item.region || '未知',
              enterprise: item.enterprise || '未知企业',
              level: item.level || 1,
              score: item.best_score || 0,
              wins: item.total_wins || 0,
              winRate: item.win_rate || 0,
              streak: item.win_streak || 0,
              lastActive: item.last_active || '未知',
            })),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [tab, timeRange, track]);

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      <header className="h-16 bg-card border-b border-border px-8 flex items-center">
        <Trophy className="w-5 h-5 text-warning mr-2" />
        <span className="text-base font-semibold text-foreground">排行榜</span>
        <span className="ml-3 text-xs text-muted-foreground">智慧政务 v3.2 · 第 38 场</span>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-6">
        {/* 4 个指标卡 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '当前房间人数', value: '8', icon: Users, color: 'text-primary' },
            { label: '我的本场排名', value: '4/8', delta: '↑2', icon: BarChart3, color: 'text-success' },
            { label: '我的总积分', value: '12,680', delta: '+820', icon: Trophy, color: 'text-warning' },
            { label: '累计对局数', value: '47 场', delta: '连胜 3', icon: Award, color: 'text-primary' },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <Icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">{m.value}</span>
                  {m.delta && <span className="text-xs text-success font-semibold">{m.delta}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab 切换 */}
        <div className="bg-card rounded-t-2xl border border-border border-b-0 px-6 flex items-center gap-8">
          {[
            { id: 'room', label: '当前房间榜' },
            { id: 'platform', label: '全平台榜' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`relative py-4 text-sm font-semibold ${tab === t.id ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {t.label}
              {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-b-2xl border border-border border-t-0 p-6">
          {tab === 'platform' && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">时间：</span>
                {['week', 'month', 'season', 'all'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1 rounded-full text-xs ${timeRange === r ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'}`}
                  >
                    {r === 'week' ? '本周' : r === 'month' ? '本月' : r === 'season' ? '本季' : '全部'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-muted-foreground">赛道：</span>
                {['all', 'gov', 'public', 'mfg', 'central', 'private'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTrack(t)}
                    className={`px-3 py-1 rounded-full text-xs ${track === t ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground'}`}
                  >
                    {t === 'all' ? '综合' : t === 'gov' ? '政府' : t === 'public' ? '事业单位' : t === 'mfg' ? '制造' : t === 'central' ? '央企' : '民企'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
          ) : tab === 'room' && roomData ? (
            <>
              <div className="space-y-2">
                {(roomData.roomPlayers || []).map((p) => (
                  <div
                    key={p.rank}
                    className={`h-14 rounded-lg flex items-center px-4 ${
                      p.isMe
                        ? 'bg-primary/5 border-2 border-primary relative'
                        : p.rank <= 3
                        ? 'bg-gradient-to-r from-amber-50 to-transparent border border-amber-200'
                        : 'border border-border hover:bg-surface-container/50'
                    }`}
                  >
                    {p.rank <= 3 && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-300 to-amber-500" />}
                    <div className="w-12 flex items-center justify-center">
                      {p.rank === 1 && <Crown className="w-5 h-5 text-amber-500" />}
                      {p.rank === 2 && <span className="text-2xl">🥈</span>}
                      {p.rank === 3 && <span className="text-2xl">🥉</span>}
                      {p.rank > 3 && <span className="text-base font-semibold text-foreground">{p.rank}</span>}
                    </div>
                    <div className="flex-1 ml-4">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {p.name}
                        {p.isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">我</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{p.enterprise} · {p.role}</div>
                    </div>
                    <div className="w-20 text-right">
                      <div className="text-[10px] text-muted-foreground">总得分</div>
                      <div className="text-sm font-semibold text-foreground num">{p.score}</div>
                    </div>
                    <div className="w-20 text-right">
                      <div className="text-[10px] text-muted-foreground">中标额</div>
                      <div className="text-sm font-semibold text-foreground num">¥{p.bid}万</div>
                    </div>
                    <div className="w-16 text-right">
                      <div className="text-[10px] text-muted-foreground">利润率</div>
                      <div className="text-sm font-semibold text-success num">+{p.margin}%</div>
                    </div>
                    <div className="w-16 text-right">
                      <div className="text-[10px] text-muted-foreground">好评度</div>
                      <div className="text-sm font-semibold text-foreground num">{p.approval}%</div>
                    </div>
                  </div>
                ))}
              </div>

              {roomData.roomSummary && (
                <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-border">
                  {[
                    { label: '房间平均分', value: roomData.roomSummary.avgScore },
                    { label: '最高分', value: roomData.roomSummary.maxScore },
                    { label: '中标率', value: `${roomData.roomSummary.bidRate}%` },
                    { label: '平均利润率', value: `+${roomData.roomSummary.avgMargin}%` },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
                      <div className="text-lg font-bold text-foreground num">{s.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : tab === 'platform' && platformData ? (
            <div className="space-y-2">
              {(platformData.platformPlayers || []).map((p) => (
                <div key={p.rank} className="h-14 rounded-lg border border-border flex items-center px-4 hover:bg-surface-container/50">
                  <div className="w-12 text-center">
                    <span className="text-sm font-semibold text-foreground">{p.rank}</span>
                  </div>
                  <div className="flex-1 ml-4 flex items-center gap-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{p.region} · {p.enterprise}</div>
                    </div>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      p.level >= 10 ? 'bg-amber-500 text-white' :
                      p.level >= 7 ? 'bg-purple-500 text-white' :
                      p.level >= 4 ? 'bg-primary text-primary-foreground' :
                      'bg-gray-200 text-foreground'
                    }`}>
                      Lv.{p.level}
                    </span>
                  </div>
                  <div className="w-20 text-right text-sm font-semibold text-foreground num">{p.score}</div>
                  <div className="w-20 text-right text-sm text-foreground num">{p.wins}胜</div>
                  <div className="w-16 text-right text-sm text-foreground num">{p.winRate}%</div>
                  <div className="w-16 text-right text-sm text-success num">{p.streak}连</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* 返回结果页 FAB */}
        <button
          onClick={() => router.back()}
          className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition"
          title="返回"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      </main>
    </div>
  );
}
