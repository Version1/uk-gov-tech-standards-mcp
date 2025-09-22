import { z } from 'zod';

export const SearchToolArgsSchema = z.object({
  query: z.string().describe('Search query for UK government standards'),
  category: z.string().optional().describe('Filter by category (e.g., APIs, Security, Cloud)'),
  organisation: z.string().optional().describe('Filter by source organisation (e.g., GDS, NCSC)')
});

export type SearchToolArgs = z.infer<typeof SearchToolArgsSchema>;

export const GetStandardArgsSchema = z.object({
  standardId: z.string().describe('Unique identifier of the standard to retrieve')
});

export type GetStandardArgs = z.infer<typeof GetStandardArgsSchema>;

export const RecentUpdatesArgsSchema = z.object({
  daysBack: z.number().default(30).describe('Number of days to look back for updates')
});

export type RecentUpdatesArgs = z.infer<typeof RecentUpdatesArgsSchema>;

export const CheckComplianceArgsSchema = z.object({
  serviceDescription: z.string().describe('Description of the digital service to check compliance for')
});

export type CheckComplianceArgs = z.infer<typeof CheckComplianceArgsSchema>;

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}