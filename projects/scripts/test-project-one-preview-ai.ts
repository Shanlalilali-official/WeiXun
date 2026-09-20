import assert from 'node:assert/strict';
import {
  PREVIEW_NPC_IDS, PREVIEW_NPCS, PreviewAiError, PreviewSessionStore, createPreviewAiService, getAllowedTasks, resolvePreviewNode,
} from '../src/lib/game/project-one-preview-ai';
import { previewAiRequestSchema, previewAiResponseSchema, previewNpcEvaluationAiOutputSchema } from '../src/lib/contracts/project-one-preview-ai';
import { PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS } from '../src/lib/designer/project-one-five-person';

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
const reply = (content: string, invitationStatus: 'none' | 'accepted' | 'rejected' | 'later' = 'none') => ({ responseAction: 'reply' as const, content, invitationStatus });
const readNoReply = (reasonCode: 'natural_closure' | 'no_new_value' | 'repeated_follow_up' | 'not_responsible' | 'current_priority_low' | 'unwilling_to_advance' = 'natural_closure') => ({
  responseAction: 'read_no_reply' as const, content: null, invitationStatus: 'none' as const, reasonCode, reasonEvidence: '当前消息没有需要立即答复的新事项。',
});

async function main() {
  assert.deepEqual(PREVIEW_NPC_IDS, ['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005']);
  assert.deepEqual(getAllowedTasks('P1-001'), ['提问', '质疑']);
  assert.match(PREVIEW_NPCS['P1-001'].personality, /一两句/);
  assert.equal(PREVIEW_NPCS['P1-001'].informationBoundary.some((item) => item.includes('技术参数') && item.includes('SLA')), true);
  assert.equal(PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS['P1-001']?.visit?.includes('不追问技术参数'), true);
  assert.equal(PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS['P1-001']?.direct_visit?.includes('不展开细节'), true);
  assert.equal(PREVIEW_NPCS['P1-002'].personality.length > 0, true);
  assert.equal(PREVIEW_NPCS['P1-003'].taboos.includes('现金回扣'), true);
  assert.equal(previewAiRequestSchema.safeParse(withMeta({ action: 'message', npcId: 'P1-001', text: '您好', channel: 'email', profile: { hidden: true } }, 0)).success, false);
  assert.equal(previewAiRequestSchema.safeParse(withMeta({ action: 'test_adjust_npcs', adjustments: [{ npcId: 'P1-001', support: 101, pleasantness: 50, effectiveContactCount: 0 }] }, 0)).success, false, 'NPC test values enforce server bounds');
  assert.equal(previewAiRequestSchema.safeParse(withMeta({ action: 'test_adjust_npcs', adjustments: [{ npcId: 'P1-001', support: 10, pleasantness: 50, effectiveContactCount: 1 }, { npcId: 'P1-001', support: 20, pleasantness: 60, effectiveContactCount: 2 }] }, 0)).success, false, 'NPC test adjustments reject duplicate people');
  assert.equal(previewAiRequestSchema.safeParse(withMeta({ action: 'start_visit', npcId: 'P1-001', skipPreparation: 'yes' }, 0)).success, false, 'skip preparation must be an explicit boolean');
  assert.equal(previewAiResponseSchema.safeParse({ previewSessionId: 'x'.repeat(20), version: 1, action: 'reset' }).success, true);
  assert.equal(previewNpcEvaluationAiOutputSchema.safeParse({ ...emptyEvaluation, blockerUpdates: [{ action: 'add', value: 'model_invented_blocker' }] }).success, false, 'blocker IDs are a server-controlled enum');

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
    return json(reply('请补充可验证的里程碑。'));
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

  const readPrompts: string[] = [];
  const readService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    readPrompts.push(prompt);
    if (prompt.includes('判断是否查看已收到的附件')) return json({ viewed: true, impact: '材料已查看，作为后续核验依据。' });
    if (prompt.includes('独立评估刚刚完成的 NPC 正文')) return json({
      ...emptyEvaluation,
      supportDelta: 2,
      effectiveContact: true,
      memoryUpdates: [
        { type: 'commitment', summary: 'NPC 不应在沉默中作出的承诺', status: 'active', tags: ['last_commitment_or_feedback'], mustMention: true },
        { type: 'evidence', summary: '玩家报告已完成验收记录，仍待 NPC 核验。', status: 'active', tags: ['last_commitment_or_feedback', 'player_report'], mustMention: true },
      ],
    });
    return json(readNoReply('current_priority_low'));
  } });
  const initialReadRequest = {
    action: 'message' as const, npcId: 'P1-001' as const, channel: 'wechat' as const, text: '验收记录已补齐，预算边界仍请您确认。',
    attachment: { title: '验收记录', content: 'VIEWED_ATTACHMENT_BODY_MAY_REACH_CONTEXT' }, commandId: 'initial-read-command'.padEnd(24, 'x'), expectedVersion: 0,
  };
  const read = await readService.execute('user-read', initialReadRequest);
  assert.equal(read.responseAction, 'read_no_reply');
  assert.equal(read.readStatus, 'read');
  assert.equal(read.content, null);
  assert.equal(read.invitationStatus, 'none');
  assert.equal(read.appointment, undefined);
  assert.equal(typeof read.playerMessageId, 'string');
  const readState = readService.store.get('user-read', read.previewSessionId)!;
  assert.equal(readState.conversations['P1-001'].length, 1, 'a read-without-reply stores no fabricated NPC message');
  assert.equal(readState.conversations['P1-001'][0]?.delivery?.reasonCode, 'current_priority_low', 'the internal diagnostic reason is retained with the real player message');
  assert.equal(readState.conversations['P1-001'][0]?.attachment?.viewed, true, 'attachment viewing remains independent from replying');
  assert.equal(readPrompts.some((prompt) => prompt.includes('VIEWED_ATTACHMENT_BODY_MAY_REACH_CONTEXT')), true, 'viewed attachment content can inform the NPC handling');
  assert.equal(readState.npcStates['P1-001'].support, 2, 'valuable player content remains scoreable without a reply');
  assert.equal(readState.npcStates['P1-001'].effectiveContactCount, 1, 'valuable player content remains an effective contact without a reply');
  assert.equal(readState.npcStates['P1-001'].workingMemory.some((entry) => entry.type === 'commitment' || entry.tags.includes('last_commitment_or_feedback')), false, 'silence cannot create commitments or node-unlocking memory');
  assert.equal(readState.npcStates['P1-001'].workingMemory.every((entry) => entry.sourceMessageIds.length === 1 && entry.sourceMessageIds[0] === read.playerMessageId), true, 'silent-turn memories cite only the real player message');
  const replayedInitialRead = await readService.execute('user-read', initialReadRequest);
  assert.deepEqual(replayedInitialRead, read, 'a lost initial response replays from the same command without a session id');
  readState.conversations['P1-001'].push({ messageId: 'prior-npc-evidence', role: 'npc', channel: 'wechat', text: '此前已收到的核验口径。', at: Date.now() });
  readState.npcStates['P1-001'].workingMemory.push({
    id: 'prior-npc-evidence-memory', type: 'evidence', summary: 'NPC 已确认的旧核验事实', status: 'active', tags: ['player_report'], mustMention: true, sourceMessageIds: ['prior-npc-evidence'],
  });
  const laterRead = await readService.execute('user-read', withMeta({ action: 'message', npcId: 'P1-001', channel: 'wechat', text: '补充同一份验收记录，请您有空核验。' }, read.version, read.previewSessionId));
  const preservedNpcEvidence = readState.npcStates['P1-001'].workingMemory.find((entry) => entry.id === 'prior-npc-evidence-memory')!;
  assert.equal(laterRead.responseAction, 'read_no_reply');
  assert.equal(preservedNpcEvidence.summary, 'NPC 已确认的旧核验事实', 'silence cannot rewrite an existing NPC-sourced evidence record');
  assert.deepEqual(preservedNpcEvidence.sourceMessageIds, ['prior-npc-evidence']);

  const badReadService = createPreviewAiService({ invoker: async (messages) => messages.some((message) => message.content.includes('独立评估刚刚完成的 NPC 正文'))
    ? json(emptyEvaluation)
    : json({ responseAction: 'read_no_reply', content: null, invitationStatus: 'none' }) });
  const badReadState = badReadService.store.create('user-bad-read');
  await assert.rejects(
    badReadService.execute('user-bad-read', withMeta({ action: 'message', npcId: 'P1-001', channel: 'email', text: '收到，谢谢。' }, 0, badReadState.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
  );
  assert.equal(badReadState.conversations['P1-001'].length, 0, 'invalid read_no_reply output cannot leave a partial message');

  const whitespaceReplyService = createPreviewAiService({ invoker: async () => json({ responseAction: 'reply', content: '   ', invitationStatus: 'none' }) });
  const whitespaceReplyState = whitespaceReplyService.store.create('user-whitespace-reply');
  await assert.rejects(
    whitespaceReplyService.execute('user-whitespace-reply', withMeta({ action: 'message', npcId: 'P1-001', channel: 'email', text: '请确认。' }, 0, whitespaceReplyState.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
  );
  assert.equal(whitespaceReplyState.conversations['P1-001'].length, 0, 'blank reply output cannot leave a partial message');

  const appointmentSilenceService = createPreviewAiService({ invoker: async () => json({ ...readNoReply(), appointment: { timeWindow: '明天', location: '会议室', agenda: '错误预约' } }) });
  const appointmentSilenceState = appointmentSilenceService.store.create('user-silent-appointment');
  await assert.rejects(
    appointmentSilenceService.execute('user-silent-appointment', withMeta({ action: 'message', npcId: 'P1-001', channel: 'email', text: '明天方便吗？' }, 0, appointmentSilenceState.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
  );
  assert.equal(appointmentSilenceState.conversations['P1-001'].length, 0, 'silent output cannot carry an appointment');

  const silentEvaluationFailureService = createPreviewAiService({ invoker: async (messages) => messages.some((message) => message.content.includes('独立评估刚刚完成的 NPC 正文'))
    ? json({ pleasureDelta: 99 })
    : json(readNoReply()) });
  const silentEvaluationFailureState = silentEvaluationFailureService.store.create('user-silent-evaluation-failure');
  await assert.rejects(
    silentEvaluationFailureService.execute('user-silent-evaluation-failure', withMeta({ action: 'message', npcId: 'P1-001', channel: 'email', text: '验收记录已补齐。' }, 0, silentEvaluationFailureState.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
  );
  assert.equal(silentEvaluationFailureState.version, 0, 'failed silent evaluation cannot increment the version');
  assert.equal(silentEvaluationFailureState.conversations['P1-001'].length, 0, 'failed silent evaluation cannot store a read receipt');
  assert.equal(silentEvaluationFailureState.npcStates['P1-001'].support, 0, 'failed silent evaluation cannot apply scoring');

  const emailSilencePrompts: string[] = [];
  const emailSilenceService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    emailSilencePrompts.push(prompt);
    if (prompt.includes('判断是否查看已收到的附件')) return json({ viewed: false, impact: '暂未查看附件。' });
    if (prompt.includes('独立评估刚刚完成的 NPC 正文')) return json(emptyEvaluation);
    return json(readNoReply('natural_closure'));
  } });
  const emailSilence = await emailSilenceService.execute('user-email-silence', withMeta({ action: 'message', npcId: 'P1-002', channel: 'email', text: '收到，谢谢。', attachment: { title: '未读附件', content: 'EMAIL_UNVIEWED_ATTACHMENT_MUST_NOT_LEAK' } }, 0));
  assert.equal(emailSilence.responseAction, 'read_no_reply');
  assert.equal(emailSilence.readStatus, 'read');
  assert.equal(emailSilence.attachment?.viewed, false, 'email silence can retain an unviewed attachment');
  assert.equal(emailSilencePrompts.some((prompt) => prompt.includes('EMAIL_UNVIEWED_ATTACHMENT_MUST_NOT_LEAK')), false, 'unviewed email attachment content cannot enter a silent decision or evaluation');

  const phoneService = createPreviewAiService({ invoker: async (messages) => messages.some((message) => message.content.includes('独立评估刚刚完成的 NPC 正文'))
    ? json(emptyEvaluation)
    : json({ content: '请通过电话先说明具体事项。', invitationStatus: 'none' }) });
  const phone = await phoneService.execute('user-phone', withMeta({ action: 'phone_connect', npcId: 'P1-001', text: '请确认技术验收口径。' }, 0));
  assert.equal(phone.responseAction, undefined, 'phone retains its legacy public reply contract');
  assert.equal(phone.readStatus, undefined, 'phone does not expose asynchronous read status');
  assert.equal(phone.content, '请通过电话先说明具体事项。');
  const legacyWorkPhone = await phoneService.execute('user-phone', withMeta({ action: 'message', npcId: 'P1-001', channel: 'work_phone', text: '请确认技术验收口径。' }, phone.version, phone.previewSessionId));
  assert.equal(legacyWorkPhone.responseAction, undefined, 'work_phone message cannot enter the read_no_reply contract');
  assert.equal(legacyWorkPhone.readStatus, undefined, 'work_phone message remains a legacy synchronous reply');
  assert.equal(legacyWorkPhone.content, '请通过电话先说明具体事项。');

  const redlineReadService = createPreviewAiService({ invoker: async (messages) => messages.some((message) => message.content.includes('独立评估刚刚完成的 NPC 正文'))
    ? json(emptyEvaluation)
    : json(readNoReply('unwilling_to_advance')) });
  const forcedRedlineReply = await redlineReadService.execute('user-redline-read', withMeta({ action: 'message', npcId: 'P1-003', channel: 'wechat', text: '我们可以给现金回扣并保证中标。' }, 0));
  assert.equal(forcedRedlineReply.responseAction, 'reply', 'a compliance redline overrides a model read_no_reply decision');
  assert.equal(forcedRedlineReply.readStatus, 'read');
  assert.equal(forcedRedlineReply.invitationStatus, 'rejected');
  assert.match(forcedRedlineReply.content ?? '', /不能接受/);

  const adjusted = await service.execute('user-a', withMeta({ action: 'test_adjust_npcs', adjustments: [
    { npcId: 'P1-001', support: 35, pleasantness: 82, effectiveContactCount: 4 },
    { npcId: 'P1-005', support: 66, pleasantness: 21, effectiveContactCount: 7 },
  ] }, first.version, sessionId));
  assert.deepEqual(adjusted.npcTestStates, [
    { npcId: 'P1-001', support: 35, pleasantness: 82, effectiveContactCount: 4, node: 'N1' },
    { npcId: 'P1-005', support: 66, pleasantness: 21, effectiveContactCount: 7, node: 'N1' },
  ], 'test adjustment returns the authoritative server values and computed nodes');
  assert.equal(state.npcStates['P1-001'].support, 35);
  assert.equal(state.npcStates['P1-001'].pleasantness, 82);
  assert.equal(state.npcStates['P1-001'].effectiveContactCount, 4);
  assert.equal(prompts.length, 3, 'test adjustment does not invoke the model');

  const appointmentService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    if (prompt.includes('独立评估刚刚完成的 NPC 正文')) return json(emptyEvaluation);
    return json({ responseAction: 'reply', content: '明天可以在办公室见面。', invitationStatus: 'accepted', appointment: { timeWindow: '明天 10:00', location: '客户办公室', agenda: '确认验收口径' } });
  } });
  const appointmentCreated = await appointmentService.execute('user-appointment', withMeta({ action: 'message', npcId: 'P1-001', channel: 'email', text: '明天方便在办公室确认验收口径吗？' }, 0));
  assert(appointmentCreated.appointment, 'accepted invitation must create a server appointment');
  assert.equal(appointmentCreated.appointment.npcId, 'P1-001');
  assert.equal(appointmentCreated.appointment.phase, 1);
  const appointmentState = appointmentService.store.get('user-appointment', appointmentCreated.previewSessionId)!;
  assert.deepEqual(appointmentState.appointments['P1-001'], appointmentCreated.appointment, 'appointment is stored in the server preview session');
  const appointmentUpdated = await appointmentService.execute('user-appointment', withMeta({ action: 'test_adjust_appointments', appointments: [{
    npcId: 'P1-001', appointmentId: appointmentCreated.appointment.id, status: 'accepted', phase: 4, timeWindow: '第 4 阶段 14:00', location: '客户办公室 4 楼', agenda: '复核上线与验收计划',
  }] }, appointmentCreated.version, appointmentCreated.previewSessionId));
  assert.deepEqual(appointmentUpdated.appointments, [{ ...appointmentCreated.appointment, phase: 4, timeWindow: '第 4 阶段 14:00', location: '客户办公室 4 楼', agenda: '复核上线与验收计划' }], 'appointment test adjustment returns the authoritative server appointment');
  assert.deepEqual(appointmentState.appointments['P1-001'], appointmentUpdated.appointments[0]);
  appointmentState.approvedVisitPreparations['P1-001'] = '已准备拜访';
  const visitStarted = await appointmentService.execute('user-appointment', withMeta({ action: 'start_visit', npcId: 'P1-001' }, appointmentUpdated.version, appointmentCreated.previewSessionId));
  const farewell = await appointmentService.execute('user-appointment', withMeta({ action: 'visit_turn', npcId: 'P1-001', text: '感谢您的时间，今天先这样，改天再聊。' }, visitStarted.version, appointmentCreated.previewSessionId));
  assert.equal(farewell.meeting?.meetingEnded, true, 'farewell visit turn ends the active meeting');
  assert.deepEqual(farewell.appointment, { ...appointmentUpdated.appointments[0], status: 'completed' }, 'farewell visit turn completes the authoritative appointment');
  assert.equal(appointmentState.appointments['P1-001']?.status, 'completed');
  const appointmentVersion = appointmentState.version;
  await assert.rejects(
    appointmentService.execute('user-appointment', withMeta({ action: 'test_adjust_appointments', appointments: [{ npcId: 'P1-001', appointmentId: '00000000-0000-0000-0000-000000000001', location: '伪造地点' }] }, farewell.version, appointmentCreated.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
    'appointment IDs cannot be used across server appointments',
  );
  assert.equal(appointmentState.version, appointmentVersion, 'rejected appointment adjustment does not commit a version or state');
  const appointmentCleared = await appointmentService.execute('user-appointment', withMeta({ action: 'test_adjust_appointments', appointments: [{ npcId: 'P1-001', status: 'none' }] }, farewell.version, appointmentCreated.previewSessionId));
  assert.deepEqual(appointmentCleared.appointments, [], 'status none clears the server appointment');
  assert.equal(appointmentState.appointments['P1-001'], undefined);

  const skipService = createPreviewAiService({ invoker: async () => { throw new Error('skipping preparation must not call AI before the visit'); } });
  const skipAppointment = await skipService.execute('user-skip-preparation', withMeta({ action: 'test_adjust_appointments', appointments: [{ npcId: 'P1-002', status: 'accepted', location: '客户办公室' }] }, 0));
  await assert.rejects(
    skipService.execute('user-skip-preparation', withMeta({ action: 'start_visit', npcId: 'P1-002' }, skipAppointment.version, skipAppointment.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
    'ordinary visit start still requires approved preparation',
  );
  const skippedVisit = await skipService.execute('user-skip-preparation', withMeta({ action: 'start_visit', npcId: 'P1-002', skipPreparation: true }, skipAppointment.version, skipAppointment.previewSessionId));
  assert.equal(skippedVisit.meeting?.meetingEnded, false, 'skip preparation enters the actual visit');
  assert.equal(skipService.store.get('user-skip-preparation', skipAppointment.previewSessionId)?.approvedVisitPreparations['P1-002'], undefined, 'skipping does not create a fake preparation');

  const second = await service.execute('user-a', withMeta({ action: 'message', npcId: 'P1-002', channel: 'email', text: '这里是已经验证的改进证据。' }, adjusted.version, sessionId));
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
    return json(reply('请按正式流程沟通。'));
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

  const unresolved = await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '请继续按正式流程沟通。' }, redline.version, redline.previewSessionId));
  assert.equal(redlineState.npcStates['P1-003'].activeBlockers.includes('compliance_redline'), true, 'a generic formal-process statement cannot remove a blocker');
  assert.equal(resolvePreviewNode(redlineState.npcStates['P1-003']), 'BLOCKED');

  const negatedWithdrawal = await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '我们不会撤回现金回扣，但会走正式采购流程。' }, unresolved.version, redline.previewSessionId));
  assert.equal(redlineState.npcStates['P1-003'].activeBlockers.includes('compliance_redline'), true, 'negating a withdrawal cannot remove a blocker');

  const residualRedline = await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '我们撤回现金回扣，但仍要求保证中标，并改走正式采购流程。' }, negatedWithdrawal.version, redline.previewSessionId));
  assert.equal(redlineState.npcStates['P1-003'].activeBlockers.includes('compliance_redline'), true, 'withdrawing one redline while retaining another cannot remove a blocker');

  const thirdPartyRepair = await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '王主任已经撤回现金回扣，并会走正式采购流程。' }, residualRedline.version, redline.previewSessionId));
  assert.equal(redlineState.npcStates['P1-003'].activeBlockers.includes('compliance_redline'), true, 'a third-party withdrawal cannot remove the player blocker');

  const repaired = await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '我们撤回现金回扣提议，改走正式采购流程并提交书面澄清留痕。' }, thirdPartyRepair.version, redline.previewSessionId));
  assert.equal(redlineState.npcStates['P1-003'].activeBlockers.includes('compliance_redline'), false, 'an explicit withdrawal plus formal remedy deterministically removes the blocker');
  assert.notEqual(resolvePreviewNode(redlineState.npcStates['P1-003']), 'BLOCKED');
  const blockerMemory = redlineState.npcStates['P1-003'].workingMemory.find((entry) => entry.type === 'blocker' && entry.tags.includes('compliance_redline'));
  assert.equal(blockerMemory?.status, 'resolved', 'removing a blocker resolves its linked working-memory record');
  assert.equal(blockerMemory?.mustMention, false);
  assert.equal(blockerMemory?.sourceMessageIds.includes(redlineState.conversations['P1-003'].at(-2)!.messageId), true, 'repair memory links to the actual player message');

  redlineState.npcStates['P1-003'].support = 99;
  redlineState.npcStates['P1-003'].pleasantness = 99;
  await redlineService.execute('user-red', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '请确认合规的书面验收流程。' }, repaired.version, redline.previewSessionId));
  assert.equal(redlineState.npcStates['P1-003'].support, 100, 'support is clamped to 100');
  assert.equal(redlineState.npcStates['P1-003'].pleasantness, 100, 'pleasantness is clamped to 100');

  const failedService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    return prompt.includes('独立评估刚刚完成的 NPC 正文') ? json({ pleasureDelta: 99 }) : json(reply('请说明。'));
  } });
  const failedState = failedService.store.create('user-failure');
  await assert.rejects(
    failedService.execute('user-failure', withMeta({ action: 'message', npcId: 'P1-001', channel: 'email', text: '请确认下一步。' }, 0, failedState.previewSessionId)),
    (error: unknown) => error instanceof PreviewAiError && error.kind === 'protocol',
  );
  assert.equal(failedState.conversations['P1-001'].length, 0, 'protocol failure leaves messages unchanged');
  assert.equal(failedState.npcStates['P1-001'].support, 0, 'protocol failure leaves scoring state unchanged');

  const modelBlockerMemoryService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    if (prompt.includes('独立评估刚刚完成的 NPC 正文')) {
      return json({ ...emptyEvaluation, blockerUpdates: [{ action: 'add', value: 'compliance_redline' }], memoryUpdates: [{ type: 'blocker', summary: 'model_invented_blocker', status: 'active', tags: ['blocker', 'compliance_redline'], mustMention: true }] });
    }
    return json(reply('请按正式流程沟通。'));
  } });
  const modelBlockerMemory = await modelBlockerMemoryService.execute('user-memory', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '请说明正式验收口径。' }, 0));
  const modelBlockerMemoryState = modelBlockerMemoryService.store.get('user-memory', modelBlockerMemory.previewSessionId)!;
  assert.deepEqual(modelBlockerMemoryState.npcStates['P1-003'].activeBlockers, [], 'model output cannot activate a blocker');
  assert.equal(modelBlockerMemoryState.npcStates['P1-003'].workingMemory.some((entry) => entry.type === 'blocker'), false, 'model memory cannot forge blocker status');

  const staleMemoryPrompts: string[] = [];
  const staleMemoryService = createPreviewAiService({ invoker: async (messages) => {
    const prompt = messages.map((message) => message.content).join('\n');
    staleMemoryPrompts.push(prompt);
    return prompt.includes('独立评估刚刚完成的 NPC 正文') ? json(emptyEvaluation) : json(reply('请说明正式验收口径。'));
  } });
  const staleMemoryState = staleMemoryService.store.create('user-stale-memory');
  staleMemoryState.npcStates['P1-003'].workingMemory.push({ id: 'stale-memory', type: 'commitment', summary: 'STALE_MEMORY_MUST_NOT_REACH_PROMPT', status: 'superseded', tags: ['stale'], mustMention: true, sourceMessageIds: [] });
  staleMemoryState.npcStates['P1-003'].workingMemory.push({ id: 'resolved-memory', type: 'evidence', summary: 'RESOLVED_MEMORY_MUST_NOT_REACH_PROMPT', status: 'resolved', tags: ['resolved'], mustMention: true, sourceMessageIds: [] });
  await staleMemoryService.execute('user-stale-memory', withMeta({ action: 'message', npcId: 'P1-003', channel: 'email', text: '请说明正式验收口径。' }, 0, staleMemoryState.previewSessionId));
  assert.equal(staleMemoryPrompts.some((prompt) => /(?:STALE|RESOLVED)_MEMORY_MUST_NOT_REACH_PROMPT/.test(prompt)), false, 'superseded/resolved must-mention memory cannot enter the high-value prompt context');

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
