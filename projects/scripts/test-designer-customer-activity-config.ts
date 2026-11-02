import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, PUT } from '../src/app/api/designer/customer-activities/route';
import { createSession, ROLE_CONFIGS, signSession, type Role } from '../src/lib/auth/identity';
import {
  CUSTOMER_ACTIVITY_DECISION_CONFIG_ID,
  createActivityDecisionConfigRepository,
} from '../src/lib/designer/customer-activity-config-repository';
import {
  HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD,
  ORGANIZATION_CUSTOMER_ACTIVITY_TYPES,
  DEFAULT_ACTIVITY_DECISION_CONFIG,
  RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS,
} from '../src/lib/game/customer-activities';
import type { ActivityDecisionConfig } from '../src/lib/game/customer-activities';
import { DEFAULT_ACTIVITY_EXECUTION_CONFIG } from '../src/lib/game/customer-activity-execution-config';

type Row = {
  id: string;
  config: unknown;
  revision: number;
  updated_by: string | null;
  updated_at: string;
};

function fakeDatabase(initial: Row | null = null, readError?: string) {
  let row = initial ? structuredClone(initial) : null;
  const client = {
    from(table: string) {
      assert.equal(table, 'designer_prompt_configs');
      let operation: 'select' | 'insert' | 'update' = 'select';
      let values: Partial<Row> = {};
      const filters: Record<string, unknown> = {};
      const query = {
        select() { return query; },
        eq(column: string, value: string | number) { filters[column] = value; return query; },
        update(nextValues: Record<string, unknown>) { operation = 'update'; values = nextValues as Partial<Row>; return query; },
        insert(nextValues: Record<string, unknown>) { operation = 'insert'; values = nextValues as Partial<Row>; return query; },
        async maybeSingle() {
          if (operation === 'select' && readError) return { data: null, error: { code: readError } };
          if (operation === 'update') {
            if (!row || row.id !== filters.id || row.revision !== filters.revision) return { data: null, error: null };
            row = { ...row, ...values } as Row;
          }
          return { data: row ? structuredClone(row) : null, error: null };
        },
        async single() {
          if (operation === 'insert' && row) return { data: null, error: { code: '23505' } };
          if (operation === 'insert') row = structuredClone(values) as Row;
          return { data: row ? structuredClone(row) : null, error: null };
        },
      };
      return query;
    },
  };
  return { client, getRow: () => row };
}

const validThresholds = {
  ...Object.fromEntries(ORGANIZATION_CUSTOMER_ACTIVITY_TYPES.map((type) => [
    type,
    { organization: structuredClone(RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS[type]) },
  ])),
  hospitality: { ...HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD },
} as ActivityDecisionConfig['thresholds'];
const legacyThresholds = {
  technical_meeting: { supportMin: 55, pleasantnessMin: 50 },
  case_site_visit: { supportMin: 60, pleasantnessMin: 55 },
  company_visit: { supportMin: 65, pleasantnessMin: 60 },
};

async function main() {
  const emptyDb = fakeDatabase();
  const emptyRepository = createActivityDecisionConfigRepository(() => emptyDb.client);
  const absent = await emptyRepository.load();
  assert.equal(absent.persisted, false);
  assert.equal(absent.config.mode, DEFAULT_ACTIVITY_DECISION_CONFIG.mode);
  assert.equal(absent.config.revision, 0);
  assert.deepEqual(absent.config.thresholds, DEFAULT_ACTIVITY_DECISION_CONFIG.thresholds);

  const readFailureRepository = createActivityDecisionConfigRepository(() => fakeDatabase(null, '08006').client);
  await assert.rejects(readFailureRepository.load(), /CUSTOMER_ACTIVITY_CONFIG_READ_FAILED:08006/);

  const firstSaved = await emptyRepository.save({ mode: 'numeric', thresholds: validThresholds }, 0, 'designer-1');
  assert.equal(firstSaved.config.revision, 1);
  assert.equal(firstSaved.config.mode, 'numeric');
  assert.equal(firstSaved.updatedBy, 'designer-1');
  assert.equal(emptyDb.getRow()?.id, CUSTOMER_ACTIVITY_DECISION_CONFIG_ID);
  assert.equal((await emptyRepository.loadForMatching()).config.mode, 'numeric', 'complete organization numeric settings are accepted for matching');

  const reloaded = await emptyRepository.load();
  assert.deepEqual(reloaded.config.thresholds, validThresholds);
  assert.equal(reloaded.config.mode, 'numeric');

  const secondSaved = await emptyRepository.save({ mode: 'ai', thresholds: validThresholds }, 1, 'designer-2');
  assert.equal(secondSaved.config.revision, 2);
  await assert.rejects(
    emptyRepository.save({ mode: 'ai', thresholds: validThresholds }, 1, 'stale-designer'),
    /CUSTOMER_ACTIVITY_CONFIG_VERSION_CONFLICT/,
  );
  await assert.rejects(
    emptyRepository.save({ mode: 'numeric', thresholds: { technical_meeting: validThresholds.technical_meeting } }, 2, 'designer-3'),
    /CUSTOMER_ACTIVITY_CONFIG_INVALID/,
  );
  await assert.rejects(
    emptyRepository.save({ mode: 'numeric', thresholds: legacyThresholds }, 2, 'designer-3'),
    /CUSTOMER_ACTIVITY_CONFIG_INVALID/,
    'the write path must reject legacy single-person numeric thresholds',
  );

  const legacyRowDb = fakeDatabase({
    id: CUSTOMER_ACTIVITY_DECISION_CONFIG_ID,
    config: { mode: 'numeric', thresholds: legacyThresholds },
    revision: 7,
    updated_by: 'legacy-designer',
    updated_at: '2026-10-20T00:00:00.000Z',
  });
  const legacyRow = await createActivityDecisionConfigRepository(() => legacyRowDb.client).load();
  assert.equal(legacyRow.config.mode, 'numeric');
  assert.equal(legacyRow.config.revision, 7);
  assert.deepEqual(legacyRow.config.thresholds, {
    ...legacyThresholds,
    hospitality: HOSPITALITY_ACTIVITY_DEFAULT_THRESHOLD,
  }, 'old one-person numeric rows remain readable with default hospitality thresholds');
  const legacyRepository = createActivityDecisionConfigRepository(() => legacyRowDb.client);
  await assert.rejects(
    legacyRepository.loadForMatching(),
    /CUSTOMER_ACTIVITY_CONFIG_REQUIRES_ORGANIZATION/,
    'legacy numeric settings cannot affect new matching decisions',
  );
  const legacyAiDb = fakeDatabase({
    id: CUSTOMER_ACTIVITY_DECISION_CONFIG_ID,
    config: { mode: 'ai', thresholds: legacyThresholds },
    revision: 8,
    updated_by: 'legacy-designer',
    updated_at: '2026-10-20T00:00:00.000Z',
  });
  assert.equal((await createActivityDecisionConfigRepository(() => legacyAiDb.client).loadForMatching()).config.mode, 'ai', 'AI mode remains available while legacy numeric rows are upgraded');

  const oldExecution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG) as unknown as Record<string, unknown>;
  delete oldExecution.evaluationProvider;
  const oldExecutionDb = fakeDatabase({
    id: CUSTOMER_ACTIVITY_DECISION_CONFIG_ID,
    config: { mode: 'ai', thresholds: validThresholds, execution: oldExecution },
    revision: 10, updated_by: 'legacy-execution-config', updated_at: '2026-11-01T00:00:00.000Z',
  });
  const loadedOldExecution = await createActivityDecisionConfigRepository(() => oldExecutionDb.client).load();
  assert.equal(loadedOldExecution.config.execution?.evaluationProvider, 'llm',
    'old saved execution JSON without an evaluation provider normalizes to LLM');

  const raceRepository = createActivityDecisionConfigRepository(() => emptyDb.client);
  await assert.rejects(
    raceRepository.save({ mode: 'ai', thresholds: {} }, 0, 'racing-designer'),
    /CUSTOMER_ACTIVITY_CONFIG_VERSION_CONFLICT/,
  );

  const customExecution = structuredClone(DEFAULT_ACTIVITY_EXECUTION_CONFIG);
  customExecution.evaluationProvider = 'jev';
  customExecution.quizDurationSeconds = 75;
  customExecution.aiInstructions = '重点判断方案是否说明客户的验收问题、负责人和验证方式。';
  customExecution.weights = { plan: 0.6, quiz: 0.4 };
  customExecution.limits.supportMax = 2;
  customExecution.questionBanks.technical_meeting[0].title = '自定义情境：客户临时缩短技术交流时间，你会怎么安排？';
  customExecution.questionBanks.technical_meeting[0].options[0].text = '先核对最需要解决的问题，再调整议程。';
  customExecution.questionBanks.technical_meeting[0].options[0].supportDelta = 2;
  const executionSaved = await emptyRepository.save({ mode: 'ai', thresholds: validThresholds, execution: customExecution }, 2, 'rules-designer');
  assert.equal(executionSaved.config.revision, 3);
  assert.deepEqual(executionSaved.config.execution, customExecution, 'execution rules are included in the versioned configuration write');
  assert.deepEqual((await emptyRepository.load()).config.execution, customExecution, 'question bank, timing, AI rubric and limits survive storage readback');
  assert.equal(executionSaved.config.execution?.evaluationProvider, 'jev', 'Jev selection is saved with the same execution snapshot');
  customExecution.quizDurationSeconds = 90;
  assert.equal((await emptyRepository.load()).config.execution?.quizDurationSeconds, 75, 'caller mutations cannot modify the saved configuration');
  const legacyWrite = await emptyRepository.save({ mode: 'numeric', thresholds: validThresholds }, 3, 'old-designer-client');
  assert.equal(legacyWrite.config.execution?.quizDurationSeconds, 75, 'a thresholds-only old client preserves saved execution rules');
  assert.equal(legacyWrite.config.execution?.evaluationProvider, 'jev', 'a thresholds-only legacy write preserves the saved Jev selection');
  assert.equal(legacyWrite.config.execution?.weights.plan, 0.6);
  await assert.rejects(emptyRepository.save({ mode: 'ai', thresholds: validThresholds, execution: customExecution }, 3, 'stale-rules-designer'),
    /CUSTOMER_ACTIVITY_CONFIG_VERSION_CONFLICT/, 'execution writes use the same CAS revision as matching thresholds');
  const brokenExecutionDb = fakeDatabase({
    id: CUSTOMER_ACTIVITY_DECISION_CONFIG_ID,
    config: { mode: 'ai', thresholds: validThresholds, execution: { ...customExecution, quizDurationSeconds: 1 } },
    revision: 9, updated_by: 'broken-config', updated_at: '2026-11-02T00:00:00Z',
  });
  await assert.rejects(createActivityDecisionConfigRepository(() => brokenExecutionDb.client).load(), /CUSTOMER_ACTIVITY_CONFIG_INVALID/,
    'invalid explicitly stored rules fail closed instead of reverting to defaults');

  process.env.SESSION_SECRET = 'customer-activity-api-test-only-secret';
  const apiUrl = 'http://localhost/api/designer/customer-activities';
  const apiRequest = (method: string, role?: Role, body?: unknown) => new NextRequest(apiUrl, {
    method,
    headers: {
      ...(role ? { 'x-session': signSession(createSession(`api-test-${role}`, role)) } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  assert.equal((await GET(apiRequest('GET'))).status, 401, 'activity configuration reads require a signed-in session');
  assert.equal((await PUT(apiRequest('PUT', undefined, {}))).status, 401, 'activity configuration writes require a signed-in session');
  for (const role of ['player', 'trainer', 'enterprise_admin'] as const) {
    if (ROLE_CONFIGS[role].permissions.includes('工作流编辑')) continue;
    assert.equal((await GET(apiRequest('GET', role))).status, 403, `${role} cannot read designer activity settings`);
    assert.equal((await PUT(apiRequest('PUT', role, {}))).status, 403, `${role} cannot write designer activity settings`);
  }
  const invalidConfigs = [
    { mode: 'ai', thresholds: validThresholds, execution: { ...customExecution, quizDurationSeconds: 29 } },
    { mode: 'ai', thresholds: validThresholds, execution: { ...customExecution, quizDurationSeconds: 601 } },
    { mode: 'ai', thresholds: validThresholds, execution: { ...customExecution, weights: { plan: 0, quiz: 0 } } },
    { mode: 'ai', thresholds: validThresholds, execution: { ...customExecution, limits: { ...customExecution.limits, supportMax: 100 } } },
    { mode: 'ai', thresholds: validThresholds, execution: { ...customExecution, aiInstructions: ' ' } },
    { mode: 'ai', thresholds: validThresholds, execution: { ...customExecution, secretExtraField: 'invalid' } },
    { mode: 'unknown', thresholds: {} },
    { mode: 'ai', thresholds: { technical_meeting: { supportMin: -1 } } },
    { mode: 'ai', thresholds: { technical_meeting: { pleasantnessMin: 101 } } },
    { mode: 'ai', thresholds: { technical_meeting: { supportMin: 1.5 } } },
    { mode: 'ai', thresholds: { hospitality: { supportMin: 50 } } },
    { mode: 'ai', thresholds: { hospitality: { organization: RECOMMENDED_ORGANIZATION_ACTIVITY_THRESHOLDS.technical_meeting } } },
    { mode: 'numeric', thresholds: { technical_meeting: { supportMin: 50, pleasantnessMin: 50 } } },
    { mode: 'numeric', thresholds: { ...validThresholds, company_visit: undefined } },
    { mode: 'numeric', thresholds: legacyThresholds },
    { mode: 'numeric', thresholds: {
      ...validThresholds,
      technical_meeting: { organization: {
        minimumPleasantness: 20,
        paths: [{ id: 'one-person', label: '单联系人路径', conditions: [{ npcIds: ['P1-001'], minCount: 1, supportMin: 0, pleasantnessMin: 0 }] }],
      } },
    } },
    { mode: 'numeric', thresholds: {
      ...validThresholds,
      technical_meeting: { organization: {
        minimumPleasantness: 20,
        paths: [{ id: 'bad-count', label: '人数超出选择', conditions: [{ npcIds: ['P1-001'], minCount: 2, supportMin: 0, pleasantnessMin: 0 }, { npcIds: ['P1-002'], minCount: 1, supportMin: 0, pleasantnessMin: 0 }] }],
      } },
    } },
  ];
  for (const config of invalidConfigs) {
    const response = await PUT(apiRequest('PUT', 'platform_designer', { expectedRevision: 0, config }));
    assert.equal(response.status, 400, `designer invalid payload is rejected before persistence: ${JSON.stringify(config)}`);
  }

  console.log('Designer customer activity config repository and API tests passed.');
}

void main();
