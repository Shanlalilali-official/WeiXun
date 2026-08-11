import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { invokeLLM } from '@/lib/ai/client';
import { gameReviewSchema } from '@/lib/contracts/game';
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
    const result = await invokeLLM([
      {
        role: 'system',
        content: '你是政企销售训练复盘教练。只能依据给定对局数据给出具体、可执行的中文复盘，不得编造对话外事实。只输出JSON。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          result: gameSession.state.status,
          dimensions: gameSession.state.dimensions,
          clues: gameSession.state.unlockedClues,
          transcript: transcript.map(({ role, content }) => ({ role, content })),
          outputSchema: { strengths: [''], improvements: [''], nextActions: [''] },
        }),
      },
    ], { temperature: 0.3, maxTokens: 1200 });
    const parsedJson = JSON.parse(result.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim());
    const parsed = gameReviewSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return NextResponse.json({ error: 'AI复盘未通过结构校验' }, { status: 502 });
    }
    await saveStoredReview(id, gameSession.state, parsed.data);
    return NextResponse.json({ success: true, review: parsed.data, cached: false });
  } catch {
    return NextResponse.json({ error: 'AI复盘服务暂时不可用' }, { status: 503 });
  }
}
