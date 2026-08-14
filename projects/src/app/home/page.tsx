'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Clock, Trophy, TrendingUp, ArrowUpRight, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/app-shell';

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
    identityData = localStorage.getItem('weixun_identity');

    // 方式2：从 cookie 读取（备份）
    if (!identityData) {
      const match = document.cookie.match(/(?:^| )weixun_identity=([^;]+)/);
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

  const metrics = [
    {
      label: '综合能力得分',
      value: stats.score,
      unit: '/100',
      icon: Sparkles,
      accent: 'from-blue-500 to-indigo-500',
      chip: '↑ +5 本周',
      chipTone: 'text-success',
      tintBg: 'rgba(47,107,255,0.10)',
      tintFg: '#2F6BFF',
    },
    {
      label: '累计实训时长',
      value: stats.totalHours,
      unit: '',
      icon: Clock,
      accent: 'from-violet-500 to-fuchsia-500',
      chip: `本周 ${stats.weeklyHours}h`,
      chipTone: 'text-muted-foreground',
      tintBg: 'rgba(124,58,237,0.10)',
      tintFg: '#7C3AED',
    },
    {
      label: '对局数',
      value: stats.sessions,
      unit: '场',
      icon: TrendingUp,
      accent: 'from-amber-500 to-orange-500',
      chip: `胜 ${stats.wins} · 负 ${stats.losses}`,
      chipTone: 'text-muted-foreground',
      tintBg: 'rgba(245,158,11,0.12)',
      tintFg: '#B45309',
    },
    {
      label: '胜率',
      value: stats.winRate,
      unit: '%',
      icon: Trophy,
      accent: 'from-emerald-500 to-teal-500',
      chip: '↑ 8%',
      chipTone: 'text-success',
      tintBg: 'rgba(22,163,123,0.12)',
      tintFg: '#16A37B',
    },
  ];

  const hotspots = [
    { href: '/start', left: '50%', top: '39%', icon: Trophy, label: '游戏入口', primary: true },
    { href: '/ranking', left: '21%', top: '41%', icon: Clock, label: '历史对局', primary: false },
    { href: '/result', left: '64%', top: '38%', icon: TrendingUp, label: '个人能力得分', primary: false },
    { href: '/knowledge', left: '43%', top: '78%', icon: Building2, label: '知识库入口', primary: false },
  ];

  return (
    <AppShell identity={identity} activeNav="home" roleAccent={identity?.role}>
      {/* 欢迎语 + 4 指标卡 */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="badge badge-primary">实时</span>
          <span className="text-xs text-muted-foreground">今天是 2025 年 1 月 15 日</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-1">
          早上好，<span className="text-gradient-primary">{identity?.displayName || '同学'}</span>
        </h1>
        <p className="text-sm text-muted-foreground">你的政企销售竞标实训已就绪，开始今天的博弈演练吧</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`card-elevated p-5 animate-fade-up-${Math.min(idx + 1, 3)}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground font-medium">{m.label}</span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: m.tintBg }}
                >
                  <Icon className="w-4 h-4" style={{ color: m.tintFg }} />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 num">
                <span className="text-3xl font-bold text-foreground">{m.value}</span>
                <span className="text-sm text-muted-foreground">{m.unit}</span>
              </div>
              <div className={`text-[11px] mt-1.5 ${m.chipTone} font-medium`}>{m.chip}</div>
              <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${m.accent} opacity-80`} />
            </div>
          );
        })}
      </div>

      {/* 竞标博弈城 + 4 hotspot */}
      <div className="card-elevated overflow-hidden animate-fade-up-2">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
          <div>
            <h2 className="text-lg font-semibold text-foreground">竞标博弈城</h2>
            <p className="text-xs text-muted-foreground mt-0.5">点击建筑徽标或文字气泡进入对应模块</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-muted">{hotspots.length} 个功能入口</span>
          </div>
        </div>

        <div className="relative aspect-[16/9] bg-gradient-to-br from-surface-container to-surface-container-high overflow-hidden">
          <img
            src="/game-park.webp"
            alt="竞标博弈城"
            className="absolute inset-0 w-full h-full object-cover opacity-95"
            onError={(e) => { (e.target as HTMLImageElement).src = '/game-park.jpg'; }}
          />

          {/* 4 个 hotspot */}
          {hotspots.map((h) => {
            const Icon = h.icon;
            return (
              <Link
                key={h.href}
                href={h.href}
                className="absolute z-10 group"
                style={{ left: h.left, top: h.top, transform: 'translate(-50%, -50%)' }}
              >
                <div className="relative transition-transform duration-200 group-hover:scale-110">
                  {h.primary && (
                    <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
                  )}
                  <span
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-2 border-card ${
                      h.primary ? 'btn-primary' : 'bg-card border-primary text-primary'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${h.primary ? 'text-primary-foreground' : 'text-primary'}`} />
                  </span>
                  <div className="absolute left-1/2 -translate-x-1/2 top-16 whitespace-nowrap px-3 py-1.5 rounded-lg bg-card/95 backdrop-blur border border-border text-sm font-semibold text-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {h.label}
                    <ArrowUpRight className="inline-block w-3 h-3 ml-1 -mt-0.5 text-primary" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
