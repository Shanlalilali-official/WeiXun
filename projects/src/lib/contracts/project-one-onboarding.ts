import { z } from 'zod';

export const projectOneOnboardingIdSchema = z.string().min(1).max(120).regex(/^[a-z0-9_-]+$/);
const text = z.string().trim().min(1).max(2000);
const detailItem = z.object({ label: text, value: text });
const customLabel = z.string().trim().min(1).max(80).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), '自定义内容不能包含控制字符');

export const projectOneOnboardingSelectionSchema = z.object({
  industryId: projectOneOnboardingIdSchema,
  businessId: projectOneOnboardingIdSchema,
  customIndustry: customLabel.optional(),
  customBusiness: customLabel.optional(),
}).strict().superRefine((selection, context) => {
  if (selection.industryId === 'custom' && !selection.customIndustry) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customIndustry'], message: '请填写客户行业' });
  }
  if (selection.industryId !== 'custom' && selection.customIndustry !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customIndustry'], message: '预设行业不能同时提交自定义行业' });
  }
  if (selection.businessId === 'custom' && !selection.customBusiness) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customBusiness'], message: '请填写主营业务' });
  }
  if (selection.businessId !== 'custom' && selection.customBusiness !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customBusiness'], message: '预设业务不能同时提交自定义业务' });
  }
});

export const projectOnePublicBriefSchema = z.object({
  id: projectOneOnboardingIdSchema,
  industryId: projectOneOnboardingIdSchema,
  businessId: projectOneOnboardingIdSchema,
  industryLabel: customLabel.optional(),
  businessLabel: customLabel.optional(),
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
  selection: projectOneOnboardingSelectionSchema.optional(),
  dossier: z.object({ sections: z.array(z.object({
    title: text,
    items: z.array(detailItem.extend({ status: z.enum(['公开', '待沟通']) })).max(30),
  })).max(12) }),
});

export type ProjectOnePublicBrief = z.infer<typeof projectOnePublicBriefSchema>;
export type ProjectOneOnboardingSnapshot = z.infer<typeof projectOneOnboardingSnapshotSchema>;
export type ProjectOneOnboardingSelection = z.infer<typeof projectOneOnboardingSelectionSchema>;
