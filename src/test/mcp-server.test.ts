import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UKGovStandardsMCPServer } from '../mcp/server.js';
import { DatabaseManager } from '../database/manager.js';
import { Standard } from '../types/standard.js';

// Mock the DatabaseManager
vi.mock('../database/manager.js');

describe('UKGovStandardsMCPServer', () => {
  let server: UKGovStandardsMCPServer;
  let mockDb: vi.Mocked<DatabaseManager>;

  const mockStandards: Standard[] = [
    {
      id: 'api-security-1',
      title: 'API Security Guidelines',
      category: 'APIs',
      url: 'https://www.gov.uk/api-security',
      content: 'Comprehensive security guidelines for government APIs including OAuth 2.0 implementation. APIs must implement HTTPS encryption and should use proper authentication mechanisms.',
      summary: 'Security guidelines for APIs',
      sourceOrg: 'GDS',
      tags: ['api', 'security', 'oauth'],
      complianceLevel: 'mandatory',
      relatedStandards: ['oauth-standard-1'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-03-01')
    },
    {
      id: 'wcag-accessibility-1',
      title: 'WCAG 2.1 Accessibility Requirements',
      category: 'Accessibility',
      url: 'https://www.gov.uk/wcag-requirements',
      content: 'Requirements for meeting WCAG 2.1 Level AA accessibility standards in government services. Services must provide alternative text for images.',
      summary: 'WCAG accessibility requirements',
      sourceOrg: 'GDS',
      tags: ['accessibility', 'wcag', 'compliance'],
      complianceLevel: 'mandatory',
      relatedStandards: [],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-02-15')
    }
  ];

  beforeEach(() => {
    mockDb = {
      initialize: vi.fn(),
      searchStandards: vi.fn(),
      hybridSearch: vi.fn(),
      getStandard: vi.fn(),
      getCategories: vi.fn(),
      getRecentUpdates: vi.fn(),
      getAllStandards: vi.fn(),
      insertStandard: vi.fn(),
      logScraping: vi.fn(),
      close: vi.fn()
    } as any;

    server = new UKGovStandardsMCPServer(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Search Tool', () => {
    it('should handle search_uk_gov_standards tool call', async () => {
      const searchResults = [
        {
          standard: mockStandards[0],
          relevanceScore: 8.5,
          matchedFields: ['title', 'content', 'tags']
        }
      ];

      mockDb.hybridSearch.mockResolvedValue(searchResults);

      const result = await server['handleSearchStandards']({
        query: 'API security OAuth',
        category: 'APIs',
        organisation: 'GDS'
      });

      expect(mockDb.hybridSearch).toHaveBeenCalledWith('API security OAuth', 'APIs', 'GDS', {
        semanticWeight: 0.6,
        semanticThreshold: 0.25,
        maxResults: 20
      });
      expect(result.content[0].text).toContain('API Security Guidelines');
      expect(result.content[0].text).toContain('relevanceScore');
    });

    it('should handle search without filters', async () => {
      mockDb.hybridSearch.mockResolvedValue([]);

      const result = await server['handleSearchStandards']({
        query: 'accessibility'
      });

      expect(mockDb.hybridSearch).toHaveBeenCalledWith('accessibility', undefined, undefined, {
        semanticWeight: 0.6,
        semanticThreshold: 0.25,
        maxResults: 20
      });
      expect(result.content[0].text).toContain('"totalResults": 0');
    });
  });

  describe('Get Standard Tool', () => {
    it('should handle get_standard_by_id tool call', async () => {
      mockDb.getStandard.mockResolvedValue(mockStandards[0]);

      const result = await server['handleGetStandard']({
        standardId: 'api-security-1'
      });

      expect(mockDb.getStandard).toHaveBeenCalledWith('api-security-1');
      
      const response = JSON.parse(result.content[0].text);
      expect(response.id).toBe('api-security-1');
      expect(response.title).toBe('API Security Guidelines');
    });

    it('should handle non-existent standard', async () => {
      mockDb.getStandard.mockResolvedValue(null);

      const result = await server['handleGetStandard']({
        standardId: 'non-existent'
      });

      expect(result.content[0].text).toBe("Standard with ID 'non-existent' not found");
    });
  });

  describe('Categories Tool', () => {
    it('should handle list_categories tool call', async () => {
      const categories = [
        { name: 'APIs', count: 25 },
        { name: 'Accessibility', count: 18 },
        { name: 'Security & Cyber Security', count: 32 }
      ];

      mockDb.getCategories.mockResolvedValue(categories);

      const result = await server['handleListCategories']();

      expect(mockDb.getCategories).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.totalCategories).toBe(3);
      expect(response.categories).toEqual(categories);
    });
  });

  describe('Recent Updates Tool', () => {
    it('should handle get_recent_updates tool call', async () => {
      mockDb.getRecentUpdates.mockResolvedValue([mockStandards[1]]);

      const result = await server['handleGetRecentUpdates']({
        daysBack: 30
      });

      expect(mockDb.getRecentUpdates).toHaveBeenCalledWith(30);
      
      const response = JSON.parse(result.content[0].text);
      expect(response.daysBack).toBe(30);
      expect(response.totalUpdates).toBe(1);
      expect(response.updates[0].id).toBe('wcag-accessibility-1');
    });

    it('should use default days back when not specified', async () => {
      mockDb.getRecentUpdates.mockResolvedValue([]);

      const result = await server['handleGetRecentUpdates']({});

      expect(mockDb.getRecentUpdates).toHaveBeenCalledWith(30);
      
      const response = JSON.parse(result.content[0].text);
      expect(response.daysBack).toBe(30);
    });
  });

  describe('Compliance Check Tool', () => {
    beforeEach(() => {
      mockDb.getAllStandards.mockResolvedValue(mockStandards);
    });

    it('should handle check_compliance tool call', async () => {
      const serviceDescription = 'A web application for citizens to apply for benefits with identity verification';

      const result = await server['handleCheckCompliance']({
        serviceDescription
      });

      expect(mockDb.getAllStandards).toHaveBeenCalled();
      
      const response = JSON.parse(result.content[0].text);
      expect(response.serviceDescription).toBe(serviceDescription);
      expect(response.relevantStandards).toBeDefined();
      expect(response.complianceChecklist).toBeDefined();
    });

    it('should find relevant standards for API service', async () => {
      const serviceDescription = 'REST API service with OAuth authentication for government data';

      const result = await server['handleCheckCompliance']({
        serviceDescription
      });

      const response = JSON.parse(result.content[0].text);
      const relevantTitles = response.relevantStandards.map((s: any) => s.title);
      
      expect(relevantTitles).toContain('API Security Guidelines');
    });

    it('should find relevant standards for accessible web service', async () => {
      const serviceDescription = 'Public-facing website that needs to be accessible to users with disabilities';

      const result = await server['handleCheckCompliance']({
        serviceDescription
      });

      const response = JSON.parse(result.content[0].text);
      const relevantTitles = response.relevantStandards.map((s: any) => s.title);
      
      expect(relevantTitles).toContain('WCAG 2.1 Accessibility Requirements');
    });

    it('should generate compliance checklist items', async () => {
      // Make sure getAllStandards returns our mock standards
      mockDb.getAllStandards.mockResolvedValue(mockStandards);
      
      const serviceDescription = 'Government API with security requirements';

      const result = await server['handleCheckCompliance']({
        serviceDescription
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.complianceChecklist.length).toBeGreaterThan(0);
      
      const firstItem = response.complianceChecklist[0];
      expect(firstItem).toHaveProperty('standard');
      expect(firstItem).toHaveProperty('requirement');
      expect(firstItem).toHaveProperty('status');
      expect(firstItem).toHaveProperty('notes');
      expect(firstItem.status).toBe('unknown');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.hybridSearch.mockRejectedValue(new Error('Database connection failed'));

      // Since we're calling the private method directly, it should throw the error
      await expect(server['handleSearchStandards']({
        query: 'test query'
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid tool parameters', async () => {
      // Test with invalid parameters that pass initial validation but cause database errors
      mockDb.getStandard.mockRejectedValue(new Error('Invalid standard ID format'));
      
      // Since we're calling the private method directly, it should throw the error
      await expect(server['handleGetStandard']({
        standardId: 'invalid-id-format-123'
      })).rejects.toThrow('Invalid standard ID format');
    });
  });

  describe('Helper Functions', () => {
    describe('findRelevantStandards', () => {
      beforeEach(() => {
        mockDb.getAllStandards.mockResolvedValue(mockStandards);
      });

      it('should identify relevant standards by keywords', async () => {
        const description = 'API service with OAuth security';
        const relevant = await server['findRelevantStandards'](description, mockStandards);

        expect(relevant.length).toBeGreaterThan(0);
        expect(relevant.map(s => s.id)).toContain('api-security-1');
      });

      it('should prioritize mandatory standards', async () => {
        const description = 'government web service';
        const relevant = await server['findRelevantStandards'](description, mockStandards);

        // Both standards are mandatory, but should prioritize based on relevance
        expect(relevant.length).toBeGreaterThan(0);
      });

      it('should limit number of relevant standards', async () => {
        const manyStandards = Array.from({ length: 20 }, (_, i) => ({
          ...mockStandards[0],
          id: `standard-${i}`,
          title: `Standard ${i}`
        }));

        const relevant = await server['findRelevantStandards']('api security', manyStandards);
        expect(relevant.length).toBeLessThanOrEqual(15);
      });
    });

    describe('extractServiceKeywords', () => {
      it('should extract meaningful keywords from service description', () => {
        const description = 'A REST API service for citizen data with OAuth authentication';
        const keywords = server['extractServiceKeywords'](description.toLowerCase());

        expect(keywords).toContain('rest');
        expect(keywords).toContain('api');
        expect(keywords).toContain('service');
        expect(keywords).toContain('citizen');
        expect(keywords).toContain('data');
        expect(keywords).toContain('oauth');
        expect(keywords).toContain('authentication');
        
        // Should not include common stop words
        expect(keywords).not.toContain('the');
        expect(keywords).not.toContain('and');
        expect(keywords).not.toContain('for');
      });
    });

    describe('isCategoryRelevant', () => {
      it('should identify relevant categories for API services', () => {
        const description = 'rest api with oauth authentication';
        const isRelevant = server['isCategoryRelevant']('APIs', description);
        expect(isRelevant).toBe(true);
      });

      it('should identify relevant categories for security services', () => {
        const description = 'secure application with encryption';
        const isRelevant = server['isCategoryRelevant']('Security & Cyber Security', description);
        expect(isRelevant).toBe(true);
      });

      it('should identify relevant categories for accessible services', () => {
        const description = 'public website accessible to users with disabilities';
        const isRelevant = server['isCategoryRelevant']('Accessibility', description);
        expect(isRelevant).toBe(true);
      });

      it('should not identify irrelevant categories', () => {
        const description = 'simple data processing script';
        const isRelevant = server['isCategoryRelevant']('Accessibility', description);
        expect(isRelevant).toBe(false);
      });
    });

    describe('extractRequirements', () => {
      it('should extract requirement statements from content', () => {
        const standard = {
          ...mockStandards[0],
          content: 'Services must implement HTTPS encryption. APIs should use OAuth 2.0 for authentication. Applications are required to log security events.'
        };

        const requirements = server['extractRequirements'](standard);

        expect(requirements.length).toBeGreaterThan(0);
        expect(requirements.some(req => req.includes('must implement HTTPS'))).toBe(true);
        expect(requirements.some(req => req.includes('should use OAuth'))).toBe(true);
        expect(requirements.some(req => req.includes('required to log'))).toBe(true);
      });

      it('should limit number of requirements extracted', () => {
        const longContent = Array.from({ length: 10 }, (_, i) => 
          `Requirement ${i}: Services must implement feature ${i}.`
        ).join(' ');

        const standard = { ...mockStandards[0], content: longContent };
        const requirements = server['extractRequirements'](standard);

        expect(requirements.length).toBeLessThanOrEqual(5);
      });
    });
  });
});