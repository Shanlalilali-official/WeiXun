import { z } from 'zod';

export const previewNpcIdSchema = z.enum(['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005']);
export type PreviewNpcId = z.infer<typeof previewNpcIdSchema>;

export const previewChannelSchema = z.enum(['email', 'wechat', 'work_phone']);
export const previewVisitTaskSchema = z.enum(['提问', '质疑', '挖坑']);
export const previewInvitationStatusSchema = z.enum(['none', 'accepted', 'rejected', 'later']);
export const previewEndReasonSchema = z.enum(['npc_task_completed', 'turn_limit', 'player_farewell']);
export const previewNodeSchema = z.enum(['N1', 'N2', 'N3', 'N4', 'BLOCKED']);
export const previewMessageResponseActionSchema = z.enum(['reply', 'read_no_reply']);
export const previewReadNoReplyReasonCodeSchema = z.enum([
  'natural_closure', 'no_new_value', 'repeated_follow_up', 'not_responsible', 'current_priority_low', 'unwilling_to_advance',
]);

const previewSessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, 'previewSessionId 格式无效').optional();
const commandIdSchema = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, 'commandId 格式无效');
const textSchema = z.string().trim().min(1).max(2_000);
const optionalAttachmentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(1_000),
}).strict().optional();
const commonRequestSchema = z.object({
  previewSessionId: previewSessionIdSchema,
  commandId: commandIdSchema,
  expectedVersion: z.number().int().min(0),
  phase: z.number().int().min(1).max(5).optional(),
}).strict();
const previewNpcTestAdjustmentSchema = z.object({
  npcId: previewNpcIdSchema,
  support: z.number().int().min(0).max(100),
  pleasantness: z.number().int().min(0).max(100),
  effectiveContactCount: z.number().int().min(0).max(100),
}).strict();
const previewNpcTestAdjustmentsSchema = z.array(previewNpcTestAdjustmentSchema).min(1).max(5).superRefine((items, context) => {
  const seen = new Set<PreviewNpcId>();
  items.forEach((item, index) => {
    if (seen.has(item.npcId)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'NPC 测试调节不能包含重复人物', path: [index, 'npcId'] });
    seen.add(item.npcId);
  });
});

export const previewAiRequestSchema = z.discriminatedUnion('action', [
  commonRequestSchema.extend({ action: z.literal('plan'), text: textSchema, npcId: previewNpcIdSchema.optional() }),
  commonRequestSchema.extend({ action: z.literal('message'), npcId: previewNpcIdSchema, text: textSchema, channel: previewChannelSchema, attachment: optionalAttachmentSchema }),
  commonRequestSchema.extend({ action: z.literal('wechat_request'), npcId: previewNpcIdSchema, text: textSchema }),
  commonRequestSchema.extend({ action: z.literal('phone_connect'), npcId: previewNpcIdSchema, text: textSchema }),
  commonRequestSchema.extend({ action: z.literal('visit_preparation'), npcId: previewNpcIdSchema, text: textSchema }),
  commonRequestSchema.extend({ action: z.literal('brief_visit'), npcId: previewNpcIdSchema, text: textSchema }),
  commonRequestSchema.extend({ action: z.literal('start_visit'), npcId: previewNpcIdSchema }),
  commonRequestSchema.extend({ action: z.literal('visit_turn'), npcId: previewNpcIdSchema, text: textSchema }),
  commonRequestSchema.extend({ action: z.literal('end_visit'), npcId: previewNpcIdSchema }),
  commonRequestSchema.extend({ action: z.literal('test_adjust_npcs'), adjustments: previewNpcTestAdjustmentsSchema }),
  commonRequestSchema.extend({ action: z.literal('reset') }),
]);
export type PreviewAiRequest = z.infer<typeof previewAiRequestSchema>;

const appointmentSchema = z.object({
  timeWindow: z.string().min(1).max(120),
  location: z.string().min(1).max(120),
  agenda: z.string().min(1).max(300),
});
const attachmentResultSchema = z.object({
  viewed: z.boolean(),
  impact: z.string().min(1).max(400),
});
const meetingStatusSchema = z.object({
  meetingEnded: z.boolean(),
  endReason: previewEndReasonSchema.optional(),
  turn: z.number().int().min(0),
  completedTasks: z.array(previewVisitTaskSchema),
});
const previewNpcTestStateSchema = z.object({
  npcId: previewNpcIdSchema,
  support: z.number().int().min(0).max(100),
  pleasantness: z.number().int().min(0).max(100),
  effectiveContactCount: z.number().int().min(0).max(100),
  node: previewNodeSchema,
});

export const previewAiResponseSchema = z.object({
  previewSessionId: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/),
  version: z.number().int().min(0),
  action: z.enum(['plan', 'message', 'wechat_request', 'phone_connect', 'visit_preparation', 'brief_visit', 'start_visit', 'visit_turn', 'end_visit', 'test_adjust_npcs', 'reset']),
  content: z.string().max(2_000).nullable().optional(),
  /** Message delivery state. The internal reason for a read-without-reply is never returned here. */
  responseAction: previewMessageResponseActionSchema.optional(),
  readStatus: z.literal('read').optional(),
  playerMessageId: z.string().uuid().optional(),
  needsDetail: z.boolean().optional(),
  matchedNpcIds: z.array(previewNpcIdSchema).max(5).optional(),
  disclosureKeys: z.array(previewNpcIdSchema).max(5).optional(),
  disclosed: z.array(z.object({ npcId: previewNpcIdSchema, facts: z.array(z.string().max(300)), clues: z.array(z.string().max(300)) })).optional(),
  recommendations: z.array(z.string().max(300)).max(5).optional(),
  invitationStatus: previewInvitationStatusSchema.optional(),
  appointment: appointmentSchema.optional(),
  attachment: attachmentResultSchema.optional(),
  wechatAccepted: z.boolean().optional(),
  strengths: z.array(z.string().max(300)).max(4).optional(),
  risks: z.array(z.string().max(300)).max(4).optional(),
  nextStep: z.string().max(300).optional(),
  meeting: meetingStatusSchema.optional(),
  npcTestStates: z.array(previewNpcTestStateSchema).max(5).optional(),
}).superRefine((value, context) => {
  if (value.action !== 'message') return;
  if (!value.responseAction) {
    if (value.readStatus !== undefined || value.playerMessageId !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, message: 'delivery fields require responseAction', path: ['responseAction'] });
    // `message` historically also accepts work_phone. That legacy path remains
    // reply-only and does not expose the asynchronous read receipt fields.
    return;
  }
  if (!value.playerMessageId) context.addIssue({ code: z.ZodIssueCode.custom, message: 'message playerMessageId is required', path: ['playerMessageId'] });
  if (value.responseAction === 'reply') {
    if (typeof value.content !== 'string' || value.content.trim().length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: 'reply content is required', path: ['content'] });
    if (value.readStatus !== 'read') context.addIssue({ code: z.ZodIssueCode.custom, message: 'reply readStatus must be read', path: ['readStatus'] });
    return;
  }
  if (value.content !== null) context.addIssue({ code: z.ZodIssueCode.custom, message: 'read_no_reply content must be null', path: ['content'] });
  if (value.readStatus !== 'read') context.addIssue({ code: z.ZodIssueCode.custom, message: 'read_no_reply readStatus must be read', path: ['readStatus'] });
  if (value.invitationStatus !== 'none') context.addIssue({ code: z.ZodIssueCode.custom, message: 'read_no_reply invitationStatus must be none', path: ['invitationStatus'] });
  if (value.appointment !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, message: 'read_no_reply cannot have appointment', path: ['appointment'] });
});
export type PreviewAiResponse = z.infer<typeof previewAiResponseSchema>;

export const planAiOutputSchema = z.object({
  needsDetail: z.boolean(),
  matchedNpcIds: z.array(previewNpcIdSchema).max(5),
  recommendations: z.array(z.string().min(1).max(300)).max(5),
});

/**
 * Internal-only output for WeChat and email. `reasonCode`/`reasonEvidence`
 * remain in server state for diagnostics and are deliberately absent from the
 * public response schema.
 */
export const messageAiOutputSchema = z.discriminatedUnion('responseAction', [
  z.object({
    responseAction: z.literal('reply'),
    content: z.string().trim().min(1).max(2_000),
    invitationStatus: previewInvitationStatusSchema,
    appointment: appointmentSchema.optional(),
  }).strict(),
  z.object({
    responseAction: z.literal('read_no_reply'),
    content: z.null(),
    invitationStatus: z.literal('none'),
    reasonCode: previewReadNoReplyReasonCodeSchema,
    reasonEvidence: z.string().trim().min(1).max(400),
  }).strict(),
]);

/** Phone keeps the original reply-only model contract. */
export const phoneMessageAiOutputSchema = z.object({
  content: z.string().min(1).max(2_000),
  invitationStatus: previewInvitationStatusSchema,
  appointment: appointmentSchema.optional(),
}).strict();

export const attachmentDecisionAiOutputSchema = attachmentResultSchema;

export const wechatAiOutputSchema = z.object({ content: z.string().min(1).max(2_000), accepted: z.boolean() });
export const briefVisitAiOutputSchema = z.object({
  content: z.string().min(1).max(2_000),
  strengths: z.array(z.string().min(1).max(300)).max(4),
  risks: z.array(z.string().min(1).max(300)).max(4),
  nextStep: z.string().min(1).max(300),
});
export const visitPreparationAiOutputSchema = z.object({
  needsDetail: z.boolean(),
  strengths: z.array(z.string().min(1).max(300)).max(4),
  risks: z.array(z.string().min(1).max(300)).max(4),
  nextStep: z.string().min(1).max(300),
});
export const visitTurnAiOutputSchema = z.object({
  content: z.string().min(1).max(2_000),
  completedTask: previewVisitTaskSchema.nullable(),
});

export const previewWorkingMemoryTypeSchema = z.enum([
  'fact', 'commitment', 'evidence', 'blocker', 'preference', 'relationship_event', 'other',
]);
export const previewWorkingMemoryStatusSchema = z.enum(['active', 'fulfilled', 'superseded', 'resolved']);
/** Blockers are server policy identifiers, never model-defined display text. */
export const previewBlockerIdSchema = z.enum(['compliance_redline']);
export type PreviewBlockerId = z.infer<typeof previewBlockerIdSchema>;
const previewDimensionDeltasSchema = z.object({
  decisionAnalysis: z.number().int().min(-3).max(3),
  relationshipBuilding: z.number().int().min(-3).max(3),
  valuePresentation: z.number().int().min(-3).max(3),
  objectionHandling: z.number().int().min(-3).max(3),
  informationDiscovery: z.number().int().min(-3).max(3),
});

/** Internal-only contract: never expose these evaluation fields to the player response. */
export const previewNpcEvaluationAiOutputSchema = z.object({
  pleasureDelta: z.number().int().min(-8).max(6),
  supportDelta: z.number().int().min(-5).max(4),
  dimensionDeltas: previewDimensionDeltasSchema,
  effectiveContact: z.boolean(),
  memoryUpdates: z.array(z.object({
    type: previewWorkingMemoryTypeSchema,
    summary: z.string().min(1).max(500),
    status: previewWorkingMemoryStatusSchema,
    tags: z.array(z.string().min(1).max(80)).max(8),
    mustMention: z.boolean().optional(),
  })).max(6),
  blockerUpdates: z.array(z.object({
    action: z.enum(['add', 'remove']),
    value: previewBlockerIdSchema,
  })).max(4),
});
