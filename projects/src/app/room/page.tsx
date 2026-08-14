'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, LogOut, ShieldCheck, Users, Crown, MessageSquare,
  Play, Pause, Square, Mic, Send, TrendingUp, Trophy, Settings,
  Wifi, WifiOff, Megaphone, Eye, Copy, Activity,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';

interface Player {
  id: string;
  name: string;
  level: number;
  score: number;
  rank: number;
  status: 'idle' | 'thinking' | 'speaking' | 'paused';
  lastAction: string;
}

const SEED_PLAYERS: Player[] = [
  { id: 'p1', name: '李新华', level: 7, score: 78, rank: 1, status: 'speaking', lastAction: '向客户强调等保三级优势' },
  { id: 'p2', name: '张明远', level: 6, score: 65, rank: 2, status: 'thinking', lastAction: '正在准备应对竞品' },
  { id: 'p3', name: '陈晓燕', level: 5, score: 52, rank: 3, status: 'speaking', lastAction: '提到本地化部署' },
  { id: 'p4', name: '王浩然', level: 4, score: 41, rank: 4, status: 'idle', lastAction: '等待中' },
  { id: 'p5', name: '赵宇轩', level: 3, score: 33, rank: 5, status: 'paused', lastAction: '已暂停' },
];

export default function RoomPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; role: string; permissions: string[] } | null>(null);
  const [players, setPlayers] = useState(SEED_PLAYERS);
  const [roomState, setRoomState] = useState<'running' | 'paused' | 'stopped'>('running');
  const [round, setRound] = useState(3);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let data = localStorage.getItem('weixun_identity');
    if (!data) {
      const match = document.cookie.match(/(?:^| )weixun_identity=([^;]+)/);
      if (match) data = decodeURIComponent(match[1]);
    }
    if (!data) { router.push('/'); return; }
    try { setIdentity(JSON.parse(data)); }
    catch { router.push('/'); }
    // WebSocket 预留（本期不实现实际通信）
    setWsConnected(false);
  }, [router]);

  const handleLogout = () => {
    document.cookie = 'weixun_session=; path=/; max-age=0';
    document.cookie = 'weixun_identity=; path=/; max-age=0';
    localStorage.removeItem('weixun_identity');
    localStorage.removeItem('weixun_session');
    router.push('/');
  };

  const isTrainer = identity?.role === 'trainer';
  const isDesigner = identity?.role === 'platform_designer';

  const statusColor = (s: Player['status']) => {
    if (s === 'speaking') return '#16A37B';
    if (s === 'thinking') return '#EA580C';
    if (s === 'paused') return '#9CA3AF';
    return '#6B7280';
  };

  const statusLabel = (s: Player['status']) => {
    if (s === 'speaking') return '对话中';
    if (s === 'thinking') return '思考中';
    if (s === 'paused') return '已暂停';
    return '空闲';
  };

  return (
    <AppShell identity={identity} activeNav="room" roleAccent={identity?.role} wsConnected={wsConnected}>
      {/* 房间头 */}
      <div className="card-elevated p-5 mb-6 flex items-center justify-between animate-fade-up">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">房间号</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-foreground font-mono tracking-wider num">R-8821</div>
              <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="border-l border-border pl-6">
            <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">当前轮次</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-foreground font-mono num">{round} / 10</div>
              <div className="w-20 h-1.5 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${(round / 10) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="border-l border-border pl-6">
            <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">在线人数</div>
            <div className="text-2xl font-bold text-foreground flex items-center gap-1.5 num">
              <Users className="w-5 h-5 text-primary" />
              {players.length} / 8
            </div>
          </div>
          <div className="border-l border-border pl-6">
            <div className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">状态</div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <span className="relative w-2 h-2 rounded-full" style={{ background: roomState === 'running' ? '#16A37B' : roomState === 'paused' ? '#EA580C' : '#9CA3AF' }}>
                {roomState === 'running' && <span className="absolute inset-0 rounded-full bg-success/40 animate-ping" />}
              </span>
              <span className="text-foreground">
                {roomState === 'running' ? '进行中' : roomState === 'paused' ? '已暂停' : '已结束'}
              </span>
            </div>
          </div>
        </div>
        {(isTrainer || isDesigner) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRoomState(roomState === 'running' ? 'paused' : 'running')}
              className="h-9 px-3.5 rounded-lg btn-glass text-foreground text-sm font-medium flex items-center gap-1.5"
            >
              {roomState === 'running' ? <><Pause className="w-3.5 h-3.5" />暂停</> : <><Play className="w-3.5 h-3.5" />继续</>}
            </button>
            <button
              onClick={() => alert('演示：发送教练点评 — 实际会通过 WebSocket 广播给所有玩家')}
              className="h-9 px-3.5 rounded-lg btn-glass text-foreground text-sm font-medium flex items-center gap-1.5"
            >
              <Megaphone className="w-3.5 h-3.5" />点评
            </button>
            <button
              onClick={() => { if (confirm('确定强制结束本房间所有对局？')) { setRoomState('stopped'); alert('已强制结束（演示）'); } }}
              className="h-9 px-3.5 rounded-lg btn-warning text-sm font-medium flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />强制结束
            </button>
          </div>
        )}
      </div>

      {/* 三栏布局：玩家列表 + 动态时间线 + 教练工具 */}
      <div className="grid grid-cols-1 lg:grid-cols-[288px_1fr_288px] gap-4">
        {/* 左：玩家列表 */}
        <aside className="card-elevated p-4 animate-fade-up-1">
          <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center justify-between uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              玩家实时状态
            </div>
            <span className="badge badge-primary">{players.length}</span>
          </div>
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="p-3 rounded-lg border border-border hover:border-primary/40 hover:-translate-y-0.5 transition-all bg-card">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold text-white shrink-0"
                      style={{
                        background: p.rank === 1
                          ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
                          : p.rank === 2
                          ? 'linear-gradient(135deg, #E0E0E0 0%, #B0B0B0 100%)'
                          : p.rank === 3
                          ? 'linear-gradient(135deg, #CD7F32 0%, #B8732A 100%)'
                          : 'linear-gradient(135deg, #2F6BFF 0%, #4574FF 100%)',
                      }}
                    >
                      {p.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground flex items-center gap-1 truncate">
                        <span className="truncate">{p.name}</span>
                        {p.rank === 1 && <Crown className="w-3 h-3 shrink-0" style={{ color: '#FFD700' }} />}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Lv.{p.level}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-foreground num">{p.score}</div>
                    <div className="text-[10px] text-muted-foreground"># {p.rank}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: statusColor(p.status) }}>
                    {p.status === 'speaking' && <span className="absolute inset-0 rounded-full bg-success/40 animate-ping" />}
                  </span>
                  <span className="font-medium" style={{ color: statusColor(p.status) }}>{statusLabel(p.status)}</span>
                  <span className="truncate">· {p.lastAction}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* 中：动态时间线 */}
        <section className="card-elevated p-5 animate-fade-up-2">
          <div className="text-xs font-semibold text-muted-foreground mb-4 flex items-center justify-between uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              房间动态时间线
            </div>
            <span className="badge badge-primary">实时</span>
          </div>
          <div className="space-y-3 relative">
            <div className="absolute left-[60px] top-2 bottom-2 w-px bg-border" />
            {[
              { t: '14:32:18', who: '李新华', action: '向张局长强调"等保三级 2.0 全链路国密"', score: '+5' },
              { t: '14:31:45', who: '陈晓燕', action: '回应"已有 12 个委办局对接经验"', score: '+3' },
              { t: '14:30:50', who: '竞品 (华为云)', action: '抛出价格战话术：总价降 8%', score: '' },
              { t: '14:30:12', who: '张明远', action: '尝试应对，但未及时反击竞品', score: '-2' },
              { t: '14:29:00', who: '陈教练', action: '全局点评："注意在第三层决策人那里多停留"', score: '' },
              { t: '14:28:30', who: '李新华', action: '进入第 3 轮对局', score: '' },
            ].map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-sm relative">
                <div className="text-[11px] text-muted-foreground font-mono w-14 shrink-0 mt-1.5 relative">
                  <span className="absolute -left-[7px] top-2.5 w-2 h-2 rounded-full bg-primary/40 border-2 border-card" />
                  {e.t}
                </div>
                <div className="flex-1 pl-2">
                  <span className="font-semibold text-foreground">{e.who}</span>
                  <span className="text-muted-foreground ml-2">{e.action}</span>
                </div>
                {e.score && (
                  <div
                    className={`badge shrink-0 ${e.score.startsWith('-') ? 'badge-danger' : 'badge-success'}`}
                  >
                    {e.score}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-border text-center text-xs text-muted-foreground">
            实时 WebSocket 通信接口已预留（/api/ws/room）— 本期不实现
          </div>
        </section>

        {/* 右：教练工具 */}
        <aside className="space-y-3 animate-fade-up-3">
          <div className="card-elevated p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
              <Settings className="w-3.5 h-3.5" />
              教练管控工具
            </div>
            <div className="space-y-2 text-sm">
              <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-surface-container text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Eye className="w-3.5 h-3.5" />观看某玩家视角
              </button>
              <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-surface-container text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="w-3.5 h-3.5" />私聊某玩家
              </button>
              <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-surface-container text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Mic className="w-3.5 h-3.5" />全场语音广播
              </button>
              <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-surface-container text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <TrendingUp className="w-3.5 h-3.5" />推送产品知识片段
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
              {(isTrainer || isDesigner) ? (
                <span className="badge badge-trainer">你有管控权限</span>
              ) : (
                <span>需要培训教练/平台设计师身份</span>
              )}
            </div>
          </div>

          <div className="card-elevated p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" />
              房间排行榜
            </div>
            <div className="space-y-2">
              {players.sort((a, b) => a.rank - b.rank).map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.rank === 1 ? <Crown className="w-3.5 h-3.5" style={{ color: '#FFD700' }} /> :
                     p.rank === 2 ? <span className="text-sm">🥈</span> :
                     p.rank === 3 ? <span className="text-sm">🥉</span> :
                     <span className="w-4 text-xs font-mono text-muted-foreground text-center num">{p.rank}</span>}
                    <span className="text-foreground truncate">{p.name}</span>
                  </div>
                  <span className="text-foreground font-semibold num">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
