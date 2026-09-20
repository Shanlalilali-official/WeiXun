import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(process.cwd(), 'public/project1-prototype-v9.html'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'src/app/api/project-one-preview/ai/route.ts'), 'utf8');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(html.includes('data-action="test-controls"'), '顶部缺少测试调节入口');
assert(html.includes('data-action="skip-visit-prep"'), '拜访准备页缺少跳过准备直接拜访入口');
assert(html.includes("if(a==='skip-visit-prep')return startVisitSimulation({skipPreparation:true})"), '跳过准备入口没有进入实际拜访');
assert(html.includes('id="test-phase" type="number" min="1" max="5"'), '缺少阶段范围控制');
assert(html.includes('id="test-action-points" type="number" min="0" max="999"'), '缺少行动点范围控制');
assert(html.includes('id="test-total-spent" type="number" min="0" max="9999"'), '缺少累计消耗范围控制');
assert(html.includes("[['','未添加'],['accepted','已添加'],['pending','待处理'],['rejected','已拒绝']]"), '微信测试状态选项不完整');
assert(html.includes('data-test-field="support" type="number" min="0" max="100"'), '缺少 NPC 支持度控制');
assert(html.includes('data-test-field="pleasantness" type="number" min="0" max="100"'), '缺少 NPC 愉悦度控制');
assert(html.includes('data-test-field="effectiveContactCount" type="number" min="0" max="100"'), '缺少 NPC 有效接触次数控制');
assert(html.includes('data-test-npc-enable='), '缺少逐 NPC 显式覆盖开关');
assert(html.includes("MockData.npcs.filter(person=>enabledNpcIds.has(person.id))"), '未勾选人物仍会被 NPC 测试调节覆盖');
assert(html.includes('data-test-appointment-enable='), '缺少逐联系人预约覆盖开关');
assert(html.includes('data-test-appointment-field="status"'), '缺少预约状态控制');
assert(html.includes('data-test-appointment-field="phase"'), '缺少预约阶段控制');
assert(html.includes('data-test-appointment-field="location"'), '缺少预约地点控制');
assert(html.includes('test_adjust_appointments'), '缺少预约测试调节 action');
assert(html.includes('Array.isArray(response.appointments)'), '没有接收服务端返回的预约状态');
assert(html.includes('response.npcTestStates||[]'), '没有接收服务端返回的 NPC 测试状态');
assert(route.includes("['test_adjust_npcs', 'test_adjust_appointments'].includes(parsed.data.action) && !isFastDebugEnabled()"), '生产环境没有默认关闭测试调节 action');
assert(html.includes("if(value)state.wechat[id]=value;else delete state.wechat[id]"), '微信状态没有写入本地测试状态');
assert(html.includes("if(state.wechat[n.id]==='accepted')return renderMessageWorkspace('wechat')"), '已添加状态不能直接进入微信对话');

const applyStart = html.indexOf('async function applyTestControls(){');
const handlerStart = html.indexOf('\nasync function handleAction', applyStart);
assert(applyStart >= 0 && handlerStart > applyStart, '测试值应用函数缺失');
const applySource = html.slice(applyStart, handlerStart);
assert(applySource.indexOf('apiCall(action') < applySource.indexOf('state.phase=phase'), '服务端同步失败前不应先提交本地测试值');
assert(applySource.includes('save();closeModal();render()'), '测试值没有保存并刷新界面');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert(scripts.length > 0, '未找到内联脚本');
for (const [, source] of scripts) new Function(source);

console.log('五人预览测试调节静态回归通过');
