const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('C:/Users/17628/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const base = process.env.ONBOARDING_TEST_URL || 'http://127.0.0.1:5089';
const projects = path.resolve(__dirname, '../../../projects');
const caseId = 'manufacturing-management-v1';
const previewId = '7ea74824-99a2-459a-aeee-5566c0000c01';
const formalId = '7ea74824-99a2-459a-aeee-5566c0000c02';
const userId = 'onboarding-browser-test';

const fixtureSource = `
import { resolveProjectOneOnboarding } from './src/lib/game/project-one-onboarding';
import { createProjectOneState, toPlayerVisibleGameState } from './src/lib/game/state';
import { createPreviewServerState, toPreviewRecoveryDto } from './src/lib/game/project-one-preview-ai';
const snapshot = resolveProjectOneOnboarding('${caseId}');
const preview = createPreviewServerState('${userId}', '${previewId}');
preview.version = 1;
preview.onboardingSnapshot = snapshot;
const state = toPlayerVisibleGameState(createProjectOneState(1, undefined, snapshot));
console.log(JSON.stringify({ brief: snapshot.brief, state, recovery: toPreviewRecoveryDto(preview) }));
`;
const fixture = JSON.parse(execFileSync(process.execPath, [require.resolve('tsx/cli', { paths: [projects] }), '-e', fixtureSource], {
  cwd: projects, encoding: 'utf8',
}).trim().split(/\r?\n/).at(-1));

async function choose(dialog) {
  await dialog.locator('select[name="industry"]').selectOption('manufacturing');
  await dialog.locator('select[name="business"]').selectOption('management');
  await dialog.getByRole('button', { name: '查看客户简报' }).click();
  await dialog.getByText(fixture.brief.projectName, { exact: true }).waitFor();
  for (const person of fixture.brief.people) {
    await dialog.getByText(person.name, { exact: true }).waitFor();
    await dialog.getByText(person.title, { exact: true }).waitFor();
  }
  assert.doesNotMatch(await dialog.innerText(), /待沟通|待核实|待确认/);
}

async function run(browser, mode) {
  const context = await browser.newContext({ viewport: { width: mode === 'formal' ? 1440 : 390, height: mode === 'formal' ? 920 : 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ userId }) => {
    localStorage.setItem('weixun_identity', JSON.stringify({ userId, role: 'platform_designer', displayName: '开场测试' }));
    localStorage.setItem('weixun_session', 'browser-test-token');
  }, { userId });
  let starts = 0;
  const save = { id: formalId, currentRound: 1, maxRounds: 5, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const json = (data, status = 200) => route.fulfill({ status, json: data });
    if (pathname === '/api/game-data/project-one-onboarding') return route.continue();
    if (pathname === '/api/game/sessions') {
      if (request.method() === 'GET') return json({ success: true, saves: starts > 1 ? [save] : [] });
      assert.equal(request.postDataJSON().onboardingScenarioId, caseId);
      if (++starts === 1) return json({ error: '测试中的首次开局失败' }, 503);
      return json({ success: true, gameSession: { id: formalId, state: fixture.state } });
    }
    if (pathname === `/api/game/sessions/${formalId}`) return json({ gameSession: { id: formalId, state: fixture.state } });
    if (pathname === `/api/game/sessions/${formalId}/timer`) return json({ state: fixture.state });
    if (pathname === '/api/game-data/npcs') return json({ data: fixture.brief.people.map(({ id, name, title }) => ({ id, name, title })) });
    if (pathname === '/api/project-one-preview/ai') {
      if (request.method() === 'GET') return json({ success: true, data: fixture.recovery });
      const body = request.postDataJSON();
      assert.equal(body.action, 'start_session');
      assert.equal(body.onboardingScenarioId, caseId);
      assert.ok(!body.previewSessionId);
      if (++starts === 1) return json({ error: '测试中的首次开局失败' }, 503);
      return json({ success: true, previewSessionId: previewId, version: 1, data: {
        action: 'start_session', previewSessionId: previewId, version: 1, projectOneBrief: fixture.brief,
      } });
    }
    return json({ success: true, data: [] });
  });
  try {
    await page.goto(base + (mode === 'formal' ? '/game?location=project-1&mode=solo' : '/project-one-preview'));
    const surface = mode === 'formal' ? page : page.frameLocator('iframe');
    if (mode === 'preview') await surface.locator('[data-action="start"]').click();
    const dialog = surface.locator('dialog[data-project-one-onboarding]');
    await dialog.waitFor();
    await dialog.locator('select[name="industry"] option[value="manufacturing"]').waitFor({ state: 'attached' });
    await page.screenshot({ path: path.join(__dirname, `${mode}-selection.png`), animations: 'disabled' });
    assert.equal(starts, 0);
    await choose(dialog);
    await dialog.getByRole('button', { name: '返回修改' }).click();
    assert.equal(await dialog.locator('select[name="industry"]').inputValue(), 'manufacturing');
    assert.equal(await dialog.locator('select[name="business"]').inputValue(), 'management');
    await choose(dialog);
    await page.screenshot({ path: path.join(__dirname, `${mode}-brief.png`), animations: 'disabled' });
    await dialog.getByRole('button', { name: '开始训练' }).click();
    await dialog.locator('.po-start-status[data-error="true"]').waitFor();
    assert.equal(starts, 1);
    await dialog.getByRole('button', { name: '开始训练' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await surface.getByText(fixture.brief.projectName, { exact: true }).first().waitFor();
    assert.equal(starts, 2);
    if (mode === 'formal') {
      await page.reload();
      await page.getByRole('button', { name: '继续游戏' }).click();
      await page.getByText(fixture.brief.projectName, { exact: true }).first().waitFor();
      assert.equal(await dialog.count(), 0);
      assert.equal(starts, 2);
    }
    assert.deepEqual(errors, []);
    console.log(`${mode}: public catalog, selections, retry, start, and project title passed`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    await run(browser, 'formal');
    await run(browser, 'preview');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
