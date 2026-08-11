import { invokeLLM } from '@/lib/ai/client';
import {
  getNpcConversationRange,
  getNpcMessageCount,
  saveGameState,
} from '@/lib/game/repository';
import type { GameRuntimeState } from '@/lib/game/state';

const RECENT_MESSAGES_TO_KEEP = 8;
const SUMMARY_TRIGGER = 16;

export async function refreshConversationMemory(
  sessionId: string,
  npcId: string,
  state: GameRuntimeState,
): Promise<GameRuntimeState> {
  const currentMemory = state.conversationMemories[npcId] ?? {
    summary: '',
    summarizedMessageCount: 0,
  };
  const messageCount = await getNpcMessageCount(sessionId, npcId);
  const unsummarizedCount = messageCount - currentMemory.summarizedMessageCount;
  if (unsummarizedCount < SUMMARY_TRIGGER) return state;

  const batchSize = unsummarizedCount - RECENT_MESSAGES_TO_KEEP;
  const messages = await getNpcConversationRange(
    sessionId,
    npcId,
    currentMemory.summarizedMessageCount,
    batchSize,
  );
  if (messages.length === 0) return state;

  const transcript = messages.map((item) => `${item.role === 'user' ? '销售' : '客户'}：${item.content}`).join('\n');
  const summary = await invokeLLM([
    {
      role: 'system',
      content: '你是对话记忆压缩器。只保留已确认的客户事实、承诺、异议、关系变化和待跟进事项；不得编造。输出不超过500字的中文摘要。',
    },
    {
      role: 'user',
      content: `已有摘要：\n${currentMemory.summary || '无'}\n\n新增对话：\n${transcript}`,
    },
  ], { temperature: 0.2, maxTokens: 700 });

  const nextState: GameRuntimeState = {
    ...state,
    conversationMemories: {
      ...state.conversationMemories,
      [npcId]: {
        summary: summary.trim().slice(0, 1200),
        summarizedMessageCount: currentMemory.summarizedMessageCount + messages.length,
      },
    },
  };
  return saveGameState(sessionId, nextState);
}
