import assert from 'node:assert/strict';
import {
  PREVIEW_NPC_IDS, PREVIEW_NPCS, PreviewAiError, PreviewSessionStore, createPreviewAiService, getAllowedTasks, resolvePreviewNode,
} from '../src/lib/game/project-one-preview-ai';
import { previewAiRequestSchema, previewAiResponseSchema } from '../src/lib/contracts/project-one-preview-ai';

const json = (value: unknown) => JSON.stringify(value);
let commandIndex = 0;
function commandId(): string { commandIndex += 1; return ('command-' + commandIndex).padEnd(24, 'x'); }
function withMeta<T extends object>(request: T, version: number, previewSessionId?: string) {
  return { ...request, commandId: commandId(), expectedVersion: version, ...(previewSessionId ? { previewSessionId } : {}) };
}
const emptyEvaluation = {
  pleasureDelta: 0, supportDelta: 0,
  dimensionDeltas: { decisionAnalysis: 0, relationshipBuilding: 0, valuePresentation: 0, objectionHandling: 0, informationDiscovery: 0 },
  effectiveContact: false, memoryUpdates: [], blockerUpdates: [],
};

async function main() {
  assert.deepEqual(PREVIEW_NPC_IDS, ['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005']);
  assert.deepEqual(getAllowedTasks('P1-001'), ['提问', '质疑', '挖坑']);
  assert.equal(PREVIEW_NPCS['P1-002'].personality.length > 0, true);
  assert.equal(PREVIEW_NPCS['P1-003'].taboos.includes('现金回扣'), true);
  assert.equal(previewAiRequestSchema.safeParse(withMeta({ action: 'message', npcId: 'P1-001', text: '您好', channel: 'email', profile: { hidden: true } }, 0)).success, false);
  assert.equal(previewAiResponseSchema.safeParse({ previewSessionId: 'x'.repeat(20), version: 1, action: 'reset' }).success, true);

  const prompts: string[] = [];
  let evaluationTurn = 0;
  const service = createPreviewAiService({ invoker: async (messages, options) => {
    assert.equal(options?.thinking, 'disabled', 'preview structured calls disable model thinking');
    const prompt = messages.map((message) => message.content).join('\n');
    prompts.push(prompt);
    if (prompt.includes('判断是否查看已收到的附件')) return json({ viewed: false, impact: '已收到，待有空查看。' });
    if (prompt.includes('独立评估刚刚完成的 NPC 正文')) {
      evaluationTurn += 1;
      const tag = evaluationTurn === 1 ? 'last_commitment_or_feedback' : evaluationTurn === 2 ? 'verified_improvement' : 'key_fulfillment';
      return json({ ...emptyEvaluation, supportDelta: 4, effectiveContact: true,
        dimensionDeltas: { ...emptyEvaluation.dimensionDeltas, decisionAnalysis: 1 },
        memoryUpdates: [{ type: evaluationTurn === 1 ? 'commitment' : 'evidence', summary: tag, status: 'active', tags: [tag], mustMention: true }] });
    }
    return json({ content: '请补充可验证的里程碑。', invitationStatus: 'none' });
  } });
  const first = await service.execute('user-a', withMeta({ action: 'message', npcId: 'P1-002', channel: 'email', text: '确认里程碑并按约给出反馈', attachment: { title: '项目里程碑清单', content: 'SECRET_ATTACHMENT_BODY_SHOULD_NOT_LEAK' } }, 0));
  const sessionId = first.previewSessionId;
  const state = service.store.get('user-a', sessionId)!;
  assert.equal(state.npcStates['P1-001'].pleasantness, 50, 'pleasantness starts from the current-system neutral midpoint');
  state.npcStates['P1-002'].support = 30;
  assert.equal(state.npcStates['P1-002'].effectiveContactCount, 1);
  assert.equal(state.npcStates['P1-002'].dimensionScores.decisionAnalysis, 1);
  assert.equal(resolvePreviewNode(state.npcStates['P1-002']), 'N2');
  assert.equal(prompts[0].includes('人物基础规则：'), true);
  const messagePrompt = prompts.find((prompt) => prompt.includes('请通过邮件回复'))!;
  for (const section of ['人物基础规则：', '状态节点与披露：', '状态：', '高价值工作记忆：', '最近有限历史：', '渠道通用修饰器：', '人物×渠道例外：']) assert.equal(messagePrompt.includes(section), true);
  assert.equal(messagePrompt.indexOf('人物基础规则：') < messagePrompt.indexOf('状态节点与披露：'), true);
  assert.equal(messagePrompt.indexOf('状态节点与披露：') < messagePrompt.indexOf('渠道通用修饰器：'), true);
  assert.equal(prompts.some((prompt) => prompt.includes('SECRET_ATTACHMENT_BODY_SHOULD_NOT_LEAK')), false, 'unviewed attachment content never enters model context');
  assert.equal(state.conversations['P1-002'][0].attachment?.viewed, false, 'attachment viewing state is retained');

  const second = await service.execute('user-a', withMeta({ action: 'message', npcId: 'P1-002', channel: 'email', text: '这里是已经验证的改进证据。' }, first.version, sessionId));
  state.npcStates['P1-002'].support = 50;
  assert.equal(resolvePreviewNode(state.npcStates['P1-002']), 'N3');
  const third = await service.execute('user-a', withMeta({ action: 'message', npcId: 'P1-002', channel: 'email', text: '关键诉求已经按验收记录兑现。' }, second.version, sessionId));
  state.npcStates['P1-002'].support = 70;
  assert.equal(resolvePreviewNode(state.npcStates['P1-002']), 'N4');
  const messages = state.conversations['P1-002'];
  assert.equal(messages.every((message) => Boolean(message.messageId)), true);
  for (const memory of state.npcStates['P1-002'].workingMemory) {
    assert.equal(memory.sourceMessageIds.length > 0, true);
    assert.equal(memory.sourceMessageIds.every((id) => messages.some((message) => message.messageId === id)), true);
  }

  const incomplete = { ...state.npcStates['P1-002'], support: 100, effectiveContactCount: 3, activeBlockers: [], workingMemory: [] };
  assert.equal(resolvePreviewNode(incomplete), 'N1', 'support and contacts alone cannot upgrade without required evidence');

  const redlineService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    if (prompt.includes('独立评估刚刚完成的 NPC 正文')) return json({ ...emptyEvaluation, pleasureDelta: 6, supportDelta: 4, effectiveContact: true });
    return json({ content: '请按正式流程沟通。', invitationStatus: 'none' });
  } });
  const redline = await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '我们可以先给现金回扣，也保证中标。' }, 0));
  assert.match(redline.content ?? '', /不能接受/);
  assert.equal(redline.invitationStatus, 'rejected');
  const redlineState = redlineService.store.get('user-red', redline.previewSessionId)!;
  assert.equal(redlineState.npcStates['P1-003'].activeBlockers.includes('compliance_redline'), true);
  assert.equal(redlineState.npcStates['P1-003'].support, 0, 'hard redline cannot create positive support');
  assert.equal(redlineState.npcStates['P1-003'].pleasantness, 42, 'hard redline enforces a negative pleasantness outcome');
  assert.equal(redlineState.npcStates['P1-003'].effectiveContactCount, 0, 'hard redline is not an effective contact');
  assert.equal(resolvePreviewNode(redlineState.npcStates['P1-003']), 'BLOCKED', 'deterministic redline blocks node promotion');

  redlineState.npcStates['P1-003'].support = 99;
  redlineState.npcStates['P1-003'].pleasantness = 99;
  await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '请确认合规的书面验收流程。' }, redline.version, redline.previewSessionId));
  assert.equal(redlineState.npcStates['P1-003'].support, 100, 'support is clamped to 100');
  assert.equal(redlineState.npcStates['P1-003'].pleasantness, 100, 'pleasantness is clamped to 100');

  const failedService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    return prompt.includes('独立评估刚刚完成的 NPC 正文') ? json({ pleasureDelta: 99 }) : json({ content: '请说明。', invitationStatus: 'none' });
  } });
  const failedState = failedService.store.create('user-failure');
  await assert.rejects(
    failedService.execute('user-failure', withMeta({ action: 'message', npcId: 'P1-001', channel: 'email', text: '请确认下一步。' }, 0, failedState.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
  );
  assert.equal(failedState.conversations['P1-001'].length, 0, 'protocol failure leaves messages unchanged');
  assert.equal(failedState.npcStates['P1-001'].support, 0, 'protocol failure leaves scoring state unchanged');

  await service.execute('user-a', withMeta({ action: 'reset' }, third.version, sessionId));
  assert.equal(state.npcStates['P1-002'].support, 0);
  assert.equal(state.npcStates['P1-002'].workingMemory.length, 0);
  assert.equal(state.conversations['P1-002'].length, 0);

  const replayService = createPreviewAiService({ invoker: async () => json({ needsDetail: false, matchedNpcIds: [], recommendations: [] }) });
  const replayRequest = withMeta({ action: 'plan' as const, text: '先确认目标、决策链和下一步安排。' }, 0);
  const replayFirst = await replayService.execute('user-r', replayRequest);
  const replaySecond = await replayService.execute('user-r', { ...replayRequest, previewSessionId: replayFirst.previewSessionId });
  assert.deepEqual(replaySecond, replayFirst, 'same commandId replays cached response');
  await assert.rejects(
    replayService.execute('user-r', withMeta({ action: 'plan', text: '另一份计划。' }, 0, replayFirst.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'conflict',
  );

  let now = 0;
  const store = new PreviewSessionStore({ capacity: 2, ttlMs: 10, now: () => now });
  const one = store.create('user-one');
  const two = store.create('user-two');
  one.wechat['P1-001'] = 'accepted';
  assert.equal(two.wechat['P1-001'], undefined);
  now = 20;
  assert.equal(store.size(), 0, 'expired sessions are cleaned up');
  console.log('project-one preview AI tests passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
