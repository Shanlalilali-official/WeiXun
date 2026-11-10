import {
  projectOnePublicBriefSchema,
  projectOneOnboardingSnapshotSchema,
  projectOneOnboardingSelectionSchema,
  type ProjectOneOnboardingSnapshot,
  type ProjectOneOnboardingSelection,
} from '@/lib/contracts/project-one-onboarding';
import { serializeUntrustedPromptData } from '@/lib/ai/prompt-data';
import { formatRuntimeRulePrompt } from '@/lib/ai/runtime-rule-prompt-catalog';
import { PROJECT_ONE_FIVE_PERSON_IDS, PROJECT_ONE_FIVE_PERSON_NPCS } from '@/lib/designer/project-one-five-person';
import inventory from './project-one-onboarding-inventory.json';

const snapshots = inventory.snapshots.map((snapshot) => projectOneOnboardingSnapshotSchema.parse(snapshot));
const byId = new Map(snapshots.map((snapshot) => [snapshot.brief.id, snapshot]));
const photosByPersonId = new Map(snapshots.flatMap(({ brief }) => brief.people).map((person) => [person.id, person.photo]));

const practiceTemplate = projectOnePublicBriefSchema.parse({
  id: 'custom',
  industryId: 'custom',
  businessId: 'custom',
  projectName: '自定义方向沟通练习',
  clientName: '自定义练习客户',
  description: '轻量练习简报，不预设具体客户事实、预算或我方能力。',
  overview: '请通过沟通了解客户现状、项目范围、预算、采购流程、技术要求与验收条件。行业和主营业务仅作为本次练习标签。',
  goals: ['核实客户现状与实际需求', '了解项目范围、预算和决策流程', '确认技术要求、实施条件与验收标准'],
  facts: [],
  details: [],
  people: PROJECT_ONE_FIVE_PERSON_IDS.map((id) => {
    const person = PROJECT_ONE_FIVE_PERSON_NPCS[id];
    const photo = photosByPersonId.get(id);
    if (!photo) throw new Error(`PROJECT_ONE_ONBOARDING_PERSON_PHOTO_MISSING:${id}`);
    return { id, name: person.name, title: person.title, photo };
  }),
});

export function getProjectOneOnboardingCatalog() {
  return {
    industries: inventory.industries,
    businesses: inventory.businesses,
    scenarios: snapshots.map(({ brief }) => brief),
    practiceTemplate: structuredClone(practiceTemplate),
  };
}

export function resolveProjectOneOnboarding(id: string): ProjectOneOnboardingSnapshot | undefined {
  const snapshot = byId.get(id);
  return snapshot ? structuredClone(snapshot) : undefined;
}

/** Resolve a custom choice to a deterministic practice brief without inventing customer facts. */
export function resolveProjectOneOnboardingSelection(
  input: ProjectOneOnboardingSelection,
): ProjectOneOnboardingSnapshot | undefined {
  const parsed = projectOneOnboardingSelectionSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const selection = parsed.data;
  const industry = inventory.industries.find(({ id }) => id === selection.industryId);
  const business = inventory.businesses.find(({ id }) => id === selection.businessId);

  if ((selection.industryId !== 'custom' && !industry)
    || (selection.businessId !== 'custom' && !business)) return undefined;

  if (selection.industryId !== 'custom' && selection.businessId !== 'custom') {
    const preset = snapshots.find(({ brief }) =>
      brief.industryId === selection.industryId && brief.businessId === selection.businessId,
    );
    return preset ? structuredClone(preset) : undefined;
  }

  const industryLabel = selection.industryId === 'custom' ? selection.customIndustry : industry?.label;
  const businessLabel = selection.businessId === 'custom' ? selection.customBusiness : business?.label;
  if (!industryLabel || !businessLabel) return undefined;

  return projectOneOnboardingSnapshotSchema.parse({
    brief: {
      ...practiceTemplate,
      industryId: selection.industryId,
      businessId: selection.businessId,
      industryLabel,
      businessLabel,
    },
    selection,
    dossier: { sections: [] },
  });
}

const roleSections: Readonly<Record<string, readonly string[]>> = {
  'P1-001': ['业务现状'],
  'P1-002': ['业务现状', '技术需求', '实施与采购', '交付与验收'],
  'P1-003': ['实施与采购'],
  'P1-004': ['技术需求', '交付与验收'],
  'P1-005': [],
};

export function projectOneOnboardingPrompt(
  snapshot: ProjectOneOnboardingSnapshot | undefined,
  npcId: string,
  dialogueRules?: string,
): string {
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
  const selectionData = snapshot.selection
    ? serializeUntrustedPromptData('project_one_onboarding_selection', {
      industryId: snapshot.selection.industryId,
      businessId: snapshot.selection.businessId,
      customIndustry: escapePromptDelimiter(snapshot.selection.customIndustry),
      customBusiness: escapePromptDelimiter(snapshot.selection.customBusiness),
    }, { maxStringLength: 480, maxTotalLength: 1500 })
    : '';
  return [
    '## 本局客户项目档案',
    dialogueRules ?? formatRuntimeRulePrompt('onboarding_dossier_dialogue'),
    JSON.stringify(context),
    selectionData,
  ].join('\n');
}

function escapePromptDelimiter(value: string | undefined): string | undefined {
  return value?.replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}
