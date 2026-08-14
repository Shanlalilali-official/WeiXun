'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, LogOut, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

export type Role = 'platform_designer' | 'enterprise_admin' | 'trainer' | 'player' | string;

export interface AppShellProps {
  identity: { name?: string; displayName?: string; role?: Role } | null;
  activeNav?: 'home' | 'setup' | 'ranking' | 'knowledge' | 'room';
  roleAccent?: Role;
  wsConnected?: boolean;
  children: ReactNode;
}

const ROLE_BG: Record<string, string> = {
  platform_designer: 'bg-role-designer',
  enterprise_admin: 'bg-role-admin',
  trainer: 'bg-role-trainer',
  player: 'bg-role-player',
};

const ROLE_LABEL: Record<string, string> = {
  platform_designer: '平台设计师',
  enterprise_admin: '企业管理员',
  trainer: '培训教练',
  player: '玩家',
};

const ROLE_COLOR: Record<string, string> = {
  platform_designer: '#7C3AED',
  enterprise_admin: '#0EA5E9',
  trainer: '#EA580C',
  player: '#2F6BFF',
};

const NAV_ITEMS = [
  { key: 'home', href: '/home', label: '首页' },
  { key: 'setup', href: '/setup', label: '开始对局' },
  { key: 'ranking', href: '/ranking', label: '排行榜' },
  { key: 'knowledge', href: '/knowledge', label: '知识库' },
  { key: 'room', href: '/room', label: '多人房间' },
] as const;

export function AppShell({ identity, activeNav, roleAccent, wsConnected, children }: AppShellProps) {
  const router = useRouter();
  const accent = (roleAccent || identity?.role || 'player') as Role;
  const bgClass = ROLE_BG[accent] || 'bg-app-shell';
  const roleLabel = ROLE_LABEL[accent] || identity?.role || '用户';

  const handleLogout = () => {
    document.cookie = 'weixun_session=; path=/; max-age=0';
    document.cookie = 'weixun_identity=; path=/; max-age=0';
    try {
      localStorage.removeItem('weixun_identity');
      localStorage.removeItem('weixun_session');
    } catch {}
    router.push('/');
  };

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <header className="topbar-glass sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/home" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="hidden sm:inline text-sm font-semibold text-foreground whitespace-nowrap">
                竞标博弈 · 政企销售实训
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`nav-item ${activeNav === item.key ? 'nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {typeof wsConnected === 'boolean' && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                {wsConnected ? (
                  <Wifi className="w-3.5 h-3.5 text-success" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>{wsConnected ? '实时同步中' : 'WS 预留'}</span>
              </div>
            )}
            {identity && (
              <div
                className="hidden sm:flex px-2.5 py-1.5 rounded-lg text-xs font-medium items-center gap-1.5 text-white shadow-sm"
                style={{ background: ROLE_COLOR[accent] || '#2F6BFF' }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">
                  {identity.displayName || identity.name || roleLabel}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-6 sm:py-8">{children}</main>
    </div>
  );
}

export { ROLE_COLOR, ROLE_LABEL, ROLE_BG };