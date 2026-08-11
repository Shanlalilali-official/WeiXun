// 身份权限类型定义 + 辅助函数
export type Role = 'platform_designer' | 'enterprise_admin' | 'trainer' | 'player';
export type SubRole = 'enterprise_employee' | 'paid_individual';

export interface RoleConfig {
  role: Role;
  subRole?: SubRole;
  name: string;
  icon: string; // lucide icon name
  color: string; // DESIGN.md 增量规范色
  description: string;
  permissions: string[];
  canPlayGame: boolean;
  isSubSelectable: boolean;
}

export const ROLE_CONFIGS: Record<Role, RoleConfig> = {
  platform_designer: {
    role: 'platform_designer',
    name: '平台设计师',
    icon: 'Wand2',
    color: '#7C3AED',
    description: '搭建与维护整个平台',
    permissions: ['页面编辑', '数据表编辑', '工作流编辑', '权限管理', '全局配置'],
    canPlayGame: true,
    isSubSelectable: false,
  },
  enterprise_admin: {
    role: 'enterprise_admin',
    name: '企业管理员',
    icon: 'Building2',
    color: '#0EA5E9',
    description: '管理学院与员工',
    permissions: ['学员管理', '邀请码生成', '查看员工对话', '查看诊断报告', '批量下载报告'],
    canPlayGame: false,
    isSubSelectable: false,
  },
  trainer: {
    role: 'trainer',
    name: '培训教练',
    icon: 'Megaphone',
    color: '#EA580C',
    description: '组织多人联机实训',
    permissions: ['创建多人房间', '全局启停对局', '查看所有玩家数据', '阶段性点评'],
    canPlayGame: true,
    isSubSelectable: false,
  },
  player: {
    role: 'player',
    name: '玩家',
    icon: 'UserRound',
    color: '#2F6BFF',
    description: '参与博弈演练',
    permissions: ['选择场景', 'AI 实时对话', '查看诊断报告', '积累能力值'],
    canPlayGame: true,
    isSubSelectable: true,
  },
};

export interface Session {
  userId: string;
  role: Role;
  subRole?: SubRole;
  displayName: string;
  enterpriseId?: string;
  permissions: string[];
  expiresAt: number;
}

// 模拟 token 存储（生产应使用 JWT）
const sessionStore = new Map<string, Session>();

export function createSession(userId: string, role: Role, subRole?: SubRole, enterpriseId?: string): Session {
  const config = ROLE_CONFIGS[role];
  // displayName: 从 userId 抽手机号末 4 位 → "用户6105"；
  // 若 userId 不是 "u_<手机号>" 格式，则退化为 userId 末 4 位
  const phoneMatch = userId.match(/^u_(1[3-9]\d{9})$/);
  const tail = phoneMatch ? phoneMatch[1].slice(-4) : userId.slice(-4);
  const session: Session = {
    userId,
    role,
    subRole,
    displayName: `用户${tail}`,
    enterpriseId,
    permissions: config.permissions,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
  };
  const token = Buffer.from(JSON.stringify(session)).toString('base64');
  sessionStore.set(token, session);
  return session;
}

export function getSession(token: string | undefined): Session | null {
  if (!token) return null;
  // 1. 先查内存（同一进程内）
  let session = sessionStore.get(token);
  // 2. 退化：直接 base64 decode（无状态，serverless 友好）
  if (!session) {
    try {
      const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
      if (decoded && decoded.userId && decoded.role && decoded.expiresAt > Date.now()) {
        session = decoded as Session;
      }
    } catch {}
  }
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
}

export function hasPermission(session: Session | null, permission: string): boolean {
  if (!session) return false;
  return session.permissions.includes(permission);
}
