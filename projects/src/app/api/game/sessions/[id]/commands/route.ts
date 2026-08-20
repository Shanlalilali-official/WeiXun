import { NextRequest, NextResponse } from 'next/server';
import { evaluateGiftDecision } from '@/lib/ai/npc-evaluation';
import { authGuard } from '@/lib/auth/guard';
import { gameCommandSchema, type GameCommand } from '@/lib/contracts/game';
import {
  commitGameCommand,
  deliverPendingNpcHandoffs,
  getCommittedGameCommand,
  getOwnedGameSession,
} from '@/lib/game/repository';
import { getProjectOneNpc } from '@/lib/game/project-one';
import { executeGameCommand, getPhaseName, toPlayerVisibleGameState } from '@/lib/game/state';
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
    const gameSession = await getOwnedGameSession(id, guard.session.userId);
    const replay = await getCommittedGameCommand(id, parsed.data.commandId);
    if (replay) return NextResponse.json({ success: true, ...replay });

    if (parsed.data.expectedVersion !== gameSession.state.version) {
      return NextResponse.json({
        error: 'STATE_VERSION_CONFLICT',
        state: toPlayerVisibleGameState(gameSession.state),
      }, { status: 409 });
    }

    // Probability decisions use an HMAC seed that the browser cannot predict
    // or enumerate. The original command ID remains the idempotency key.
    const probabilityCommand = {
      ...parsed.data,
      commandId: createServerProbabilitySeed([id, parsed.data.commandId, parsed.data.type]),
    } as GameCommand;

    // Pure preflight rejects invalid inventory/meeting/version state before an
    // external AI call. The authoritative state is still committed only once.
    let execution = executeGameCommand(gameSession.state, probabilityCommand);
    if (parsed.data.type === 'give_gift') {
      const giftCommand = parsed.data;
      const preparation = gameSession.state.preparations.find((item) => item.id === giftCommand.payload.preparationId);
      const meeting = gameSession.state.activeMeeting;
      const npc = preparation ? getProjectOneNpc(preparation.npcId) : null;
      if (!preparation || !meeting || !npc) throw new Error('GIFT_CONTEXT_INVALID');
      const attitude = gameSession.state.npcAttitudes[npc.id];
      const appointment = gameSession.state.appointments.find((item) => item.id === meeting.appointmentId);
      const priorBoundaryGiftCount = gameSession.state.complianceRisks.filter((item) =>
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
        support: attitude?.support ?? gameSession.state.npcAffinity[npc.id] ?? 35,
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
        round: gameSession.state.currentRound,
        phaseName: getPhaseName(gameSession.state.currentRound),
        meetingType: meeting.visitType,
        venue: appointment?.venue ?? '未记录场地',
        procurementSensitive: gameSession.state.currentRound >= 4,
        exchangeRequested: giftCommand.payload.exchangeRequested,
      });
      execution = executeGameCommand(gameSession.state, {
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
    return NextResponse.json({ success: true, ...committed, state: toPlayerVisibleGameState(committed.state) });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'GAME_COMMAND_FAILED';
    const status = code === 'STATE_VERSION_CONFLICT' || code === 'COMMAND_IN_PROGRESS' ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
