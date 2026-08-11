import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { invokeLLM } from '@/lib/ai/client';
import { parseAiJsonObject } from '@/lib/ai/json';
import { gameReviewSchema, type GameReview } from '@/lib/contracts/game';
import {
  getOwnedGameSession,
  getSessionTranscript,
  getStoredReview,
  saveStoredReview,
} from '@/lib/game/repository';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = authGuard(request);
  if (!guard.ok || !guard.session) return guard.response!;
  const { id } = await context.params;

  try {
    const gameSession = await getOwnedGameSession(id, guard.session.userId);
    if (gameSession.state.status === 'playing') {
      return NextResponse.json({ error: '对局尚未结束' }, { status: 409 });
    }
    const existing = await getStoredReview(id);
    if (existing) return NextResponse.json({ success: true, review: existing, cached: true });

    const transcript = await getSessionTranscript(id);
    const reviewInput = JSON.stringify({
      result: gameSession.state.status,
      dimensions: gameSession.state.dimensions,
      clues: gameSession.state.unlockedClues,
      transcript: transcript.map(({ role, content }) => ({ role, content })),
    });
    const systemPrompt = [
      '你是政企销售训练复盘教练。只能依据给定对局数据给出具体、可执行的中文复盘，不得编造对话外事实。',
      '只输出一个JSON对象，且必须恰好包含strengths、improvements、nextActions三个字段。',
      '每个字段必须是包含1到3个非空中文字符串的数组，每个字符串不超过300字。不得输出Markdown或其他字段。',
    ].join('');
    let review: GameReview | null = null;
    for (let attempt = 0; attempt < 2 && !review; attempt += 1) {
      const result = await invokeLLM([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: attempt === 0
            ? reviewInput
            : `${reviewInput}\n上一次输出未通过字段或数组约束，请严格按指定JSON结构重新生成。`,
        },
      ], { temperature: attempt === 0 ? 0.2 : 0, maxTokens: 1200, jsonMode: true });
      try {
        const parsed = gameReviewSchema.safeParse(parseAiJsonObject(result));
        if (parsed.success) review = parsed.data;
      } catch {
        // Retry once with a stricter correction prompt.
      }
    }
    if (!review) {
      return NextResponse.json({ error: 'AI复盘未通过结构校验' }, { status: 502 });
    }
    await saveStoredReview(id, gameSession.state, review);
    return NextResponse.json({ success: true, review, cached: false });
  } catch {
    return NextResponse.json({ error: 'AI复盘服务暂时不可用' }, { status: 503 });
  }
}
