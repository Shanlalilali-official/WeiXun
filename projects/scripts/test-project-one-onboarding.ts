import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getCatalog } from '../src/app/api/game-data/project-one-onboarding/route';
import { POST as createFormalSession } from '../src/app/api/game/sessions/route';
import { POST as runPreviewCommand } from '../src/app/api/project-one-preview/ai/route';
import { createSession, signSession } from '../src/lib/auth/identity';
import { previewAiRequestSchema } from '../src/lib/contracts/project-one-preview-ai';
import { createPreviewAiService } from '../src/lib/game/project-one-preview-ai';
import {
  getProjectOneOnboardingCatalog,
  projectOneOnboardingPrompt,
  resolveProjectOneOnboarding,
} from '../src/lib/game/project-one-onboarding';
import {
  createProjectOneState,
  normalizeProjectOneState,
  toPlayerVisibleGameState,
} from '../src/lib/game/state';

async function main() {
  const catalog = getProjectOneOnboardingCatalog();
  assert.equal(catalog.scenarios.length, 12);
  const pairs = new Set(catalog.scenarios.map(({ industryId, businessId }) => `${industryId}+${businessId}`));
  assert.equal(pairs.size, catalog.scenarios.length);
  for (const brief of catalog.scenarios) {
    assert.ok(catalog.industries.some(({ id }) => id === brief.industryId));
    assert.ok(catalog.businesses.some(({ id }) => id === brief.businessId));
    assert.deepEqual(resolveProjectOneOnboarding(brief.id)?.brief, brief);
  }
  const brief = catalog.scenarios.find(({ industryId, businessId }) => industryId === 'manufacturing' && businessId === 'management');
  assert.ok(brief);
  const snapshot = resolveProjectOneOnboarding(brief.id);
  assert.ok(snapshot);
  const internalDetail = snapshot.dossier.sections.find(({ title }) => title === '技术需求')?.items.find(({ status }) => status === '待沟通');
  assert.ok(internalDetail);

  const publicResponse = await getCatalog().json();
  assert.deepEqual(publicResponse.catalog, catalog);
  assert.doesNotMatch(JSON.stringify(publicResponse), /"dossier"|待沟通|待确认/);
  assert.ok(!JSON.stringify(publicResponse).includes(internalDetail.value));
  assert.equal(resolveProjectOneOnboarding('unknown'), undefined);
  const invalidSelection = (url: string, role: 'player' | 'platform_designer', body: object) => new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-session': signSession(createSession('onboarding-invalid-id-test', role)) },
    body: JSON.stringify({ ...body, onboardingScenarioId: 'unknown' }),
  });
  const invalidFormal = await createFormalSession(invalidSelection('/api/game/sessions', 'player', { scenarioCode: 'project-1', replaceExisting: true }));
  assert.equal((await invalidFormal.json()).error, 'ONBOARDING_SCENARIO_NOT_FOUND');
  const invalidPreview = await runPreviewCommand(invalidSelection('/api/project-one-preview/ai', 'platform_designer', {
    action: 'start_session', commandId: 'opening-preview-invalid-request', expectedVersion: 0,
  }));
  assert.equal(invalidPreview.status, 400);
  assert.ok(projectOneOnboardingPrompt(snapshot, 'P1-002').includes(internalDetail.value));
  assert.ok(!projectOneOnboardingPrompt(snapshot, 'P1-005').includes(internalDetail.value));

  const formal = createProjectOneState(1, undefined, snapshot);
  const restored = normalizeProjectOneState(JSON.parse(JSON.stringify(formal)));
  assert.deepEqual(restored.onboardingScenario, snapshot);
  const formalPublic = toPlayerVisibleGameState(restored);
  assert.deepEqual(formalPublic.projectOneBrief, brief);
  assert.ok(!('onboardingScenario' in formalPublic));
  assert.ok(!JSON.stringify(formalPublic).includes(internalDetail.value));
  assert.equal(toPlayerVisibleGameState(createProjectOneState()).projectOneBrief, undefined);

  const preview = createPreviewAiService({ invoker: async () => { throw new Error('Opening a project must not invoke an LLM'); } });
  const start = previewAiRequestSchema.parse({
    action: 'start_session', commandId: 'opening-preview-first-command', expectedVersion: 0, onboardingScenarioId: brief.id,
  });
  const opened = await preview.execute('onboarding-preview-test', start);
  assert.deepEqual(opened.projectOneBrief, formalPublic.projectOneBrief);
  assert.ok(!JSON.stringify(opened).includes(internalDetail.value));
  assert.deepEqual(await preview.execute('onboarding-preview-test', start), opened);
  await assert.rejects(preview.execute('onboarding-preview-test', previewAiRequestSchema.parse({
    action: 'start_session', commandId: 'opening-preview-invalid-scene', expectedVersion: 0, onboardingScenarioId: 'unknown',
  })));
  console.log('Project-one public catalog, save round trip, role boundaries, and formal/preview scene parity passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
