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
  commandId: z.string().trim().min(8).max(128),
  expectedVersion: z.number().int().min(1),
  intent: z.enum(['outreach', 'message', 'request_online', 'call_connect']).default('message'),
  channel: z.enum(['email', 'work_phone', 'online', 'offline']).optional(),
  contextType: z.enum(['online', 'short_visit', 'formal_visit', 'informal_visit']).optional(),
  appointmentId: z.string().trim().min(1).max(128).optional(),
  usedPreparationIds: z.array(z.string().trim().min(1).max(128)).max(12).default([]),
  workTopicOpenedBy: z.enum(['none', 'player', 'npc']).optional(),
});

export const onlineContactDecisionSchema = z.object({
  accepted: z.boolean(),
  response: z.string().trim().min(1).max(160),
});

export const npcSemanticFlagsSchema = z.object({
  negativeInformation: z.boolean(),
  negativeInformationType: z.enum([
    'none',
    'sourced_risk',
    'generalized_pessimism',
    'unsupported_rumor',
    'insult_or_attack',
  ]),
  riskyConduct: z.boolean(),
  giftMentioned: z.boolean(),
  explicitQuidProQuo: z.boolean(),
  repeatedPressure: z.boolean(),
});

export const giftAssessmentSchema = z.object({
  giftType: z.enum(['none', 'compliant', 'boundary']),
  outcome: z.enum([
    'not_applicable',
    'accepted',
    'accepted_cautiously',
    'politely_refused',
    'firmly_refused',
    'refused_and_reported',
    'accepted_then_exposed',
  ]),
  riskLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  riskReason: z.string().trim().max(160),
});

export const giftCommandDecisionSchema = z.object({
  disposition: z.enum([
    'delighted_acceptance',
    'cautious_acceptance',
    'polite_decline',
    'firm_rejection',
    'reported',
  ]),
  pleasureDelta: z.number().int().min(-12).max(12),
  supportDelta: z.number().int().min(-10).max(7),
  severity: z.number().int().min(1).max(5),
  reason: z.string().trim().min(1).max(160),
  riskReason: z.string().trim().min(1).max(200),
  npcResponse: z.string().trim().min(1).max(160),
});

export const npcTurnEvaluationSchema = z.object({
  // Legacy compatibility: until all game-state consumers migrate, affinityDelta
  // mirrors supportDelta. New evaluators must return both fields.
  affinityDelta: z.number().int().min(-10).max(10),
  affinityReason: z.string().trim().min(1).max(120),
  pleasureDelta: z.number().int().min(-12).max(12).optional(),
  supportDelta: z.number().int().min(-10).max(10).optional(),
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
  publicValueEvidence: z.array(z.string().trim().min(1).max(180)).max(3).optional(),
  personalBenefitEvidence: z.array(z.string().trim().min(1).max(180)).max(3).optional(),
  workTopicOpenedBy: z.enum(['none', 'player', 'npc']).optional(),
  semanticFlags: npcSemanticFlagsSchema.optional(),
  giftAssessment: giftAssessmentSchema.optional(),
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
export type NpcSemanticFlags = z.infer<typeof npcSemanticFlagsSchema>;
export type GiftAssessment = z.infer<typeof giftAssessmentSchema>;
export type GiftCommandDecision = z.infer<typeof giftCommandDecisionSchema>;
export type NpcTurnEvaluation = z.infer<typeof npcTurnEvaluationSchema>;
export type OnlineContactDecision = z.infer<typeof onlineContactDecisionSchema>;
export type GeneratedScenario = z.infer<typeof generatedScenarioSchema>;
