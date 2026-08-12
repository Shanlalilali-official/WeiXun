import { z } from 'zod';

export const chatHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export const npcChatRequestSchema = z.object({
  gameSessionId: z.string().trim().min(1).max(128),
  scenarioId: z.string().trim().min(1).max(128),
  npcId: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(4000),
});

export const npcTurnEvaluationSchema = z.object({
  affinityDelta: z.number().int().min(-8).max(8),
  affinityReason: z.string().trim().min(1).max(120),
  dimensionDeltas: z.object({
    decisionAnalysis: z.number().int().min(-3).max(3),
    relationshipBuilding: z.number().int().min(-3).max(3),
    valuePresentation: z.number().int().min(-3).max(3),
    objectionHandling: z.number().int().min(-3).max(3),
    informationDiscovery: z.number().int().min(-3).max(3),
  }),
  cluesUnlocked: z.array(z.enum([
    'decision_process',
    'performance_goal',
    'procurement_priority',
    'personal_interest',
  ])).max(2),
  confirmedFacts: z.array(z.string().trim().min(1).max(160)).max(2).default([]),
  commitments: z.array(z.string().trim().min(1).max(160)).max(2).default([]),
  handoff: z.object({
    targetNpcId: z.enum([
      'p1-frontline-wang-hao',
      'p1-procurement-liu-kai',
      'p1-minister-chen-jianguo',
      'p1-deputy-zhao-feng',
    ]),
    summary: z.string().trim().min(1).max(180),
  }).nullable().default(null),
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
