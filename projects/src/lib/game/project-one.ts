export const PROJECT_ONE_CODE = 'project-1';
export const PROJECT_ONE_MAX_ROUNDS = 5;
export const PROJECT_ONE_INITIAL_ACTION_POINTS = 28;

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
    initiallyVisible: false,
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
    actionPreferences: { roadshow: 3, visit: 2, video: 1, gift: -3, dinner: -2 },
  },
];

export function getProjectOneNpc(npcId: string): ProjectOneNpc | null {
  return PROJECT_ONE_NPCS.find((npc) => npc.id === npcId) ?? null;
}
