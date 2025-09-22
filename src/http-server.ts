#!/usr/bin/env node

import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import { DatabaseManager } from './database/manager.js';
import { ContentProcessor } from './scraper/content-processor.js';
import { getApplicableStandards, CURATED_STANDARDS_CONFIG, getMandatoryStandards, getStandardsByPriority } from './config/standards-config.js';
import logger from './utils/logger.js';

config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database
const dbPath = process.env.DATABASE_URL?.replace('sqlite:', '') || './standards.db';
const db = new DatabaseManager(dbPath);
const processor = new ContentProcessor();

await db.initialize();

// API Routes
app.get('/', (req, res) => {
  res.json({
    name: 'UK Government Technology Standards API',
    version: '1.0.0',
    endpoints: {
      search: '/api/search?q=<query>&category=<category>&org=<organisation>',
      standard: '/api/standards/<id>',
      categories: '/api/categories',
      recent: '/api/recent?days=<days>',
      compliance: '/api/compliance (POST with {serviceDescription})',
      applicable: '/api/applicable (POST with {workType, serviceType, developmentPhase})',
      mandatory: '/api/mandatory',
      priority: '/api/priority/<level>',
      hierarchy: '/api/hierarchy?categoryId=<id>'
    },
    totalStandards: 'Use /api/categories to see counts'
  });
});

// Search standards
app.get('/api/search', async (req, res): Promise<any> => {
  try {
    const { q: query, category, org: organisation } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Use hybrid search for better semantic understanding
    const results = await db.hybridSearch(
      query as string, 
      category as string, 
      organisation as string,
      {
        semanticWeight: 0.6, // 60% semantic, 40% FTS
        semanticThreshold: 0.25, // Lower threshold for more inclusive results
        maxResults: 20
      }
    );

    res.json({
      query,
      filters: { category, organisation },
      totalResults: results.length,
      results: results.map(result => ({
        id: result.standard.id,
        title: result.standard.title,
        category: result.standard.category,
        url: result.standard.url,
        summary: result.standard.summary,
        sourceOrg: result.standard.sourceOrg,
        tags: result.standard.tags,
        complianceLevel: result.standard.complianceLevel,
        relevanceScore: result.relevanceScore
      }))
    });
  } catch (error) {
    logger.error('Search API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific standard
app.get('/api/standards/:id', async (req, res): Promise<any> => {
  try {
    const standard = await db.getStandard(req.params.id);
    
    if (!standard) {
      return res.status(404).json({ error: 'Standard not found' });
    }

    res.json(standard);
  } catch (error) {
    logger.error('Get standard API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.getCategories();
    res.json({
      totalCategories: categories.length,
      categories
    });
  } catch (error) {
    logger.error('Categories API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recent updates
app.get('/api/recent', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const recent = await db.getRecentUpdates(days);
    
    res.json({
      daysBack: days,
      totalUpdates: recent.length,
      updates: recent.map(standard => ({
        id: standard.id,
        title: standard.title,
        category: standard.category,
        url: standard.url,
        lastUpdated: standard.lastUpdated,
        updatedAt: standard.updatedAt
      }))
    });
  } catch (error) {
    logger.error('Recent updates API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Compliance check
app.post('/api/compliance', async (req, res): Promise<any> => {
  try {
    const { serviceDescription } = req.body;
    
    if (!serviceDescription) {
      return res.status(400).json({ error: 'serviceDescription is required' });
    }

    const allStandards = await db.getAllStandards();
    
    // Simple relevance scoring (you could enhance this)
    const relevantStandards = allStandards.filter(standard => {
      const text = (serviceDescription as string).toLowerCase();
      const standardText = (standard.title + ' ' + standard.content).toLowerCase();
      
      // Basic keyword matching
      const keywords = text.split(' ').filter(w => w.length > 3);
      return keywords.some(keyword => standardText.includes(keyword));
    }).slice(0, 10);

    res.json({
      serviceDescription,
      relevantStandards: relevantStandards.map(s => ({
        id: s.id,
        title: s.title,
        category: s.category,
        url: s.url,
        complianceLevel: s.complianceLevel
      }))
    });
  } catch (error) {
    logger.error('Compliance API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get applicable standards
app.post('/api/applicable', async (req, res): Promise<any> => {
  try {
    const { workType, serviceType, developmentPhase } = req.body;
    
    if (!workType || !serviceType || !developmentPhase) {
      return res.status(400).json({ 
        error: 'workType, serviceType, and developmentPhase arrays are required' 
      });
    }

    const applicableCategories = getApplicableStandards(workType, serviceType, developmentPhase);
    
    // Get actual standards for these categories
    const applicableStandards = [];
    for (const category of applicableCategories) {
      const categoryStandards = await db.searchStandards('', category.name);
      applicableStandards.push({
        category: category.name,
        description: category.description,
        applicabilityContext: category.applicabilityContext,
        urlCount: category.urls.length,
        standards: categoryStandards.map(result => ({
          id: result.standard.id,
          title: result.standard.title,
          url: result.standard.url,
          summary: result.standard.summary
        }))
      });
    }

    res.json({
      context: { workType, serviceType, developmentPhase },
      applicableCategories: applicableStandards,
      totalCategories: applicableStandards.length,
      totalStandards: applicableStandards.reduce((sum, cat) => sum + cat.standards.length, 0)
    });
  } catch (error) {
    logger.error('Applicable standards API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get mandatory standards
app.get('/api/mandatory', async (req, res) => {
  try {
    const mandatoryCategories = getMandatoryStandards();
    
    const mandatoryStandards = [];
    for (const category of mandatoryCategories) {
      const categoryStandards = await db.searchStandards('', category.name);
      mandatoryStandards.push({
        category: category.name,
        description: category.description,
        priority: category.applicabilityContext.priority,
        applicableFor: {
          workType: category.applicabilityContext.workType,
          serviceType: category.applicabilityContext.serviceType,
          developmentPhase: category.applicabilityContext.developmentPhase
        },
        standards: categoryStandards.map(result => ({
          id: result.standard.id,
          title: result.standard.title,
          url: result.standard.url,
          summary: result.standard.summary
        }))
      });
    }

    res.json({
      mandatoryCategories: mandatoryStandards,
      totalCategories: mandatoryStandards.length,
      totalStandards: mandatoryStandards.reduce((sum, cat) => sum + cat.standards.length, 0),
      note: "These are standards marked as mandatory and must be followed when applicable to your work context."
    });
  } catch (error) {
    logger.error('Mandatory standards API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get standards by priority
app.get('/api/priority/:level', async (req, res): Promise<any> => {
  try {
    const priority = req.params.level as 'critical' | 'high' | 'medium' | 'low';
    
    if (!['critical', 'high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ 
        error: 'Priority must be one of: critical, high, medium, low' 
      });
    }

    const priorityCategories = getStandardsByPriority(priority);
    
    const priorityStandards = [];
    for (const category of priorityCategories) {
      const categoryStandards = await db.searchStandards('', category.name);
      priorityStandards.push({
        category: category.name,
        description: category.description,
        priority: category.applicabilityContext.priority,
        mandatory: category.applicabilityContext.mandatory,
        standards: categoryStandards.map(result => ({
          id: result.standard.id,
          title: result.standard.title,
          url: result.standard.url,
          summary: result.standard.summary
        }))
      });
    }

    res.json({
      priority,
      categories: priorityStandards,
      totalCategories: priorityStandards.length,
      totalStandards: priorityStandards.reduce((sum, cat) => sum + cat.standards.length, 0)
    });
  } catch (error) {
    logger.error('Priority standards API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category hierarchy
app.get('/api/hierarchy', async (req, res): Promise<any> => {
  try {
    const { categoryId } = req.query;

    if (categoryId) {
      const category = CURATED_STANDARDS_CONFIG.find(c => c.id === categoryId);
      if (!category) {
        return res.status(404).json({ error: `Category ${categoryId} not found` });
      }

      res.json(category);
    } else {
      // Return all categories with hierarchy
      const categoriesWithCounts = await Promise.all(
        CURATED_STANDARDS_CONFIG.map(async category => {
          const standards = await db.searchStandards('', category.name);
          return {
            ...category,
            standardsCount: standards.length
          };
        })
      );

      res.json({
        categories: categoriesWithCounts,
        totalCategories: CURATED_STANDARDS_CONFIG.length,
        totalUrls: CURATED_STANDARDS_CONFIG.reduce((sum, cat) => sum + cat.urls.length, 0)
      });
    }
  } catch (error) {
    logger.error('Hierarchy API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`🇬🇧 UK Gov Standards API running at http://localhost:${port}`);
  console.log(`📖 API documentation available at http://localhost:${port}`);
  console.log(`🔍 Search: GET /api/search?q=<query>`);
  console.log(`📋 Categories: GET /api/categories`);
  console.log(`🎯 Context-aware: POST /api/applicable`);
  console.log(`⚠️  Mandatory: GET /api/mandatory`);
  console.log(`📊 Priority: GET /api/priority/<level>`);
});