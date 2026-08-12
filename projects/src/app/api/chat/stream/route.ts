import { NextRequest } from 'next/server';
import { streamLLM, type ChatMessage } from '@/lib/ai/client';
import { CUSTOMER_PROMPT } from '@/lib/ai/prompts/customer';
import { evaluateNpcTurn } from '@/lib/ai/npc-evaluation';
import { authGuard } from '@/lib/auth/guard';
import { npcChatRequestSchema } from '@/lib/contracts/ai';
import { getProjectOneNpc } from '@/lib/game/project-one';
import {
  appendGameEvent,
  getNpcInbox,
  getNpcConversation,
  getOwnedGameSession,
  saveChatMessage,
  saveGameState,
} from '@/lib/game/repository';
import { applyNpcEvaluation, calculateTotalScore } from '@/lib/game/state';
import { refreshConversationMemory } from '@/lib/game/memory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonResponse(error: string, status: number, details?: unknown) {
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  const guard = authGuard(req);
  if (!guard.ok || !guard.session) return guard.response!;

  const parsed = npcChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonResponse('聊天请求字段无效', 400, parsed.error.flatten());
  }

  const { gameSessionId, scenarioId, npcId, message } = parsed.data;
  let gameSession;
  try {
    gameSession = await getOwnedGameSession(gameSessionId, guard.session.userId);
  } catch {
    return jsonResponse('对局不存在或无权访问', 404);
  }
  if (gameSession.state.scenarioCode !== scenarioId) {
    return jsonResponse('场景与对局不一致', 409);
  }
  if (gameSession.state.status !== 'playing') {
    return jsonResponse('对局已经结束', 409);
  }
  if (!gameSession.state.unlockedNpcIds.includes(npcId)) {
    return jsonResponse('NPC尚未解锁', 403);
  }

  const npc = getProjectOneNpc(npcId);
  if (!npc) return jsonResponse('NPC不存在', 404);

  try {
    await saveChatMessage({
      sessionId: gameSessionId,
      npcId,
      round: gameSession.state.currentRound,
      role: 'user',
      content: message,
    });
  } catch {
    return jsonResponse('用户消息保存失败，本轮未调用AI', 503);
  }

  let recentHistory;
  try {
    recentHistory = await getNpcConversation(gameSessionId, npcId, 12);
  } catch {
    return jsonResponse('对话历史读取失败，本轮未调用AI', 503);
  }

  const memory = gameSession.state.conversationMemories[npcId];
  const inbox = await getNpcInbox(gameSessionId, npcId).catch(() => []);
  const systemPrompt = CUSTOMER_PROMPT({
    gameSessionId,
    scenarioId,
    npc,
    round: gameSession.state.currentRound,
    maxRounds: gameSession.state.maxRounds,
    affinity: gameSession.state.npcAffinity[npcId] ?? 35,
    lastAction: gameSession.state.lastAction,
    memorySummary: memory?.summary,
    confirmedFacts: memory?.confirmedFacts,
    commitments: memory?.commitments,
    inbox,
    canRevealPersonalInterest: (gameSession.state.npcAffinity[npcId] ?? 35) >= 50,
    canRevealKeyContact: (gameSession.state.npcAffinity[npcId] ?? 35) >= 50,
  });
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...recentHistory.map(({ role, content }) => ({ role, content })),
  ];

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      let reply = '';

      const emitContent = (content: string) => {
        if (!content) return;
        reply += content;
        controller.enqueue(encoder.encode(sseData({ type: 'delta', content })));
      };

      try {
        for await (const chunk of streamLLM(messages, { temperature: 0.7, thinking: 'disabled' })) emitContent(chunk);
        if (!reply.trim()) throw new Error('AI_PROVIDER_EMPTY_RESPONSE');

        controller.enqueue(encoder.encode(sseData({ type: 'evaluation_started' })));
        const assessment = await evaluateNpcTurn({
          npcId,
          npcName: npc.name,
          npcTitle: npc.title,
          affinity: gameSession.state.npcAffinity[npcId] ?? 35,
          round: gameSession.state.currentRound,
          playerMessage: message,
          npcReply: reply,
          recentConversation: recentHistory,
          confirmedFacts: memory?.confirmedFacts ?? [],
          commitments: memory?.commitments ?? [],
        });
        const evaluation = assessment.evaluation;
        const appliedAffinityDelta = evaluation.affinityDelta * gameSession.state.progressionMultiplier;
        const previousScore = calculateTotalScore(gameSession.state.dimensions);
        const changedState = applyNpcEvaluation(gameSession.state, npcId, evaluation, reply);
        let state = await saveGameState(gameSessionId, changedState);
        const scoreDelta = calculateTotalScore(state.dimensions) - previousScore;
        await saveChatMessage({
          sessionId: gameSessionId,
          npcId,
          round: state.currentRound,
          role: 'assistant',
          content: reply,
          affinityDelta: appliedAffinityDelta,
          scoreDelta,
          metadata: { ...evaluation, protocolValid: true, evaluationSource: assessment.source },
        });
        await appendGameEvent(gameSessionId, state.currentRound, 'npc.turn.completed', {
          scoreDelta,
          affinityDelta: appliedAffinityDelta,
          affinityReason: evaluation.affinityReason,
          evaluationSource: assessment.source,
          cluesUnlocked: evaluation.cluesUnlocked,
        }, npcId);
        if (assessment.source === 'fallback') {
          await appendGameEvent(gameSessionId, state.currentRound, 'npc.evaluation.fallback', {
            affinityDelta: appliedAffinityDelta,
            affinityReason: evaluation.affinityReason,
          }, npcId);
        }
        if (evaluation.handoff && /汇报|上报|转告|转达/.test(reply)) {
          await appendGameEvent(gameSessionId, state.currentRound, 'npc.handoff.promised', evaluation.handoff, npcId);
        }
        try {
          state = await refreshConversationMemory(gameSessionId, npcId, state);
        } catch {
          await appendGameEvent(gameSessionId, state.currentRound, 'memory.refresh.failed', {}, npcId).catch(() => undefined);
        }
        controller.enqueue(encoder.encode(sseData({
          type: 'result',
          state,
          emotion: evaluation.emotion,
          affinityDelta: appliedAffinityDelta,
          affinityReason: evaluation.affinityReason,
          evaluationSource: assessment.source,
        })));

        controller.enqueue(encoder.encode(sseData({ type: 'done' })));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode(sseData({
          type: 'error', code: 'AI_PROVIDER_ERROR', error: 'AI服务或状态保存暂时不可用，请稍后重试',
        })));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
