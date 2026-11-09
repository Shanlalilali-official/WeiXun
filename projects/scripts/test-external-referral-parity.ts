import assert from 'node:assert/strict';
import {
  previewAiRequestSchema,
  type PreviewAiRequest,
} from '../src/lib/contracts/project-one-preview-ai';
import { gameCommandSchema, type GameCommand } from '../src/lib/contracts/game';
import {
  createProjectOneState,
  executeGameCommand,
  normalizeProjectOneState,
  resolveInvitationPayload,
  type GameRuntimeState,
} from '../src/lib/game/state';
import {
  createPreviewAiService,
  fromPersistedPreviewServerState,
  toPreviewRecoveryDto,
  toPersistedPreviewServerState,
} from '../src/lib/game/project-one-preview-ai';
import {
  canUseExternalReferralForInvitation,
  canUseExternalReferralForWechat,
  hasExternalReferral,
  readExternalReferrals,
} from '../src/lib/game/external-referral';

const invitationText = '王主任，能否安排到贵单位拜访？下午3点，在客户会议室见面沟通采购流程。';

function formalCommand<T extends GameCommand['type']>(
  state: GameRuntimeState,
  type: T,
  payload: Record<string, unknown>,
  commandId: string,
): Extract<GameCommand, { type: T }> {
  const command = gameCommandSchema.parse({ commandId, expectedVersion: state.version, type, payload });
  if (command.type !== type) throw new Error('FORMAL_COMMAND_TYPE_MISMATCH');
  return command as Extract<GameCommand, { type: T }>;
}

function runFormal(state: GameRuntimeState, type: GameCommand['type'], payload: Record<string, unknown>, id: string) {
  return executeGameCommand(state, formalCommand(state, type, payload, id));
}

function previewRequest(
  action: string,
  previewSessionId: string | undefined,
  commandId: string,
  expectedVersion: number,
  extra: Record<string, unknown> = {},
) {
  return previewAiRequestSchema.parse({ action, ...(previewSessionId ? { previewSessionId } : {}), commandId, expectedVersion, ...extra }) as PreviewAiRequest;
}

async function main() {
  const formalInitial = createProjectOneState();
  const legacyFormal = normalizeProjectOneState({
    ...formalInitial,
    referrals: undefined,
  } as unknown as GameRuntimeState);
  assert.deepEqual(legacyFormal.referrals, {}, 'old formal saves default to no referral');
  assert.equal(readExternalReferrals({ 'P1-003': {
    id: 'external-referral:legacy', targetNpcId: 'P1-003', sourceKind: 'external', status: 'granted', grantedAt: 1,
  } })['P1-003']?.chargedActionPoints, 0, 'legacy referral records default their charge total to zero');

  const wrongFormalReferral = gameCommandSchema.safeParse({
    commandId: 'formal-referral-wrong-target',
    expectedVersion: formalInitial.version,
    type: 'use_referral',
    payload: { npcId: 'P1-001' },
  });
  if (wrongFormalReferral.success) {
    assert.throws(() => executeGameCommand(formalInitial, wrongFormalReferral.data as GameCommand), /EXTERNAL_REFERRAL_UNAVAILABLE/);
  } else {
    assert.equal(wrongFormalReferral.success, false, 'formal contract rejects referral payloads for another NPC');
  }
  assert.equal(formalInitial.npcContacts['P1-003'].status, 'known', 'a referral does not fabricate a prior NPC conversation');
  assert.throws(() => runFormal(formalInitial, 'request_wechat', { npcId: 'P1-003', message: '为了沟通采购流程申请添加工作微信' }, 'formal-referral-wechat-before'), /NPC_NOT_CONNECTED/);

  const formalSupportBefore = formalInitial.npcAttitudes['P1-003'].support;
  const formalPleasantnessBefore = formalInitial.npcAttitudes['P1-003'].pleasantness;
  assert.equal(canUseExternalReferralForInvitation(formalInitial.referrals, 'P1-003', invitationText), false, 'an ungranted referral does not unlock deterministic visit acceptance');
  const formalReferralCommand = formalCommand(formalInitial, 'use_referral', { npcId: 'P1-003' }, 'formal-external-referral-grant');
  const formalGrant = executeGameCommand(formalInitial, formalReferralCommand);
  const formalReferred = formalGrant.state;
  const formalReferral = formalReferred.referrals['P1-003'];
  assert.ok(formalReferral, 'formal grant stores an authoritative referral');
  assert.equal(formalReferral.sourceKind, 'external');
  assert.equal('introducerId' in formalReferral, false, 'the out-of-game introducer is not a system person');
  assert.deepEqual(Object.keys(formalReferral).sort(), ['chargedActionPoints', 'grantedAt', 'id', 'sourceKind', 'status', 'targetNpcId'].sort());
  assert.equal(formalReferral.chargedActionPoints, 0, 'new formal referrals start with no recorded AP charge');
  assert.equal(formalReferred.actionPoints, formalInitial.actionPoints, 'granting has no extra AP cost');
  assert.equal(formalReferred.npcAttitudes['P1-003'].support, formalSupportBefore, 'granting does not increase support');
  assert.equal(formalReferred.npcAttitudes['P1-003'].pleasantness, formalPleasantnessBefore, 'granting does not increase pleasantness');
  assert.equal(formalReferred.unlockedClues.length, formalInitial.unlockedClues.length, 'granting does not unlock clues');
  assert.equal(canUseExternalReferralForInvitation(formalReferred.referrals, 'P1-003', invitationText), true, 'the shared eligibility check recognizes the normal visit invite');
  assert.equal(canUseExternalReferralForWechat(formalReferred.referrals, 'P1-003', '通过工作引荐申请添加工作微信'), true);
  for (const excludedText of [
    '王主任，请取消安排这次拜访。',
    '王主任，上次拜访后我们讨论过采购流程。',
    '王主任，能否安排一次技术交流会？',
    '王主任，能否安排拜访并考虑回扣？',
  ]) {
    assert.equal(canUseExternalReferralForInvitation(formalReferred.referrals, 'P1-003', excludedText), false, `excluded text must not use deterministic referral acceptance: ${excludedText}`);
  }
  assert.equal(canUseExternalReferralForWechat(formalReferred.referrals, 'P1-003', '通过回扣申请添加工作微信'), false, 'referral does not override compliance redlines');

  const normalizedFormalReferral = normalizeProjectOneState(
    JSON.parse(JSON.stringify(formalReferred)) as GameRuntimeState,
  );
  assert.deepEqual(normalizedFormalReferral.referrals, formalReferred.referrals, 'formal referral survives normalization and JSON round-trip');

  const formalRepeatGrant = runFormal(formalReferred, 'use_referral', { npcId: 'P1-003' }, 'formal-external-referral-grant-again');
  assert.deepEqual(formalRepeatGrant.state.referrals, formalReferred.referrals, 'a second command does not replace or multiply the grant');
  const formalDuplicateGrant = executeGameCommand(formalReferred, formalReferralCommand);
  assert.equal(formalDuplicateGrant.result.duplicate, true, 'command retries are idempotent');

  const formalWechatCommand = formalCommand(
    formalReferred,
    'request_wechat',
    { npcId: 'P1-003', message: '通过工作引荐认识您，申请添加工作微信以沟通项目流程' },
    'formal-external-referral-wechat',
  );
  const formalWechat = executeGameCommand(formalReferred, formalWechatCommand);
  assert.equal(formalWechat.state.npcContacts['P1-003'].wechatStatus, 'accepted', 'referral guarantees the Wang Defu WeChat request');
  assert.equal(formalWechat.state.actionPoints, formalReferred.actionPoints - 1, 'the original WeChat AP cost remains');
  assert.equal(formalWechat.state.referrals['P1-003']?.chargedActionPoints, 1, 'formal referral records the WeChat AP charge');
  assert.equal(formalWechat.state.npcAttitudes['P1-003'].support, formalSupportBefore, 'adding WeChat does not grant hidden relationship points');
  const formalWechatRetry = executeGameCommand(formalWechat.state, formalWechatCommand);
  assert.equal(formalWechatRetry.result.duplicate, true, 'retrying the same WeChat command is free');
  assert.equal(formalWechatRetry.state.actionPoints, formalWechat.state.actionPoints, 'a replay does not spend AP twice');
  const formalAlreadyAdded = runFormal(
    formalWechat.state,
    'request_wechat',
    { npcId: 'P1-003', message: '通过工作引荐认识您，申请添加工作微信以沟通项目流程' },
    'formal-external-referral-wechat-repeat',
  );
  assert.equal(formalAlreadyAdded.result.alreadyAdded, true, 'a new request after acceptance does not re-run WeChat scoring');
  assert.equal(formalAlreadyAdded.state.actionPoints, formalWechat.state.actionPoints, 'already-added WeChat does not spend AP again');
  assert.equal(formalAlreadyAdded.state.npcAttitudes['P1-003'].support, formalSupportBefore, 'already-added WeChat adds no relationship points');
  assert.equal(formalAlreadyAdded.state.referrals['P1-003']?.chargedActionPoints, formalWechat.state.referrals['P1-003']?.chargedActionPoints, 'already-added WeChat does not increment the referral charge');

  const formalInviteCommand = formalCommand(
    formalWechat.state,
    'invite',
    { npcId: 'P1-003', channel: 'wechat', rawText: invitationText, attachmentIds: [], emailAttachments: [] },
    'formal-external-referral-invite',
  );
  const formalInvite = executeGameCommand(formalWechat.state, formalInviteCommand);
  const formalAppointment = formalInvite.result.appointment as {
    status?: string;
    npcId?: string;
    id?: string;
    startMinute?: number;
    venue?: string;
    purpose?: string;
  };
  assert.equal(formalAppointment.npcId, 'P1-003');
  assert.equal(formalAppointment.status, 'accepted', 'a valid Wang Defu invitation succeeds after referral');
  const formalResolvedInvite = resolveInvitationPayload(formalWechat.state, formalInviteCommand.payload);
  assert.equal(formalAppointment.startMinute, formalResolvedInvite.startMinute);
  assert.equal(formalAppointment.venue, formalResolvedInvite.venue);
  assert.equal(formalAppointment.purpose, formalResolvedInvite.purpose);
  assert.equal(formalInvite.state.actionPoints, formalWechat.state.actionPoints - 1, 'the original invitation channel cost remains');
  assert.equal(formalInvite.state.referrals['P1-003']?.chargedActionPoints, 2, 'formal referral records WeChat plus first written invitation AP');
  const formalInviteRepeat = runFormal(
    formalInvite.state,
    'invite',
    { npcId: 'P1-003', channel: 'wechat', rawText: invitationText, attachmentIds: [], emailAttachments: [] },
    'formal-external-referral-invite-repeat',
  );
  assert.equal(formalInviteRepeat.state.appointments.length, formalInvite.state.appointments.length, 'a new command for the same active referral invite reuses one appointment');
  assert.equal(
    (formalInviteRepeat.result.appointment as { id?: string }).id,
    formalAppointment.id,
    'the repeated invite returns its existing appointment',
  );
  assert.equal(formalInviteRepeat.state.actionPoints, formalInvite.state.actionPoints, 'reusing the same accepted invitation does not spend AP again');
  assert.equal(formalInviteRepeat.state.referrals['P1-003']?.chargedActionPoints, 2, 'reusing an accepted invitation does not increment the referral charge');
  const formalZeroApReuse = runFormal(
    { ...formalInvite.state, actionPoints: 0 },
    'invite',
    { npcId: 'P1-003', channel: 'wechat', rawText: invitationText, attachmentIds: [], emailAttachments: [] },
    'formal-external-referral-invite-zero-ap-reuse',
  );
  assert.equal(formalZeroApReuse.result.reused, true, 'formal referral reuses the accepted appointment when the player has zero AP');
  assert.equal(formalZeroApReuse.state.actionPoints, 0);
  assert.equal(formalZeroApReuse.state.referrals['P1-003']?.chargedActionPoints, 2);
  const formalInviteRetry = executeGameCommand(formalInvite.state, formalInviteCommand);
  assert.equal(formalInviteRetry.result.duplicate, true, 'retrying the same invitation is idempotent');
  assert.equal(formalInviteRetry.state.appointments.length, formalInvite.state.appointments.length, 'a replay does not add an appointment');

  let modelCalls = 0;
  const rejectModel = async () => {
    modelCalls += 1;
    throw new Error('MODEL_SHOULD_NOT_BE_REQUIRED_FOR_GRANTED_REFERRAL');
  };
  const previewService = createPreviewAiService({
    invoker: rejectModel as never,
    jevInvoker: rejectModel as never,
  });
  const previewUser = 'external-referral-parity-user';
  const grantPreview = await previewService.execute(previewUser, previewRequest(
    'use_referral', undefined, 'preview-referral-grant-command-0001', 0, { npcId: 'P1-003' },
  ));
  const previewSessionId = grantPreview.previewSessionId;
  assert.ok(previewSessionId);
  const previewReferral = grantPreview.referrals?.['P1-003'];
  assert.ok(previewReferral, 'preview grant returns the same authoritative referral shape');
  assert.deepEqual(Object.keys(previewReferral).sort(), ['chargedActionPoints', 'grantedAt', 'id', 'sourceKind', 'status', 'targetNpcId'].sort());
  assert.equal(previewReferral.chargedActionPoints, 0, 'preview referrals start with no recorded AP charge');
  assert.equal(previewReferral.targetNpcId, formalReferral.targetNpcId);
  assert.equal(previewReferral.sourceKind, formalReferral.sourceKind);
  assert.equal(previewReferral.status, formalReferral.status);
  assert.equal(modelCalls, 0, 'creating the referral does not call an AI model');
  assert.equal(previewReferral && ('introducerId' in previewReferral), false, 'preview does not invent an introducer NPC');
  assert.equal(hasExternalReferral(grantPreview.referrals, 'P1-001'), false, 'the shared grant does not authorize another NPC');
  assert.equal(previewAiRequestSchema.safeParse({
    action: 'use_referral', commandId: 'preview-wrong-target-command-001', expectedVersion: grantPreview.version,
    previewSessionId, npcId: 'P1-001',
  }).success, false, 'preview contract only offers referral to Wang Defu');

  const stateAfterGrant = previewService.store.get(previewUser, previewSessionId);
  assert.ok(stateAfterGrant);
  const previewSupportBefore = stateAfterGrant.npcStates['P1-003'].support;
  const previewPleasantnessBefore = stateAfterGrant.npcStates['P1-003'].pleasantness;
  assert.equal(previewSupportBefore, 0);
  assert.equal(previewPleasantnessBefore, 50);
  const previewRestored = fromPersistedPreviewServerState(
    JSON.parse(JSON.stringify(toPersistedPreviewServerState(stateAfterGrant))),
    previewUser,
    previewSessionId,
    stateAfterGrant.version,
  );
  assert.deepEqual(previewRestored.referrals, grantPreview.referrals, 'preview referral survives JSON persistence and restoration');
  assert.deepEqual(toPreviewRecoveryDto(stateAfterGrant).referrals, grantPreview.referrals, 'preview recovery preserves the referral');
  assert.deepEqual(
    fromPersistedPreviewServerState({ userId: previewUser }, previewUser, previewSessionId, 0).referrals,
    {},
    'an older preview state has no synthetic referral',
  );

  const retryGrant = await previewService.execute(previewUser, previewRequest(
    'use_referral', previewSessionId, 'preview-referral-repeat-command-001', grantPreview.version, { npcId: 'P1-003' },
  ));
  assert.deepEqual(retryGrant.referrals, grantPreview.referrals, 'a second preview command preserves the existing referral');
  const replayGrant = await previewService.execute(previewUser, previewRequest(
    'use_referral', previewSessionId, 'preview-referral-repeat-command-001', grantPreview.version, { npcId: 'P1-003' },
  ));
  assert.equal(replayGrant.referrals?.['P1-003']?.id, retryGrant.referrals?.['P1-003']?.id, 'replaying the grant returns the same record');

  const previewWechat = await previewService.execute(previewUser, previewRequest(
    'wechat_request', previewSessionId, 'preview-referral-wechat-command-001', retryGrant.version, {
      npcId: 'P1-003', text: '通过工作引荐认识您，申请添加工作微信以沟通项目流程',
    },
  ));
  assert.equal(previewWechat.wechatAccepted, true, 'a granted preview referral guarantees the WeChat request');
  assert.notEqual(previewWechat.alreadyAdded, true, 'the first accepted WeChat is not marked as a duplicate');
  assert.equal(previewWechat.referrals?.['P1-003']?.chargedActionPoints, 1, 'preview records the first WeChat AP charge');
  assert.equal(previewWechat.referrals?.['P1-003']?.chargedActionPoints, formalWechat.state.referrals['P1-003']?.chargedActionPoints, 'formal and preview WeChat charge totals match');
  const previewWechatRetry = await previewService.execute(previewUser, previewRequest(
    'wechat_request', previewSessionId, 'preview-referral-wechat-command-002', previewWechat.version, {
      npcId: 'P1-003', text: '通过工作引荐认识您，申请添加工作微信以沟通项目流程',
    },
  ));
  assert.equal(previewWechatRetry.wechatAccepted, true, 'repeating an already-added WeChat remains accepted');
  assert.equal(previewWechatRetry.alreadyAdded, true, 'the preview marks a duplicate WeChat request');
  assert.equal(previewWechatRetry.referrals?.['P1-003']?.chargedActionPoints, 1, 'already-added preview WeChat does not increment the referral charge');
  assert.equal(previewWechatRetry.npcTestStates?.find((item) => item.npcId === 'P1-003')?.support, previewSupportBefore, 'referral and WeChat do not add hidden support');

  const previewInvite = await previewService.execute(previewUser, previewRequest(
    'message', previewSessionId, 'preview-referral-invite-command-001', previewWechatRetry.version, {
      npcId: 'P1-003', channel: 'wechat', text: invitationText,
    },
  ));
  assert.equal(previewInvite.invitationStatus, 'accepted', 'a valid preview invitation succeeds after referral');
  assert.equal(previewInvite.appointment?.npcId, 'P1-003');
  assert.equal(previewInvite.appointment?.status, 'accepted');
  assert.match(previewInvite.appointment?.timeWindow ?? '', /15:00/);
  assert.equal(previewInvite.appointment?.location, formalAppointment.venue);
  assert.equal(previewInvite.appointment?.agenda, formalAppointment.purpose);
  assert.equal(previewInvite.referrals?.['P1-003']?.chargedActionPoints, 2, 'preview records WeChat plus first written invitation AP');
  assert.equal(previewInvite.referrals?.['P1-003']?.chargedActionPoints, formalInvite.state.referrals['P1-003']?.chargedActionPoints, 'formal and preview first invitation charge totals match');
  assert.equal(modelCalls, 0, 'granted referral, WeChat, and invitation do not depend on a model response');
  const previewInviteRetry = await previewService.execute(previewUser, previewRequest(
    'message', previewSessionId, 'preview-referral-invite-command-002', previewInvite.version, {
      npcId: 'P1-003', channel: 'wechat', text: invitationText,
    },
  ));
  assert.equal(previewInviteRetry.invitationStatus, 'accepted');
  assert.equal(previewInviteRetry.appointmentReused, true, 'repeated invitation reuses its existing accepted appointment');
  assert.equal(previewInviteRetry.appointment?.id, previewInvite.appointment?.id);
  assert.equal(previewInviteRetry.referrals?.['P1-003']?.chargedActionPoints, 2, 'reused preview invitation does not increment the referral charge');
  assert.equal(modelCalls, 0);

  const previewReuseOnly = await previewService.execute(previewUser, previewRequest(
    'message', previewSessionId, 'preview-referral-invite-reuse-only-001', previewInviteRetry.version, {
      npcId: 'P1-003', channel: 'wechat', text: invitationText, reuseOnly: true,
    },
  ));
  assert.equal(previewReuseOnly.appointmentReused, true, 'reuseOnly returns the existing accepted appointment');
  assert.equal(previewReuseOnly.appointment?.id, previewInvite.appointment?.id);
  assert.equal(previewReuseOnly.referrals?.['P1-003']?.chargedActionPoints, 2, 'reuseOnly does not add an AP charge');
  await assert.rejects(
    previewService.execute(previewUser, previewRequest(
      'message', previewSessionId, 'preview-referral-ordinary-reuse-only-001', previewReuseOnly.version, {
        npcId: 'P1-003', channel: 'wechat', text: '王主任，感谢您回复，我们下周继续沟通。', reuseOnly: true,
      },
    )),
    /APPOINTMENT_REUSE_UNAVAILABLE/,
    'reuseOnly rejects an ordinary message that is not a valid referral invitation',
  );
  assert.equal(previewService.store.get(previewUser, previewSessionId)?.referrals['P1-003']?.chargedActionPoints, 2, 'a rejected reuseOnly request does not change the charge total');
  assert.equal(modelCalls, 0, 'reuseOnly checks complete without AI calls');

  const secondSession = await previewService.execute(previewUser, previewRequest(
    'reset', undefined, 'preview-second-session-initial-command-001', 0,
  ));
  assert.deepEqual(
    previewService.store.get(previewUser, secondSession.previewSessionId)?.referrals,
    {},
    'a separate preview session starts without another session\'s referral',
  );
  await assert.rejects(
    previewService.execute('external-referral-parity-other-user', previewRequest(
      'wechat_request', previewSessionId, 'preview-cross-account-command-0001', previewInviteRetry.version, {
        npcId: 'P1-003', text: '通过工作引荐申请添加工作微信',
      },
    )),
    /PREVIEW_SESSION_NOT_FOUND/,
    'another account cannot read or reuse this session\'s referral',
  );

  console.log('External referral formal/preview parity passed: grant, persistence, WeChat, accepted invitation, retries, and ownership.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
