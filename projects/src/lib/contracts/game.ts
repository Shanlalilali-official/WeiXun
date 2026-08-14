import { z } from 'zod';

export const createGameSessionRequestSchema = z.object({
  scenarioCode: z.literal('project-1'),
});

export const relationshipActionRequestSchema = z.object({
  npcId: z.string().trim().min(1).max(128),
  actionId: z.enum(['gift', 'dinner', 'tea', 'festival', 'roadshow', 'visit', 'sample', 'video']),
});

export const timerControlRequestSchema = z.object({
  action: z.enum(['pause', 'resume']),
});

export const endMeetingRequestSchema = z.object({
  reason: z.enum(['player']).default('player'),
});

export const replenishActionPointsRequestSchema = z.object({
  amount: z.number().int().min(1).max(999),
});

const commandBaseSchema = {
  commandId: z.string().trim().min(1).max(128),
  expectedVersion: z.number().int().nonnegative(),
};

const npcIdSchema = z.string().trim().min(1).max(128);
const entityIdSchema = z.string().trim().min(1).max(160);
const textSchema = z.string().trim().min(1).max(1000);
const emptyPayloadSchema = z.object({}).default({});

export const contactGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('contact'),
  payload: z.object({
    npcId: npcIdSchema,
    channel: z.enum(['email', 'work_phone', 'online']),
  }),
});

export const inviteGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('invite'),
  payload: z.object({
    npcId: npcIdSchema,
    channel: z.enum(['email', 'work_phone', 'online']).default('online'),
    invitationMethod: z.enum(['dedicated', 'drop_in']),
    visitType: z.enum(['short', 'formal', 'informal']),
    venue: z.string().trim().min(1).max(120),
    purpose: textSchema,
    scheduledRound: z.number().int().min(1).max(5),
    startMinute: z.number().int().min(9 * 60).max(22 * 60),
  }),
});

export const prepareGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('prepare'),
  payload: z.object({
    npcId: npcIdSchema,
    appointmentId: entityIdSchema.nullable().optional(),
    preparationType: z.enum(['agenda', 'ppt', 'materials', 'courtesy_gift', 'boundary_gift']),
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().max(2000).default(''),
  }),
});

export const startVisitGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('start_visit'),
  payload: z.object({
    appointmentId: entityIdSchema,
    preparationIds: z.array(entityIdSchema).max(12).default([]),
  }),
});

export const endVisitGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('end_visit'),
  payload: z.object({
    appointmentId: entityIdSchema.optional(),
    meetingId: entityIdSchema.optional(),
    reason: z.enum(['completed', 'player', 'npc_left']).default('completed'),
    summary: z.string().trim().max(2000).default(''),
  }),
});

export const giveGiftGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('give_gift'),
  payload: z.object({
    preparationId: entityIdSchema,
    appointmentId: entityIdSchema.optional(),
    setting: z.enum(['public', 'private']).default('public'),
    witnesses: z.array(npcIdSchema).max(8).default([]),
    exchangeRequested: z.boolean().default(false),
  }),
});

export const followUpGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('follow_up'),
  payload: z.union([
    z.object({
      action: z.literal('deliver_preparation'),
      npcId: npcIdSchema,
      appointmentId: entityIdSchema.optional(),
      preparationId: entityIdSchema,
    }),
    z.object({
      action: z.literal('message').default('message'),
      npcId: npcIdSchema,
      appointmentId: entityIdSchema.optional(),
      channel: z.enum(['email', 'work_phone', 'online']),
      content: textSchema,
      preparationIds: z.array(entityIdSchema).max(8).default([]),
    }),
  ]),
});

export const updateAppointmentGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('update_appointment'),
  payload: z.object({
    appointmentId: entityIdSchema,
    action: z.enum(['accept_counter', 'cancel']),
  }),
});

export const waitGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('wait'),
  payload: z.object({ minutes: z.number().int().min(5).max(13 * 60) }),
});

export const advancePhaseGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('advance_phase'),
  payload: emptyPayloadSchema,
});

export const submitGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('submit'),
  payload: emptyPayloadSchema,
});

export const markNotificationReadGameCommandSchema = z.object({
  ...commandBaseSchema,
  type: z.literal('mark_notification_read'),
  payload: z.object({ notificationId: entityIdSchema }),
});

/** Versioned deterministic commands used by the unified game command API. */
export const gameCommandSchema = z.discriminatedUnion('type', [
  contactGameCommandSchema,
  inviteGameCommandSchema,
  updateAppointmentGameCommandSchema,
  prepareGameCommandSchema,
  startVisitGameCommandSchema,
  endVisitGameCommandSchema,
  giveGiftGameCommandSchema,
  followUpGameCommandSchema,
  waitGameCommandSchema,
  advancePhaseGameCommandSchema,
  submitGameCommandSchema,
  markNotificationReadGameCommandSchema,
]);

export type GameCommand = z.infer<typeof gameCommandSchema>;

export const gameReviewSchema = z.object({
  strengths: z.array(z.string().trim().min(1).max(300)).min(1).max(3),
  improvements: z.array(z.string().trim().min(1).max(300)).min(1).max(3),
  nextActions: z.array(z.string().trim().min(1).max(300)).min(1).max(3),
});

export type GameReview = z.infer<typeof gameReviewSchema>;
