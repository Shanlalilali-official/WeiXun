import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameCommandSchema, useReferralGameCommandSchema } from '../src/lib/contracts/game';
import {
  canUseExternalReferralForInvitation,
  canUseExternalReferralForWechat,
  chargeExternalReferral,
  grantExternalReferral,
  hasExternalReferral,
  readExternalReferrals,
} from '../src/lib/game/external-referral';
import {
  createProjectOneState,
  executeGameCommand,
  normalizeProjectOneState,
  shouldNpcRespond,
  toPlayerVisibleGameState,
  type GameAppointment,
  type GameRuntimeState,
} from '../src/lib/game/state';
import type { GameCommand } from '../src/lib/contracts/game';

function command(state: GameRuntimeState, commandId: string, type: GameCommand['type'], payload: unknown): GameCommand {
  return gameCommandSchema.parse({ commandId, expectedVersion: state.version, type, payload });
}

function connectedState(state: GameRuntimeState, npcId: string): GameRuntimeState {
  return normalizeProjectOneState({
    ...state,
    npcContacts: {
      ...state.npcContacts,
      [npcId]: { ...state.npcContacts[npcId], status: 'connected' },
    },
  });
}

const invitation = '您好，希望围绕一线流程安排一次正式沟通，方便和您见面吗？';
const initial = createProjectOneState();
assert.deepEqual(initial.referrals, {}, 'new games start with no referral');
assert.deepEqual(readExternalReferrals(undefined), {}, 'old saves without referral data migrate to empty');
assert.equal(readExternalReferrals({
  'P1-003': { id: 'legacy-grant', targetNpcId: 'P1-003', sourceKind: 'external', status: 'granted', grantedAt: 1 },
})['P1-003']?.chargedActionPoints, 0, 'old valid grants default the AP ledger to zero');
assert.deepEqual(readExternalReferrals({ 'P1-002': { id: 'bad', targetNpcId: 'P1-002' } }), {}, 'other NPCs cannot enter the referral whitelist');
assert.equal(hasExternalReferral({}, 'P1-003'), false);
assert.throws(() => grantExternalReferral({}, 'P1-002', 'unsupported', 123), /EXTERNAL_REFERRAL_UNAVAILABLE/);
assert.throws(() => chargeExternalReferral({}, 'P1-003', 1), /EXTERNAL_REFERRAL_NOT_GRANTED/);
assert.throws(() => chargeExternalReferral({}, 'P1-002', 1), /EXTERNAL_REFERRAL_UNAVAILABLE/);
assert.throws(() => chargeExternalReferral({ 'P1-003': {
  id: 'legacy-grant', targetNpcId: 'P1-003', sourceKind: 'external', status: 'granted', grantedAt: 1,
} }, 'P1-003', -1), /EXTERNAL_REFERRAL_CHARGE_INVALID/);
assert.equal(useReferralGameCommandSchema.safeParse({
  commandId: 'wrong-target', expectedVersion: 1, type: 'use_referral', payload: { npcId: 'P1-002' },
}).success, false, 'the formal command schema only accepts Wang Defu');

const beforeGrant = {
  actionPoints: initial.actionPoints,
  timer: structuredClone(initial.projectTimer),
  support: structuredClone(initial.npcAttitudes),
  affinity: structuredClone(initial.npcAffinity),
  dimensions: structuredClone(initial.dimensions),
  clues: [...initial.unlockedClues],
  evidence: structuredClone(initial.outcomeEvidence),
};
const grantCommand = command(initial, 'referral-first', 'use_referral', { npcId: 'P1-003' });
const firstGrant = executeGameCommand(initial, grantCommand, { now: 123_456 });
const referral = firstGrant.state.referrals['P1-003'];
assert.ok(referral);
assert.equal(referral.id, 'external-referral:referral-first');
assert.equal(referral.targetNpcId, 'P1-003');
assert.equal(referral.sourceKind, 'external');
assert.equal(referral.status, 'granted');
assert.equal(referral.grantedAt, 123_456, 'grant timestamp uses trusted server wall clock');
assert.equal(referral.chargedActionPoints, 0, 'granting starts the AP ledger at zero');
assert.equal(firstGrant.state.npcContacts['P1-003'].status, 'connected');
assert.equal(firstGrant.state.npcContacts['P1-003'].hasReplied, false, 'a referral does not manufacture an NPC reply');
assert.equal(firstGrant.state.actionPoints, beforeGrant.actionPoints, 'grant costs no AP');
assert.deepEqual(firstGrant.state.projectTimer, beforeGrant.timer, 'grant consumes no game time');
assert.deepEqual(firstGrant.state.npcAttitudes, beforeGrant.support, 'grant does not change support or pleasantness');
assert.deepEqual(firstGrant.state.npcAffinity, beforeGrant.affinity);
assert.deepEqual(firstGrant.state.dimensions, beforeGrant.dimensions);
assert.deepEqual(firstGrant.state.unlockedClues, beforeGrant.clues);
assert.deepEqual(firstGrant.state.outcomeEvidence, beforeGrant.evidence);
assert.deepEqual(toPlayerVisibleGameState(firstGrant.state).referrals, firstGrant.state.referrals,
  'the player snapshot carries only the safe external referral record');

const secondGrant = executeGameCommand(
  firstGrant.state,
  command(firstGrant.state, 'referral-second-id', 'use_referral', { npcId: 'P1-003' }),
  { now: 999_999 },
);
assert.deepEqual(secondGrant.state.referrals['P1-003'], referral, 'a changed command id preserves the original referral record');
assert.equal(secondGrant.state.npcContacts['P1-003'].status, 'connected', 'repeat grant does not downgrade contact state');
assert.equal(secondGrant.state.npcContacts['P1-003'].hasReplied, false);

const legacy = normalizeProjectOneState({ ...initial, referrals: undefined });
assert.deepEqual(legacy.referrals, {}, 'persisted saves from before this feature remain readable');

assert.equal(canUseExternalReferralForInvitation({}, 'P1-003', invitation), false, 'without authorization, ordinary invites retain old rules');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', invitation), true);
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-002', invitation), false);
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '咱们下周开个技术交流会吧。'), false,
  'customer activity invitations do not enter the appointment shortcut');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '取消这次拜访邀约。'), false,
  'cancelled invitations do not get deterministic acceptance');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '我不想安排拜访。'), false,
  'negative invitations do not get deterministic acceptance');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '希望安排拜访并给您现金回扣。'), false,
  'compliance redlines do not get deterministic acceptance');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '上次拜访已经完成，纪要已发出。'), false,
  'historical references are not new appointments');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '想邀请您添加我的工作微信，方便继续交流。'), false,
  'a WeChat request is not mistaken for an appointment invitation');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '这是昨天的拜访邀请记录，供您留档。'), false,
  'a historical invitation record is not mistaken for a new request');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '不用安排拜访了，我们改用邮件沟通。'), false,
  'a withdrawn visit that switches to email is not accepted');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '王主任，明天下午可以拜访您吗？'), true,
  'a standard direct visit question is eligible');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '明天我来拜访您，可以吗？'), true,
  'a direct offer to visit is eligible');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', '本次会议邀请是公司内部通知，请您知悉。'), false,
  'an internal meeting notice is not a visit invitation');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', 'Please do not arrange a meeting.'), false,
  'English meeting negation is not accepted');
assert.equal(canUseExternalReferralForInvitation(firstGrant.state.referrals, 'P1-003', 'Please do not arrange a visit.'), false,
  'English visit cancellation is not accepted');
assert.equal(canUseExternalReferralForWechat(firstGrant.state.referrals, 'P1-003', '申请添加工作微信，方便发送流程材料。'), true);
assert.equal(canUseExternalReferralForWechat(firstGrant.state.referrals, 'P1-003', '申请加微信，给您现金回扣。'), false,
  'wechat redlines do not enter the deterministic acceptance path');

const noReferralConnected = connectedState(initial, 'P1-003');
assert.throws(() => executeGameCommand(
  noReferralConnected,
  command(noReferralConnected, 'invite-without-referral', 'invite', {
    npcId: 'P1-003', channel: 'email', rawText: invitation,
  }),
), /TWO_WAY_CONTACT_REQUIRED/, 'the grant does not change invitation requirements for an unintroduced NPC');

const noAcceptanceId = Array.from({ length: 500 }, (_, index) => `wechat-no-auto-${index}`)
  .find((id) => !shouldNpcRespond(`${id}:wechat`, 42 + Math.max(0, noReferralConnected.npcAttitudes['P1-003'].support - 35)));
assert.ok(noAcceptanceId);
const noReferralWechat = executeGameCommand(
  noReferralConnected,
  command(noReferralConnected, noAcceptanceId, 'request_wechat', { npcId: 'P1-003', message: '申请添加工作微信。' }),
);
assert.notEqual(noReferralWechat.result.status, 'accepted', 'an ungranted request retains its normal chance');

const requestWechat = command(firstGrant.state, 'wechat-first', 'request_wechat', {
  npcId: 'P1-003', message: '申请添加工作微信，方便发送流程材料。',
});
const firstWechat = executeGameCommand(firstGrant.state, requestWechat);
assert.equal(firstWechat.result.status, 'accepted', 'a referred WeChat request succeeds deterministically');
assert.equal(firstWechat.state.actionPoints, firstGrant.state.actionPoints - 1, 'the normal WeChat AP cost remains');
assert.equal(firstWechat.state.referrals['P1-003']?.chargedActionPoints, 1, 'the referral ledger records the actual WeChat AP deduction');
assert.equal(firstWechat.state.npcContacts['P1-003'].wechatStatus, 'accepted');
const secondWechat = executeGameCommand(
  firstWechat.state,
  command(firstWechat.state, 'wechat-new-command-id', 'request_wechat', {
    npcId: 'P1-003', message: '再申请一次添加工作微信。',
  }),
);
assert.equal(secondWechat.result.alreadyAdded, true, 'a new command ID reuses an existing WeChat connection successfully');
assert.equal(secondWechat.state.actionPoints, firstWechat.state.actionPoints, 'an already-added WeChat request is not charged twice');
assert.equal(secondWechat.state.referrals['P1-003']?.chargedActionPoints, 1, 'an already-added WeChat request adds no referral charge');
assert.equal(secondWechat.state.npcContacts['P1-003'].wechatStatus, 'accepted');

const hardBlockerWechat = executeGameCommand(
  firstGrant.state,
  command(firstGrant.state, 'wechat-redline', 'request_wechat', {
    npcId: 'P1-003', message: '申请添加微信并给您现金回扣。',
  }),
);
assert.equal(hardBlockerWechat.result.status, 'rejected', 'a referred hard blocker stays rejected');
assert.equal(hardBlockerWechat.state.npcContacts['P1-003'].hasReplied, false);
assert.equal(hardBlockerWechat.state.referrals['P1-003']?.chargedActionPoints, 1,
  'the ledger reflects AP actually spent on the rejected request');

const acceptedInvite = executeGameCommand(
  firstGrant.state,
  command(firstGrant.state, 'invite-first', 'invite', { npcId: 'P1-003', channel: 'email', rawText: invitation }),
);
const acceptedAppointment = acceptedInvite.result.appointment as GameAppointment;
assert.equal(acceptedAppointment.status, 'accepted', 'a valid referred visit is accepted deterministically');
assert.equal(acceptedInvite.state.actionPoints, firstGrant.state.actionPoints - 1, 'the normal email invitation AP cost remains');
assert.equal(acceptedInvite.state.referrals['P1-003']?.chargedActionPoints, 1, 'a new referred invitation records its email AP cost');
assert.equal(acceptedInvite.state.npcContacts['P1-003'].hasReplied, false,
  'the invitation does not rewrite the contact history established by the grant');
assert.throws(() => executeGameCommand(
  firstGrant.state,
  command(firstGrant.state, 'invite-activity', 'invite', { npcId: 'P1-003', channel: 'email', rawText: '咱们下周开个技术交流会吧。' }),
), /EXTERNAL_REFERRAL_INVITATION_NOT_ELIGIBLE/);
assert.throws(() => executeGameCommand(
  firstGrant.state,
  command(firstGrant.state, 'invite-redline', 'invite', { npcId: 'P1-003', channel: 'email', rawText: '希望安排拜访并给您现金回扣。' }),
), /EXTERNAL_REFERRAL_INVITATION_NOT_ELIGIBLE/);

const reusedInvite = executeGameCommand(
  acceptedInvite.state,
  command(acceptedInvite.state, 'invite-new-id', 'invite', {
    npcId: 'P1-003', channel: 'email', rawText: '我想再安排一次正式拜访，方便吗？',
  }),
);
assert.equal(reusedInvite.eventType, 'appointment.reused');
assert.equal(reusedInvite.result.reused, true);
assert.equal((reusedInvite.result.appointment as GameAppointment).id, acceptedAppointment.id);
assert.equal(reusedInvite.state.appointments.length, acceptedInvite.state.appointments.length);
assert.equal(reusedInvite.state.actionPoints, acceptedInvite.state.actionPoints, 'an accepted appointment is reused without a second charge');
assert.equal(reusedInvite.state.referrals['P1-003']?.chargedActionPoints, 1, 'reusing an appointment adds no referral charge');

const activePhoneState = {
  ...firstGrant.state,
  activePhoneCall: { npcId: 'P1-003', startedRound: firstGrant.state.currentRound, startedAt: new Date(0).toISOString() },
};
const activePhoneInvite = executeGameCommand(
  activePhoneState,
  command(activePhoneState, 'invite-during-call', 'invite', {
    npcId: 'P1-003', channel: 'work_phone', rawText: invitation,
  }),
);
assert.equal((activePhoneInvite.result.appointment as GameAppointment).status, 'accepted');
assert.equal(activePhoneInvite.state.actionPoints, activePhoneState.actionPoints, 'an invite inside an active phone call retains its zero base AP cost');
assert.equal(activePhoneInvite.state.referrals['P1-003']?.chargedActionPoints, 0, 'zero-cost active phone invites add no referral charge');

const chatRoute = readFileSync(new URL('../src/app/api/chat/stream/route.ts', import.meta.url), 'utf8');
assert.match(chatRoute, /externalReferralInvitation[\s\S]*?decideChatAttachments/,
  'formal chat evaluates referral eligibility before its attachment decision');
assert.match(chatRoute, /externalReferralInvitation\s*\?\s*\{ responseAction: 'reply' as const \}/,
  'formal chat bypasses the message-response model for eligible referred invites');
assert.match(chatRoute, /!hasExternalReferral\(initialState\.referrals, npcId\) \|\| externalReferralInvitation/,
  'a granted referral only shortcuts actual eligible visit invitations; other text stays on normal chat');
assert.match(chatRoute, /hasExternalReferral\(initialState\.referrals, npcId\)[\s\S]*?未在系统中的外部工作关系引荐/,
  'later Wang Defu conversations receive a safe referral fact without an introducer identity');
assert.match(chatRoute, /chargeExternalReferral\(stateWithAttachmentCost\.referrals, npcId, attachmentActionPoints\)/,
  'attachment AP is added to the referral ledger in the same chat transaction');

console.log('formal external referral state and chat contracts passed');
