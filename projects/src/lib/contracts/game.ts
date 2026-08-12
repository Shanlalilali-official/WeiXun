import { z } from 'zod';

export const createGameSessionRequestSchema = z.object({
  scenarioCode: z.literal('project-1'),
});

export const relationshipActionRequestSchema = z.object({
  npcId: z.string().trim().min(1).max(128),
  actionId: z.enum(['gift', 'dinner', 'tea', 'festival', 'roadshow', 'visit', 'sample', 'video']),
});

export const replenishActionPointsRequestSchema = z.object({
  amount: z.number().int().min(1).max(999),
});

export const gameReviewSchema = z.object({
  strengths: z.array(z.string().trim().min(1).max(300)).min(1).max(3),
  improvements: z.array(z.string().trim().min(1).max(300)).min(1).max(3),
  nextActions: z.array(z.string().trim().min(1).max(300)).min(1).max(3),
});

export type GameReview = z.infer<typeof gameReviewSchema>;
