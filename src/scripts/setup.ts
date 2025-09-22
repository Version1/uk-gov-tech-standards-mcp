#!/usr/bin/env node

import { config } from 'dotenv';
import { DatabaseManager } from '../database/manager.js';
import { GovUKScraper } from '../scraper/gov-uk-scraper.js';
import { ContentProcessor } from '../scraper/content-processor.js';
import logger from '../utils/logger.js';

config();

async function setupDatabase(): Promise<void> {
  const dbPath = process.env.DATABASE_URL?.replace('sqlite:', '') || './standards.db';
  
  try {
    logger.info('Starting initial setup...');

    // Initialize database
    const db = new DatabaseManager(dbPath);
    await db.initialize();

    // Initialize scraper and processor
    const scraper = new GovUKScraper();
    const processor = new ContentProcessor();

    await scraper.initialize();

    try {
      // Scrape main standards page for URLs
      logger.info('Discovering UK government standards pages...');
      const urls = await scraper.scrapeMainStandardsPage();
      logger.info(`Found ${urls.length} pages to scrape`);

      // Scrape all discovered pages
      logger.info('Scraping content from all discovered pages...');
      const scrapedPages = await scraper.scrapeMultiplePages(urls);
      logger.info(`Successfully scraped ${scrapedPages.length} pages`);

      // Process and store standards
      const standards = scrapedPages.map((page: any) => processor.processScrapedPage(page));
      
      logger.info('Processing and storing standards in database...');
      for (const standard of standards) {
        const validation = processor.validateStandard(standard);
        if (validation.valid) {
          await db.insertStandard(standard);
          await db.logScraping(standard.url, 'success');
        } else {
          logger.warn(`Invalid standard ${standard.id}: ${validation.errors.join(', ')}`);
          await db.logScraping(standard.url, 'failed', validation.errors.join(', '));
        }
      }

      // Process related standards
      logger.info('Processing related standards relationships...');
      const allStandards = await db.getAllStandards();
      for (const standard of allStandards) {
        const relatedIds = processor.findRelatedStandards(standard, allStandards);
        if (relatedIds.length > 0) {
          standard.relatedStandards = relatedIds;
          await db.insertStandard(standard); // Update with related standards
        }
      }

      logger.info(`Setup completed successfully! Processed ${standards.length} standards.`);
      
      // Generate embeddings for all standards
      logger.info('Generating embeddings for semantic search...');
      try {
        const { VectorStorageService } = await import('../services/vector-storage.js');
        const vectorStorage = VectorStorageService.getInstance();
        await vectorStorage.initialize();
        
        // Get all standards for embedding
        const allStandards = await db.getAllStandards();
        
        // Clear existing embeddings and add all standards
        await vectorStorage.clearCollection();
        await vectorStorage.addStandards(allStandards);
        
        const stats = await vectorStorage.getStats();
        logger.info(`Generated embeddings for ${stats.totalDocuments} standards`);
      } catch (error) {
        logger.error('Failed to generate embeddings (semantic search will not be available):', error);
        console.error('Warning: Semantic search setup failed, but standard search will still work');
      }
      
      // Print summary
      const categories = await db.getCategories();
      logger.info('Categories summary:');
      categories.forEach((cat: any) => {
        logger.info(`  - ${cat.name}: ${cat.count} standards`);
      });

    } finally {
      await scraper.close();
    }

    await db.close();

  } catch (error) {
    logger.error('Setup failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase().catch(error => {
    logger.error('Setup failed:', error);
    process.exit(1);
  });
}