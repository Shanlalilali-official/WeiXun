import assert from 'node:assert/strict';
import {
  createPreviewAiService,
  createPreviewServerState,
  fromPersistedPreviewServerState,
  toPersistedPreviewServerState,
  toPreviewRecoveryDto,
  type PreviewSessionPersistence,
} from '../src/lib/game/project-one-preview-ai';
import { previewAiRequestSchema, type PreviewAiRequest, type PreviewAiResponse } from '../src/lib/contracts/project-one-preview-ai';
import {
  canUseExternalReferralForInvitation,
  canUseExternalReferralForWechat,
  grantExternalReferral,
  readExternalReferrals,
} from '../src/lib/game/external-referral';
import { resolveInvitationPayload } from '../src/lib/game/state';
import type { JevInvoker } from '../src/lib/ai/jev-client';

let commandSequence = 0;
function commandId(): string {
  commandSequence += 1;
  return `external-referral-command-${commandSequence}`.padEnd(24, 'x');
}
function request<T extends object>(action: T, version: number, previewSessionId?: string) {
  return { ...action, commandId: commandId(), expectedVersion: version, ...(previewSessionId ? { previewSessionId } : {}) };
}

const granted = grantExternalReferral({}, 'P1-003', 'referral-test-command', 123);
assert.deepEqual(readExternalReferrals(granted), granted);
assert.equal(grantExternalReferral(granted, 'P1-003', 'different-command', 456)['P1-003']?.id, granted['P1-003']?.id,
  'a repeated grant preserves the original external referral record');
assert.equal(previewAiRequestSchema.safeParse(request({ action: 'use_referral', npcId: 'P1-003' }, 0)).success, true);
assert.equal(previewAiRequestSchema.safeParse(request({ action: 'use_referral', npcId: 'P1-002' }, 0)).success, false,
  'the request contract only grants the referral to Wang Defu');
assert.equal(canUseExternalReferralForInvitation(granted, 'P1-003', '我想预约拜访您，聊聊项目推进，可以吗？'), true);
assert.equal(canUseExternalReferralForInvitation(granted, 'P1-003', '我想拜访您，后来取消了这次邀约。'), false,
  'a withdrawn invitation cannot be converted into an accepted visit');
assert.equal(canUseExternalReferralForInvitation(granted, 'P1-003', '上次拜访之后我补了材料。'), false,
  'a historical mention is not a new visit invitation');
assert.equal(canUseExternalReferralForInvitation(granted, 'P1-003', '希望安排一次技术交流会。'), false,
  'a customer activity proposal is not an ordinary visit invitation');
assert.equal(canUseExternalReferralForInvitation(granted, 'P1-002', '我想预约拜访您，可以吗？'), false,
  'the referral does not authorize a different NPC');
assert.equal(canUseExternalReferralForInvitation({}, 'P1-003', '我想预约拜访您，可以吗？'), false,
  'an ordinary visit without a referral does not receive deterministic acceptance');
assert.equal(canUseExternalReferralForInvitation(granted, 'P1-003', '我想拜访您，同时请保证中标。'), false,
  'a redline is excluded by the same shared eligibility rule');
assert.equal(canUseExternalReferralForWechat(granted, 'P1-003', '希望添加您的工作微信。'), true);
assert.equal(canUseExternalReferralForWechat(granted, 'P1-002', '希望添加您的工作微信。'), false);

const legacyState = createPreviewServerState('legacy-preview', 'preview-session-legacy-referral-test');
const oldSave = structuredClone(toPersistedPreviewServerState(legacyState)) as Record<string, unknown>;
delete oldSave.referrals;
assert.deepEqual(fromPersistedPreviewServerState(oldSave, legacyState.userId, legacyState.previewSessionId, 4).referrals, {},
  'legacy saves without referral state recover with an empty map');

async function main() {
let modelCalls = 0;
const rejectingInvoker = async () => {
  modelCalls += 1;
  throw new Error('external referral deterministic flow must not require the LLM');
};
const rejectingJev: JevInvoker = async () => {
  modelCalls += 1;
  throw new Error('external referral deterministic flow must not require Jev');
};
const service = createPreviewAiService({ invoker: rejectingInvoker, jevInvoker: rejectingJev });
let result = await service.execute('referral-preview-user', request({ action: 'use_referral', npcId: 'P1-003' }, 0));
const previewSessionId = result.previewSessionId;
assert.deepEqual(result.referrals, { 'P1-003': result.referrals?.['P1-003'] });
assert.equal(typeof result.referrals?.['P1-003']?.id, 'string');
const state = service.store.get('referral-preview-user', previewSessionId)!;
const relationshipBefore = structuredClone(state.npcStates['P1-003']);
assert.deepEqual(toPreviewRecoveryDto(state).referrals, result.referrals, 'recovery exposes the sanitized referral state');

result = await service.execute('referral-preview-user', request({
  action: 'wechat_request', npcId: 'P1-003', text: '希望添加您的工作微信，后续沟通项目推进。',
}, result.version, previewSessionId));
assert.equal(result.wechatAccepted, true, 'a granted referral makes the first WeChat request deterministic');
assert.equal(result.alreadyAdded, undefined);
assert.equal(state.wechat['P1-003'], 'accepted');
assert.equal(result.referrals?.['P1-003']?.chargedActionPoints, 1, 'the first referred WeChat request records one server-side AP charge');
assert.equal(state.npcStates['P1-003'].support, relationshipBefore.support, 'referral contact does not raise support');
assert.equal(state.npcStates['P1-003'].pleasantness, relationshipBefore.pleasantness, 'referral contact does not raise pleasantness');
assert.equal(state.npcStates['P1-003'].effectiveContactCount, relationshipBefore.effectiveContactCount, 'referral contact does not count as a scored contact');
assert.deepEqual(state.npcStates['P1-003'].dimensionScores, relationshipBefore.dimensionScores, 'referral contact does not change relationship dimensions');

result = await service.execute('referral-preview-user', request({
  action: 'wechat_request', npcId: 'P1-003', text: '再次申请添加您的工作微信，便于项目沟通。',
}, result.version, previewSessionId));
assert.equal(result.wechatAccepted, true);
assert.equal(result.alreadyAdded, true, 'a duplicate WeChat request is identified for the client no-charge path');

result = await service.execute('referral-preview-user', request({
  action: 'message', npcId: 'P1-003', channel: 'wechat', text: '王主任，能否安排到贵单位拜访？下午3点，在客户会议室见面沟通采购流程。',
}, result.version, previewSessionId));
assert.equal(result.invitationStatus, 'accepted', 'a direct ordinary visit request after referral has a deterministic accepted result');
assert.equal(result.responseAction, 'reply');
assert.equal(result.appointment?.status, 'accepted');
const resolvedInvitation = resolveInvitationPayload({ currentRound: 1 }, {
  npcId: 'P1-003', channel: 'wechat', rawText: '王主任，能否安排到贵单位拜访？下午3点，在客户会议室见面沟通采购流程。',
  attachmentIds: [], emailAttachments: [],
});
assert.equal(result.appointment?.timeWindow, '15:00', 'appointment time follows the formal shared resolver without exposing the old stage alias');
assert.equal(result.appointment?.location, resolvedInvitation.venue);
assert.equal(result.appointment?.agenda, resolvedInvitation.purpose);
assert.match(result.content ?? '', /下午3点/);
assert.equal(result.referrals?.['P1-003']?.chargedActionPoints, 2, 'a new written referred visit records one additional AP charge');
const firstAppointmentId = result.appointment?.id;
const metricsAfterInvitation = structuredClone(state.npcStates['P1-003']);

result = await service.execute('referral-preview-user', request({
  action: 'message', npcId: 'P1-003', channel: 'wechat', text: '我想再约您拜访，能否确认安排？',
}, result.version, previewSessionId));
assert.equal(result.invitationStatus, 'accepted');
assert.equal(result.appointmentReused, true, 'an existing accepted visit is reused instead of duplicated');
assert.equal(result.appointment?.id, firstAppointmentId);
assert.match(result.content ?? '', /此前确认的拜访安排仍然有效/);
assert.equal(result.referrals?.['P1-003']?.chargedActionPoints, 2, 'a duplicate invitation reuses the appointment without another charge');
assert.equal(state.npcStates['P1-003'].support, metricsAfterInvitation.support, 'accepted visit invitation does not run scoring');
assert.deepEqual(state.npcStates['P1-003'].dimensionScores, metricsAfterInvitation.dimensionScores);
assert.equal(modelCalls, 0, 'grant, WeChat, and ordinary visit invitation do not call either model');

result = await service.execute('referral-preview-user', request({ action: 'reset' }, result.version, previewSessionId));
assert.deepEqual(result.referrals, {}, 'reset clears the referral grant');
assert.deepEqual(state.referrals, {});

// The production route uses executePersistent. This adapter round-trips JSON
// after each commit so this test covers persistence and recovery as well.
class JsonRoundTripPersistence implements PreviewSessionPersistence {
  readonly previewSessionId = 'preview-session-external-referral-persist';
  version = 0;
  private persisted: unknown = JSON.parse(JSON.stringify(toPersistedPreviewServerState(
    createPreviewServerState('persistent-referral-user', this.previewSessionId),
  )));
  private responses = new Map<string, PreviewAiResponse>();

  async acquire(userId: string, command: PreviewAiRequest): Promise<{
    previewSessionId: string; version: number; state: ReturnType<typeof createPreviewServerState>; leaseToken: string;
  } | { replay: PreviewAiResponse }> {
    const replay = this.responses.get(command.commandId);
    if (replay) return { replay: structuredClone(replay) };
    assert.equal(command.expectedVersion, this.version, 'persistent commands preserve compare-and-swap version checks');
    const restored = fromPersistedPreviewServerState(this.persisted, userId, this.previewSessionId, this.version);
    return { previewSessionId: this.previewSessionId, version: this.version, state: restored, leaseToken: `lease-${command.commandId}` };
  }
  async renew(): Promise<void> {}
  async commit(args: Parameters<PreviewSessionPersistence['commit']>[0]): Promise<PreviewAiResponse> {
    assert.equal(args.expectedVersion, this.version);
    this.version = args.expectedVersion + 1;
    this.persisted = JSON.parse(JSON.stringify(toPersistedPreviewServerState(args.state)));
    this.responses.set(args.commandId, structuredClone(args.response));
    return args.response;
  }
  async abandon(): Promise<void> {}
  restore(userId: string) {
    return fromPersistedPreviewServerState(this.persisted, userId, this.previewSessionId, this.version);
  }
}

const persistence = new JsonRoundTripPersistence();
const persistentService = createPreviewAiService({ invoker: rejectingInvoker, jevInvoker: rejectingJev });
let persistedResult = await persistentService.executePersistent('persistent-referral-user', request({
  action: 'use_referral', npcId: 'P1-003',
}, 0), persistence);
assert.ok(persistedResult.referrals?.['P1-003']);
assert.ok(persistence.restore('persistent-referral-user').referrals['P1-003'], 'the grant survives a JSON save and restore');

persistedResult = await persistentService.executePersistent('persistent-referral-user', request({
  action: 'wechat_request', npcId: 'P1-003', text: '希望添加您的工作微信，后续沟通项目推进。',
}, persistedResult.version, persistedResult.previewSessionId), persistence);
assert.equal(persistedResult.wechatAccepted, true);
persistedResult = await persistentService.executePersistent('persistent-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'wechat', text: '我想预约拜访您，沟通项目推进，可以吗？',
}, persistedResult.version, persistedResult.previewSessionId), persistence);
assert.equal(persistedResult.invitationStatus, 'accepted');
assert.ok(persistence.restore('persistent-referral-user').appointments['P1-003']);
assert.equal(modelCalls, 0, 'persistent referral actions also work without either AI provider');

const restoredState = persistence.restore('persistent-referral-user');
assert.ok(toPreviewRecoveryDto(restoredState).referrals?.['P1-003'], 'recovery DTO returns persisted referral state');
const resetPersistent = await persistentService.executePersistent('persistent-referral-user', request({
  action: 'reset',
}, persistedResult.version, persistedResult.previewSessionId), persistence);
assert.deepEqual(resetPersistent.referrals, {});
assert.deepEqual(persistence.restore('persistent-referral-user').referrals, {});

// Missing authorization, redline, and activity proposal cannot be
// turned into a successful visit just because the referral exists.
const unauthorizedService = createPreviewAiService({ invoker: rejectingInvoker, jevInvoker: rejectingJev });
const unauthorizedState = unauthorizedService.store.create('unauthorized-referral-user');
await assert.rejects(unauthorizedService.execute('unauthorized-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'wechat', text: '我想预约拜访您，聊聊项目推进，可以吗？',
}, 0, unauthorizedState.previewSessionId)));
assert.equal(unauthorizedService.store.get('unauthorized-referral-user', unauthorizedState.previewSessionId)?.appointments['P1-003'], undefined,
  'a player without a referral does not get a deterministic accepted appointment');
assert.deepEqual(unauthorizedService.store.get('unauthorized-referral-user', unauthorizedState.previewSessionId)?.referrals, {});

const gatedService = createPreviewAiService({ invoker: rejectingInvoker, jevInvoker: rejectingJev });
const gated = await gatedService.execute('gated-referral-user', request({ action: 'use_referral', npcId: 'P1-003' }, 0));
const gatedSessionId = gated.previewSessionId;
const versionBeforeRejectedMessages = gated.version;
await assert.rejects(gatedService.execute('gated-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'wechat', text: '我想预约拜访您，同时请保证中标。',
}, gated.version, gatedSessionId)));
assert.equal(gatedService.store.get('gated-referral-user', gatedSessionId)?.version, versionBeforeRejectedMessages,
  'a redline stays on the normal evaluated path instead of using deterministic referral acceptance');
assert.equal(gatedService.store.get('gated-referral-user', gatedSessionId)?.appointments['P1-003'], undefined,
  'a redline message never commits the deterministic visit appointment');
const versionBeforeActivityProposal = versionBeforeRejectedMessages;
await assert.rejects(gatedService.execute('gated-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'wechat', text: '希望安排一次技术交流会。',
}, versionBeforeActivityProposal, gatedSessionId)));
assert.equal(gatedService.store.get('gated-referral-user', gatedSessionId)?.version, versionBeforeActivityProposal,
  'an activity proposal does not commit through the deterministic invitation path');
assert.equal(gatedService.store.get('gated-referral-user', gatedSessionId)?.appointments['P1-003'], undefined);

// A malicious legacy Jev/LLM pair must not turn a cancellation, a WeChat
// message before WeChat is actually added, or a disconnected phone message
// into a persisted accepted appointment merely because the referral exists.
let adversarialModelCalls = 0;
const adversarialInvoker = async (messages: Array<{ content: string }>) => {
  adversarialModelCalls += 1;
  const system = messages[0]?.content ?? '';
  if (system.includes('独立评估刚刚完成')) return JSON.stringify({ memorySuggestions: [] });
  return JSON.stringify({
    content: '我会按合规流程核对本次安排。',
    appointment: { timeWindow: '明日下午3点', location: '客户会议室', agenda: '项目推进' },
  });
};
const adversarialJev: JevInvoker = async (input) => {
  if (typeof input.state === 'string' && input.state.includes('project_one_preview_message')) {
    return { answers: {
      responseAction: { type: 'choice', choice: 'reply', probabilities: {}, confidence: 1 },
      invitationStatus: { type: 'choice', choice: 'accepted', probabilities: {}, confidence: 1 },
    } };
  }
  return { answers: {} as Record<string, never> };
};
const adversarialService = createPreviewAiService({ invoker: adversarialInvoker, jevInvoker: adversarialJev });
let adversarial = await adversarialService.execute('adversarial-referral-user', request({ action: 'use_referral', npcId: 'P1-003' }, 0));
const adversarialSessionId = adversarial.previewSessionId;
adversarial = await adversarialService.execute('adversarial-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'email', text: '我想取消原来的拜访邀约。',
}, adversarial.version, adversarialSessionId));
assert.equal(adversarial.invitationStatus, 'none', 'a cancellation cannot be upgraded to accepted by a malicious Jev answer');
assert.equal(adversarial.appointment, undefined, 'a cancellation cannot persist an LLM appointment draft');
assert.equal(adversarialService.store.get('adversarial-referral-user', adversarialSessionId)?.appointments['P1-003'], undefined);
adversarial = await adversarialService.execute('adversarial-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'wechat', text: '请安排一次拜访，沟通项目推进。',
}, adversarial.version, adversarialSessionId));
assert.equal(adversarial.invitationStatus, 'none', 'a referral alone cannot bypass the authoritative WeChat-added state');
assert.equal(adversarialService.store.get('adversarial-referral-user', adversarialSessionId)?.appointments['P1-003'], undefined);
adversarial = await adversarialService.execute('adversarial-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'work_phone', text: '请安排一次拜访，沟通项目推进。',
}, adversarial.version, adversarialSessionId));
assert.equal(adversarial.invitationStatus, 'none', 'a referral alone cannot fabricate an active work-phone connection');
assert.equal(adversarialService.store.get('adversarial-referral-user', adversarialSessionId)?.appointments['P1-003'], undefined);
assert.ok(adversarialModelCalls > 0, 'the guard is verified against an actually malicious Jev+LLM response, not provider failure');

let reuseModelCalls = 0;
const reuseService = createPreviewAiService({
  invoker: async () => { reuseModelCalls += 1; return JSON.stringify({ content: '不应调用模型。' }); },
  jevInvoker: async () => { reuseModelCalls += 1; return { answers: {} }; },
});
let reusable = await reuseService.execute('reuse-only-referral-user', request({ action: 'use_referral', npcId: 'P1-003' }, 0));
const reusableSessionId = reusable.previewSessionId;
await assert.rejects(reuseService.execute('reuse-only-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'email', text: '请复用此前拜访安排。', reuseOnly: true,
}, reusable.version, reusableSessionId)), /APPOINTMENT_REUSE_UNAVAILABLE/);
assert.equal(reuseModelCalls, 0, 'an unavailable reuseOnly request is rejected before any model call or commit');
reusable = await reuseService.execute('reuse-only-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'email', text: '请安排一次拜访，沟通项目推进。', attachment: { title: '议程附件', content: '项目推进议题' },
}, reusable.version, reusableSessionId));
assert.equal(reusable.referrals?.['P1-003']?.chargedActionPoints, 2, 'a new written appointment with an attachment records 1+1 AP');
const reusableAppointmentId = reusable.appointment?.id;
reusable = await reuseService.execute('reuse-only-referral-user', request({
  action: 'message', npcId: 'P1-003', channel: 'email', text: '请安排一次拜访，沟通项目推进。', reuseOnly: true,
}, reusable.version, reusableSessionId));
assert.equal(reusable.appointmentReused, true);
assert.equal(reusable.appointment?.id, reusableAppointmentId, 'reuseOnly returns the already accepted appointment');
assert.equal(reusable.referrals?.['P1-003']?.chargedActionPoints, 2, 'reuseOnly never adds a charge');
assert.equal(reuseModelCalls, 0, 'a valid reuseOnly request remains deterministic');

console.log('Preview external referral checks passed.');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
