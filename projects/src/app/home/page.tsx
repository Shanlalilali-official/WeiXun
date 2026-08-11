'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Clock, Trophy, TrendingUp, LogOut, User, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; displayName: string; role: string } | null>(null);
  const [stats, setStats] = useState({
    score: 73,
    weeklyHours: 12,
    totalHours: '38h24m',
    sessions: 12,
    wins: 7,
    losses: 5,
    winRate: 58,
  });

  useEffect(() => {
    // 读取身份 - 优先 localStorage，备选 cookie
    let identityData: string | null = null;
    
    // 方式1：从 localStorage 读取
    identityData = localStorage.getItem('coze_identity');
    
    // 方式2：从 cookie 读取（备份）
    if (!identityData) {
      const match = document.cookie.match(/(?:^| )coze_identity=([^;]+)/);
      if (match) {
        identityData = decodeURIComponent(match[1]);
      }
    }
    
    if (!identityData) {
      router.push('/');
      return;
    }
    
    try {
      setIdentity(JSON.parse(identityData));
    } catch (e) {
      console.error('Failed to parse identity:', e, identityData);
      router.push('/');
    }
  }, [router]);

  const handleLogout = async () => {
    document.cookie = 'coze_session=; path=/; max-age=0';
    document.cookie = 'coze_identity=; path=/; max-age=0';
    localStorage.removeItem('coze_identity');
    localStorage.removeItem('coze_session');
    router.push('/');
  };

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      {/* 顶部状态栏 */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-base font-semibold text-foreground">竞标博弈 · 政企销售实训</span>
            </div>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/home" className="px-3 py-1.5 text-primary font-medium rounded">首页</Link>
              <Link href="/setup" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">开始对局</Link>
              <Link href="/ranking" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">排行榜</Link>
              <Link href="/knowledge" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">知识库</Link>
              <Link href="/room" className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded">多人房间</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {identity && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">{identity.name}</span>
                <span className="text-[10px] text-muted-foreground">· {identity.role}</span>
              </div>
            )}
            <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 欢迎语 + 4 指标卡 */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">早上好，{identity?.displayName || '同学'}</h1>
          <p className="text-sm text-muted-foreground">今天是 2025 年 1 月 15 日 · 你的政企销售竞标实训已就绪</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">综合能力得分</span>
              <span className="text-[10px] text-success">↑ +5 本周</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.score}<span className="text-sm text-muted-foreground">/100</span></div>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">累计实训时长</span>
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.totalHours}</div>
            <div className="text-[10px] text-muted-foreground mt-1">本周 {stats.weeklyHours}h</div>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">对局数</span>
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.sessions}<span className="text-sm text-muted-foreground"> 场</span></div>
            <div className="text-[10px] text-muted-foreground mt-1">胜 {stats.wins} · 负 {stats.losses}</div>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">胜率</span>
              <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.winRate}<span className="text-sm text-muted-foreground">%</span></div>
            <div className="text-[10px] text-success mt-1">↑ 8%</div>
          </div>
        </div>

        {/* 竞标博弈城 + 4 hotspot */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">竞标博弈城</h2>
              <p className="text-xs text-muted-foreground mt-0.5">点击建筑徽标或文字气泡进入对应模块</p>
            </div>
            <div className="text-xs text-muted-foreground">4 个功能入口</div>
          </div>

          <div className="relative aspect-[16/9] bg-surface-container">
            <img
              src="/game-park.webp"
              alt="竞标博弈城"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = '/game-park.jpg'; }}
            />

            {/* 4 个 hotspot */}
            <Link
              href="/start"
              className="absolute z-10 group transition-transform hover:scale-110"
              style={{ left: '50%', top: '39%' }}
            >
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
                <span className="relative w-14 h-14 rounded-full bg-primary border-2 border-card flex items-center justify-center shadow-lg">
                  <Trophy className="w-6 h-6 text-primary-foreground" />
                </span>
                <div className="absolute left-1/2 -translate-x-1/2 top-16 whitespace-nowrap px-3 py-1.5 rounded bg-card border border-border text-sm font-semibold text-foreground">
                  游戏入口
                </div>
              </div>
            </Link>

            <Link
              href="/ranking"
              className="absolute z-10 group transition-transform hover:scale-110"
              style={{ left: '21%', top: '41%' }}
            >
              <div className="relative">
                <span className="w-14 h-14 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-primary" />
                </span>
                <div className="absolute left-1/2 -translate-x-1/2 top-16 whitespace-nowrap px-3 py-1.5 rounded bg-card border border-border text-sm font-semibold text-foreground">
                  历史对局
                </div>
              </div>
            </Link>

            <Link
              href="/result"
              className="absolute z-10 group transition-transform hover:scale-110"
              style={{ left: '64%', top: '38%' }}
            >
              <div className="relative">
                <span className="w-14 h-14 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </span>
                <div className="absolute left-1/2 -translate-x-1/2 top-16 whitespace-nowrap px-3 py-1.5 rounded bg-card border border-border text-sm font-semibold text-foreground">
                  个人能力得分
                </div>
              </div>
            </Link>

            <Link
              href="/knowledge"
              className="absolute z-10 group transition-transform hover:scale-110"
              style={{ left: '43%', top: '78%' }}
            >
              <div className="relative">
                <span className="w-14 h-14 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-lg">
                  <Building2 className="w-6 h-6 text-primary" />
                </span>
                <div className="absolute left-1/2 -translate-x-1/2 top-16 whitespace-nowrap px-3 py-1.5 rounded bg-card border border-border text-sm font-semibold text-foreground">
                  知识库入口
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
