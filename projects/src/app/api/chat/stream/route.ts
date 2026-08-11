import { NextRequest } from 'next/server';
import { streamLLM, type ChatMessage } from '@/lib/ai/client';
import { CUSTOMER_PROMPT, GAME_STATE_MARKER } from '@/lib/ai/prompts/customer';
import { authGuard } from '@/lib/auth/guard';
import { npcChatRequestSchema, npcTurnEvaluationSchema } from '@/lib/contracts/ai';
import { createServerClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type NpcProfile = {
  id: number | string;
  project_id: number;
  category: string;
  name: string;
  title: string;
  gender: string | null;
  age: number | null;
  hometown: string | null;
  personality: string;
  weakness: string;
};

function jsonResponse(error: string, status: number, details?: unknown) {
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function projectIdFromScenario(scenarioId: string): number | null {
  const match = /^project-(\d+)$/.exec(scenarioId);
  return match ? Number(match[1]) : null;
}

/**
 * NPC 流式对话 API。
 * 请求身份由 x-session 校验，NPC 画像由服务端按 npcId 加载。
 */
export async function POST(req: NextRequest) {
  const guard = authGuard(req);
  if (!guard.ok) return guard.response!;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse('请求体不是有效JSON', 400);
  }

  const parsed = npcChatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResponse('聊天请求字段无效', 400, parsed.error.flatten());
  }

  const { gameSessionId, scenarioId, npcId, history } = parsed.data;

  let npc: NpcProfile;
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('npc_profiles')
      .select('id, project_id, category, name, title, gender, age, hometown, personality, weakness')
      .eq('id', npcId)
      .single();

    if (error || !data) {
      return jsonResponse('NPC不存在或无法读取', 404);
    }
    npc = data as NpcProfile;
  } catch {
    return jsonResponse('NPC数据源不可用', 503);
  }

  const expectedProjectId = projectIdFromScenario(scenarioId);
  if (expectedProjectId !== null && npc.project_id !== expectedProjectId) {
    return jsonResponse('NPC不属于当前场景', 409);
  }

  const systemPrompt = CUSTOMER_PROMPT({ gameSessionId, scenarioId, npc });
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      let pending = '';
      let structured = '';
      let markerFound = false;

      const emitContent = (content: string) => {
        if (content) controller.enqueue(encoder.encode(sseData({ type: 'delta', content })));
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
          controller.enqueue(encoder.encode(sseData({
            type: 'error',
            code: 'AI_PROTOCOL_INVALID',
            error: 'AI响应缺少结构化状态，本轮状态未更新',
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
            controller.enqueue(encoder.encode(sseData({
              type: 'result',
              ...evaluationResult.data,
            })));
          } else {
            controller.enqueue(encoder.encode(sseData({
              type: 'error',
              code: 'AI_STATE_INVALID',
              error: 'AI状态数据未通过校验，本轮状态未更新',
            })));
          }
        }

        controller.enqueue(encoder.encode(sseData({ type: 'done' })));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode(sseData({
          type: 'error',
          code: 'AI_PROVIDER_ERROR',
          error: 'AI服务暂时不可用，请稍后重试',
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
