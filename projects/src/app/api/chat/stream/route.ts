import { NextRequest } from 'next/server';
import { streamLLM, type ChatMessage } from '@/lib/ai/client';
import { CUSTOMER_PROMPT } from '@/lib/ai/prompts/customer';
import { COMPETITOR_PROMPT } from '@/lib/ai/prompts/competitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * LLM 流式对话 API
 * POST /api/chat/stream
 * Body: { scenarioId, role: 'customer' | 'competitor', history: [{role, content}] }
 * 返回: SSE 流 (text/event-stream)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenarioId, role, history } = body as {
      scenarioId: string;
      role: 'customer' | 'competitor';
      history: ChatMessage[];
    };

    if (!scenarioId || !role || !Array.isArray(history)) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数 scenarioId/role/history' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. **根据角色加载提示词**
    const systemPrompt =
      role === 'customer'
        ? CUSTOMER_PROMPT({ scenarioId })
        : COMPETITOR_PROMPT({ scenarioId });

    // 2. **组装完整消息**
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    // 3. **SSE 流式输出** (Content-Type: text/event-stream)
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const content of streamLLM(messages, { temperature: 0.8 })) {
            const data = `data: ${JSON.stringify({ content })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          // 结束标记
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
          );
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
  } catch (err) {
    return new Response(
      JSON.stringify({ error: '请求体解析失败' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
