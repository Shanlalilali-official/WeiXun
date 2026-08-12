export const FAST_ACCEPTANCE_ACCOUNT = {
  username: 'fast_acceptance',
  password: 'fastpass',
  multiplier: 3,
} as const;

export function getProgressionMultiplier(userId: string): number {
  return userId === `u_${FAST_ACCEPTANCE_ACCOUNT.username}`
    ? FAST_ACCEPTANCE_ACCOUNT.multiplier
    : 1;
}
