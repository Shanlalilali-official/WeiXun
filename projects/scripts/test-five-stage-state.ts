import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameCommandSchema } from '../src/lib/contracts/game';
import {
  applyPreparationAttachments,
  connectNpc,
  createProjectOneState,
  executeGameCommand,
  extractPreparationBrief,
  hasReliablePreparationSemantics,
  isCurrentPreparationType,
  normalizeProjectOneState,
  toPlayerVisibleGameState,
} from '../src/lib/game/state';
import {
  advanceMultiplayerRuntime,
  allCompaniesOccupied,
  calculateHiddenProgressDelta,
  assertMultiplayerCommandAllowed,
  assertMultiplayerRoomRunning,
  decideMultiplayerStageVersion,
  decideMultiplayerReadyRetry,
  nextStageDeadline,
  shouldAdvanceSharedStage,
  updateSharedCustomerState,
} from '../src/lib/game/multiplayer';

let state = createProjectOneState();
assert.equal(state.currentStage, 1);
assert.equal(state.maxStages, 5);
assert.equal(state.dayAvailableMinutes, 0);

const command = (type: Parameters<typeof executeGameCommand>[1]['type'], payload: Record<string, unknown>, id: string) => {
  const result = executeGameCommand(state, { commandId: id, expectedVersion: state.version, type, payload } as Parameters<typeof executeGameCommand>[1]);
  state = result.state;
  return result;
};

const firstResearch = command('research_public_info', { npcId: 'p1-frontline-wang-hao' }, 'research-1');
assert.equal(firstResearch.result.publicResearch && typeof firstResearch.result.publicResearch, 'object');
assert.equal(state.actionPoints, 26);
assert.equal(Object.keys(state.publicResearch).length, 0, 'public search must not remain on the player card');
assert.equal('timeMinutes' in firstResearch.eventPayload, false, 'public search events use action points, not time metrics');
assert.equal(firstResearch.eventPayload.costPoints, 2);
command('research_public_info', { npcId: 'p1-frontline-wang-hao' }, 'research-2');
assert.equal(state.actionPoints, 24, 'repeat search charges action points again');

const phone = command('contact', { npcId: 'p1-frontline-wang-hao', channel: 'work_phone', content: '您好，想沟通项目。' }, 'phone-1');
assert.ok(['connected', 'unanswered', 'declined', 'call_later'].includes(String(phone.result.outcome)));
assert.equal(state.actionPoints, 23, 'failed or successful phone attempt has the same point cost');

command('prepare', {
  npcId: 'p1-frontline-wang-hao',
  preparationType: 'visit_preparation',
  title: '拜访前准备',
  content: '目标人物：王浩；客户问题：一线重复录入与跨部门确认成本；方案维度：流程和交付；证据：同类案例和可验证的交付记录；下一步：确认技术交流和责任人。',
}, 'prepare-1');
assert.equal(state.preparations.at(-1)?.type, 'visit_preparation');
assert.equal(state.preparations.at(-1)?.timeMinutes, 0);
assert.ok(state.preparations.at(-1)?.brief);
assert.equal(state.preparations.at(-1)?.brief?.audience.includes('王浩'), true);
assert.equal(state.preparations.at(-1)?.brief?.problem.includes('重复录入'), true);
assert.equal(state.preparations.at(-1)?.brief?.dimensions.includes('流程'), true);
assert.equal(state.preparations.at(-1)?.brief?.evidence.includes('案例'), true);
assert.equal(state.preparations.at(-1)?.brief?.nextStep.includes('技术交流'), true);
assert.deepEqual(new Set(state.preparations.at(-1)?.brief?.semanticTags), new Set([
  'target_person',
  'customer_problem',
  'solution_or_dimension',
  'evidence',
  'next_step',
]));
assert.equal(hasReliablePreparationSemantics(state.preparations.at(-1)?.brief ?? extractPreparationBrief('', 'p1-frontline-wang-hao')), true);
assert.throws(
  () => command('prepare', {
    npcId: 'p1-frontline-wang-hao',
    preparationType: 'visit_preparation',
    content: '随便写一点拜访内容，没有具体标签。',
  }, 'prepare-invalid'),
  /PREPARATION_BRIEF_REQUIRED/,
  'free-text preparation without semantic coverage is not usable',
);
const preparationId = state.preparations.at(-1)?.id;
assert.ok(preparationId);
const attached = applyPreparationAttachments(state, 'p1-frontline-wang-hao', [preparationId]);
assert.equal(attached.preparations.at(-1)?.usedCount, 1, 'email attachment increments preparation usage');
assert.equal(attached.preparations.at(-1)?.status, 'ready', 'reusable preparation remains ready after email delivery');
assert.equal(state.preparations.at(-1)?.usedCount, 0, 'attachment application is pure');
assert.throws(
  () => applyPreparationAttachments(state, 'p1-frontline-wang-hao', ['missing-preparation']),
  /EMAIL_ATTACHMENT_NOT_AVAILABLE/,
  'unknown preparation cannot be attached',
);
assert.throws(
  () => applyPreparationAttachments(state, 'p1-procurement-liu-kai', [preparationId]),
  /EMAIL_ATTACHMENT_NOT_AVAILABLE/,
  'another NPC preparation cannot be attached',
);

const legacyState = normalizeProjectOneState({
  ...createProjectOneState(),
  publicResearch: {
    'p1-frontline-wang-hao': {
      npcId: 'p1-frontline-wang-hao',
      facts: ['旧资料'],
      weakSignals: [],
      sourceNote: '旧存档',
      completedRound: 1,
      completedMinute: 540,
      costPoints: 2,
    },
  },
  preparations: [
    {
      id: 'legacy-material',
      npcId: 'p1-frontline-wang-hao',
      appointmentId: null,
      type: 'materials',
      title: '历史项目材料',
      content: '旧版材料记录',
      status: 'ready',
      costPoints: 2,
      timeMinutes: 0,
      reusable: true,
      usedCount: 0,
      createdRound: 1,
    },
    {
      id: 'legacy-gift',
      npcId: 'p1-frontline-wang-hao',
      appointmentId: null,
      type: 'courtesy_gift',
      title: '历史礼品',
      content: '旧版礼品记录',
      status: 'ready',
      costPoints: 3,
      timeMinutes: 0,
      reusable: false,
      usedCount: 0,
      createdRound: 1,
    },
  ],
});
assert.equal(Object.keys(legacyState.publicResearch).length, 0, 'legacy public research is not restored into a contact card');
assert.equal(legacyState.preparations.length, 2, 'legacy preparation rows remain readable for archive compatibility');
assert.equal(isCurrentPreparationType('visit_preparation'), true);
assert.equal(isCurrentPreparationType('materials'), false);
assert.throws(
  () => applyPreparationAttachments(legacyState, 'p1-frontline-wang-hao', ['legacy-material']),
  /EMAIL_ATTACHMENT_NOT_AVAILABLE/,
  'legacy materials cannot become ordinary email attachments',
);
assert.throws(
  () => applyPreparationAttachments(legacyState, 'p1-frontline-wang-hao', ['legacy-gift']),
  /EMAIL_ATTACHMENT_NOT_AVAILABLE/,
  'legacy gifts cannot become ordinary email attachments',
);
const nonEmailInviteState = connectNpc(createProjectOneState(), 'p1-frontline-wang-hao');
for (const channel of ['email', 'work_phone', 'wechat'] as const) {
  const naturalLanguageInvite = gameCommandSchema.parse({
    commandId: `invite-channel-${channel}`,
    expectedVersion: 1,
    type: 'invite',
    payload: {
      npcId: 'p1-frontline-wang-hao',
      channel,
      rawText: '希望围绕当前客户问题和交付案例安排一次正式沟通。',
    },
  });
  assert.equal(naturalLanguageInvite.type, 'invite');
  assert.equal(naturalLanguageInvite.payload.channel, channel, `${channel} remains a natural-language invitation channel`);
}
assert.throws(
  () => gameCommandSchema.parse({
    commandId: 'legacy-online-request',
    expectedVersion: 1,
    type: 'request_online',
    payload: { npcId: 'p1-frontline-wang-hao', message: '旧式线上申请路径不应再存在。' },
  }),
  'legacy request_online must not be accepted as an independent invitation/contact command',
);
assert.throws(
  () => executeGameCommand(nonEmailInviteState, gameCommandSchema.parse({
    commandId: 'phone-attachment',
    expectedVersion: nonEmailInviteState.version,
    type: 'invite',
    payload: {
      npcId: 'p1-frontline-wang-hao',
      channel: 'work_phone',
      rawText: '想当面沟通方案。',
      attachmentIds: ['legacy-material'],
    },
  })),
  /EMAIL_ATTACHMENT_NOT_AVAILABLE/,
  'attachments are only accepted on ordinary email invitations',
);

const wechatPayload = gameCommandSchema.parse({
  commandId: 'wechat-contract-1',
  expectedVersion: 1,
  type: 'request_wechat',
  payload: { npcId: 'p1-frontline-wang-hao', message: '申请添加工作微信，方便后续沟通。' },
});
assert.equal(wechatPayload.type, 'request_wechat', 'wechat application uses the unified command contract');
const connectedWechatState = connectNpc(createProjectOneState(), 'p1-frontline-wang-hao');
let acceptedWechatResult: ReturnType<typeof executeGameCommand> | null = null;
for (let index = 0; index < 200 && !acceptedWechatResult; index += 1) {
  const candidate = executeGameCommand(connectedWechatState, {
    commandId: `wechat-state-${index}`,
    expectedVersion: connectedWechatState.version,
    type: 'request_wechat',
    payload: { npcId: 'p1-frontline-wang-hao', message: '申请添加工作微信，方便后续沟通。' },
  });
  if (candidate.result.status === 'accepted') acceptedWechatResult = candidate;
}
assert.ok(acceptedWechatResult, 'the unified wechat command can produce an accepted request');
assert.equal(acceptedWechatResult?.state.npcContacts['p1-frontline-wang-hao'].status, 'online');
assert.equal(acceptedWechatResult?.state.npcContacts['p1-frontline-wang-hao'].wechatStatus, 'accepted');
assert.equal(acceptedWechatResult?.state.actionPoints, connectedWechatState.actionPoints - 1, 'wechat request charges one action point once');
assert.equal(acceptedWechatResult?.state.npcContacts['p1-frontline-wang-hao'].onlineRequestedRound, 1);

const beforeAdvance = state.actionPoints;
const advanced = command('advance_phase', {}, 'advance-1');
assert.equal(state.currentStage, 2);
assert.equal(state.currentRound, 2);
assert.equal(state.actionPoints, Math.min(28, beforeAdvance + 8));
assert.equal(state.competitorState.actions.length, 1, 'solo ABC simulation runs once per completed stage');
assert.equal('competitorAction' in advanced.result, false, 'advance result does not expose the internal competitor action');
assert.equal(state.notifications.some((item) => item.title === '竞品动态'), false, 'hidden competitor progress must not be pushed to the player');
const visibleState = toPlayerVisibleGameState({ ...state, competitorClaims: [{ id: 'claim-1', npcId: 'p1-frontline-wang-hao', stage: 1, statement: '内部竞品主张', truthStatus: 'unverified' }] });
assert.deepEqual(visibleState.competitorClaims, [], 'player state does not expose competitor claims');
assert.equal(visibleState.competitorState.actions.length, 0, 'player state does not expose competitor actions');
assert.equal(normalizeProjectOneState({ ...createProjectOneState(), gameMode: 'multiplayer', roomStageVersion: 4 }).roomStageVersion, 4, 'room stage concurrency token survives player-state normalization');
const duplicate = executeGameCommand(state, { commandId: 'advance-1', expectedVersion: state.version, type: 'advance_phase', payload: {} });
assert.equal(duplicate.result.duplicate, true);
assert.equal(duplicate.state.currentStage, 2);

const slots = [
  { playerUserId: 'u1', readyStage: 1, connected: true },
  { playerUserId: 'u2', readyStage: 1, connected: true },
];
assert.equal(allCompaniesOccupied(slots), true);
assert.equal(shouldAdvanceSharedStage(1, slots, null, 0), 'all_ready');
assert.equal(shouldAdvanceSharedStage(1, [{ ...slots[0], readyStage: null }, slots[1]], '2000-01-01T00:00:00.000Z', Date.now()), 'timeout');
assert.equal(nextStageDeadline(null, 0), null);
assert.equal(decideMultiplayerStageVersion(3, 3), 'advance');
assert.equal(decideMultiplayerStageVersion(4, 3), 'replay');
assert.equal(decideMultiplayerStageVersion(5, 3), 'conflict', 'older retries must not be treated as idempotent');
assert.equal(decideMultiplayerReadyRetry(1, 3, 1, 3, false), 'mark_ready');
assert.equal(decideMultiplayerReadyRetry(1, 3, 1, 3, true), 'ready_replay', 'same slot retry remains idempotent before the stage moves');
assert.equal(decideMultiplayerReadyRetry(2, 4, 1, 3, false), 'stage_replay', 'lost last-ready response returns the advanced room');
assert.equal(decideMultiplayerReadyRetry(5, 6, 5, 5, false, true), 'stage_replay', 'terminal transition can replay without a sixth stage');
assert.equal(decideMultiplayerReadyRetry(3, 5, 1, 3, false), 'conflict', 'a stale ready request must not mark a later stage ready');
assert.throws(
  () => assertMultiplayerCommandAllowed('multiplayer', 'advance_phase'),
  /MULTIPLAYER_STAGE_ADVANCE_REQUIRES_ROOM_READY/,
  'the generic session command API cannot bypass room readiness',
);
assert.doesNotThrow(() => assertMultiplayerCommandAllowed('solo', 'advance_phase'));
assert.throws(() => assertMultiplayerRoomRunning('multiplayer', 'waiting'), /MULTIPLAYER_ROOM_NOT_RUNNING/, 'multiplayer writes are blocked before room start');
assert.throws(() => assertMultiplayerRoomRunning('multiplayer', 'finished'), /MULTIPLAYER_ROOM_NOT_RUNNING/, 'multiplayer writes are blocked after room end');
assert.doesNotThrow(() => assertMultiplayerRoomRunning('multiplayer', 'running'));
assert.doesNotThrow(() => assertMultiplayerRoomRunning('solo', 'waiting'));
const multiplayerMigration = readFileSync(new URL('../supabase/migrations/20260819000200_five_stage_multiplayer.sql', import.meta.url), 'utf8');
assert.match(multiplayerMigration, /WHERE user_id = p_user_id AND status = 'playing' AND multiplayer = false/, 'solo save replacement excludes multiplayer sessions');
assert.match(multiplayerMigration, /CREATE OR REPLACE FUNCTION public\.mark_multiplayer_ready\([\s\S]*p_expected_stage integer,[\s\S]*p_expected_version integer/, 'ready RPC requires stage and version preconditions');
assert.match(multiplayerMigration, /CREATE OR REPLACE FUNCTION public\.create_multiplayer_room/, 'room and slots are created atomically by RPC');
assert.match(multiplayerMigration, /IF r\.status <> 'waiting' THEN RAISE EXCEPTION 'ROOM_NOT_MUTABLE'/, 'player removal is limited to the lobby until running-room backfill exists');
assert.match(multiplayerMigration, /SELECT \* INTO runtime_row FROM public\.game_runtime_states[\s\S]*WHERE session_id = s\.game_session_id FOR UPDATE[\s\S]*last_action = 'multiplayer_player_removed', version = version \+ 1/, 'lobby removal locks and invalidates the detached runtime before replacing its session');
const advancedRuntime = advanceMultiplayerRuntime({
  actionPoints: 23,
  version: 7,
  simulationState: { companyId: 'player-company' },
  dimensions: { decisionAnalysis: 60, relationshipBuilding: 60, valuePresentation: 60, objectionHandling: 60, informationDiscovery: 60 },
  npcAffinity: { wang: 45 },
}, 2);
assert.equal(advancedRuntime.currentStage, 3);
assert.equal(advancedRuntime.actionPoints, 28, 'multiplayer stage gain respects the action-point cap');
assert.equal(advancedRuntime.version, 8);
assert.equal(advancedRuntime.simulationState.currentStage, 3);
assert.equal(calculateHiddenProgressDelta(advancedRuntime.dimensions, advancedRuntime.npcAffinity), 2);
assert.deepEqual(updateSharedCustomerState({}, 2, 3, 2, '2026-08-20T00:00:00.000Z'), {
  currentStage: 3,
  lastCompletedStage: 2,
  companyCount: 2,
  updatedAt: '2026-08-20T00:00:00.000Z',
});
const finalRuntime = advanceMultiplayerRuntime(advancedRuntime, 5);
assert.equal(finalRuntime.currentStage, 5);
assert.equal(finalRuntime.submissionReady, true);
assert.equal(finalRuntime.actionPoints, 28, 'final stage does not grant action points again');

console.log('five-stage action-point and multiplayer state tests passed');
