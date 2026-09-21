import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import {
  DEFAULT_PROJECT_ONE_COMPETITORS,
  competitorCreateSchema,
  competitorRecordSchema,
  competitorUpdateSchema,
  parseCompetitorList,
} from '../src/lib/designer/competitors';
import { createSession, signLoginProof, signSession } from '../src/lib/auth/identity';
import { GET, POST } from '../src/app/api/game-data/competitors/route';

process.env.SESSION_SECRET = 'designer-competitor-regression-secret';

async function main() {

const valid = {
  id: '10000000-0000-4000-8000-000000000101',
  project_id: 1 as const,
  company_name: 'ABC竞品',
  features: '既有客情与价格竞争',
  more_info: '具体报价和项目动作需要在对局中继续收集。',
};

assert.equal(competitorRecordSchema.safeParse(valid).success, true);
assert.equal(competitorRecordSchema.safeParse({ ...valid, unexpected: true }).success, false, 'unknown fields are rejected');
assert.equal(competitorRecordSchema.safeParse({ ...valid, company_name: ' '.repeat(65) }).success, false, 'oversized names are rejected');
const createInput = { project_id: 1 as const, expected_revision: 0, company_name: valid.company_name, features: valid.features, more_info: valid.more_info };
assert.equal(competitorCreateSchema.safeParse(createInput).success, true);
assert.equal(competitorCreateSchema.safeParse({ ...valid, project_id: 2, expected_revision: 0 }).success, false, 'project whitelist is enforced');
assert.equal(competitorUpdateSchema.safeParse({ ...valid, expected_revision: 0 }).success, true);
assert.deepEqual(parseCompetitorList(DEFAULT_PROJECT_ONE_COMPETITORS), DEFAULT_PROJECT_ONE_COMPETITORS);
assert.throws(() => parseCompetitorList([valid, { ...valid, id: '10000000-0000-4000-8000-000000000102' }]), /COMPETITOR_DUPLICATE_NAME/);

const request = (method: string, token?: string, body?: unknown) => new NextRequest('http://localhost/api/game-data/competitors?project_id=1', {
  method,
  headers: {
    ...(token ? { 'x-session': token } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const playerToken = signSession(createSession('competitor-player', 'player'));
const designerToken = signSession(createSession('competitor-designer', 'platform_designer'));
const proof = signLoginProof('competitor-designer');

assert.equal((await GET(request('GET'))).status, 401);
assert.equal((await GET(request('GET', proof))).status, 401, 'login proof cannot authorize designer data');
assert.equal((await GET(request('GET', playerToken))).status, 403);
assert.equal((await POST(request('POST', designerToken, { project_id: 1 }))).status, 400, 'designer reaches strict request validation');

const migration = readFileSync(new URL('../supabase/migrations/20260921000300_scenario_competitor_config.sql', import.meta.url), 'utf8');
assert.match(migration, /ALTER TABLE public\.scenario_templates/);
assert.match(migration, /competitors/);
assert.match(migration, /revision/);
assert.doesNotMatch(migration, /CREATE TABLE/i, 'competitor config must reuse scenario_templates');

const routeSource = readFileSync(new URL('../src/app/api/game-data/competitors/route.ts', import.meta.url), 'utf8');
const designerPage = readFileSync(new URL('../src/app/designer/page.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(routeSource, /status:\s*501/);
assert.match(designerPage, /handleSaveCompetitor/);
assert.match(designerPage, /handleDeleteCompetitor/);
assert.match(designerPage, /api\/game-data\/competitors/);

  console.log('designer competitor CRUD contracts, authorization and persistence checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
