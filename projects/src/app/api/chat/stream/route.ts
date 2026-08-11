import { NextRequest } from 'next/server';
import { streamLLM, type ChatMessage } from '@/lib/ai/client';
import { CUSTOMER_PROMPT, GAME_STATE_MARKER } from '@/lib/ai/prompts/customer';
import { authGuard } from '@/lib/auth/guard';
import { npcChatRequestSchema, npcTurnEvaluationSchema } from '@/lib/contracts/ai';
import { getProjectOneNpc } from '@/lib/game/project-one';
import {
  appendGameEvent,
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
  const systemPrompt = CUSTOMER_PROMPT({
    gameSessionId,
    scenarioId,
    npc,
    round: gameSession.state.currentRound,
    maxRounds: gameSession.state.maxRounds,
    affinity: gameSession.state.npcAffinity[npcId] ?? 35,
    lastAction: gameSession.state.lastAction,
    memorySummary: memory?.summary,
    canRevealPersonalInterest: (gameSession.state.npcAffinity[npcId] ?? 35) >= 50,
  });
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...recentHistory.map(({ role, content }) => ({ role, content })),
  ];

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      let pending = '';
      let structured = '';
      let reply = '';
      let markerFound = false;

      const emitContent = (content: string) => {
        if (!content) return;
        reply += content;
        controller.enqueue(encoder.encode(sseData({ type: 'delta', content })));
      };

      try {
        for await (const chunk of streamLLM(messages, { temperature: 0.7 })) {
          if (markerFound) {
            structured += chunk;
            continue;
          }
          pending += chunk;
          const markerIndex = pending.indexOf(GAME_STATE_MARKER);
          if (markerIndex >= 0) {
            emitContent(pending.slice(0, markerIndex));
            structured = pending.slice(markerIndex + GAME_STATE_MARKER.length);
            pending = '';
            markerFound = true;
            continue;
          }
          const safeLength = pending.length - (GAME_STATE_MARKER.length - 1);
          if (safeLength > 0) {
            emitContent(pending.slice(0, safeLength));
            pending = pending.slice(safeLength);
          }
        }

        if (!markerFound) {
          emitContent(pending);
          await saveChatMessage({
            sessionId: gameSessionId,
            npcId,
            round: gameSession.state.currentRound,
            role: 'assistant',
            content: reply,
            metadata: { protocolValid: false },
          });
          controller.enqueue(encoder.encode(sseData({
            type: 'error', code: 'AI_PROTOCOL_INVALID', error: 'AI响应缺少结构化状态，本轮状态未更新',
          })));
        } else {
          const cleaned = structured.replace(/```(?:json)?/gi, '').trim();
          let evaluation: unknown;
          try {
            evaluation = JSON.parse(cleaned);
          } catch {
            evaluation = null;
          }
          const evaluationResult = npcTurnEvaluationSchema.safeParse(evaluation);
          if (evaluationResult.success) {
            const previousScore = calculateTotalScore(gameSession.state.dimensions);
            const changedState = applyNpcEvaluation(gameSession.state, npcId, evaluationResult.data);
            let state = await saveGameState(gameSessionId, changedState);
            const scoreDelta = calculateTotalScore(state.dimensions) - previousScore;
            await saveChatMessage({
              sessionId: gameSessionId,
              npcId,
              round: state.currentRound,
              role: 'assistant',
              content: reply,
              affinityDelta: evaluationResult.data.affinityDelta,
              scoreDelta,
              metadata: { ...evaluationResult.data, protocolValid: true },
            });
            await appendGameEvent(gameSessionId, state.currentRound, 'npc.turn.completed', {
              scoreDelta,
              affinityDelta: evaluationResult.data.affinityDelta,
              cluesUnlocked: evaluationResult.data.cluesUnlocked,
            }, npcId);
            try {
              state = await refreshConversationMemory(gameSessionId, npcId, state);
            } catch {
              await appendGameEvent(gameSessionId, state.currentRound, 'memory.refresh.failed', {}, npcId).catch(() => undefined);
            }
            controller.enqueue(encoder.encode(sseData({ type: 'result', state, emotion: evaluationResult.data.emotion })));
          } else {
            await saveChatMessage({
              sessionId: gameSessionId,
              npcId,
              round: gameSession.state.currentRound,
              role: 'assistant',
              content: reply,
              metadata: { protocolValid: false },
            });
            controller.enqueue(encoder.encode(sseData({
              type: 'error', code: 'AI_STATE_INVALID', error: 'AI状态数据未通过校验，本轮状态未更新',
            })));
          }
        }

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
