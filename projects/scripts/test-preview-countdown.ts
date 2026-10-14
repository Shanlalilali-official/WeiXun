import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const html = readFileSync(resolve(process.cwd(), 'public/project1-prototype-v9.html'), 'utf8');
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(source, '预览页缺少应用脚本');
const end = source.lastIndexOf('})();');
assert.notEqual(end, -1, '预览页 IIFE 不完整');

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}

let now = 1_700_000_000_000;
class ClockDate extends Date {
  static override now() { return now; }
}

const localStorage = new MemoryStorage();
localStorage.setItem('weixun_identity', JSON.stringify({ userId: 'timer-test-user' }));
localStorage.setItem('weixun_session', 'timer-test-token');
const app = { innerHTML: '' };
const document = {
  hidden: false,
  body: { appendChild: () => undefined },
  getElementById(id: string) { return id === 'app' ? app : id === 'modal-root' ? { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } : id === 'toast-root' ? { appendChild: () => undefined } : null; },
  querySelectorAll: () => [], querySelector: () => null,
  createElement: () => ({ className: '', textContent: '', remove: () => undefined }),
  addEventListener: () => undefined,
};
const injected = `${source.slice(0, end)}
globalThis.__timerHooks={
 snapshot:()=>JSON.parse(JSON.stringify(state.timer)),
 set:(points,elapsed=0)=>{state.screen='game';state.actionPoints=points;state.timer={...freshTimer(),started:true,elapsedMs:elapsed,lastResumedAt:Date.now(),refillsApplied:Math.floor(elapsed/TIMER_REFILL_INTERVAL_MS)}},
 sync:at=>syncCountdown(at), pause:()=>pauseCountdown(), resume:turns=>resumeCountdown(turns), points:()=>state.actionPoints, remaining:()=>remainingCountdownMs(),
 project:()=>{state=initialState();state.screen='projects'}, start:at=>startCountdown(at), finalize:()=>finalizePreview('timeout'), screen:()=>state.screen,
 prepareLate:()=>{let aborted=false;state.screen='game';state.timer={...freshTimer(),started:true,expired:true};state.aiRetry={action:'plan',commandId:'late-command',payload:{text:'late'},kind:'plan',meta:null};requestBusy=true;activeRequestSerial=41;activeRequestController={abort:()=>{aborted=true}};return ()=>({aborted,serial:activeRequestSerial,busy:requestBusy,retry:state.aiRetry,screen:state.screen})},
};
})();`;
const context = vm.createContext({
  console, document, localStorage, sessionStorage: new MemoryStorage(),
  window: { matchMedia: () => ({ matches: false }), addEventListener: () => undefined },
  fetch: async () => ({ ok: false, json: async () => ({}) }), AbortController, TextDecoder, TextEncoder, URL, Event, Math, Date: ClockDate,
  crypto: { randomUUID: () => 'timer-command-id' }, setTimeout: () => 0, clearTimeout: () => undefined, setInterval: () => 0, clearInterval: () => undefined,
  requestAnimationFrame: () => 0, performance: { now: () => 0 },
});
vm.runInContext(injected, context, { filename: 'project1-prototype-v9.timer.js' });
const hooks = vm.runInContext('globalThis.__timerHooks', context) as {
  snapshot: () => { elapsedMs: number; paused: boolean; expired: boolean }; set: (points: number, elapsed?: number) => void;
  sync: (at: number) => boolean; pause: () => void; resume: (turns: number) => boolean; points: () => number; remaining: () => number;
  project: () => void; start: (at: number) => void; finalize: () => void; screen: () => string;
  prepareLate: () => () => { aborted: boolean; serial: number; busy: boolean; retry: unknown; screen: string };
};

hooks.project();
hooks.sync(now + 10 * 60_000);
hooks.start(now + 10 * 60_000);
assert.equal(hooks.remaining(), 20 * 60_000, '停留在项目选择页不会消耗项目时间');

hooks.set(20);
hooks.sync(now + 5 * 60_000);
assert.equal(hooks.points(), 25, '5 分钟补充 5 点行动点');
hooks.sync(now + 15 * 60_000);
assert.equal(hooks.points(), 28, '跨多个恢复点仍受 28 点上限限制');

hooks.set(12, 4 * 60_000);
hooks.pause();
now += 10 * 60_000;
hooks.sync(now);
assert.equal(hooks.snapshot().elapsedMs, 4 * 60_000, '拜访暂停时不累计真实时间');
assert.equal(hooks.resume(4), false, '4 轮扣 60 秒后尚未超时');
assert.equal(hooks.snapshot().elapsedMs, 5 * 60_000, '拜访结束按每轮 15 秒扣时');
assert.equal(hooks.points(), 17, '扣时跨 5 分钟恢复点后补充 5 点');

hooks.set(24, 19 * 60_000 + 45_000);
assert.equal(hooks.resume(1), true, '第 20 分钟的最后一轮扣时触发超时');
assert.equal(hooks.snapshot().expired, true, '超时状态持久化');
assert.equal(hooks.remaining(), 0, '超时后剩余时间为零');

hooks.set(28);
hooks.finalize();
assert.equal(hooks.screen(), 'result', '统一结算收口进入结果页，后续异步响应不能回到游戏页面');

const lateStatus = hooks.prepareLate();
hooks.finalize();
const settledLate = lateStatus();
assert.equal(settledLate.aborted, true, '超时统一结算取消延迟 AI 请求');
assert.equal(settledLate.serial, 42, '超时统一结算使延迟请求上下文失效');
assert.equal(settledLate.busy, false, '超时统一结算释放请求忙碌态');
assert.equal(settledLate.retry, null, '超时统一结算清理重试状态');
assert.equal(settledLate.screen, 'result', '超时统一结算保留结果页');

console.log('五人预览倒计时、补点与拜访扣时回归通过');
