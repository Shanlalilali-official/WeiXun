const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../../..');
const html = fs.readFileSync(path.join(projectRoot, 'projects/public/project1-prototype-v9.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length, 'preview HTML has an inline app script');
const lastScript = scripts[scripts.length - 1][1];
const bootTail = lastScript.indexOf("window.addEventListener('storage'");
assert.ok(bootTail >= 0, 'preview script has its normal boot boundary');

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const app = { innerHTML: '' };
const modal = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
const document = {
  body: { appendChild: () => undefined },
  getElementById(id) {
    if (id === 'app') return app;
    if (id === 'modal-root') return modal;
    return null;
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => ({ className: '', textContent: '', remove: () => undefined }),
};
const localStorage = new MemoryStorage();
localStorage.setItem('weixun_identity', JSON.stringify({ userId: 'entry-ui-vm-check' }));
const sessionStorage = new MemoryStorage();
const injected = `
globalThis.__entryUi = {
  renderPerson: id => personNode(id),
  title: id => npc(id).title,
  renderContact: id => { state.selectedNpcId = id; return renderComm(); },
};
`;
const source = `${lastScript.slice(0, bootTail)}${injected}\n})();`;
const context = vm.createContext({
  console,
  document,
  window: { matchMedia: () => ({ matches: false }), addEventListener: () => undefined },
  localStorage,
  sessionStorage,
  fetch: async () => { throw new Error('unexpected network call during UI render verification'); },
  AbortController,
  TextDecoder,
  TextEncoder,
  ReadableStream,
  URL,
  Event,
  Date,
  Math,
  crypto: { randomUUID: () => 'entry-ui-vm-check' },
  setTimeout: callback => { callback(); return 0; },
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
});
vm.runInContext(source, context, { filename: 'project1-prototype-v9.inline.js' });
const ui = vm.runInContext('globalThis.__entryUi', context);
const npcIds = ['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005'];

for (const npcId of npcIds) {
  const card = ui.renderPerson(npcId);
  assert.ok(card.includes(ui.title(npcId)), `person card shows job title for ${npcId}`);
  assert.equal(card.includes('class="referral-badge"'), npcId === 'P1-003', `referral badge only appears for Wang Defu (${npcId})`);
  const detail = ui.renderContact(npcId);
  assert.ok(detail.includes(ui.title(npcId)), `contact detail shows job title for ${npcId}`);
  if (npcId !== 'P1-003') assert.ok(!detail.includes('可由他人引荐认识王德福'), `no referral purpose is shown for ${npcId}`);
}

assert.ok(ui.renderPerson('P1-003').includes('可通过他人引荐认识王德福，添加微信并邀约拜访'), 'Wang Defu badge explains referral by an external contact');
assert.ok(ui.renderContact('P1-003').includes('可由他人引荐认识王德福，添加微信并邀约拜访'), 'Wang Defu detail explains referral by an external contact');
console.log('五人预览 HTML VM 渲染验证通过：卡片/详情职务、王德福唯一引荐标识与用途');
