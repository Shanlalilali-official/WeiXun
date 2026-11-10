import {
  CustomerActivityDetectionError,
  detectCustomerActivityProposals,
  type CustomerActivityInvoker,
} from '@/lib/ai/customer-activities';
import { resolveRuntimeRulePrompt } from '@/lib/ai/runtime-rule-prompts';
import { activityRuntimeRulePrompts } from '@/lib/ai/runtime-rule-prompts-activity';
import type { CustomerActivityConversationMessage, CustomerActivityType } from '@/lib/game/customer-activities';

/** Check for an activity before an ordinary appointment can be committed. */
export async function classifyCurrentActivityForAppointment(
  npcId: string,
  current: CustomerActivityConversationMessage & { speaker: 'sales' },
  recent: CustomerActivityConversationMessage[],
  invoker?: CustomerActivityInvoker,
): Promise<CustomerActivityType | 'none' | 'unavailable'> {
  try {
    const proposals = await detectCustomerActivityProposals({
      conversationEnded: true,
      conversationId: `appointment-check:${current.messageId}`,
      npcId,
      messages: [...recent.slice(-8), current],
    }, { invoker });
    return proposals.find((proposal) => (proposal.initiator === 'sales'
      ? proposal.proposalMessageId : proposal.responseMessageId) === current.messageId)?.type ?? 'none';
  } catch (error) {
    if (!(error instanceof CustomerActivityDetectionError)) throw error;
    return 'unavailable';
  }
}

/** Gives the NPC a semantic rule on turns where no appointment precheck is needed. */
export const CUSTOMER_ACTIVITY_REPLY_GUIDANCE = activityRuntimeRulePrompts.customer_activity_routing_guidance.defaultText;

export async function resolveCustomerActivityReplyGuidance(): Promise<string> {
  return resolveRuntimeRulePrompt('customer_activity_routing_guidance');
}
