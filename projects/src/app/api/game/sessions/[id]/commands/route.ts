import { NextRequest, NextResponse } from 'next/server';
import { evaluateGiftDecision } from '@/lib/ai/npc-evaluation';
import { evaluateFormalBriefVisit, evaluateFormalVisitPreparation, evaluateFormalWorkPlan } from '@/lib/ai/formal-workflow';
import { authGuard } from '@/lib/auth/guard';
import { gameCommandSchema, type GameCommand } from '@/lib/contracts/game';
import {
  commitGameCommand,
  deliverPendingNpcHandoffs,
  assertOwnedMultiplayerRoomRunning,
  getCommittedGameCommand,
  synchronizeOwnedGameTimer,
} from '@/lib/game/repository';
import { getProjectOneNpc } from '@/lib/game/project-one';
import { assertMultiplayerCommandAllowed } from '@/lib/game/multiplayer';
import { executeGameCommand, synchronizeProjectTimer, toPlayerVisibleGameCommandResult, toPlayerVisibleGameState } from '@/lib/game/state';
import { createServerProbabilitySeed } from '@/lib/game/server-random';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  const parsed = gameCommandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'GAME_COMMAND_INVALID', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const timerSynchronized = await synchronizeOwnedGameTimer(id, guard.session.userId);
    const gameSession = {
      ...timerSynchronized,
      // A command is an authoritative boundary, so retain sub-interval elapsed
      // time before a start_visit can freeze the clock. Its eventual command
      // commit persists this checkpoint atomically with the action.
      state: timerSynchronized.state.gameMode === 'multiplayer' && !timerSynchronized.state.projectTimer.lastResumedAt
        ? timerSynchronized.state
        : synchronizeProjectTimer(timerSynchronized.state, Date.now(), true),
    };
    const replay = await getCommittedGameCommand(id, parsed.data.commandId);
    if (replay) return NextResponse.json({
      success: true,
      ...replay,
      result: toPlayerVisibleGameCommandResult(replay.result),
      state: toPlayerVisibleGameState(replay.state),
    });

    const allowFinishedRoom = parsed.data.type === 'mark_notification_read';
    await assertOwnedMultiplayerRoomRunning(id, gameSession.state, allowFinishedRoom);

    if (parsed.data.expectedVersion !== gameSession.state.version) {
      return NextResponse.json({
        error: 'STATE_VERSION_CONFLICT',
        state: toPlayerVisibleGameState(gameSession.state),
      }, { status: 409 });
    }

    // Legacy phase controls are rejected by the reducer; multiplayer still
    // keeps its room ownership check for normal company actions.
    assertMultiplayerCommandAllowed(gameSession.state.gameMode, parsed.data.type);

    // Probability decisions use an HMAC seed that the browser cannot predict
    // or enumerate. The original command ID remains the idempotency key.
    const probabilityCommand = {
      ...parsed.data,
      commandId: createServerProbabilitySeed([id, parsed.data.commandId, parsed.data.type]),
    } as GameCommand;

    // The pure reducer still rejects invalid inventory/meeting/version state;
    // the authoritative state is committed only once after the candidate has
    // been validated or the deterministic fallback has been selected.
    const planPayload = parsed.data.type === 'work_plan' ? parsed.data.payload : null;
    const duplicatePlan = planPayload !== null && gameSession.state.workPlans.some((plan) =>
      plan.scope === planPayload.scope && plan.npcId === (planPayload.npcId ?? null) && plan.content.trim() === planPayload.content.trim());
    const workflowEvaluation = parsed.data.type === 'work_plan' && !duplicatePlan
      ? { workPlanEvaluation: await evaluateFormalWorkPlan(parsed.data.payload) }
      : parsed.data.type === 'prepare' && parsed.data.payload.preparationType === 'visit_preparation'
        ? { visitPreparationEvaluation: await evaluateFormalVisitPreparation(parsed.data.payload) }
      : parsed.data.type === 'brief_visit'
        ? { briefVisitEvaluation: await evaluateFormalBriefVisit(parsed.data.payload) }
        : {};
    // AI preparation can take longer than the remaining project budget. Load
    // the trusted timer again before applying any model-derived business
    // effect, so a late response never lands after automatic settlement.
    const settledSession = await synchronizeOwnedGameTimer(id, guard.session.userId);
    if (settledSession.state.status !== 'playing') throw new Error('GAME_ALREADY_FINISHED');
    if (settledSession.state.version !== parsed.data.expectedVersion) throw new Error('STATE_VERSION_CONFLICT');
    const executionState = synchronizeProjectTimer(settledSession.state, Date.now(), true);
    let execution = executeGameCommand(executionState, probabilityCommand, workflowEvaluation);
    if (parsed.data.type === 'give_gift') {
      const giftCommand = parsed.data;
      const preparation = executionState.preparations.find((item) => item.id === giftCommand.payload.preparationId);
      const meeting = executionState.activeMeeting;
      const npc = preparation ? getProjectOneNpc(preparation.npcId) : null;
      if (!preparation || !meeting || !npc) throw new Error('GIFT_CONTEXT_INVALID');
      const attitude = executionState.npcAttitudes[npc.id];
      const appointment = executionState.appointments.find((item) => item.id === meeting.appointmentId);
      const priorBoundaryGiftCount = executionState.complianceRisks.filter((item) =>
        item.npcId === npc.id
        && item.kind === 'boundary_gift'
        && (item.outcome === 'delighted_acceptance' || item.outcome === 'cautious_acceptance')).length;
      const assessment = await evaluateGiftDecision({
        commandId: probabilityCommand.commandId,
        npcId: npc.id,
        npcName: npc.name,
        npcTitle: npc.title,
        npcCategory: npc.category,
        npcPersonality: npc.personality,
        npcConcern: npc.weakness,
        complianceSensitivity: npc.complianceSensitivity,
        giftPreference: npc.actionPreferences.gift ?? 0,
        pleasure: attitude?.pleasantness ?? 50,
        support: attitude?.support ?? executionState.npcAffinity[npc.id] ?? 35,
        attitudeHistory: (attitude?.history ?? []).slice(-8).map((item) => ({
          reason: item.reason,
          source: item.source,
          pleasantnessDelta: item.pleasantnessDelta,
          supportDelta: item.supportDelta,
        })),
        giftType: preparation.type === 'boundary_gift' ? 'boundary' : 'compliant',
        giftDescription: `${preparation.title}${preparation.content ? `：${preparation.content}` : ''}`,
        setting: giftCommand.payload.setting,
        witnesses: giftCommand.payload.witnesses.map((npcId) => getProjectOneNpc(npcId)?.name ?? npcId),
        priorBoundaryGiftCount,
        round: executionState.currentRound,
        phaseName: '项目限时推进',
        meetingType: meeting.visitType,
        venue: appointment?.venue ?? '未记录场地',
        procurementSensitive: false,
        exchangeRequested: giftCommand.payload.exchangeRequested,
      });
      execution = executeGameCommand(executionState, {
        ...giftCommand,
        commandId: probabilityCommand.commandId,
      }, {
        giftEvaluation: { ...assessment.decision, source: assessment.source },
      });
    }
    const committed = await commitGameCommand({
      sessionId: id,
      commandId: parsed.data.commandId,
      commandType: parsed.data.type,
      expectedVersion: parsed.data.expectedVersion,
      state: execution.state,
      eventType: execution.eventType,
      eventPayload: execution.eventPayload,
      result: execution.result,
    });
    await deliverPendingNpcHandoffs(id, committed.state.currentRound).catch(() => undefined);
    return NextResponse.json({
      success: true,
      ...committed,
      result: toPlayerVisibleGameCommandResult(committed.result),
      state: toPlayerVisibleGameState(committed.state),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'GAME_COMMAND_FAILED';
    const status = code === 'STATE_VERSION_CONFLICT' || code === 'COMMAND_IN_PROGRESS' || code === 'MULTIPLAYER_ROOM_NOT_RUNNING' ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
