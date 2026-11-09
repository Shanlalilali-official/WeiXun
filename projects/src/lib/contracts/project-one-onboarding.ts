import { z } from 'zod';

export const projectOneOnboardingIdSchema = z.string().min(1).max(120).regex(/^[a-z0-9_-]+$/);
const text = z.string().trim().min(1).max(2000);
const detailItem = z.object({ label: text, value: text });

export const projectOnePublicBriefSchema = z.object({
  id: projectOneOnboardingIdSchema,
  industryId: projectOneOnboardingIdSchema,
  businessId: projectOneOnboardingIdSchema,
  projectName: text,
  clientName: text,
  description: text,
  overview: text,
  goals: z.array(text).max(12),
  facts: z.array(detailItem.extend({ note: text })).max(12),
  details: z.array(z.object({ title: text, items: z.array(detailItem).max(20) })).max(12),
  people: z.array(z.object({
    id: z.enum(['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005']),
    name: text,
    title: text,
    photo: z.string().regex(/^\/assets\/people\/[a-z0-9-]+\.png$/),
  })).length(5).refine((people) => new Set(people.map((person) => person.id)).size === 5),
});

export const projectOneOnboardingSnapshotSchema = z.object({
  brief: projectOnePublicBriefSchema,
  dossier: z.object({ sections: z.array(z.object({
    title: text,
    items: z.array(detailItem.extend({ status: z.enum(['公开', '待沟通']) })).max(30),
  })).max(12) }),
});

export type ProjectOnePublicBrief = z.infer<typeof projectOnePublicBriefSchema>;
export type ProjectOneOnboardingSnapshot = z.infer<typeof projectOneOnboardingSnapshotSchema>;
