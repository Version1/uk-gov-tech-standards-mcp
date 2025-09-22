#!/usr/bin/env node

import { config } from 'dotenv';
import { DatabaseManager } from '../database/manager.js';
import { GovUKScraper } from '../scraper/gov-uk-scraper.js';
import { ContentProcessor } from '../scraper/content-processor.js';
import logger from '../utils/logger.js';

config();

async function updateStandards(): Promise<void> {
  const dbPath = process.env.DATABASE_URL?.replace('sqlite:', '') || './standards.db';
  
  try {
    logger.info('Starting standards update...');

    // Initialize components
    const db = new DatabaseManager(dbPath);
    await db.initialize();

    const scraper = new GovUKScraper();
    const processor = new ContentProcessor();

    await scraper.initialize();

    try {
      // Get existing standards to check for updates
      const existingStandards = await db.getAllStandards();
      const existingUrls = new Set(existingStandards.map((s: any) => s.url));

      // Discover current standards pages
      logger.info('Discovering current UK government standards pages...');
      const currentUrls = await scraper.scrapeMainStandardsPage();
      
      // Find new URLs
      const newUrls = currentUrls.filter((url: string) => !existingUrls.has(url));
      logger.info(`Found ${newUrls.length} new pages to scrape`);

      // Find URLs to re-check (random sampling for updates)
      const urlsToRecheck = selectUrlsForUpdate(existingStandards, 0.1); // Check 10% of existing
      logger.info(`Re-checking ${urlsToRecheck.length} existing pages for updates`);

      // Scrape new and updated content
      const allUrlsToScrape = [...newUrls, ...urlsToRecheck];
      if (allUrlsToScrape.length === 0) {
        logger.info('No new content to scrape. Update completed.');
        return;
      }

      const scrapedPages = await scraper.scrapeMultiplePages(allUrlsToScrape);
      logger.info(`Successfully scraped ${scrapedPages.length} pages`);

      // Process and update standards
      let newCount = 0;
      let updatedCount = 0;

      for (const page of scrapedPages) {
        const standard = processor.processScrapedPage(page);
        const validation = processor.validateStandard(standard);

        if (validation.valid) {
          const existing = await db.getStandard(standard.id);
          
          if (existing) {
            // Check if content has changed
            if (hasContentChanged(existing, standard)) {
              await db.insertStandard(standard);
              await db.logScraping(standard.url, 'success');
              updatedCount++;
              logger.debug(`Updated standard: ${standard.title}`);
            }
          } else {
            await db.insertStandard(standard);
            await db.logScraping(standard.url, 'success');
            newCount++;
            logger.debug(`Added new standard: ${standard.title}`);
          }
        } else {
          logger.warn(`Invalid standard ${standard.id}: ${validation.errors.join(', ')}`);
          await db.logScraping(standard.url, 'failed', validation.errors.join(', '));
        }
      }

      // Update related standards for new/updated ones
      if (newCount > 0 || updatedCount > 0) {
        logger.info('Updating related standards relationships...');
        const allStandards = await db.getAllStandards();
        
        for (const page of scrapedPages) {
          const standard = processor.processScrapedPage(page);
          const relatedIds = processor.findRelatedStandards(standard, allStandards);
          if (relatedIds.length > 0) {
            standard.relatedStandards = relatedIds;
            await db.insertStandard(standard);
          }
        }
      }

      logger.info(`Update completed! Added: ${newCount}, Updated: ${updatedCount} standards.`);

    } finally {
      await scraper.close();
    }

    await db.close();

  } catch (error) {
    logger.error('Update failed:', error);
    process.exit(1);
  }
}

function selectUrlsForUpdate(standards: any[], percentage: number): string[] {
  const count = Math.ceil(standards.length * percentage);
  const shuffled = [...standards].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(s => s.url);
}

function hasContentChanged(existing: any, updated: any): boolean {
  return existing.title !== updated.title ||
         existing.content !== updated.content ||
         existing.category !== updated.category ||
         JSON.stringify(existing.tags.sort()) !== JSON.stringify(updated.tags.sort());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateStandards().catch(error => {
    logger.error('Update failed:', error);
    process.exit(1);
  });
}