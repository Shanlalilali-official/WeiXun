'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Trophy, ArrowUp, ChevronUp, Award, ArrowUpRight, ArrowDownRight, Crown, Users, BarChart3, Flame, Target } from 'lucide-react';
import { AppShell } from '@/components/app-shell';

interface RoomPlayer { rank: number; name: string; enterprise: string; role: string; score: number; bid: number; margin: number; approval: number; duration: string; isMe?: boolean; }
interface PlatformPlayer { rank: number; name: string; region: string; enterprise: string; level: number; score: number; wins: number; winRate: number; streak: number; lastActive: string; }
interface RoomSummary { avgScore: number | null; maxScore: number | null; bidRate: number; avgMargin: number; }
interface RankingApiItem {
  player_id?: string | number;
  player_name?: string;
  enterprise?: string;
  role?: string;
  total_score?: number;
  bid_amount?: number;
  profit_margin?: number;
  approval_rate?: number;
  duration?: string;
  region?: string;
  level?: number;
  best_score?: number;
  total_wins?: number;
  win_rate?: number;
  win_streak?: number;
  last_active?: string;
}

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
  const [roomData, setRoomData] = useState<{ me: null; roomPlayers: RoomPlayer[]; roomSummary: RoomSummary | null } | null>(null);
  const [platformData, setPlatformData] = useState<{ me: null; platformPlayers: PlatformPlayer[] } | null>(null);
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
            roomPlayers: (data.items || []).map((item: RankingApiItem, idx: number) => ({
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
            platformPlayers: (data.items || []).map((item: RankingApiItem, idx: number) => ({
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
    <AppShell identity={null} activeNav="ranking">
      {/* 4 个指标卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: '当前房间人数', value: '8', icon: Users, color: '#2F6BFF', tintBg: 'rgba(47,107,255,0.10)', delta: '' },
          { label: '我的本场排名', value: '4/8', icon: BarChart3, color: '#16A37B', tintBg: 'rgba(22,163,123,0.10)', delta: '↑2' },
          { label: '我的总积分', value: '12,680', icon: Trophy, color: '#B45309', tintBg: 'rgba(245,158,11,0.12)', delta: '+820' },
          { label: '累计对局数', value: '47 场', icon: Flame, color: '#7C3AED', tintBg: 'rgba(124,58,237,0.10)', delta: '连胜 3' },
        ].map((m, idx) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className={`card-elevated p-5 animate-fade-up-${Math.min(idx + 1, 3)}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-medium">{m.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: m.tintBg }}>
                  <Icon className="w-4 h-4" style={{ color: m.color }} />
                </div>
              </div>
              <div className="flex items-baseline gap-2 num">
                <span className="text-2xl font-bold text-foreground">{m.value}</span>
                {m.delta && <span className="badge badge-success">{m.delta}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab 切换 */}
      <div className="bg-card rounded-t-2xl border border-border border-b-0 px-6 flex items-center gap-1 sticky top-16 z-10 backdrop-blur">
        {[
          { id: 'room', label: '当前房间榜' },
          { id: 'platform', label: '全平台榜' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'room' | 'platform')}
            className={`relative py-4 px-4 text-sm font-semibold transition-colors ${
              tab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {tab === t.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-b-2xl border border-border border-t-0 p-6">
        {tab === 'platform' && (
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">时间：</span>
              {['week', 'month', 'season', 'all'].map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    timeRange === r
                      ? 'btn-primary text-primary-foreground shadow-sm'
                      : 'border border-border text-foreground hover:border-primary/50'
                  }`}
                >
                  {r === 'week' ? '本周' : r === 'month' ? '本月' : r === 'season' ? '本季' : '全部'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">赛道：</span>
              {['all', 'gov', 'public', 'mfg', 'central', 'private'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTrack(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    track === t
                      ? 'btn-primary text-primary-foreground shadow-sm'
                      : 'border border-border text-foreground hover:border-primary/50'
                  }`}
                >
                  {t === 'all' ? '综合' : t === 'gov' ? '政府' : t === 'public' ? '事业单位' : t === 'mfg' ? '制造' : t === 'central' ? '央企' : '民企'}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            加载中...
          </div>
        ) : tab === 'room' && roomData ? (
          <>
            <div className="space-y-2.5">
              {(roomData.roomPlayers || []).map((p, idx) => {
                const rowClass = p.isMe
                  ? 'row-me relative'
                  : p.rank === 1
                  ? 'row-gold relative'
                  : p.rank === 2
                  ? 'row-silver relative'
                  : p.rank === 3
                  ? 'row-bronze relative'
                  : 'relative border border-border hover:border-primary/30 hover:-translate-y-0.5 transition-all';
                return (
                  <div
                    key={p.rank}
                    className={`h-16 rounded-xl flex items-center px-5 animate-fade-up ${rowClass}`}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="w-14 flex items-center justify-center shrink-0">
                      {p.rank === 1 && <Crown className="w-6 h-6" style={{ color: '#FFD700' }} />}
                      {p.rank === 2 && <span className="text-2xl">🥈</span>}
                      {p.rank === 3 && <span className="text-2xl">🥉</span>}
                      {p.rank > 3 && <span className="text-lg font-semibold text-foreground num">{p.rank}</span>}
                    </div>
                    <div className="flex-1 ml-4 min-w-0">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="truncate">{p.name}</span>
                        {p.isMe && <span className="badge badge-primary">我</span>}
                        {p.rank === 1 && <span className="badge badge-warning" style={{ background: 'rgba(255,215,0,0.18)', color: '#B45309' }}>榜首</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.enterprise} · {p.role}</div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">总得分</div>
                      <div className="text-base font-bold text-foreground num">{p.score}</div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">中标额</div>
                      <div className="text-base font-semibold text-foreground num">¥{p.bid}万</div>
                    </div>
                    <div className="w-20 text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">利润率</div>
                      <div className="text-base font-semibold text-success num">+{p.margin}%</div>
                    </div>
                    <div className="w-20 text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">好评度</div>
                      <div className="text-base font-semibold text-foreground num">{p.approval}%</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {roomData.roomSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border">
                {[
                  { label: '房间平均分', value: roomData.roomSummary.avgScore, icon: BarChart3 },
                  { label: '最高分', value: roomData.roomSummary.maxScore, icon: Trophy },
                  { label: '中标率', value: `${roomData.roomSummary.bidRate}%`, icon: Target },
                  { label: '平均利润率', value: `+${roomData.roomSummary.avgMargin}%`, icon: ArrowUp },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="text-center p-3 rounded-xl bg-surface-container">
                      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1.5">
                        <Icon className="w-3 h-3" />
                        {s.label}
                      </div>
                      <div className="text-xl font-bold text-foreground num">{s.value}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === 'platform' && platformData ? (
          <div className="space-y-2.5">
            {(platformData.platformPlayers || []).map((p, idx) => (
              <div
                key={p.rank}
                className={`h-14 rounded-xl border border-border flex items-center px-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all bg-card animate-fade-up`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="w-12 text-center">
                  {p.rank <= 3 ? (
                    <span className="text-lg">{p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'}</span>
                  ) : (
                    <span className="text-sm font-semibold text-foreground num">{p.rank}</span>
                  )}
                </div>
                <div className="flex-1 ml-4 flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.region} · {p.enterprise}</div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold ${
                    p.level >= 10 ? 'lvl-gold' :
                    p.level >= 7 ? 'lvl-purple' :
                    p.level >= 4 ? 'lvl-blue' :
                    'lvl-iron'
                  }`}>
                    Lv.{p.level}
                  </span>
                </div>
                <div className="w-24 text-right text-base font-bold text-foreground num">{p.score}</div>
                <div className="w-20 text-right text-sm text-foreground num">{p.wins}胜</div>
                <div className="w-16 text-right text-sm text-foreground num">{p.winRate}%</div>
                <div className="w-20 text-right text-sm text-success font-semibold num">{p.streak}连</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* 返回结果页 FAB */}
      <button
        onClick={() => router.back()}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full btn-primary text-primary-foreground shadow-float flex items-center justify-center hover:scale-110 transition-transform"
        title="返回"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </AppShell>
  );
}
