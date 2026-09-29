import { invokeJev, type JevInvoker, type JevRequest } from '@/lib/ai/jev-client';
import { invokeConfiguredJev } from '@/lib/ai/jev-designer-config';
import { serializeUntrustedPromptData } from '@/lib/ai/prompt-data';
import {
  PROJECT_ONE_FIVE_PERSON_NPCS,
  type ProjectOneFivePersonId,
  type ProjectOneVisitTask,
} from '@/lib/designer/project-one-five-person';

export interface FormalVisitDecisionInput {
  /** The NPC from the active, server-persisted meeting. */
  npcId: string;
  /** Completed task IDs from the active, server-persisted meeting. */
  completedTasks: readonly ProjectOneVisitTask[];
  /** The server-persisted count before this dialogue turn. */
  turn: number;
  /** Current chat request text, passed only as untrusted decision context. */
  playerMessage: string;
  /** The generated NPC reply for this same turn. */
  npcReply: string;
}

export interface FormalVisitTurnDecision {
  completedTask: ProjectOneVisitTask | null;
  /** The player explicitly ended this conversation in their natural-language turn. */
  playerFarewell: boolean;
  /** True only when the evaluator confirms that the NPC must leave now. */
  npcLeft: boolean;
}

export interface FormalVisitDecisionDependencies {
  /** Injectable for deterministic tests; production uses the configured Jev provider. */
  jevInvoker?: JevInvoker;
}

const NO_VISIT_PROGRESS: FormalVisitTurnDecision = { completedTask: null, playerFarewell: false, npcLeft: false };

function isFivePersonId(value: string): value is ProjectOneFivePersonId {
  return Object.prototype.hasOwnProperty.call(PROJECT_ONE_FIVE_PERSON_NPCS, value);
}

function readChoice(response: Awaited<ReturnType<JevInvoker>>, key: string): string | undefined {
  const answer = response.answers[key];
  return answer?.type === 'choice' ? answer.choice : undefined;
}

/**
 * Decide formal-visit progress from server-owned meeting state and the actual
 * turn transcript. The browser never submits task IDs or exit flags. The
 * selected task is validated again against the NPC master record and the
 * unfinished task set before state.ts can persist it.
 */
export async function evaluateFormalVisitTurn(
  input: FormalVisitDecisionInput,
  dependencies: FormalVisitDecisionDependencies = {},
): Promise<FormalVisitTurnDecision> {
  if (!isFivePersonId(input.npcId)) throw new Error('NPC_UNKNOWN');
  const npc = PROJECT_ONE_FIVE_PERSON_NPCS[input.npcId];
  const allowedTasks: readonly ProjectOneVisitTask[] = npc.allowedTasks;
  const completed = new Set(input.completedTasks.filter((task) => allowedTasks.includes(task)));
  const remaining = allowedTasks.filter((task) => !completed.has(task));
  // An already-complete meeting must be closed by the state reducer, rather
  // than asking a model to invent another task or departure event.
  if (remaining.length === 0) return NO_VISIT_PROGRESS;

  const request: JevRequest = {
    state: serializeUntrustedPromptData('formal_visit_turn', {
      npc: {
        id: npc.id,
        name: npc.name,
        title: npc.title,
        personality: npc.personality,
        allowedTasks: [...allowedTasks],
      },
      meeting: { turn: Math.max(0, Math.floor(input.turn)), completedTasks: [...completed], remainingTasks: remaining },
      playerMessage: input.playerMessage,
      npcReply: input.npcReply,
    }, { maxStringLength: 2_000, maxTotalLength: 16_000 }),
    questions: {
      completedTask: {
        type: 'choice',
        criteria: Object.fromEntries([
          ['none', '本轮未完成拜访任务'],
          ...remaining.map((task) => [task, '本轮确实完成该剩余拜访任务']),
        ]),
        instructions: '仅根据本轮双方已说出的内容选择一个确实完成的剩余任务；没有完成选择 none。',
      },
      npcDialogueSignal: {
        type: 'choice',
        criteria: {
          continue: 'NPC 可以继续交流',
          farewell: 'NPC 礼貌收尾，但没有必须立即离场',
          forced_exit: 'NPC 在实际回复中明确表示因时间或事务必须立刻离场',
        },
        instructions: '只根据 NPC 实际回复判断。只有明确、即时的离场约束才选择 forced_exit。',
      },
      playerDialogueSignal: {
        type: 'choice',
        criteria: {
          continue: '玩家没有明确结束本次交流',
          farewell: '玩家在本轮明确告辞或结束交流',
        },
        instructions: '仅根据玩家本轮实际文本判断是否明确告辞；普通感谢、确认或下一步安排不等于告辞。',
      },
    },
  };

  try {
    const response = dependencies.jevInvoker
      ? await dependencies.jevInvoker(request)
      : await invokeConfiguredJev('preview_visit', request, invokeJev);
    const proposedTask = readChoice(response, 'completedTask');
    const completedTask = proposedTask && proposedTask !== 'none' && remaining.includes(proposedTask as ProjectOneVisitTask)
      ? proposedTask as ProjectOneVisitTask
      : null;
    return {
      completedTask,
      playerFarewell: readChoice(response, 'playerDialogueSignal') === 'farewell',
      npcLeft: readChoice(response, 'npcDialogueSignal') === 'forced_exit',
    };
  } catch {
    // Keep an unavailable decision service from fabricating visit progress.
    // The chat turn can still commit, while state.ts retains its hard limit.
    return NO_VISIT_PROGRESS;
  }
}
