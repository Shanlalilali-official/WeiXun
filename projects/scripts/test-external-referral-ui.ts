import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const html = readFileSync(resolve(process.cwd(), 'public/project1-prototype-v9.html'), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)?.[1];
assert.ok(source, '实际测试页应包含应用脚本');
const bootTail = source.indexOf("window.addEventListener('storage'");
assert.notEqual(bootTail, -1, '应能定位实际测试页启动监听器');

const formalPage = readFileSync(resolve(process.cwd(), 'src/app/game/page.tsx'), 'utf8');
assert.match(formalPage, /runCommand\('use_referral', \{ npcId: 'P1-003' \}\)/, '正式玩家端必须走服务端 use_referral 命令');
assert.match(formalPage, /selectedNpc !== 'P1-003'\) return/, '正式入口只允许王德福');
assert.match(formalPage, /hasExternalReferral\(asRecord\(nextState\)\?\.referrals, 'P1-003'\)/, '正式端成功提示必须依赖返回状态中的有效引荐');
assert.match(formalPage, /EXTERNAL_REFERRAL_NOT_CONFIRMED/, '正式端缺少权威引荐记录时应保持未完成');

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}

const npcIds = ['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005'];
const sessionId = '8a38546e-9045-4ad2-9e90-a276bfdf7d30';
const userA = 'external-referral-ui-a';
const userB = 'external-referral-ui-b';
const grantedAt = 1_794_000_000_000;
const validReferral = {
  'P1-003': {
    id: 'external-referral:command-1', targetNpcId: 'P1-003', sourceKind: 'external', status: 'granted', grantedAt, chargedActionPoints: 0,
  },
};

function makeSnapshot(referrals?: unknown) {
  return {
    previewSessionId: sessionId,
    version: 3,
    conversations: Object.fromEntries(npcIds.map((npcId) => [npcId, []])),
    appointments: [],
    wechat: {},
    activeMeeting: null,
    customerActivities: { version: 1, serverNow: Date.now(), tasks: [] },
    ...(referrals === undefined ? {} : { referrals }),
  };
}

type HttpReply = { status: number; body: unknown };
type RequestRecord = { method: string; action?: string; commandId?: string; body?: Record<string, unknown> };
type PostHandler = (body: Record<string, unknown>) => HttpReply | Promise<HttpReply>;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function createHarness(options: { savedReferral?: unknown; snapshotReferral?: unknown } = {}) {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const savedState = {
    screen: 'game', actionPoints: 28, totalSpent: 0, selectedNpcId: 'P1-003', workspaceMode: 'overview',
    wechat: {}, appointments: [], referrals: options.savedReferral ?? {},
  };
  const setUser = (userId: string, token: string, state: Record<string, unknown>, previewId: string | null) => {
    localStorage.setItem('weixun_identity', JSON.stringify({ userId }));
    localStorage.setItem('weixun_session', token);
    const suffix = encodeURIComponent(userId);
    sessionStorage.setItem(`project1_interactive_prototype_v10:user:${suffix}`, JSON.stringify({ ownerId: userId, state }));
    if (previewId) sessionStorage.setItem(`weixun_project1_preview_session_v1:user:${suffix}`, JSON.stringify({ ownerId: userId, id: previewId, version: 2 }));
    else sessionStorage.removeItem(`weixun_project1_preview_session_v1:user:${suffix}`);
  };
  setUser(userA, 'external-referral-token-a', savedState, sessionId);

  let serverSnapshot = makeSnapshot(options.snapshotReferral);
  const postHandlers: PostHandler[] = [];
  const requests: RequestRecord[] = [];
  let timerId = 0;
  const app = { innerHTML: '' };
  const modal = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const toastRoot = { appendChild: () => undefined };
  const modalActionButton = { onclick: null as null | (() => void) };
  const messageInput = { value: '', addEventListener: () => undefined, toggleAttribute: () => undefined };
  const attachmentInput = { value: '', addEventListener: () => undefined, toggleAttribute: () => undefined };
  const document = {
    hidden: false,
    body: { appendChild: () => undefined },
    getElementById(id: string) { return id === 'app' ? app : id === 'modal-root' ? modal : id === 'toast-root' ? toastRoot : id === 'go-prep' ? modalActionButton : id === 'message-text' ? messageInput : id === 'attachment-text' ? attachmentInput : null; },
    querySelectorAll: () => [] as unknown[],
    querySelector: () => null,
    createElement: () => ({ className: '', textContent: '', remove: () => undefined, setAttribute: () => undefined }),
    addEventListener: () => undefined,
  };
  const fetch = async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input), method = init.method || 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    requests.push({
      method,
      action: typeof body?.action === 'string' ? body.action : undefined,
      commandId: typeof body?.commandId === 'string' ? body.commandId : undefined,
      body,
    });
    if (url.startsWith('/api/project-one-preview/ai?') && method === 'GET') {
      return jsonResponse(200, { success: true, data: serverSnapshot });
    }
    if (url === '/api/project-one-preview/ai' && method === 'POST') {
      assert.ok(body, '预览POST应包含JSON请求');
      const handler = postHandlers.shift();
      assert.ok(handler, `未配置POST响应: ${String(body.action)}`);
      const reply = await handler(body);
      return jsonResponse(reply.status, reply.body);
    }
    return jsonResponse(404, { error: 'unexpected route' });
  };
  const host = {
    setServerSnapshot(value: unknown) { serverSnapshot = value as typeof serverSnapshot; },
    setPostHandlers(...handlers: PostHandler[]) { postHandlers.push(...handlers); },
    switchUser(userId: string, token: string, state: Record<string, unknown>, previewId: string | null = null) {
      setUser(userId, token, state, previewId);
    },
  };
  const injected = `${source!.slice(0, bootTail)}
globalThis.__externalReferralHooks={
 snapshot:()=>JSON.parse(JSON.stringify(state)),
 renderComm:()=>renderComm(),
 renderPeople:()=>renderPeople(),
 action:action=>handleAction({currentTarget:{dataset:{action}}}),
 recover:()=>recoverPreviewSession({force:true}),
 setSelectedNpcId:id=>{state.selectedNpcId=id},
 setBusy:value=>{requestBusy=value;activeRequestAction=value?'use_referral':''},
 setActionPoints:value=>{state.actionPoints=value},
 setWorkspaceMode:value=>{state.workspaceMode=value},
 setMessageDraft:value=>{document.getElementById('message-text').value=value},
 sendMessage:()=>sendMessage(),
 sendMessageWithPayload:options=>sendMessage(options),
 reload:()=>{state=loadState(activeUserId);restorePreviewSession(activeUserId);invalidatePreviewRecovery()},
 syncIdentity:()=>syncIdentitySnapshot(),
 ready:()=>previewRecoveryIsReady()
};
})();`;
  const context = vm.createContext({
    console, document, window: { matchMedia: () => ({ matches: false }), addEventListener: () => undefined },
    localStorage, sessionStorage, fetch, AbortController, TextDecoder, TextEncoder, ReadableStream, URL, Event, Date, Math,
    crypto: { randomUUID: () => `referral-command-${requests.filter((request) => request.method === 'POST').length + 1}` },
    setTimeout: (callback: () => void, delay = 0) => { const id = ++timerId; if (delay === 0) queueMicrotask(callback); return id; },
    clearTimeout: () => undefined,
  });
  vm.runInContext(injected, context, { filename: 'project1-prototype-v9.external-referral.js' });
  const hooks = vm.runInContext('globalThis.__externalReferralHooks', context) as {
    snapshot: () => Record<string, unknown>;
    renderComm: () => string;
    renderPeople: () => string;
    action: (action: string) => Promise<unknown>;
    recover: () => Promise<unknown>;
    setSelectedNpcId: (id: string) => void;
    setBusy: (busy: boolean) => void;
    setActionPoints: (value: number) => void;
    setWorkspaceMode: (value: string) => void;
    setMessageDraft: (value: string) => void;
    sendMessage: () => Promise<unknown>;
    sendMessageWithPayload: (options: Record<string, unknown>) => Promise<unknown>;
    reload: () => void;
    syncIdentity: () => boolean;
    ready: () => boolean;
  };
  return { hooks, requests, host, localStorage, sessionStorage };
}

function successReply(referrals?: unknown): PostHandler {
  return (body) => ({
    status: 200,
    body: {
      success: true, previewSessionId: sessionId, version: Number(body.expectedVersion || 0) + 1,
      data: { version: Number(body.expectedVersion || 0) + 1, ...(referrals === undefined ? {} : { referrals }) },
    },
  });
}

function assertJsonEqual(actual: unknown, expected: unknown, message: string) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

async function main() {
  const localOnly = createHarness({ savedReferral: validReferral });
  const localState = localOnly.hooks.snapshot();
  assertJsonEqual(localState.referrals, {}, '加载浏览器缓存时不得恢复引荐授权');
  assert.doesNotMatch(localOnly.hooks.renderComm(), /已通过引荐建立联系/, '本地缓存不得显示已引荐');
  assert.match(localOnly.hooks.renderComm(), /data-action="use-referral"/, '王德福未获权威引荐时显示入口');
  localOnly.hooks.setSelectedNpcId('P1-001');
  assert.doesNotMatch(localOnly.hooks.renderComm(), /data-action="use-referral"/, '其他联系人不显示入口');
  localOnly.hooks.setSelectedNpcId('P1-003');
  await localOnly.hooks.recover();
  assert.equal(localOnly.hooks.ready(), true, '必须先完成服务端会话恢复');
  assertJsonEqual(localOnly.hooks.snapshot().referrals, {}, '旧服务端快照缺 referrals 时按空状态恢复');
  assert.equal(Object.values(localOnly.hooks.snapshot().wechat as Record<string, unknown>).some((status) => status !== null), false, '恢复和引荐流程不从缓存伪造微信状态');
  assertJsonEqual(localOnly.hooks.snapshot().appointments, [], '恢复和引荐流程不从缓存伪造预约');
  const wechatBeforeReferral = JSON.stringify(localOnly.hooks.snapshot().wechat);
  const appointmentsBeforeReferral = JSON.stringify(localOnly.hooks.snapshot().appointments);

  localOnly.hooks.setBusy(true);
  assert.match(localOnly.hooks.renderComm(), /data-action="use-referral" disabled aria-busy="true"/, '正在请求时引荐入口显示忙碌并禁用');
  const postCountWhileBusy = localOnly.requests.filter((request) => request.method === 'POST').length;
  await localOnly.hooks.action('use-referral');
  assert.equal(localOnly.requests.filter((request) => request.method === 'POST').length, postCountWhileBusy, '忙碌时重复点击不发第二个POST');
  localOnly.hooks.setBusy(false);

  localOnly.host.setPostHandlers(
    () => ({ status: 503, body: { error: '暂时不可用' } }),
    successReply(undefined),
    successReply(validReferral),
  );
  await localOnly.hooks.action('use-referral');
  const afterFailure = localOnly.hooks.snapshot();
  assertJsonEqual(afterFailure.referrals, {}, '失败响应不得建立本地引荐');
  assert.equal(JSON.stringify(afterFailure.wechat), wechatBeforeReferral, '引荐失败不得改微信状态');
  assert.equal(JSON.stringify(afterFailure.appointments), appointmentsBeforeReferral, '引荐失败不得创建预约');
  assert.equal(afterFailure.actionPoints, 28, '引荐失败不得扣行动点');
  assert.equal(afterFailure.totalSpent, 0, '引荐失败不得增加累计花费');
  assert.match(localOnly.hooks.renderComm(), /data-action="use-referral"/, '失败后保留引荐入口供重试');

  await localOnly.hooks.action('use-referral');
  const noReferral200 = localOnly.hooks.snapshot();
  assertJsonEqual(noReferral200.referrals, {}, 'HTTP 200缺少referrals时仍不能标记成功');
  assert.equal(JSON.stringify(noReferral200.wechat), wechatBeforeReferral, 'HTTP 200缺少referrals时不能改微信状态');
  assert.equal(JSON.stringify(noReferral200.appointments), appointmentsBeforeReferral, 'HTTP 200缺少referrals时不能创建预约');
  assert.equal(noReferral200.actionPoints, 28, 'HTTP 200缺少referrals时不能扣行动点');
  assert.equal(noReferral200.totalSpent, 0, 'HTTP 200缺少referrals时不能改累计花费');
  const missingGrantCommandId = localOnly.requests.filter((request) => request.method === 'POST').at(-1)?.commandId;
  assert.ok(missingGrantCommandId, '缺少引荐记录的响应必须保留可重试命令');

  localOnly.host.setServerSnapshot({ ...makeSnapshot(validReferral), version: 5 });
  await localOnly.hooks.action('retry-ai');
  const afterSuccess = localOnly.hooks.snapshot();
  assertJsonEqual(afterSuccess.referrals, validReferral, '只有服务端返回有效记录后才更新refs');
  assert.equal(afterSuccess.selectedNpcId, 'P1-003', '成功后仍聚焦王德福');
  assert.equal(afterSuccess.workspaceMode, 'wechat', '成功后引导到原工作微信申请入口');
  assert.match(String(afterSuccess.wechatRequestDraft), /外部引荐/, '工作微信申请预填自然说明');
  assert.equal(JSON.stringify(afterSuccess.wechat), wechatBeforeReferral, '登记引荐不伪造已加微信');
  assert.equal(JSON.stringify(afterSuccess.appointments), appointmentsBeforeReferral, '登记引荐不伪造邀约或预约');
  assert.equal(afterSuccess.actionPoints, 28, '引荐登记不扣行动点');
  assert.equal(afterSuccess.totalSpent, 0, '引荐登记不改累计花费');
  assert.match(localOnly.hooks.renderComm(), /已通过引荐建立联系/, '正式HTML在权威状态下显示成功');
  assert.match(localOnly.hooks.renderComm(), /已通过引荐建立联系；请补充添加原因和后续沟通安排/, '王德福的微信申请引导使用自然产品说明');
  assert.doesNotMatch(localOnly.hooks.renderComm(), /AI\s*\/\s*后端|授权状态/, '玩家界面不泄露实现术语');
  assert.doesNotMatch(localOnly.hooks.renderComm(), /data-action="use-referral"/, '成功后不再显示未完成入口');
  assert.equal(localOnly.requests.filter((request) => request.method === 'POST').at(-1)?.commandId, missingGrantCommandId, '重试使用原命令ID');

  const postsAfterGrant = localOnly.requests.filter((request) => request.method === 'POST').length;
  await localOnly.hooks.action('use-referral');
  assert.equal(localOnly.requests.filter((request) => request.method === 'POST').length, postsAfterGrant, '重复点击已完成引荐不重复POST');

  localOnly.hooks.reload();
  assertJsonEqual(localOnly.hooks.snapshot().referrals, {}, '刷新先丢弃本地引荐缓存');
  assert.doesNotMatch(localOnly.hooks.renderComm(), /已通过引荐建立联系/, '刷新恢复前不根据本地缓存显示已引荐');
  await localOnly.hooks.recover();
  assertJsonEqual(localOnly.hooks.snapshot().referrals, validReferral, '刷新后从服务端snapshot恢复引荐');
  assert.match(localOnly.hooks.renderComm(), /已通过引荐建立联系/, '恢复服务端snapshot后显示引荐状态');

  const accountBState = { screen: 'game', actionPoints: 28, totalSpent: 0, selectedNpcId: 'P1-003', workspaceMode: 'overview', wechat: {}, appointments: [], referrals: validReferral };
  localOnly.host.switchUser(userB, 'external-referral-token-b', accountBState);
  localOnly.hooks.syncIdentity();
  assertJsonEqual(localOnly.hooks.snapshot().referrals, {}, '账号切换清除另一账号的本地引荐缓存');
  assert.doesNotMatch(localOnly.hooks.renderComm(), /已通过引荐建立联系/, '账号切换后不沿用其他账号引荐状态');

  const serverGranted = createHarness({ snapshotReferral: validReferral });
  await serverGranted.hooks.recover();
  assertJsonEqual(serverGranted.hooks.snapshot().referrals, validReferral, '刷新恢复可接受的服务端referrals');
  assert.match(serverGranted.hooks.renderComm(), /已通过引荐建立联系/, '服务端已授权后显示成功状态');
  assert.doesNotMatch(serverGranted.hooks.renderComm(), /data-action="use-referral"/, '已有授权时隐藏未完成入口');

  // The referral record is the AP receipt. Model a commit whose HTTP response
  // disappears, then reconcile it through recovery and a replay without ever
  // double-spending or refunding a stale lower server total.
  const referralWithOnePoint = {
    'P1-003': { ...validReferral['P1-003'], chargedActionPoints: 1 },
  };
  const acceptedAppointment = {
    id: '6c1c3f82-c0cb-48c7-8bc7-1c5b6a046b4f', npcId: 'P1-003', status: 'accepted',
    timeWindow: '15:00', location: '客户会议室', agenda: '项目推进',
  };
  const lostReply = createHarness({ snapshotReferral: validReferral });
  await lostReply.hooks.recover();
  lostReply.host.setPostHandlers(
    () => ({ status: 503, body: { error: 'response lost after commit' } }),
    (body) => ({
      status: 200,
      body: {
        success: true, previewSessionId: sessionId, version: Number(body.expectedVersion || 0) + 1,
        data: {
          version: Number(body.expectedVersion || 0) + 1, referrals: referralWithOnePoint,
          responseAction: 'reply', readStatus: 'read', playerMessageId: 'server-replay-message',
          content: '此前确认的拜访安排仍然有效。', invitationStatus: 'accepted', appointment: acceptedAppointment,
          appointmentReused: true, referralCostRecorded: true,
        },
      },
    }),
  );
  await lostReply.hooks.sendMessageWithPayload({
    commandId: 'lost-referral-invite-command',
    payload: { npcId: 'P1-003', channel: 'email', text: '请安排一次拜访，沟通项目推进。' },
  });
  assert.equal(lostReply.hooks.snapshot().actionPoints, 28, '丢失回包前客户端不得猜测扣除引荐费用');
  lostReply.host.setServerSnapshot({ ...makeSnapshot(referralWithOnePoint), version: 4, appointments: [acceptedAppointment] });
  await lostReply.hooks.recover();
  assert.equal(lostReply.hooks.snapshot().actionPoints, 27, '恢复应按服务端引荐账本补扣一次费用');
  assert.equal(lostReply.hooks.snapshot().totalSpent, 1, '恢复补扣同步累计花费');
  await lostReply.hooks.sendMessageWithPayload({
    commandId: 'lost-referral-invite-command',
    payload: { npcId: 'P1-003', channel: 'email', text: '请安排一次拜访，沟通项目推进。' },
  });
  assert.equal(lostReply.hooks.snapshot().actionPoints, 27, '同命令重放不重复扣引荐费用');
  lostReply.host.setServerSnapshot({ ...makeSnapshot(validReferral), version: 5, appointments: [acceptedAppointment] });
  await lostReply.hooks.recover();
  assert.equal(lostReply.hooks.snapshot().actionPoints, 27, '旧回放账本总额更低时不得退款');
  assert.equal(lostReply.hooks.snapshot().totalSpent, 1, '旧回放不得回退累计花费');

  const zeroApReuse = createHarness({ snapshotReferral: referralWithOnePoint });
  zeroApReuse.host.setServerSnapshot({ ...makeSnapshot(referralWithOnePoint), version: 6, appointments: [acceptedAppointment] });
  await zeroApReuse.hooks.recover();
  zeroApReuse.hooks.setActionPoints(0);
  zeroApReuse.hooks.setWorkspaceMode('email');
  zeroApReuse.host.setPostHandlers((body) => {
    assert.equal(body.reuseOnly, true, '0 AP with an accepted referral visit must request reuseOnly, not a free new message');
    return {
      status: 200,
      body: {
        success: true, previewSessionId: sessionId, version: Number(body.expectedVersion || 0) + 1,
        data: { version: Number(body.expectedVersion || 0) + 1, referrals: referralWithOnePoint, responseAction: 'reply', readStatus: 'read', playerMessageId: 'reuse-only-message', invitationStatus: 'accepted', appointment: acceptedAppointment, appointmentReused: true, referralCostRecorded: true, content: '此前确认的拜访安排仍然有效。' },
      },
    };
  });
  zeroApReuse.hooks.setMessageDraft('王主任，明天下午可以拜访您吗？');
  const zeroApPostCount = zeroApReuse.requests.filter((request) => request.method === 'POST').length;
  await zeroApReuse.hooks.sendMessage();
  assert.equal(zeroApReuse.requests.filter((request) => request.method === 'POST').length, zeroApPostCount + 1,
    '0 AP 已有预约时必须真的发出 reuseOnly 请求，不能在客户端提前返回');
  assert.equal(zeroApReuse.requests.filter((request) => request.method === 'POST').at(-1)?.body?.reuseOnly, true,
    '0 AP 已有预约的正常邀约文本必须由服务端按 reuseOnly 验证');
  assert.equal(zeroApReuse.hooks.snapshot().actionPoints, 0, '复用既有预约不消耗行动点');
  assert.equal((zeroApReuse.hooks.snapshot().appointments as Array<{ id?: string }>).some((item) => item.id === acceptedAppointment.id), true,
    'reuseOnly 只能返回既有预约，不能创建新的预约记录');

  console.log('External referral UI VM checks passed (preview + formal source contract).');
}

void main();
