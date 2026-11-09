import {
  projectOneOnboardingSnapshotSchema,
  type ProjectOneOnboardingSnapshot,
} from '@/lib/contracts/project-one-onboarding';
import inventory from './project-one-onboarding-inventory.json';

const snapshots = inventory.snapshots.map((snapshot) => projectOneOnboardingSnapshotSchema.parse(snapshot));
const byId = new Map(snapshots.map((snapshot) => [snapshot.brief.id, snapshot]));

export function getProjectOneOnboardingCatalog() {
  return {
    industries: inventory.industries,
    businesses: inventory.businesses,
    scenarios: snapshots.map(({ brief }) => brief),
  };
}

export function resolveProjectOneOnboarding(id: string): ProjectOneOnboardingSnapshot | undefined {
  const snapshot = byId.get(id);
  return snapshot ? structuredClone(snapshot) : undefined;
}

const roleSections: Readonly<Record<string, readonly string[]>> = {
  'P1-001': ['业务现状'],
  'P1-002': ['业务现状', '技术需求', '实施与采购', '交付与验收'],
  'P1-003': ['实施与采购'],
  'P1-004': ['技术需求', '交付与验收'],
  'P1-005': [],
};

export function projectOneOnboardingPrompt(snapshot: ProjectOneOnboardingSnapshot | undefined, npcId: string): string {
  const person = snapshot?.brief.people.find(({ id }) => id === npcId);
  if (!snapshot || !person) return '';
  const { brief } = snapshot;
  const roleContext = snapshot.dossier.sections.filter(({ title }) => roleSections[npcId]?.includes(title));
  const context = {
    customer: brief.clientName,
    project: brief.projectName,
    title: person.title,
    publicOverview: brief.overview,
    publicFacts: brief.facts,
    publicDetails: brief.details,
    roleContext,
  };
  return [
    '## 本局客户项目档案',
    '项目名称、客户和当前人物职务以这份对局档案为准。沿用人物原有职责、对话阶段和披露边界。',
    '角色参考资料供你判断如何回应，不能整表转述。标为待沟通的内容尚待确认，不得说成已知事实。超出职责或资料的问题请说明需向对应人员核实。',
    '仅依据客户档案和玩家实际提供的信息讨论方案，不替玩家假定供应商产品或交付能力。',
    JSON.stringify(context),
  ].join('\n');
}
