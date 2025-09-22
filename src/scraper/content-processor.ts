import { ScrapedPage, Standard } from '../types/standard.js';
import logger from '../utils/logger.js';
import { createHash } from 'crypto';

export class ContentProcessor {
  
  processScrapedPage(scrapedPage: ScrapedPage): Standard {
    const id = this.generateStandardId(scrapedPage.url);
    const tags = this.extractTags(scrapedPage.title, scrapedPage.content);
    const complianceLevel = this.determineComplianceLevel(scrapedPage.content);
    const summary = this.generateSummary(scrapedPage.content);

    return {
      id,
      title: scrapedPage.title,
      category: scrapedPage.category,
      url: scrapedPage.url,
      content: scrapedPage.content,
      summary,
      lastUpdated: scrapedPage.lastModified,
      sourceOrg: scrapedPage.sourceOrg,
      tags,
      complianceLevel,
      relatedStandards: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private generateStandardId(url: string): string {
    // Create a unique ID from the URL
    const urlPath = new URL(url).pathname;
    const cleanPath = urlPath
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase();
    
    // Add a short hash to ensure uniqueness
    const hash = createHash('md5').update(url).digest('hex').substring(0, 8);
    return `${cleanPath}-${hash}`;
  }

  private extractTags(title: string, content: string): string[] {
    const text = (title + ' ' + content).toLowerCase();
    const tags: Set<string> = new Set();

    // Technical terms
    const technicalTerms = [
      'api', 'rest', 'soap', 'graphql', 'json', 'xml',
      'oauth', 'jwt', 'https', 'ssl', 'tls',
      'gdpr', 'data protection', 'privacy',
      'cloud', 'aws', 'azure', 'saas', 'paas', 'iaas',
      'security', 'cyber security', 'malware', 'phishing',
      'accessibility', 'wcag', 'screen reader',
      'agile', 'scrum', 'devops', 'ci/cd',
      'open source', 'open data', 'open standards',
      'docker', 'kubernetes', 'microservices'
    ];

    technicalTerms.forEach(term => {
      if (text.includes(term)) {
        tags.add(term);
      }
    });

    // Government specific terms
    const govTerms = [
      'gds', 'cabinet office', 'ncsc', 'hmrc', 'dvla',
      'digital service standard', 'government digital service',
      'public sector', 'civil service', 'whitehall',
      'transparency', 'open government', 'digital by default'
    ];

    govTerms.forEach(term => {
      if (text.includes(term)) {
        tags.add(term);
      }
    });

    // Compliance and standards terms
    const complianceTerms = [
      'iso 27001', 'pci dss', 'sox', 'hipaa',
      'mandatory', 'recommended', 'optional',
      'compliance', 'audit', 'assessment',
      'risk management', 'governance'
    ];

    complianceTerms.forEach(term => {
      if (text.includes(term)) {
        tags.add(term);
      }
    });

    return Array.from(tags).slice(0, 20); // Limit to 20 tags
  }

  private determineComplianceLevel(content: string): 'mandatory' | 'recommended' | 'optional' | undefined {
    const contentLower = content.toLowerCase();

    // Check for mandatory indicators
    const mandatoryIndicators = [
      'must', 'shall', 'required', 'mandatory', 'obligation',
      'compulsory', 'essential', 'critical requirement'
    ];

    const recommendedIndicators = [
      'should', 'recommended', 'best practice', 'advised',
      'suggested', 'good practice', 'guideline'
    ];

    const optionalIndicators = [
      'may', 'can', 'optional', 'consider', 'might',
      'could', 'possible', 'alternative'
    ];

    const mandatoryCount = mandatoryIndicators.filter(term => contentLower.includes(term)).length;
    const recommendedCount = recommendedIndicators.filter(term => contentLower.includes(term)).length;
    const optionalCount = optionalIndicators.filter(term => contentLower.includes(term)).length;

    // Determine based on frequency and context
    if (mandatoryCount > recommendedCount && mandatoryCount > optionalCount) {
      return 'mandatory';
    } else if (recommendedCount > optionalCount) {
      return 'recommended';
    } else if (optionalCount > 0) {
      return 'optional';
    }

    return undefined;
  }

  private generateSummary(content: string, maxLength: number = 500): string {
    // Simple extractive summarization
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length === 0) return '';

    // Score sentences based on position and key terms
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0;
      const sentenceLower = sentence.toLowerCase();

      // Position scoring (earlier sentences get higher scores)
      score += Math.max(0, 10 - index);

      // Key term scoring
      const keyTerms = [
        'standard', 'requirement', 'must', 'should', 'guidance',
        'policy', 'procedure', 'compliance', 'security', 'api',
        'data', 'service', 'digital', 'technology', 'government'
      ];

      keyTerms.forEach(term => {
        if (sentenceLower.includes(term)) score += 2;
      });

      // Length scoring (prefer medium-length sentences)
      const words = sentence.split(' ').length;
      if (words >= 10 && words <= 30) score += 3;

      return { sentence: sentence.trim(), score };
    });

    // Sort by score and take top sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.sentence);

    let summary = topSentences.join('. ') + '.';

    // Trim to max length
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }

  findRelatedStandards(standard: Standard, allStandards: Standard[]): string[] {
    const related: Set<string> = new Set();
    const standardText = (standard.title + ' ' + standard.content + ' ' + standard.tags.join(' ')).toLowerCase();

    allStandards.forEach(otherStandard => {
      if (otherStandard.id === standard.id) return;

      const otherText = (otherStandard.title + ' ' + otherStandard.content + ' ' + otherStandard.tags.join(' ')).toLowerCase();
      
      // Check for common tags
      const commonTags = standard.tags.filter(tag => otherStandard.tags.includes(tag));
      if (commonTags.length >= 2) {
        related.add(otherStandard.id);
      }

      // Check for similar categories
      if (standard.category === otherStandard.category && related.size < 10) {
        related.add(otherStandard.id);
      }

      // Check for keyword overlap
      const keywords = this.extractKeywords(standardText);
      const otherKeywords = this.extractKeywords(otherText);
      const commonKeywords = keywords.filter(kw => otherKeywords.includes(kw));
      
      if (commonKeywords.length >= 3) {
        related.add(otherStandard.id);
      }
    });

    return Array.from(related).slice(0, 10); // Limit to 10 related standards
  }

  private extractKeywords(text: string): string[] {
    const words = text.split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '').toLowerCase())
      .filter(word => word.length > 3);

    // Remove common words
    const stopWords = new Set([
      'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
      'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over',
      'such', 'take', 'than', 'them', 'well', 'were', 'government'
    ]);

    return words.filter(word => !stopWords.has(word));
  }

  validateStandard(standard: Standard): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!standard.id || standard.id.trim().length === 0) {
      errors.push('Standard ID is required');
    }

    if (!standard.title || standard.title.trim().length === 0) {
      errors.push('Standard title is required');
    }

    if (!standard.url || !this.isValidUrl(standard.url)) {
      errors.push('Valid URL is required');
    }

    if (!standard.content || standard.content.trim().length < 50) {
      errors.push('Standard content must be at least 50 characters long');
    }

    if (!standard.category || standard.category.trim().length === 0) {
      errors.push('Standard category is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}