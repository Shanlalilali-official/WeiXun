'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('C:/Users/17628/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const sourceData = require('./source/demo-data.js');
const toPublicDemoData = require('./source/demo-public.js');

const OUTPUT_DIR = __dirname;
const PROJECT_DIR = path.resolve(OUTPUT_DIR, '..', '..');
const PEOPLE_DIR = path.join(PROJECT_DIR, 'projects', 'public', 'assets', 'people');
const GAME_REFERENCE_PATH = path.join(OUTPUT_DIR, 'screenshots', 'current-game-reference.png');
const ONBOARDING_HERO_PATH = path.join(OUTPUT_DIR, 'assets', 'onboarding-hero-photo-v2.png');
const DATA_MARKER = '<!--DEMO_DATA-->';
const ENGINE_MARKER = '<!--DEMO_ENGINE-->';
const TEMPLATE_BUILDS = [
  { template: 'templates/01-briefing.html', output: '01-作战简报.html' },
  { template: 'templates/02-workspace.html', output: '02-商务工作台.html' },
  { template: 'templates/03-industry.html', output: '03-行业场景.html' },
  { template: 'templates/04-current-ui.html', output: '04-现有UI-标准弹窗.html', layout: 'standard' },
  { template: 'templates/04-current-ui.html', output: '05-现有UI-紧凑弹窗.html', layout: 'compact' },
  { template: 'templates/04-current-ui.html', output: '06-现有UI-分栏弹窗.html', layout: 'split' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function makePhotoDataUri(photoAsset) {
  const photoPath = path.resolve(PEOPLE_DIR, photoAsset);
  assert(photoPath.startsWith(`${PEOPLE_DIR}${path.sep}`), `照片路径越界：${photoAsset}`);
  const buffer = await sharp(photoPath)
    .resize({ width: 448, height: 560, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function makeGameReferenceDataUri() {
  const buffer = await sharp(GAME_REFERENCE_PATH)
    .resize({ width: 1440, withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function makeOnboardingHeroDataUri() {
  const buffer = await sharp(ONBOARDING_HERO_PATH)
    .resize({ width: 1000, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  await fs.writeFile(path.join(OUTPUT_DIR, 'assets', 'onboarding-hero-photo-v2.webp'), buffer);
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

function validateData(data) {
  assert(data.industries.length > 0, '行业列表不能为空');
  assert(data.businesses.length > 0, '主营业务列表不能为空');
  assert(data.people.length === 5, `人物数量应为 5，实际为 ${data.people.length}`);
  const industryIds = new Set(data.industries.map((industry) => industry.id));
  const businessIds = new Set(data.businesses.map((business) => business.id));
  assert(industryIds.size === data.industries.length, '行业 ID 必须唯一');
  assert(businessIds.size === data.businesses.length, '主营业务 ID 必须唯一');
  const combinations = Object.keys(data.scenarios);
  assert(combinations.length > 0, '至少需要一个适配演示组合');
  for (const combination of combinations) {
    const separator = combination.indexOf('+');
    const industryId = separator < 0 ? '' : combination.slice(0, separator);
    const businessId = separator < 0 ? '' : combination.slice(separator + 1);
    assert(industryIds.has(industryId) && businessIds.has(businessId), `${combination} 引用了未知行业或主营业务`);
    const project = data.scenarios[combination];
    assert(Array.isArray(project.details) && project.details.length > 0, `${combination} 缺少公开项目详情`);
    assert(project.details.every((section) => Array.isArray(section.items) && section.items.length > 0), `${combination} 存在空详情分组`);
    assert(project.peopleRoles && data.people.every((person) => project.peopleRoles[person.id]), `${combination} 缺少人物职务映射`);
  }
}

function validateOfflineHtml(html, outputName) {
  assert(!/<script\b[^>]*\bsrc\s*=/i.test(html), `${outputName} 含外部脚本`);
  assert(!/<link\b[^>]*\bhref\s*=\s*["']\s*(?:https?:)?\/\//i.test(html), `${outputName} 含外部样式或字体链接`);
  assert(!/url\(\s*["']?\s*(?:https?:)?\/\//i.test(html), `${outputName} 含外部 CSS 资源`);
  assert(!/<img\b[^>]*\bsrc\s*=\s*["']\s*(?:https?:)?\/\//i.test(html), `${outputName} 含外部图片`);
  assert((html.match(/"photo":"data:image\/jpeg;base64,/g) || []).length === 5, `${outputName} 应内嵌 5 张人物照片数据`);
  assert((html.match(/<!--DEMO_(?:DATA|ENGINE)-->/g) || []).length === 0, `${outputName} 仍有未替换占位符`);
  assert(!html.includes('__LAYOUT__'), `${outputName} 仍有未替换布局标记`);
  assert(!html.includes('__GAME_BACKDROP__'), `${outputName} 仍有未替换游戏界面背景标记`);
  assert(!html.includes('__ONBOARDING_HERO__'), `${outputName} 仍有未替换开场配图标记`);
}

async function main() {
  validateData(sourceData);
  const publicData = toPublicDemoData(sourceData);
  validateData(publicData);
  const engineSource = await fs.readFile(path.join(OUTPUT_DIR, 'source', 'demo-engine.js'), 'utf8');
  const photos = await Promise.all(sourceData.people.map(async (person) => ({
    id: person.id,
    name: person.name,
    photo: await makePhotoDataUri(person.photoAsset),
  })));
  const gameReferenceDataUri = await makeGameReferenceDataUri();
  const onboardingHeroDataUri = await makeOnboardingHeroDataUri();
  const embeddedData = { ...publicData, people: photos };
  const dataScript = `<script>window.DEMO_DATA = ${scriptSafeJson(embeddedData)};</script>`;
  const engineScript = `<script>\n${engineSource}\n</script>`;
  const rendered = [];

  for (const build of TEMPLATE_BUILDS) {
    const templatePath = path.resolve(OUTPUT_DIR, build.template);
    assert(templatePath.startsWith(`${OUTPUT_DIR}${path.sep}`), `模板路径越界：${build.template}`);
    const template = await fs.readFile(templatePath, 'utf8');
    assert(template.split(DATA_MARKER).length - 1 === 1, `${build.template} 必须恰有一个 ${DATA_MARKER}`);
    assert(template.split(ENGINE_MARKER).length - 1 === 1, `${build.template} 必须恰有一个 ${ENGINE_MARKER}`);
    let html = template.replace(DATA_MARKER, dataScript).replace(ENGINE_MARKER, engineScript);
    if (build.layout) {
      assert(html.split('__LAYOUT__').length - 1 === 1, `${build.template} 必须恰有一个 __LAYOUT__`);
      html = html.replaceAll('__LAYOUT__', build.layout);
      if (html.includes('__GAME_BACKDROP__')) html = html.replaceAll('__GAME_BACKDROP__', gameReferenceDataUri);
      assert(html.split('__ONBOARDING_HERO__').length - 1 === 1, `${build.template} 必须恰有一张开场配图`);
      html = html.replaceAll('__ONBOARDING_HERO__', onboardingHeroDataUri);
    }
    validateOfflineHtml(html, build.output);
    rendered.push({ output: path.join(OUTPUT_DIR, build.output), html });
  }

  for (const item of rendered) {
    await fs.writeFile(item.output, item.html, 'utf8');
    const stats = await fs.stat(item.output);
    console.log(`Built ${path.basename(item.output)} (${(stats.size / 1024).toFixed(0)} KB)`);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
