import { z } from 'zod';

export const chatHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export const npcChatRequestSchema = z.object({
  gameSessionId: z.string().trim().min(1).max(128),
  scenarioId: z.string().trim().min(1).max(128),
  npcId: z.union([z.string().trim().min(1).max(128), z.number().int().positive()]),
  history: z.array(chatHistoryMessageSchema).min(1).max(40),
});

export const npcTurnEvaluationSchema = z.object({
  scoreDelta: z.number().int().min(-5).max(5),
  affinityDelta: z.number().int().min(-8).max(8),
  cluesUnlocked: z.array(z.string().trim().min(1).max(80)).max(3),
  emotion: z.enum(['greeting', 'thinking', 'excited', 'annoyed']),
});

export const scenarioGenerateRequestSchema = z.object({
  industry: z.string().trim().min(1).max(80),
  productCategory: z.string().trim().min(1).max(120),
  customRequirement: z.string().trim().max(1000).optional(),
});

export const generatedScenarioSchema = z.object({
  scenarioName: z.string().trim().min(1).max(80),
  clientName: z.string().trim().min(1).max(120),
  decisionMaker: z.object({
    name: z.string().trim().min(1).max(40),
    role: z.string().trim().min(1).max(80),
    personality: z.string().trim().min(1).max(80),
    background: z.string().trim().min(1).max(500),
    decisionCycle: z.string().trim().min(1).max(80),
  }),
  budget: z.number().positive().max(100000),
  deliveryPeriod: z.string().trim().min(1).max(80),
  techChallenges: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  clientNeeds: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  bottomLine: z.string().trim().min(1).max(500),
  competitors: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    strength: z.string().trim().min(1).max(300),
  })).min(1).max(6),
  difficulty: z.number().int().min(1).max(5),
  estimatedProfitMargin: z.string().trim().min(1).max(40),
  estimatedWinRate: z.string().trim().min(1).max(40),
});

export type NpcChatRequest = z.infer<typeof npcChatRequestSchema>;
export type NpcTurnEvaluation = z.infer<typeof npcTurnEvaluationSchema>;
export type GeneratedScenario = z.infer<typeof generatedScenarioSchema>;
