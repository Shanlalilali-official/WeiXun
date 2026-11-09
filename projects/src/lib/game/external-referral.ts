import { z } from 'zod';
import {
  isNaturalLanguageCustomerActivityInvitation,
  isNaturalLanguageInvitation,
} from '@/lib/game/invitation-intent';

const EXTERNAL_REFERRAL_HARD_BLOCKER_PATTERN = /(?:现金|回扣|返现|私下利益|利益交换|保证中标|内定中标|陪标|围标|规避(?:招采|采购|流程))/i;
const ORDINARY_VISIT_SIGNAL = /拜访|登门|到访|上门|见面|会面|碰面|当面|约见|\bmeet\b|\bvisit\b/i;

/** An unnamed, out-of-game referral that introduces the player to Wang Defu. */
export const externalReferralSchema = z.object({
  id: z.string().min(1).max(180),
  targetNpcId: z.literal('P1-003'),
  sourceKind: z.literal('external'),
  status: z.literal('granted'),
  grantedAt: z.number().int().nonnegative(),
  chargedActionPoints: z.number().int().nonnegative().default(0),
}).strict();

export type ExternalReferral = z.infer<typeof externalReferralSchema>;
export type ExternalReferralMap = Partial<Record<'P1-003', ExternalReferral>>;

export function readExternalReferrals(value: unknown): ExternalReferralMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = (value as Record<string, unknown>)['P1-003'];
  const parsed = externalReferralSchema.safeParse(record);
  return parsed.success ? { 'P1-003': parsed.data } : {};
}

export function hasExternalReferral(value: unknown, npcId: string): boolean {
  return npcId === 'P1-003' && Boolean(readExternalReferrals(value)['P1-003']);
}

/** Shared eligibility for the deterministic ordinary-visit path in both clients. */
export function canUseExternalReferralForInvitation(
  referrals: unknown,
  npcId: string,
  text: string,
): boolean {
  if (!hasExternalReferral(referrals, npcId)
    || !isNaturalLanguageInvitation(text)
    || isNaturalLanguageCustomerActivityInvitation(text)
    || EXTERNAL_REFERRAL_HARD_BLOCKER_PATTERN.test(text)) return false;

  const normalized = text.replace(/\s+/g, '');
  if (!ORDINARY_VISIT_SIGNAL.test(text)) return false;

  const historicalReference = /(?:昨天|前天|上周|上次|此前|之前|刚才|已经|已完成|过去|曾经).{0,12}(?:邀请|邀约|拜访|登门|到访|上门|见面|会面|碰面)|(?:邀请|邀约|拜访|登门|到访|上门|见面|会面|碰面).{0,12}(?:记录|留档|纪要|回执|已发送|已发出|已完成)|\b(?:yesterday|last\s+(?:week|month|time)|previously|earlier).{0,24}\b(?:meet|meeting|visit|invitation)\b/i;
  if (historicalReference.test(normalized)) return false;

  const cancellationText = normalized.replace(/(?:方便不方便|方不方便)/gu, '');
  const cancellationOrRefusal = /(?:取消|撤回|撤销|作废|不再|先不|暂不|暂缓|不想|不愿|不要|别再|不接受|拒绝|不用|无需|不必|改用|改成|不方便).{0,16}(?:邀约|邀请|见面|拜访|登门|到访|上门|会面|碰面|当面|安排|约|行程|邮件|线上|电话)|(?:邀约|邀请|见面|拜访|登门|到访|上门|会面|碰面|当面|安排|约|行程).{0,16}(?:取消|撤回|撤销|作废|不再|先不|暂不|暂缓|不想|不愿|不要|别再|不接受|拒绝|不用|无需|不必|改用|改成)/u;
  const englishCancellation = /\b(?:do\s+not|don't|cannot|can't|won't|wouldn't|shouldn't|no\s+need\s+to|cancel|withdraw|stop)\b.{0,40}\b(?:meet|visit)\b/i;
  return !cancellationOrRefusal.test(cancellationText) && !englishCancellation.test(text);
}

export function canUseExternalReferralForWechat(
  referrals: unknown,
  npcId: string,
  text: string,
): boolean {
  return hasExternalReferral(referrals, npcId)
    && !EXTERNAL_REFERRAL_HARD_BLOCKER_PATTERN.test(text);
}

export function grantExternalReferral(
  value: unknown,
  npcId: string,
  commandId: string,
  now: number,
): ExternalReferralMap {
  if (npcId !== 'P1-003') throw new Error('EXTERNAL_REFERRAL_UNAVAILABLE');
  const existing = readExternalReferrals(value);
  if (existing['P1-003']) return existing;
  const record = externalReferralSchema.parse({
    id: `external-referral:${commandId}`,
    targetNpcId: 'P1-003',
    sourceKind: 'external',
    status: 'granted',
    grantedAt: now,
  });
  return { 'P1-003': record };
}

/** Add an already-authoritatively-charged AP amount to the grant ledger. */
export function chargeExternalReferral(
  value: unknown,
  npcId: string,
  points: number,
): ExternalReferralMap {
  if (npcId !== 'P1-003') throw new Error('EXTERNAL_REFERRAL_UNAVAILABLE');
  if (!Number.isSafeInteger(points) || points < 0) throw new Error('EXTERNAL_REFERRAL_CHARGE_INVALID');
  const existing = readExternalReferrals(value)['P1-003'];
  if (!existing) throw new Error('EXTERNAL_REFERRAL_NOT_GRANTED');
  if (points === 0) return { 'P1-003': existing };
  const chargedActionPoints = existing.chargedActionPoints + points;
  if (!Number.isSafeInteger(chargedActionPoints)) throw new Error('EXTERNAL_REFERRAL_CHARGE_INVALID');
  return {
    'P1-003': externalReferralSchema.parse({ ...existing, chargedActionPoints }),
  };
}
