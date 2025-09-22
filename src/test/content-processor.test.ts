import { describe, it, expect } from 'vitest';
import { ContentProcessor } from '../scraper/content-processor.js';
import { ScrapedPage, Standard } from '../types/standard.js';

describe('ContentProcessor', () => {
  let processor: ContentProcessor;

  beforeEach(() => {
    processor = new ContentProcessor();
  });

  describe('processScrapedPage', () => {
    const mockScrapedPage: ScrapedPage = {
      url: 'https://www.gov.uk/guidance/gds-api-technical-and-data-standards',
      title: 'GDS API technical and data standards',
      content: 'This guidance explains the technical standards for APIs in government. APIs must use HTTPS and should implement OAuth 2.0 for authentication. All APIs should follow REST principles and return JSON responses.',
      category: 'APIs',
      sourceOrg: 'GDS',
      links: []
    };

    it('should process scraped page into standard', () => {
      const standard = processor.processScrapedPage(mockScrapedPage);

      expect(standard.id).toMatch(/^guidance-gds-api-technical-and-data-standards-[a-f0-9]{8}$/);
      expect(standard.title).toBe(mockScrapedPage.title);
      expect(standard.category).toBe(mockScrapedPage.category);
      expect(standard.url).toBe(mockScrapedPage.url);
      expect(standard.content).toBe(mockScrapedPage.content);
      expect(standard.sourceOrg).toBe(mockScrapedPage.sourceOrg);
      expect(standard.summary).toBeTruthy();
      expect(standard.tags.length).toBeGreaterThan(0);
    });

    it('should extract relevant tags from content', () => {
      const standard = processor.processScrapedPage(mockScrapedPage);

      expect(standard.tags).toContain('api');
      expect(standard.tags).toContain('oauth');
      expect(standard.tags).toContain('rest');
      expect(standard.tags).toContain('https');
      expect(standard.tags).toContain('json');
    });

    it('should determine compliance level from content', () => {
      const mandatoryContent: ScrapedPage = {
        ...mockScrapedPage,
        content: 'Services must implement HTTPS encryption. All APIs shall use OAuth 2.0 authentication. This is a mandatory requirement for all government services.'
      };

      const standard = processor.processScrapedPage(mandatoryContent);
      expect(standard.complianceLevel).toBe('mandatory');
    });

    it('should generate appropriate summary', () => {
      const standard = processor.processScrapedPage(mockScrapedPage);
      
      expect(standard.summary).toBeTruthy();
      expect(standard.summary!.length).toBeGreaterThan(0);
      expect(standard.summary!.length).toBeLessThanOrEqual(500);
    });
  });

  describe('findRelatedStandards', () => {
    const apiStandard: Standard = {
      id: 'api-standard-1',
      title: 'API Security Guidelines',
      category: 'APIs',
      url: 'https://www.gov.uk/api-security',
      content: 'Guidelines for API security with OAuth and JWT',
      tags: ['api', 'security', 'oauth', 'jwt'],
      relatedStandards: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const securityStandard: Standard = {
      id: 'security-standard-1',
      title: 'Cyber Security Framework',
      category: 'Security & Cyber Security',
      url: 'https://www.gov.uk/cyber-security',
      content: 'Security framework including API security and OAuth implementation',
      tags: ['security', 'api', 'oauth', 'framework'],
      relatedStandards: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const unrelatedStandard: Standard = {
      id: 'accessibility-standard-1',
      title: 'WCAG Guidelines',
      category: 'Accessibility',
      url: 'https://www.gov.uk/wcag',
      content: 'Web content accessibility guidelines',
      tags: ['accessibility', 'wcag', 'screen-reader'],
      relatedStandards: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should find related standards by common tags', () => {
      const allStandards = [apiStandard, securityStandard, unrelatedStandard];
      const related = processor.findRelatedStandards(apiStandard, allStandards);

      expect(related).toContain('security-standard-1');
      expect(related).not.toContain('accessibility-standard-1');
      expect(related).not.toContain('api-standard-1'); // Should not include itself
    });

    it('should limit related standards to reasonable number', () => {
      const manyStandards = Array.from({ length: 20 }, (_, i) => ({
        ...apiStandard,
        id: `standard-${i}`,
        tags: ['api', 'security'] // Common tags
      }));
      
      const related = processor.findRelatedStandards(apiStandard, manyStandards);
      expect(related.length).toBeLessThanOrEqual(10);
    });
  });

  describe('validateStandard', () => {
    const validStandard: Standard = {
      id: 'valid-standard-1',
      title: 'Valid Standard',
      category: 'APIs',
      url: 'https://www.gov.uk/valid-standard',
      content: 'This is a valid standard with sufficient content to pass validation requirements and provide meaningful guidance.',
      tags: ['api'],
      relatedStandards: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should validate a correct standard', () => {
      const result = processor.validateStandard(validStandard);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject standard without ID', () => {
      const invalidStandard = { ...validStandard, id: '' };
      const result = processor.validateStandard(invalidStandard);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Standard ID is required');
    });

    it('should reject standard without title', () => {
      const invalidStandard = { ...validStandard, title: '' };
      const result = processor.validateStandard(invalidStandard);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Standard title is required');
    });

    it('should reject standard with invalid URL', () => {
      const invalidStandard = { ...validStandard, url: 'not-a-url' };
      const result = processor.validateStandard(invalidStandard);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid URL is required');
    });

    it('should reject standard with insufficient content', () => {
      const invalidStandard = { ...validStandard, content: 'Short' };
      const result = processor.validateStandard(invalidStandard);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Standard content must be at least 50 characters long');
    });

    it('should reject standard without category', () => {
      const invalidStandard = { ...validStandard, category: '' };
      const result = processor.validateStandard(invalidStandard);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Standard category is required');
    });

    it('should accumulate multiple validation errors', () => {
      const invalidStandard = {
        ...validStandard,
        id: '',
        title: '',
        url: 'invalid'
      };
      const result = processor.validateStandard(invalidStandard);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('Tag Extraction', () => {
    it('should extract technical terms as tags', () => {
      const content = 'This API uses OAuth 2.0 with JWT tokens over HTTPS with JSON responses';
      const scrapedPage: ScrapedPage = {
        url: 'https://test.com',
        title: 'API Standard',
        content,
        category: 'APIs',
        links: []
      };

      const standard = processor.processScrapedPage(scrapedPage);
      
      expect(standard.tags).toContain('api');
      expect(standard.tags).toContain('oauth');
      expect(standard.tags).toContain('jwt');
      expect(standard.tags).toContain('https');
      expect(standard.tags).toContain('json');
    });

    it('should extract government terms as tags', () => {
      const content = 'GDS Digital Service Standard for Cabinet Office applications';
      const scrapedPage: ScrapedPage = {
        url: 'https://test.com',
        title: 'Government Standard',
        content,
        category: 'Digital Service Standard',
        links: []
      };

      const standard = processor.processScrapedPage(scrapedPage);
      
      expect(standard.tags).toContain('gds');
      expect(standard.tags).toContain('digital service standard');
      expect(standard.tags).toContain('cabinet office');
    });

    it('should limit number of tags', () => {
      const content = 'api rest soap graphql json xml oauth jwt https ssl tls gdpr privacy security cyber malware phishing cloud aws azure saas paas iaas accessibility wcag agile scrum devops docker kubernetes microservices';
      const scrapedPage: ScrapedPage = {
        url: 'https://test.com',
        title: 'Comprehensive Standard',
        content,
        category: 'General',
        links: []
      };

      const standard = processor.processScrapedPage(scrapedPage);
      
      expect(standard.tags.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Compliance Level Detection', () => {
    it('should detect mandatory compliance', () => {
      const content = 'Services must implement HTTPS. This is mandatory for all government applications.';
      const scrapedPage: ScrapedPage = {
        url: 'https://test.com',
        title: 'Mandatory Standard',
        content,
        category: 'Security & Cyber Security',
        links: []
      };

      const standard = processor.processScrapedPage(scrapedPage);
      expect(standard.complianceLevel).toBe('mandatory');
    });

    it('should detect recommended compliance', () => {
      const content = 'Services should implement OAuth 2.0. This is recommended best practice.';
      const scrapedPage: ScrapedPage = {
        url: 'https://test.com',
        title: 'Recommended Standard',
        content,
        category: 'APIs',
        links: []
      };

      const standard = processor.processScrapedPage(scrapedPage);
      expect(standard.complianceLevel).toBe('recommended');
    });

    it('should detect optional compliance', () => {
      const content = 'Services may implement caching. This could improve performance.';
      const scrapedPage: ScrapedPage = {
        url: 'https://test.com',
        title: 'Optional Standard',
        content,
        category: 'General',
        links: []
      };

      const standard = processor.processScrapedPage(scrapedPage);
      expect(standard.complianceLevel).toBe('optional');
    });
  });
});