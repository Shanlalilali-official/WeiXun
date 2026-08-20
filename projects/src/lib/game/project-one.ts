export const PROJECT_ONE_CODE = 'project-1';
export const PROJECT_ONE_MAX_ROUNDS = 5;
export const PROJECT_ONE_INITIAL_ACTION_POINTS = 28;
/** Legacy time constants are retained only to read old saves. */
export const PROJECT_ONE_PHASE_DURATION_MS = 0;
export const PROJECT_ONE_DAY_START_MINUTE = 9 * 60;
export const PROJECT_ONE_STANDARD_DAY_MINUTES = 8 * 60;
export const PROJECT_ONE_WORK_END_MINUTE = 17 * 60;
export const PROJECT_ONE_OVERTIME_END_MINUTE = 19 * 60;
export const PROJECT_ONE_EVENING_END_MINUTE = 22 * 60;
export const PROJECT_ONE_PHASE_ACTION_POINT_GAIN = 8;
export const PROJECT_ONE_ACTION_POINT_CAP = 28;

export const PROJECT_ONE_PHASE_NAMES = [
  '初识建联',
  '信息摸底',
  '关系深化',
  '方案推动',
  '决策冲刺',
] as const;

export type ContactChannel = 'email' | 'work_phone' | 'wechat' | 'online' | 'offline';

export const PROJECT_ONE_COMMUNICATION_MINUTES = {
  wechat: 0,
  online: 0,
  email: 10,
  work_phone: 15,
  offline: 0,
} as const satisfies Record<ContactChannel, number>;

export const PROJECT_ONE_COMMUNICATION_POINTS = {
  wechat: 1,
  online: 1,
  email: 1,
  work_phone: 1,
  offline: 0,
} as const satisfies Record<ContactChannel, number>;

export const PROJECT_ONE_VISIT_RULES = {
  short: { durationMinutes: 5, maxTurns: 2 },
  formal: { durationMinutes: 40, maxTurns: 6 },
  informal: { durationMinutes: 60, maxTurns: 5 },
} as const;

export const PROJECT_ONE_PREPARATION_RULES = {
  visit_preparation: { timeMinutes: 0, costPoints: 3, reusable: true },
  /** Legacy save compatibility; new clients cannot create these types. */
  agenda: { timeMinutes: 0, costPoints: 1, reusable: true },
  ppt: { timeMinutes: 0, costPoints: 4, reusable: true },
  materials: { timeMinutes: 0, costPoints: 2, reusable: true },
  courtesy_gift: { timeMinutes: 0, costPoints: 3, reusable: false },
  boundary_gift: { timeMinutes: 0, costPoints: 8, reusable: false },
} as const;

export const PROJECT_ONE_PREPARATION_TITLES: Record<keyof typeof PROJECT_ONE_PREPARATION_RULES, string> = {
  visit_preparation: '拜访前准备',
  agenda: '历史准备记录',
  ppt: '历史方案材料',
  materials: '历史项目材料',
  courtesy_gift: '历史合规伴手礼',
  boundary_gift: '历史边界礼品',
};

export const PROJECT_ONE_PUBLIC_RESEARCH_RULE = {
  timeMinutes: 0,
  costPoints: 2,
} as const;

export interface ProjectOnePublicProfile {
  facts: string[];
  weakSignals: string[];
  sourceNote: string;
}

/**
 * Publicly obtainable information only. These records intentionally exclude
 * private interests, hidden attitudes, decision weights and win conditions.
 */
export const PROJECT_ONE_PUBLIC_PROFILES: Record<string, ProjectOnePublicProfile> = {
  'p1-frontline-wang-hao': {
    facts: ['现任项目一线办事员，日常负责业务材料流转与跨部门协调。', '曾参与单位内部的数据汇总与流程整理工作。'],
    weakSignals: ['公开工作记录多次提到重复录入与跨部门确认成本，可能重视方案是否真正减轻一线负担。'],
    sourceNote: '单位公开通讯与公开岗位信息整理',
  },
  'p1-procurement-liu-kai': {
    facts: ['现任采购专员，工作范围覆盖采购流程、供应商材料与合规核验。', '参加过单位公开的采购规范与数字化采购培训。'],
    weakSignals: ['公开活动记录中频繁出现验收依据、交付边界和流程留痕，可能优先关注可审计性。'],
    sourceNote: '公开采购培训与岗位信息整理',
  },
  'p1-minister-chen-jianguo': {
    facts: ['现任业务部部长，负责业务部门整体推进与项目落地协调。', '曾在单位内部公开交流中介绍业务数字化与部门协同。'],
    weakSignals: ['公开表述更强调规模化落地与部门整体成效，方案准备应避免只描述单点功能。'],
    sourceNote: '单位公开交流与部门介绍整理',
  },
  'p1-deputy-zhao-feng': {
    facts: ['现任分管业务副主任，负责业务方向与重点项目统筹。', '近期公开讲话强调重点项目要形成可衡量成果并守住合规底线。'],
    weakSignals: ['更可能从组织成果、实施风险和可复制性判断方案，而非只看产品参数。'],
    sourceNote: '公开讲话与单位新闻整理',
  },
};

export type ProjectOneClue =
  | 'decision_process'
  | 'performance_goal'
  | 'procurement_priority'
  | 'personal_interest'
  | 'key_contact';

export interface ProjectOneNpc {
  id: string;
  projectId: 1;
  category: '高层' | '中层' | '一线';
  name: string;
  title: string;
  gender: string;
  age: number | null;
  hometown: string;
  personality: string;
  weakness: string;
  initiallyVisible: boolean;
  initialContactChannel: Extract<ContactChannel, 'email' | 'work_phone'>;
  decisionWeight: number;
  complianceSensitivity: number;
  actionPreferences: Partial<Record<string, number>>;
}

export const PROJECT_ONE_COMPETITORS = [
  {
    company_name: 'ABC竞品',
    features: '既有客情与价格竞争',
    more_info: '具体报价和项目动作需要在对局中继续收集。',
    project_id: 1,
  },
];

/** Private opening knowledge is deliberately asymmetric by company. */
export const PROJECT_ONE_COMPANY_PERSONAL_INFO: Record<string, Record<string, string[]>> = {
  'player-company': {
    'p1-frontline-wang-hao': ['我方曾在公开交流活动中与王浩有过短暂接触，但不了解其项目态度。'],
  },
  'abc-company': {
    'p1-procurement-liu-kai': ['ABC曾参与刘凯经手的另一项供应商材料核验，熟悉其对留痕和验收边界的重视。'],
    'p1-minister-chen-jianguo': ['ABC通过既有客情知道陈建国近期更关注可量化的部门整体成果。'],
  },
};

/** 来源：项目内“各项目人物表.docx”的最新导入版本。 */
export const PROJECT_ONE_NPCS: ProjectOneNpc[] = [
  {
    id: 'p1-frontline-wang-hao',
    projectId: 1,
    category: '一线',
    name: '王浩',
    title: '一线办事员',
    gender: '男',
    age: null,
    hometown: '未提供',
    personality: '四种性格之一，由场景初始化确定',
    weakness: '工作减负、绩效加分或个人业余爱好',
    initiallyVisible: true,
    initialContactChannel: 'work_phone',
    decisionWeight: 0.1,
    complianceSensitivity: 45,
    actionPreferences: { tea: 2, festival: 1, gift: -1, roadshow: 1 },
  },
  {
    id: 'p1-procurement-liu-kai',
    projectId: 1,
    category: '一线',
    name: '刘凯',
    title: '采购专员',
    gender: '男',
    age: null,
    hometown: '未提供',
    personality: '老虎型或孔雀型，由场景初始化确定',
    weakness: '评优晋升或家庭育儿需求',
    initiallyVisible: true,
    initialContactChannel: 'email',
    decisionWeight: 0.2,
    complianceSensitivity: 80,
    actionPreferences: { sample: 2, video: 1, gift: -2, dinner: -1 },
  },
  {
    id: 'p1-minister-chen-jianguo',
    projectId: 1,
    category: '中层',
    name: '陈建国',
    title: '业务部部长',
    gender: '男',
    age: null,
    hometown: '未提供',
    personality: '老虎型',
    weakness: '职称评级、行业个人口碑或子女升学',
    initiallyVisible: true,
    initialContactChannel: 'work_phone',
    decisionWeight: 0.3,
    complianceSensitivity: 70,
    actionPreferences: { roadshow: 2, visit: 2, tea: 1, gift: -3 },
  },
  {
    id: 'p1-deputy-zhao-feng',
    projectId: 1,
    category: '高层',
    name: '赵峰',
    title: '分管业务副主任',
    gender: '男',
    age: null,
    hometown: '未提供',
    personality: '老虎型，年富力强',
    weakness: '政绩考核与新项目落地成果',
    initiallyVisible: true,
    initialContactChannel: 'work_phone',
    decisionWeight: 0.4,
    complianceSensitivity: 85,
    actionPreferences: { roadshow: 3, visit: 2, video: 1, gift: -3, dinner: -2 },
  },
];

export function getProjectOneNpc(npcId: string): ProjectOneNpc | null {
  return PROJECT_ONE_NPCS.find((npc) => npc.id === npcId) ?? null;
}
