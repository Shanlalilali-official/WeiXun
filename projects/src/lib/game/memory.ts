import { invokeLLM } from '@/lib/ai/client';
import { serializeUntrustedPromptData } from '@/lib/ai/prompt-data';
import { resolveRuntimeRulePrompt } from '@/lib/ai/runtime-rule-prompts';
import {
  getNpcConversationRange,
  getNpcMessageCount,
} from '@/lib/game/repository';
import type { GameRuntimeState } from '@/lib/game/state';

const RECENT_MESSAGES_TO_KEEP = 8;
const SUMMARY_TRIGGER = 16;

export function mergeConversationMemorySummary(
  state: GameRuntimeState,
  npcId: string,
  summary: string,
  summarizedMessageCount: number,
): GameRuntimeState {
  const currentMemory = state.conversationMemories[npcId] ?? {
    summary: '',
    summarizedMessageCount: 0,
  };
  return {
    ...state,
    conversationMemories: {
      ...state.conversationMemories,
      [npcId]: {
        summary: summary.trim().slice(0, 1200),
        summarizedMessageCount,
        confirmedFacts: currentMemory.confirmedFacts ?? [],
        commitments: currentMemory.commitments ?? [],
      },
    },
  };
}

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
  const unsummarizedCount = Math.max(0, messageCount - currentMemory.summarizedMessageCount);
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
      content: await resolveRuntimeRulePrompt('formal_conversation_memory'),
    },
    {
      role: 'user',
      content: serializeUntrustedPromptData('conversation_memory_source', {
        existingSummary: currentMemory.summary || null,
        transcript,
      }, { maxStringLength: 12000, maxTotalLength: 16000 }),
    },
  ], { temperature: 0.2, maxTokens: 700 });

  const nextState = mergeConversationMemorySummary(
    state,
    npcId,
    summary,
    currentMemory.summarizedMessageCount + messages.length,
  );
  // The caller includes this state in its existing versioned command commit.
  // A separate save here would make command replay return a stale version.
  return nextState;
}
