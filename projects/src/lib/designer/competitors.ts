import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PROJECT_ONE_COMPETITORS } from '@/lib/game/project-one';
import { createServerClient } from '@/storage/database/supabase-client';

/**
 * Competitors are part of the existing scenario_templates document.  Keep
 * the project whitelist deliberately narrow until the other projects have a
 * persisted scenario contract of their own.
 */
export const COMPETITOR_PROJECT_IDS = [1] as const;
export type CompetitorProjectId = (typeof COMPETITOR_PROJECT_IDS)[number];
export const PROJECT_ONE_SCENARIO_TEMPLATE_CODE = 'project-1';
export const MAX_COMPETITORS_PER_PROJECT = 50;
export const MAX_COMPETITOR_CONFIG_BYTES = 128 * 1024;

const UUID = z.string().uuid();
const projectIdSchema = z.literal(1);

export const competitorRecordSchema = z.object({
  id: UUID,
  project_id: projectIdSchema,
  company_name: z.string().trim().min(1).max(64),
  features: z.string().trim().min(1).max(2_000),
  more_info: z.string().trim().min(1).max(4_000),
}).strict();

export const competitorListSchema = z.array(competitorRecordSchema).max(MAX_COMPETITORS_PER_PROJECT);

export const competitorCreateSchema = z.object({
  project_id: projectIdSchema,
  expected_revision: z.number().int().min(0),
  company_name: z.string().trim().min(1).max(64),
  features: z.string().trim().min(1).max(2_000),
  more_info: z.string().trim().min(1).max(4_000),
}).strict();

export const competitorUpdateSchema = z.object({
  id: UUID,
  project_id: projectIdSchema,
  expected_revision: z.number().int().min(0),
  company_name: z.string().trim().min(1).max(64),
  features: z.string().trim().min(1).max(2_000),
  more_info: z.string().trim().min(1).max(4_000),
}).strict();

export const competitorDeleteSchema = z.object({
  id: UUID,
  project_id: projectIdSchema,
  expected_revision: z.number().int().min(0),
}).strict();

export type CompetitorRecord = z.infer<typeof competitorRecordSchema>;
export type CompetitorCreate = z.infer<typeof competitorCreateSchema>;
export type CompetitorUpdate = z.infer<typeof competitorUpdateSchema>;
export type CompetitorDelete = z.infer<typeof competitorDeleteSchema>;

export interface StoredCompetitorConfig {
  competitors: CompetitorRecord[];
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  persisted: boolean;
}

const defaultCompetitorId = '10000000-0000-4000-8000-000000000101';

export const DEFAULT_PROJECT_ONE_COMPETITORS: CompetitorRecord[] = PROJECT_ONE_COMPETITORS.map((competitor) =>
  competitorRecordSchema.parse({
    id: defaultCompetitorId,
    project_id: 1,
    company_name: competitor.company_name,
    features: competitor.features,
    more_info: competitor.more_info,
  }),
);

function validateUniqueCompetitors(competitors: CompetitorRecord[]): CompetitorRecord[] {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const competitor of competitors) {
    if (ids.has(competitor.id)) throw new Error('COMPETITOR_CONFIG_INVALID');
    const normalizedName = competitor.company_name.trim().toLocaleLowerCase('zh-CN');
    if (names.has(normalizedName)) throw new Error('COMPETITOR_DUPLICATE_NAME');
    ids.add(competitor.id);
    names.add(normalizedName);
  }
  return competitors;
}

export function parseCompetitorList(value: unknown): CompetitorRecord[] {
  const parsed = competitorListSchema.safeParse(value);
  if (!parsed.success) throw new Error('COMPETITOR_CONFIG_INVALID');
  return validateUniqueCompetitors(parsed.data);
}

function normalizeStoredRow(row: Record<string, unknown>): StoredCompetitorConfig {
  const revision = row.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    throw new Error('COMPETITOR_CONFIG_INVALID');
  }
  return {
    competitors: parseCompetitorList(row.competitors),
    revision,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null,
    persisted: true,
  };
}

export async function loadProjectOneCompetitorConfig(): Promise<StoredCompetitorConfig> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('scenario_templates')
    .select('competitors, revision, updated_at, updated_by')
    .eq('code', PROJECT_ONE_SCENARIO_TEMPLATE_CODE)
    .maybeSingle();
  if (error) throw new Error(`COMPETITOR_CONFIG_READ_FAILED:${error.code || 'unknown'}`);
  if (!data) {
    return {
      competitors: structuredClone(DEFAULT_PROJECT_ONE_COMPETITORS),
      revision: 0,
      updatedAt: null,
      updatedBy: null,
      persisted: false,
    };
  }
  return normalizeStoredRow(data as Record<string, unknown>);
}

function toStoredConfig(data: Record<string, unknown>): StoredCompetitorConfig {
  return normalizeStoredRow(data);
}

async function updateStoredConfig(
  nextCompetitors: CompetitorRecord[],
  expectedRevision: number,
  userId: string,
): Promise<StoredCompetitorConfig> {
  const current = await loadProjectOneCompetitorConfig();
  if (!current.persisted) throw new Error('COMPETITOR_CONFIG_NOT_INITIALIZED');
  if (current.revision !== expectedRevision) throw new Error('COMPETITOR_CONFIG_VERSION_CONFLICT');

  const competitors = validateUniqueCompetitors(parseCompetitorList(nextCompetitors));
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('scenario_templates')
    .update({
      competitors,
      revision: expectedRevision + 1,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('code', PROJECT_ONE_SCENARIO_TEMPLATE_CODE)
    .eq('revision', expectedRevision)
    .select('competitors, revision, updated_at, updated_by')
    .maybeSingle();
  if (error) throw new Error(`COMPETITOR_CONFIG_WRITE_FAILED:${error.code || 'unknown'}`);
  if (!data) throw new Error('COMPETITOR_CONFIG_VERSION_CONFLICT');
  return toStoredConfig(data as Record<string, unknown>);
}

export async function createProjectOneCompetitor(
  input: CompetitorCreate,
  userId: string,
): Promise<{ item: CompetitorRecord; config: StoredCompetitorConfig }> {
  const current = await loadProjectOneCompetitorConfig();
  if (!current.persisted) throw new Error('COMPETITOR_CONFIG_NOT_INITIALIZED');
  if (current.revision !== input.expected_revision) throw new Error('COMPETITOR_CONFIG_VERSION_CONFLICT');
  const item = competitorRecordSchema.parse({
    id: randomUUID(),
    project_id: input.project_id,
    company_name: input.company_name,
    features: input.features,
    more_info: input.more_info,
  });
  const config = await updateStoredConfig([...current.competitors, item], input.expected_revision, userId);
  return { item, config };
}

export async function updateProjectOneCompetitor(
  input: CompetitorUpdate,
  userId: string,
): Promise<{ item: CompetitorRecord; config: StoredCompetitorConfig }> {
  const current = await loadProjectOneCompetitorConfig();
  if (!current.persisted) throw new Error('COMPETITOR_CONFIG_NOT_INITIALIZED');
  if (current.revision !== input.expected_revision) throw new Error('COMPETITOR_CONFIG_VERSION_CONFLICT');
  if (!current.competitors.some((competitor) => competitor.id === input.id)) throw new Error('COMPETITOR_NOT_FOUND');
  const item = competitorRecordSchema.parse({
    id: input.id,
    project_id: input.project_id,
    company_name: input.company_name,
    features: input.features,
    more_info: input.more_info,
  });
  const config = await updateStoredConfig(
    current.competitors.map((competitor) => competitor.id === input.id ? item : competitor),
    input.expected_revision,
    userId,
  );
  return { item, config };
}

export async function deleteProjectOneCompetitor(
  input: CompetitorDelete,
  userId: string,
): Promise<StoredCompetitorConfig> {
  const current = await loadProjectOneCompetitorConfig();
  if (!current.persisted) throw new Error('COMPETITOR_CONFIG_NOT_INITIALIZED');
  if (current.revision !== input.expected_revision) throw new Error('COMPETITOR_CONFIG_VERSION_CONFLICT');
  if (!current.competitors.some((competitor) => competitor.id === input.id)) throw new Error('COMPETITOR_NOT_FOUND');
  return updateStoredConfig(
    current.competitors.filter((competitor) => competitor.id !== input.id),
    input.expected_revision,
    userId,
  );
}

