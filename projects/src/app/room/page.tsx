'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, LogOut, ShieldCheck, Users, Crown, MessageSquare,
  Play, Pause, Square, Mic, Send, TrendingUp, Trophy, Settings,
  Wifi, WifiOff, Megaphone, Eye,
} from 'lucide-react';

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
    let data = localStorage.getItem('coze_identity');
    if (!data) {
      const match = document.cookie.match(/(?:^| )coze_identity=([^;]+)/);
      if (match) data = decodeURIComponent(match[1]);
    }
    if (!data) { router.push('/'); return; }
    try { setIdentity(JSON.parse(data)); }
    catch { router.push('/'); }
    // WebSocket 预留（本期不实现实际通信）
    setWsConnected(false);
  }, [router]);

  const handleLogout = () => {
    document.cookie = 'coze_session=; path=/; max-age=0';
    document.cookie = 'coze_identity=; path=/; max-age=0';
    localStorage.removeItem('coze_identity');
    localStorage.removeItem('coze_session');
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

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      {/* 顶栏 */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-base font-semibold text-foreground">竞标博弈 · 政企销售实训</span>
            </div>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/home" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">首页</Link>
              <Link href="/setup" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">开始对局</Link>
              <Link href="/ranking" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">排行榜</Link>
              <Link href="/knowledge" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">知识库</Link>
              <Link href="/room" className="px-3 py-1.5 text-primary font-medium rounded">多人房间</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {wsConnected ? <Wifi className="w-3.5 h-3.5 text-success" /> : <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />}
              <span>{wsConnected ? '实时同步中' : 'WS 预留'}</span>
            </div>
            {identity && (
              <div
                className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 text-white"
                style={{ background: identity.role === 'platform_designer' ? '#7C3AED' : identity.role === 'enterprise_admin' ? '#0EA5E9' : identity.role === 'trainer' ? '#EA580C' : '#2F6BFF' }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {identity.name}
              </div>
            )}
            <button onClick={handleLogout} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" title="退出登录">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-6">
        {/* 房间头 */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">房间号</div>
              <div className="text-2xl font-bold text-foreground font-mono tracking-wider">R-8821</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">当前轮次</div>
              <div className="text-2xl font-bold text-foreground font-mono">{round} / 10</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">在线人数</div>
              <div className="text-2xl font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-5 h-5 text-primary" />
                {players.length} / 8
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">状态</div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: roomState === 'running' ? '#16A37B' : roomState === 'paused' ? '#EA580C' : '#9CA3AF' }} />
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
                className="h-9 px-3 rounded-lg border border-border bg-card text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-muted"
              >
                {roomState === 'running' ? <><Pause className="w-3.5 h-3.5" />暂停</> : <><Play className="w-3.5 h-3.5" />继续</>}
              </button>
              <button
                onClick={() => alert('演示：发送教练点评 — 实际会通过 WebSocket 广播给所有玩家')}
                className="h-9 px-3 rounded-lg border border-border bg-card text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-muted"
              >
                <Megaphone className="w-3.5 h-3.5" />点评
              </button>
              <button
                onClick={() => { if (confirm('确定强制结束本房间所有对局？')) { setRoomState('stopped'); alert('已强制结束（演示）'); } }}
                className="h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-1.5 text-white"
                style={{ background: '#EA580C' }}
              >
                <Square className="w-3.5 h-3.5" />强制结束
              </button>
            </div>
          )}
        </div>

        {/* 三栏布局：玩家列表 + 动态时间线 + 教练工具 */}
        <div className="grid grid-cols-[288px_1fr_288px] gap-4">
          {/* 左：玩家列表 */}
          <aside className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              玩家实时状态
            </div>
            <div className="space-y-2">
              {players.map(p => (
                <div key={p.id} className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold text-white" style={{ background: p.rank === 1 ? '#FFD700' : p.rank === 2 ? '#C0C0C0' : p.rank === 3 ? '#CD7F32' : '#2F6BFF' }}>
                        {p.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground flex items-center gap-1">
                          {p.name}
                          {p.rank === 1 && <Crown className="w-3 h-3" style={{ color: '#FFD700' }} />}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Lv.{p.level}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground">{p.score}</div>
                      <div className="text-[10px] text-muted-foreground"># {p.rank}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(p.status) }} />
                    {p.lastAction}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* 中：动态时间线 */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              房间动态时间线
            </div>
            <div className="space-y-3">
              {[
                { t: '14:32:18', who: '李新华', action: '向张局长强调"等保三级 2.0 全链路国密"', score: '+5' },
                { t: '14:31:45', who: '陈晓燕', action: '回应"已有 12 个委办局对接经验"', score: '+3' },
                { t: '14:30:50', who: '竞品 (华为云)', action: '抛出价格战话术：总价降 8%', score: '' },
                { t: '14:30:12', who: '张明远', action: '尝试应对，但未及时反击竞品', score: '-2' },
                { t: '14:29:00', who: '陈教练', action: '全局点评："注意在第三层决策人那里多停留"', score: '' },
                { t: '14:28:30', who: '李新华', action: '进入第 3 轮对局', score: '' },
              ].map((e, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="text-xs text-muted-foreground font-mono w-16 shrink-0 mt-0.5">{e.t}</div>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{e.who}</span>
                    <span className="text-muted-foreground ml-2">{e.action}</span>
                  </div>
                  {e.score && (
                    <div className="text-xs font-semibold shrink-0" style={{ color: e.score.startsWith('-') ? '#EA580C' : '#16A37B' }}>
                      {e.score}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border text-center text-xs text-muted-foreground">
              实时 WebSocket 通信接口已预留（/api/ws/room）— 本期不实现
            </div>
          </section>

          {/* 右：教练工具 */}
          <aside className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                教练管控工具
              </div>
              <div className="space-y-2 text-sm">
                <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-muted text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-muted/70 disabled:opacity-50">
                  <Eye className="w-3.5 h-3.5" />观看某玩家视角
                </button>
                <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-muted text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-muted/70 disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />私聊某玩家
                </button>
                <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-muted text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-muted/70 disabled:opacity-50">
                  <Mic className="w-3.5 h-3.5" />全场语音广播
                </button>
                <button disabled={!isTrainer && !isDesigner} className="w-full h-9 px-3 rounded-lg bg-muted text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-muted/70 disabled:opacity-50">
                  <TrendingUp className="w-3.5 h-3.5" />推送产品知识片段
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
                {(isTrainer || isDesigner) ? '你有管控权限' : '需要培训教练/平台设计师身份'}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                房间排行榜
              </div>
              <div className="space-y-2">
                {players.sort((a, b) => a.rank - b.rank).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs font-mono text-muted-foreground">{p.rank}</span>
                      <span className="text-foreground">{p.name}</span>
                    </div>
                    <span className="text-foreground font-semibold">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
