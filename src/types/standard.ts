import { z } from 'zod';

export const StandardSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  url: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  lastUpdated: z.date().optional(),
  sourceOrg: z.string().optional(),
  tags: z.array(z.string()).default([]),
  complianceLevel: z.enum(['mandatory', 'recommended', 'optional']).optional(),
  relatedStandards: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export type Standard = z.infer<typeof StandardSchema>;

export const CategorySchema = z.object({
  name: z.string(),
  count: z.number(),
  description: z.string().optional()
});

export type Category = z.infer<typeof CategorySchema>;

export const SearchResultSchema = z.object({
  standard: StandardSchema,
  relevanceScore: z.number(),
  matchedFields: z.array(z.string())
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const ComplianceCheckSchema = z.object({
  serviceDescription: z.string(),
  relevantStandards: z.array(StandardSchema),
  complianceChecklist: z.array(z.object({
    standard: z.string(),
    requirement: z.string(),
    status: z.enum(['compliant', 'non-compliant', 'unknown']),
    notes: z.string().optional()
  }))
});

export type ComplianceCheck = z.infer<typeof ComplianceCheckSchema>;

export const ScrapedPageSchema = z.object({
  url: z.string(),
  title: z.string(),
  content: z.string(),
  lastModified: z.date().optional(),
  category: z.string(),
  sourceOrg: z.string().optional(),
  links: z.array(z.string()).default([])
});

export type ScrapedPage = z.infer<typeof ScrapedPageSchema>;