import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { ScrapedPage } from '../types/standard.js';
import logger from '../utils/logger.js';
import { getAllCuratedUrls, getCategoryForUrl } from '../config/standards-config.js';

export class GovUKScraper {
  private browser: Browser | null = null;
  private maxConcurrentPages: number;
  private scrapeDelay: number;
  private requestTimeout: number;

  constructor() {
    this.maxConcurrentPages = parseInt(process.env.MAX_CONCURRENT_PAGES || '3');
    this.scrapeDelay = parseInt(process.env.SCRAPE_DELAY || '1000');
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');
  }

  async initialize(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: process.env.PUPPETEER_HEADLESS !== 'false',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security'
        ]
      });
      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async scrapeMainStandardsPage(): Promise<string[]> {
    // Return curated URLs instead of discovering them
    const curatedUrls = getAllCuratedUrls();
    logger.info(`Using curated URL list: ${curatedUrls.length} URLs`);
    return curatedUrls;
  }

  async scrapePage(url: string): Promise<ScrapedPage | null> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: this.requestTimeout 
      });

      const content = await page.content();
      const $ = cheerio.load(content);
      
      // Extract title
      const title = this.extractTitle($);
      
      // Extract main content
      const mainContent = this.extractContent($);
      
      // Extract category and source org
      const { category, sourceOrg } = this.categorizeContent(url, title, mainContent);
      
      // Extract related links
      const links = this.extractLinks($, url);

      const scrapedPage: ScrapedPage = {
        url,
        title,
        content: mainContent,
        category,
        sourceOrg,
        links
      };

      logger.debug(`Successfully scraped: ${title}`);
      return scrapedPage;
      
    } catch (error) {
      logger.error(`Failed to scrape page ${url}:`, error);
      return null;
    } finally {
      await page.close();
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, this.scrapeDelay));
    }
  }

  async scrapeMultiplePages(urls: string[]): Promise<ScrapedPage[]> {
    // Since we're using curated URLs, we don't need to follow child links
    logger.info(`Starting scraping of ${urls.length} curated pages...`);
    return await this.scrapePages(urls);
  }
  
  private async scrapePages(urls: string[]): Promise<ScrapedPage[]> {
    const results: ScrapedPage[] = [];
    const chunks = this.chunkArray(urls, this.maxConcurrentPages);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.info(`Scraping chunk ${i + 1}/${chunks.length} (${chunk.length} pages)`);
      
      const promises = chunk.map(url => this.scrapePage(url));
      const chunkResults = await Promise.all(promises);
      
      chunkResults.forEach(result => {
        if (result) results.push(result);
      });

      logger.info(`Completed chunk ${i + 1}/${chunks.length}. Running total: ${results.length}`);
    }

    return results;
  }
  
  private shouldFollowChildLink(url: string): boolean {
    // More selective criteria for child links to maintain quality
    const highValuePatterns = [
      '/guidance/',
      '/service-manual/',
      'ncsc.gov.uk/guidance',
      'ncsc.gov.uk/collection', 
      '/government/publications/',
      '/digital-service-standard'
    ];
    
    const excludePatterns = [
      '/browse/', '/search', '/contact', '/help', '#', 'mailto:', 'tel:',
      '.pdf', '.doc', '.xls', '.zip',
      '/news/', '/press-release/', '/consultation/',
      'youtube.com', 'twitter.com', 'linkedin.com',
      '/cookies', '/privacy', '/accessibility-statement'
    ];
    
    const urlLower = url.toLowerCase();
    
    return highValuePatterns.some(pattern => urlLower.includes(pattern)) &&
           !excludePatterns.some(pattern => urlLower.includes(pattern)) &&
           (urlLower.includes('gov.uk') || urlLower.includes('ncsc.gov.uk'));
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple selectors for title
    const titleSelectors = [
      'h1.gem-c-title__text',
      'h1',
      '.page-header h1',
      'title'
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title) return title;
    }

    return 'Untitled Document';
  }

  private extractContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('.gem-c-print-link, .gem-c-share-links, .gem-c-feedback, .govuk-breadcrumbs').remove();
    
    // Try to find main content area
    const contentSelectors = [
      '.gem-c-govspeak',
      '.govuk-govspeak',
      'main .govuk-grid-column-two-thirds',
      '.publication-external-download',
      'main'
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).first();
      if (content.length > 0) {
        return content.text().trim().replace(/\s+/g, ' ');
      }
    }

    // Fallback to body content
    return $('body').text().trim().replace(/\s+/g, ' ');
  }

  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && this.isRelevantGovUKLink(href)) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
        links.push(fullUrl);
      }
    });

    return [...new Set(links)];
  }

  private categorizeContent(url: string, title: string, content: string): { category: string; sourceOrg: string } {
    // Use the curated category mapping first
    const categoryConfig = getCategoryForUrl(url);
    
    if (categoryConfig) {
      const sourceOrg = this.determineSourceOrg(url);
      return { 
        category: categoryConfig.name, 
        sourceOrg 
      };
    }

    // Fallback to existing logic for any URLs not in curated list
    return this.legacyCategorizeContent(url, title, content);
  }

  private determineSourceOrg(url: string): string {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('ncsc.gov.uk')) return 'NCSC';
    if (urlLower.includes('ico.org.uk')) return 'ICO';
    if (urlLower.includes('service-manual')) return 'GDS';
    if (urlLower.includes('cabinet-office')) return 'Cabinet Office';
    if (urlLower.includes('opensource.org')) return 'Open Source Initiative';
    if (urlLower.includes('pcisecuritystandards.org')) return 'PCI Security Standards Council';
    if (urlLower.includes('gov.uk')) return 'GOV.UK';
    
    return 'Unknown';
  }

  // Renamed existing method as fallback
  private legacyCategorizeContent(url: string, title: string, content: string): { category: string; sourceOrg: string } {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    // Determine source organization
    let sourceOrg = 'Unknown';
    if (urlLower.includes('ncsc.gov.uk')) sourceOrg = 'NCSC';
    else if (urlLower.includes('service-manual')) sourceOrg = 'GDS';
    else if (urlLower.includes('cabinet-office')) sourceOrg = 'Cabinet Office';
    else if (urlLower.includes('gov.uk')) sourceOrg = 'GOV.UK';

    // Determine category
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['api', 'rest', 'graphql', 'endpoint'])) {
      return { category: 'APIs', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['security', 'cyber', 'malware', 'vulnerability', 'incident'])) {
      return { category: 'Security & Cyber Security', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['accessibility', 'wcag', 'assisted digital', 'inclusive'])) {
      return { category: 'Accessibility', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['cloud', 'aws', 'azure', 'hosting', 'iaas'])) {
      return { category: 'Cloud Strategy', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['data protection', 'gdpr', 'privacy', 'data classification'])) {
      return { category: 'Data Protection', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['open standards', 'open source', 'open data'])) {
      return { category: 'Open Standards', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['service standard', 'digital service', 'user research'])) {
      return { category: 'Digital Service Standard', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['psn', 'public service network', 'connection'])) {
      return { category: 'Public Service Network (PSN)', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['green', 'sustainable', 'energy', 'environment'])) {
      return { category: 'Green Technology', sourceOrg };
    }
    if (this.matchesKeywords(titleLower + ' ' + contentLower, ['mobile', 'app', 'development', 'application'])) {
      return { category: 'Application Development', sourceOrg };
    }

    return { category: 'General', sourceOrg };
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private isRelevantGovUKLink(href: string): boolean {
    const relevantPatterns = [
      '/guidance/',
      '/government/publications/',
      '/service-manual/',
      'ncsc.gov.uk',
      '/digital-service-standards'
    ];

    const irrelevantPatterns = [
      '/browse/',
      '/search',
      '/contact',
      '/help',
      '#',
      'mailto:',
      'tel:',
      '.pdf',
      '.doc',
      '.xls'
    ];

    return relevantPatterns.some(pattern => href.includes(pattern)) &&
           !irrelevantPatterns.some(pattern => href.includes(pattern));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed successfully');
    }
  }
}