'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/17628/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = __dirname;
const expectedPublicData = require('./source/demo-public.js')(require('./source/demo-data.js'));
const variants = [
  '04-现有UI-标准弹窗.html',
  '05-现有UI-紧凑弹窗.html',
  '06-现有UI-分栏弹窗.html',
];
const report = {
  checkedAt: new Date().toISOString(),
  variants: [],
  externalRequests: [],
  errors: [],
};

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function noHorizontalOverflow(page, label) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert(widths.body <= widths.viewport + 1, label + ': body horizontal overflow ' + JSON.stringify(widths));
  assert(widths.document <= widths.viewport + 1, label + ': document horizontal overflow ' + JSON.stringify(widths));
}

async function assertVisibleEnabled(page, selector, label) {
  const control = page.locator(selector).first();
  assert(await control.isVisible(), label + ' must be visible');
  assert(await control.isEnabled(), label + ' must be enabled');
  const box = await control.boundingBox();
  assert(box && box.width > 0 && box.height > 0, label + ' must have an actionable box');
}

async function assertPhotos(page) {
  const photos = page.locator('[data-people-grid] img');
  assert(await photos.count() === 5, 'Brief must render five people');
  await photos.evaluateAll(items => Promise.all(items.map(image => image.decode())));
  assert(
    await photos.evaluateAll(items => items.every(image =>
      image.complete && image.naturalWidth > 0 && image.src.startsWith('data:image/'))),
    'All five portraits must decode from embedded data URIs',
  );
}

async function waitForStageFocus(page, stage) {
  await page.waitForFunction(name => {
    const title = document.querySelector('[data-step="' + name + '"] [data-screen-title]');
    return title && document.activeElement === title;
  }, stage);
}

async function openSelectedBrief(page, industrySelect, businessSelect, industryId, businessId) {
  await industrySelect.selectOption(industryId);
  assert(await industrySelect.inputValue() === industryId, 'Industry select must retain ' + industryId);
  await businessSelect.selectOption(businessId);
  assert(await businessSelect.inputValue() === businessId, 'Business select must retain ' + businessId);
  await assertVisibleEnabled(page, '[data-continue]', 'Continue footer action');
  await page.locator('[data-continue]').click();
  await page.locator('[data-step="brief"]').waitFor({ state: 'visible' });
  await waitForStageFocus(page, 'brief');
}

async function verifyLargeIndustryList(page, industrySelect, businessSelect, file) {
  const before = await page.evaluate(() => {
    const selectors = ['[data-demo-dialog]', '[data-step="select"]', '[data-industry-select]', '[data-business-select]'];
    return selectors.map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 100) / 100);
    });
  });
  const fakeValues = await page.evaluate(() => {
    const select = document.querySelector('select[data-industry-select]');
    const values = [];
    for (let index = 1; index <= 100; index += 1) {
      const value = 'qa-only-industry-' + String(index).padStart(3, '0');
      const option = document.createElement('option');
      option.value = value;
      option.textContent = '测试行业 ' + String(index).padStart(3, '0');
      select.add(option);
      values.push(value);
    }
    return values;
  });
  await industrySelect.selectOption(fakeValues[99]);
  assert(await industrySelect.inputValue() === fakeValues[99], 'Native select must choose a QA-only long-list option');
  assert(await page.locator('[data-continue]').isDisabled(), 'QA-only industry must not unlock a demo scenario');
  assert(await page.locator('[data-step="brief"]').isHidden(), 'QA-only industry must not invent a brief');
  assert(await businessSelect.isDisabled(), 'QA-only industry without scene data must leave business unavailable');
  assert(
    await page.evaluate(value => !Object.prototype.hasOwnProperty.call(window.DEMO_DATA.scenarios, value + '+management'), fakeValues[99]),
    'QA-only industry must remain outside the scenario fixture',
  );
  const after = await page.evaluate(() => {
    const selectors = ['[data-demo-dialog]', '[data-step="select"]', '[data-industry-select]', '[data-business-select]'];
    return selectors.map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 100) / 100);
    });
  });
  assert(JSON.stringify(after) === JSON.stringify(before), file + ': 100 added industry options changed selection screen geometry');
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('select[data-industry-select]').waitFor();
  assert(await page.locator('select[data-industry-select] option:not([value=""])').count() === 8, 'Reload must restore eight curated industries');
  assert(await page.locator('select[data-business-select]').isDisabled(), 'Reload must restore the disabled business default');
  assert(await page.locator('[data-continue]').isDisabled(), 'Reload must restore the disabled continue default');
}

async function verifyNativeSelectors(page, file) {
  const industrySelect = page.locator('select[data-industry-select]');
  const businessSelect = page.locator('select[data-business-select]');
  assert(await industrySelect.count() === 1, file + ': expected one native industry select');
  assert(await businessSelect.count() === 1, file + ': expected one native business select');
  assert(await page.locator('.choice-card, button[data-industry], button[data-business]').count() === 0,
    file + ': choice cards must not replace native selects');
  assert(await industrySelect.isDisabled() === false, file + ': industry select must be usable initially');
  assert(await businessSelect.isDisabled(), file + ': business select must start disabled');
  assert(await page.locator('[data-continue]').isDisabled(), file + ': continue must start disabled');
  assert(await industrySelect.inputValue() === '', file + ': initial industry must be unselected');

  const fixture = await page.evaluate(() => ({
    industries: window.DEMO_DATA.industries.map(item => ({ id: item.id, label: item.label })),
    businesses: window.DEMO_DATA.businesses.map(item => ({ id: item.id, label: item.label })),
    scenarios: Object.values(window.DEMO_DATA.scenarios).map(item => ({
      industryId: item.industryId,
      businessId: item.businessId,
      projectName: item.projectName,
      clientName: item.clientName,
      description: item.description,
    })),
  }));
  const embeddedScenarios = await page.evaluate(() => window.DEMO_DATA.scenarios);
  assert(JSON.stringify(embeddedScenarios) === JSON.stringify(expectedPublicData.scenarios), file + ': HTML must contain only the audited public projection');
  assert(!/待沟通|待核实|待确认|尚未确认/.test(JSON.stringify(embeddedScenarios)), file + ': unpublished prompts must stay out of embedded data');
  assert(fixture.industries.length === 8, file + ': expected eight industry fixtures');
  assert(fixture.businesses.length === 6, file + ': expected six business fixtures');
  assert(fixture.scenarios.length === 12, file + ': expected twelve curated combinations');
  const industryValues = await industrySelect.locator('option').evaluateAll(items =>
    items.map(option => option.value).filter(Boolean));
  const businessValues = await businessSelect.locator('option').evaluateAll(items =>
    items.map(option => option.value).filter(Boolean));
  assert(JSON.stringify(industryValues) === JSON.stringify(fixture.industries.map(item => item.id)),
    file + ': industry options do not match the eight fixtures');
  assert(JSON.stringify(businessValues) === JSON.stringify(fixture.businesses.map(item => item.id)),
    file + ': business options do not match the six fixtures');
  return { industrySelect, businessSelect, fixture };
}

async function verifyScenarioMatrix(page, industrySelect, businessSelect, fixture, file) {
  let combinationsChecked = 0;
  let industryOptionsChecked = 0;
  for (const industry of fixture.industries) {
    await industrySelect.selectOption(industry.id);
    assert(await industrySelect.inputValue() === industry.id, file + ': failed to select industry ' + industry.id);
    industryOptionsChecked += 1;
    const available = fixture.scenarios.filter(item => item.industryId === industry.id);
    assert(available.length > 0, file + ': every industry must have a curated demo');
    const availableIds = new Set(available.map(item => item.businessId));
    const optionStates = await businessSelect.locator('option').evaluateAll(items =>
      items.filter(option => option.value).map(option => ({ value: option.value, disabled: option.disabled })));
    assert(await businessSelect.isEnabled(), file + ': business select should enable after industry selection');
    for (const option of optionStates) {
      assert(option.disabled === !availableIds.has(option.value),
        file + ': incorrect enabled state for ' + industry.id + '+' + option.value);
    }

    for (const scenario of available) {
      await businessSelect.selectOption(scenario.businessId);
      assert(await businessSelect.inputValue() === scenario.businessId,
        file + ': enabled business option did not select ' + scenario.businessId);
      assert(await page.locator('[data-continue]').isEnabled(),
        file + ': curated pair must enable continue ' + industry.id + '+' + scenario.businessId);
      await page.locator('[data-continue]').click();
      await page.locator('[data-step="brief"]').waitFor({ state: 'visible' });
      await waitForStageFocus(page, 'brief');
      const project = fixture.scenarios.find(item =>
        item.industryId === industry.id && item.businessId === scenario.businessId);
      assert((await page.locator('[data-step="brief"] [data-project-name]').first().textContent()).trim() === project.projectName,
        file + ': project data mismatch for ' + industry.id + '+' + scenario.businessId);
      assert((await page.locator('[data-step="brief"] [data-client-name]').first().textContent()).trim() === project.clientName,
        file + ': client data mismatch for ' + industry.id + '+' + scenario.businessId);
      assert((await page.locator('[data-step="brief"] [data-industry-label]').first().textContent()).trim() === industry.label,
        file + ': industry label mismatch');
      const business = fixture.businesses.find(item => item.id === scenario.businessId);
      assert((await page.locator('[data-step="brief"] [data-business-label]').first().textContent()).trim() === business.label,
        file + ': business label mismatch');
      assert((await page.locator('[data-step="brief"] [data-project-description]').first().textContent()).trim() === project.description,
        file + ': description mismatch');
      await assertPhotos(page);
      await page.locator('[data-open-details]').click();
      assert(await page.locator('[data-details-panel]').isVisible(), file + ': details must expand');
      assert(await page.locator('[data-details-panel] .detail-section').count() > 0,
        file + ': expected audited public detail sections');
      assert(!/待沟通|待核实|待确认|尚未确认/.test(await page.locator('[data-step="brief"]').innerText()), file + ': brief must not expose unpublished prompts');
      assert(await page.locator('[data-details-panel] .detail-table dt').count() > 0,
        file + ': details must include dt labels');
      assert(await page.locator('[data-details-panel] .detail-table dd').count() > 0,
        file + ': details must include dd values');
      await page.keyboard.press('Escape');
      assert(await page.locator('[data-details-panel]').isHidden(), file + ': Escape must close details');
      assert(await page.locator('[data-open-details]').getAttribute('aria-expanded') === 'false',
        file + ': detail button state must track Escape');
      await page.locator('[data-back]').click();
      await page.locator('[data-step="select"]').waitFor({ state: 'visible' });
      await waitForStageFocus(page, 'select');
      assert(await industrySelect.inputValue() === industry.id, file + ': back must preserve industry');
      assert(await businessSelect.inputValue() === scenario.businessId, file + ': back must preserve business');
      combinationsChecked += 1;
    }
  }
  assert(industryOptionsChecked === 8, file + ': expected to exercise all eight industry options');
  assert(combinationsChecked === 12, file + ': expected 12 curated combinations, got ' + combinationsChecked);
  return { industryOptionsChecked, combinationsChecked };
}

async function verifyIncompatibleReset(page, industrySelect, businessSelect, fixture, file) {
  let pair;
  for (const source of fixture.industries) {
    for (const business of fixture.businesses) {
      const sourceHas = fixture.scenarios.some(item => item.industryId === source.id && item.businessId === business.id);
      if (!sourceHas) continue;
      const target = fixture.industries.find(industry =>
        industry.id !== source.id &&
        !fixture.scenarios.some(item => item.industryId === industry.id && item.businessId === business.id));
      if (target) {
        pair = { source: source.id, target: target.id, business: business.id };
        break;
      }
    }
    if (pair) break;
  }
  assert(pair, file + ': expected an incompatible industry/business pair');
  await industrySelect.selectOption(pair.source);
  await businessSelect.selectOption(pair.business);
  assert(await page.locator('[data-continue]').isEnabled(), file + ': source pair must be selectable');
  await industrySelect.selectOption(pair.target);
  assert(await businessSelect.inputValue() === '', file + ': changing to an incompatible industry must clear business');
  assert(await page.locator('[data-continue]').isDisabled(), file + ': incompatible switch must disable continue');
  const unavailable = businessSelect.locator('option[value="' + pair.business + '"]');
  assert(await unavailable.isDisabled(), file + ': incompatible business option must be disabled');
}

async function verifyKeyboardAndCompletion(page, industrySelect, businessSelect, fixture, file) {
  const multiChoiceIndustry = fixture.industries.find(industry =>
    fixture.scenarios.filter(item => item.industryId === industry.id).length >= 2);
  assert(multiChoiceIndustry, file + ': keyboard test requires an industry with multiple business options');
  const combinations = fixture.scenarios.filter(item => item.industryId === multiChoiceIndustry.id)
    .sort((a, b) => fixture.businesses.findIndex(item => item.id === a.businessId) - fixture.businesses.findIndex(item => item.id === b.businessId));
  await industrySelect.selectOption(multiChoiceIndustry.id);
  await businessSelect.selectOption(combinations[0].businessId);
  await businessSelect.focus();
  assert(await businessSelect.evaluate(element => document.activeElement === element), file + ': business select must receive focus');
  await businessSelect.press('ArrowDown');
  const keyboardBusiness = await businessSelect.inputValue();
  assert(combinations.some(item => item.businessId === keyboardBusiness) && keyboardBusiness !== combinations[0].businessId,
    file + ': ArrowDown must choose another enabled native business option');

  const beforeIndustry = await industrySelect.inputValue();
  await industrySelect.focus();
  assert(await industrySelect.evaluate(element => document.activeElement === element), file + ': industry select must receive focus');
  await industrySelect.press('ArrowDown');
  assert(await industrySelect.inputValue() !== beforeIndustry, file + ': ArrowDown must change the native industry option');

  const first = fixture.scenarios[0];
  await openSelectedBrief(page, industrySelect, businessSelect, first.industryId, first.businessId);
  await assertVisibleEnabled(page, '[data-start]', 'Start footer action');
  await page.locator('[data-start]').click();
  await page.locator('[data-step="ready"]').waitFor({ state: 'visible' });
  assert((await page.locator('[data-step="ready"]').innerText()).includes('不会创建真实对局'),
    file + ': ready state must explain this is only a demo');
  await page.locator('[data-review]:visible').click();
  await page.locator('[data-step="brief"]').waitFor({ state: 'visible' });
  await page.locator('[data-back]').click();
  await page.locator('[data-step="select"]').waitFor({ state: 'visible' });
  assert(await industrySelect.inputValue() === first.industryId, file + ': review/back must preserve industry');
  assert(await businessSelect.inputValue() === first.businessId, file + ': review/back must preserve business');

  const motion = page.locator('[data-motion-toggle]:visible').first();
  assert(await motion.count() === 1, file + ': motion toggle must be visible');
  const beforeMotion = await motion.getAttribute('aria-pressed');
  await motion.click();
  const afterMotion = await motion.getAttribute('aria-pressed');
  assert(afterMotion !== beforeMotion, file + ': motion toggle must update aria-pressed');
  assert(
    await page.locator('html').evaluate(element => element.classList.contains('reduce-motion')) === (afterMotion === 'true'),
    file + ': motion toggle must update reduced-motion styling',
  );
  if (afterMotion === 'true') {
    assert(await page.locator('[data-opening-animation]').evaluate(element => parseFloat(getComputedStyle(element).animationDuration) <= .01), file + ': reduced motion must disable the opening graphic');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    file + ': prefers-reduced-motion media query must be honored by the browser');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function verifyViewportFooterFlow(page, industrySelect, businessSelect, fixture, width, height, file) {
  await page.setViewportSize({ width, height });
  const label = file + ' ' + width + 'x' + height;
  await noHorizontalOverflow(page, label + ' select');
  const scenario = fixture.scenarios[0];
  await openSelectedBrief(page, industrySelect, businessSelect, scenario.industryId, scenario.businessId);
  await noHorizontalOverflow(page, label + ' brief');
  await assertVisibleEnabled(page, '[data-back]', 'Back footer action');
  await assertVisibleEnabled(page, '[data-start]', 'Start footer action');
  await page.locator('[data-open-details]').click();
  assert(await page.locator('[data-details-panel]').isVisible(), label + ': details must open');
  await noHorizontalOverflow(page, label + ' details');
  await page.keyboard.press('Escape');
  await page.locator('[data-back]').click();
  await page.locator('[data-step="select"]').waitFor({ state: 'visible' });
  await noHorizontalOverflow(page, label + ' returned select');
  assert(await industrySelect.inputValue() === scenario.industryId, label + ': footer back must preserve industry');
  assert(await businessSelect.inputValue() === scenario.businessId, label + ': footer back must preserve business');
  await assertVisibleEnabled(page, '[data-continue]', 'Continue footer action');
  await page.locator('[data-continue]').click();
  await page.locator('[data-step="brief"]').waitFor({ state: 'visible' });
  await assertVisibleEnabled(page, '[data-start]', 'Start footer action');
  await page.locator('[data-start]').click();
  await page.locator('[data-step="ready"]').waitFor({ state: 'visible' });
  await page.locator('[data-restart]:visible').click();
  await page.locator('[data-step="select"]').waitFor({ state: 'visible' });
  await noHorizontalOverflow(page, label + ' restarted select');
}

async function verifyVariant(browser, file) {
  const prefix = file.slice(0, 2);
  const screenshots = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(file + ': ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(file + ': ' + message.text());
  });
  page.on('request', request => {
    if (/^https?:/i.test(request.url())) report.externalRequests.push(file + ': ' + request.url());
  });

  try {
    await page.goto(pathToFileURL(path.join(root, file)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelector('select[data-industry-select]'));
    const tokens = await page.evaluate(() => ({
      bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase(),
      blue: getComputedStyle(document.documentElement).getPropertyValue('--blue').trim().toLowerCase(),
    }));
    assert(tokens.bg === '#eff3f9', file + ': expected root --bg #eff3f9, got ' + tokens.bg);
    assert(tokens.blue === '#2f6bff', file + ': expected root --blue #2f6bff, got ' + tokens.blue);

    let { industrySelect, businessSelect, fixture } = await verifyNativeSelectors(page, file);
    const hero = page.locator('img[data-onboarding-hero]');
    assert(await hero.count() === 1, file + ': welcome modal must contain one AI illustration');
    await hero.evaluate(image => image.decode());
    assert(await hero.evaluate(image => image.naturalWidth >= 600 && image.src.startsWith('data:image/')), file + ': hero must decode offline');
    assert(await hero.isVisible(), file + ': hero must be visible inside the welcome modal');
    assert(await hero.evaluate(image => getComputedStyle(image).animationName === 'none' && getComputedStyle(image).transform === 'none'), file + ': photograph must remain still');
    const openingGraphic = page.locator('[data-opening-animation]');
    assert(await openingGraphic.count() === 1, file + ': one opening graphic required');
    assert(await openingGraphic.evaluate(element => {
      const style = getComputedStyle(element);
      return style.animationIterationCount === '1' && parseFloat(style.animationDuration) <= 1.4;
    }), file + ': opening graphic must play once');
    assert(await page.locator('[data-brief-loading], [data-loading]').count() === 0, file + ': no loading state may be added');
    await industrySelect.selectOption('manufacturing');
    await businessSelect.selectOption('management');
    const immediate = await page.locator('[data-continue]').evaluate(button => {
      button.click();
      return !document.querySelector('[data-step="brief"]').hidden;
    });
    assert(immediate, file + ': opening animation must not impose a loading delay');
    await page.locator('[data-back]').click();
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    ({ industrySelect, businessSelect, fixture } = await verifyNativeSelectors(page, file));
    assert(await hero.evaluate(image => {
      const photo = image.getBoundingClientRect();
      const frame = image.closest('figure').getBoundingClientRect();
      return photo.width <= frame.width && photo.height <= frame.height && getComputedStyle(image).objectFit === 'contain';
    }), file + ': illustration must fit its frame without cropping');
    await noHorizontalOverflow(page, file + ' 1440x1000 initial select');
    await page.screenshot({
      path: path.join(root, 'screenshots', prefix + '-current-ui-select.png'),
      fullPage: true,
      animations: 'disabled',
    });
    screenshots.push(prefix + '-current-ui-select.png');

    await verifyLargeIndustryList(page, industrySelect, businessSelect, file);
    ({ industrySelect, businessSelect, fixture } = await verifyNativeSelectors(page, file));
    const matrix = await verifyScenarioMatrix(page, industrySelect, businessSelect, fixture, file);
    await verifyIncompatibleReset(page, industrySelect, businessSelect, fixture, file);

    const first = fixture.scenarios[0];
    await openSelectedBrief(page, industrySelect, businessSelect, first.industryId, first.businessId);
    await noHorizontalOverflow(page, file + ' 1440x1000 brief');
    await assertPhotos(page);
    await page.screenshot({
      path: path.join(root, 'screenshots', prefix + '-current-ui-brief.png'),
      fullPage: true,
      animations: 'disabled',
    });
    screenshots.push(prefix + '-current-ui-brief.png');
    await page.locator('[data-open-details]').click();
    const firstDt = await page.locator('[data-details-panel] .detail-table dt').first().boundingBox();
    const firstDd = await page.locator('[data-details-panel] .detail-table dd').first().boundingBox();
    assert(firstDt && firstDd, file + ': desktop detail label/value must have layout boxes');
    assert(firstDd.x > firstDt.x + Math.max(40, firstDt.width * 0.35),
      file + ': desktop detail dd must sit in a second column to the right of dt');
    assert(Math.abs((firstDt.y + firstDt.height / 2) - (firstDd.y + firstDd.height / 2)) < 12,
      file + ': desktop detail dt/dd must share a row');
    await noHorizontalOverflow(page, file + ' 1440x1000 details');
    await page.screenshot({
      path: path.join(root, 'screenshots', prefix + '-current-ui-details.png'),
      fullPage: true,
      animations: 'disabled',
    });
    screenshots.push(prefix + '-current-ui-details.png');
    await page.keyboard.press('Escape');
    await page.locator('[data-back]').click();
    await page.locator('[data-step="select"]').waitFor({ state: 'visible' });

    await verifyKeyboardAndCompletion(page, industrySelect, businessSelect, fixture, file);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    ({ industrySelect, businessSelect, fixture } = await verifyNativeSelectors(page, file));
    await page.setViewportSize({ width: 390, height: 844 });
    await noHorizontalOverflow(page, file + ' 390x844 initial select');
    await page.screenshot({
      path: path.join(root, 'screenshots', prefix + '-current-ui-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    });
    screenshots.push(prefix + '-current-ui-mobile.png');
    await verifyViewportFooterFlow(page, industrySelect, businessSelect, fixture, 1280, 720, file);
    await verifyViewportFooterFlow(page, industrySelect, businessSelect, fixture, 390, 844, file);

    report.variants.push({
      file,
      rootTokens: tokens,
      industryOptionsChecked: matrix.industryOptionsChecked,
      curatedCombinationsChecked: matrix.combinationsChecked,
      fakeIndustryOptionsChecked: 100,
      viewports: ['1440x1000', '1280x720', '390x844'],
      screenshots,
      passed: true,
    });
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    for (const file of variants) await verifyVariant(browser, file);
  } finally {
    await browser.close();
  }
  assert(report.externalRequests.length === 0,
    'Expected zero HTTP requests: ' + report.externalRequests.join(', '));
  assert(report.errors.length === 0, report.errors.join('\n'));
  report.passed = true;
}

main().then(() => {
  fs.writeFileSync(path.join(root, 'verification-current-ui.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}).catch(error => {
  report.passed = false;
  report.failure = error && error.stack ? error.stack : String(error);
  fs.writeFileSync(path.join(root, 'verification-current-ui.json'), JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
});
