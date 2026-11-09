const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/17628/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = __dirname;
const variants = ['01-作战简报.html', '02-商务工作台.html', '03-行业场景.html'];
const assert = (value, message) => { if (!value) throw new Error(message); };
async function noOverflow(page, label) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);
}
async function visibleImages(page) {
  const photos = page.locator('[data-people-grid] img');
  assert(await photos.count() === 5, 'Five portraits required');
  await photos.evaluateAll(items => Promise.all(items.map(i => i.decode())));
  assert(await photos.evaluateAll(items => items.every(i => i.complete && i.naturalWidth > 0 && i.src.startsWith('data:image/'))), 'Portraits must decode offline');
}
(async () => {
  fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const report = { checkedAt: new Date().toISOString(), variants: [], externalRequests: [], errors: [] };
  try {
    for (const [index, file] of variants.entries()) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const screenshot = async name => page.screenshot({ path: path.join(root, 'screenshots', name), fullPage: true, animations: 'disabled' });
      page.on('pageerror', e => report.errors.push(`${file}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') report.errors.push(`${file}: ${m.text()}`); });
      page.on('request', r => { if (/^https?:/.test(r.url())) report.externalRequests.push(r.url()); });
      await page.goto(pathToFileURL(path.join(root, file)).href);
      await page.evaluate(() => document.fonts.ready);
      await noOverflow(page, `${file} desktop`);
      assert(await page.locator('[data-continue]').isDisabled(), 'Initial continue must be disabled');
      assert(await page.locator('[data-industry]').count() === 8, 'Eight industries');
      assert(await page.locator('[data-business]').count() === 6, 'Six businesses');
      assert(await page.locator('[data-business]:enabled').count() === 0, 'Industry must be selected first');
      await screenshot(`${index + 1}-desktop-select.png`);
      let combinations = 0;
      const industries = await page.locator('[data-industry]').evaluateAll(items => items.map(i => i.dataset.industry));
      for (const industry of industries) {
        await page.locator(`[data-industry="${industry}"]`).click();
        const businesses = await page.locator('[data-business]:enabled').evaluateAll(items => items.map(i => i.dataset.business));
        assert(businesses.length > 0, 'Every industry has a compatible demo');
        for (const business of businesses) {
          await page.locator(`[data-business="${business}"]`).click();
          assert(await page.locator('[data-continue]').isEnabled(), 'Valid pair enables continue');
          await page.locator('[data-continue]').click();
          assert(await page.locator('[data-step="brief"]').isVisible(), 'Background screen visible');
          assert((await page.locator('[data-step="brief"] [data-project-name]').textContent()).trim().length > 4, 'Project title populated');
          await visibleImages(page);
          await page.locator('[data-open-details]').click();
          assert(await page.locator('[data-details-panel]').isVisible(), 'Technical details expandable');
          assert(await page.locator('[data-details-panel] .detail-section').count() >= 4, 'Technical depth groups');
          assert(!/R\d/.test(await page.locator('[data-details-panel]').innerText()), 'Designer row identifiers stay out of the player brief');
          await page.locator('[data-open-details]').click();
          await page.locator('[data-back]').click();
          assert(await page.locator(`[data-business="${business}"]`).getAttribute('aria-pressed') === 'true', 'Back preserves selection');
          combinations++;
        }
      }
      assert(combinations === 12, `Expected 12 curated combinations, got ${combinations}`);
      await page.locator('[data-industry="manufacturing"]').click();
      await page.locator('[data-business="management"]').click();
      await page.locator('[data-industry="healthcare"]').click();
      assert(await page.locator('[data-continue]').isDisabled(), 'Changing to incompatible industry clears business');
      await page.locator('[data-business="infrastructure"]').click();
      await page.locator('[data-continue]').click();
      const previousTitle = await page.locator('[data-step="brief"] [data-project-name]').textContent();
      await page.locator('[data-back]').click();
      await page.locator('[data-industry="manufacturing"]').click();
      await page.locator('[data-business="management"]').click();
      await page.locator('[data-continue]').click();
      assert(await page.locator('[data-step="brief"] [data-project-name]').textContent() !== previousTitle, 'Scenario changes with choice');
      await noOverflow(page, `${file} background desktop`);
      await screenshot(`${index + 1}-desktop-brief.png`);
      await page.locator('[data-open-details]').click();
      await noOverflow(page, `${file} technical details`);
      const dt = await page.locator('.detail-table dt').first().boundingBox();
      const dd = await page.locator('.detail-table dd').first().boundingBox();
      assert(dd.x > dt.x, 'Desktop technical details use label/content columns');
      await page.locator('[data-details-panel]').scrollIntoViewIfNeeded();
      await screenshot(`${index + 1}-desktop-details.png`);
      await page.keyboard.press('Escape');
      assert(await page.locator('[data-details-panel]').isHidden(), 'Escape collapses details');
      await page.locator('[data-start]').click();
      assert(await page.locator('[data-step="ready"]').isVisible(), 'Demo completion visible');
      assert((await page.locator('[data-step="ready"]').innerText()).includes('不会创建真实对局'), 'Demo completion explains result');
      await page.locator('[data-review]:visible').click();
      await page.locator('[data-back]').click();
      const toggle = page.locator('[data-motion-toggle]');
      const before = await toggle.getAttribute('aria-pressed');
      await toggle.click();
      assert(await toggle.getAttribute('aria-pressed') !== before, 'Motion toggle state updates');
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), 'Keyboard navigation works');
      const focusable = '[data-demo-dialog] a[href], [data-demo-dialog] button:not(:disabled), [data-demo-dialog] [tabindex="0"]';
      await page.locator(focusable).evaluateAll(items => {
        const visible = items.filter(i => i.getClientRects().length > 0);
        visible[visible.length - 1].focus();
      });
      await page.keyboard.press('Tab');
      assert(await page.locator(focusable).evaluateAll(items => document.activeElement === items.filter(i => i.getClientRects().length > 0)[0]), 'Dialog keyboard focus wraps');
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page, `${file} mobile select`);
      await screenshot(`${index + 1}-mobile-select.png`);
      await page.locator('[data-continue]').click();
      await noOverflow(page, `${file} mobile background`);
      await visibleImages(page);
      await screenshot(`${index + 1}-mobile-brief.png`);
      await page.locator('[data-start]').click();
      await page.locator('[data-restart]:visible').click();
      assert(await page.locator('[data-step="select"]').isVisible(), 'Restart returns to choices');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'Reduced-motion media supported');
      report.variants.push({ file, curatedCombinationsChecked: combinations, desktop: '1440x1000', mobile: '390x844', passed: true });
      await context.close();
    }
    assert(report.externalRequests.length === 0, 'Standalone demos must not make network requests');
    assert(report.errors.length === 0, report.errors.join('\n'));
    report.passed = true;
    fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
