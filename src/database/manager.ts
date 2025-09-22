import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { Standard, Category, SearchResult } from '../types/standard.js';
import { VectorStorageService } from '../services/vector-storage.js';
import logger from '../utils/logger.js';

export class DatabaseManager {
  private db: sqlite3.Database;
  private dbPath: string;
  private projectRoot: string;
  private vectorStorage: VectorStorageService;

  constructor(dbPath: string = './standards.db', projectRoot?: string) {
    this.dbPath = dbPath;
    this.projectRoot = projectRoot || this.inferProjectRoot();
    this.vectorStorage = VectorStorageService.getInstance();
    console.error(`DEBUG: DatabaseManager - dbPath: ${dbPath}, projectRoot: ${this.projectRoot}`);
    
    // Configure SQLite with better concurrency handling
    this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        console.error('ERROR: Failed to connect to database:', err);
        throw err;
      } else {
        console.error('DEBUG: Database connection established');
        this.configureDatabaseSettings();
      }
    });
  }

  private configureDatabaseSettings(): void {
    // Configure database settings synchronously to avoid race conditions
    this.db.serialize(() => {
      // Enable WAL mode for better concurrency
      this.db.exec("PRAGMA journal_mode = WAL;", (walErr) => {
        if (walErr) {
          console.error('WARNING: Could not enable WAL mode:', walErr);
        } else {
          console.error('DEBUG: WAL mode enabled for better concurrency');
        }
      });
      
      // Set busy timeout
      this.db.exec("PRAGMA busy_timeout = 30000;", (timeoutErr) => {
        if (timeoutErr) {
          console.error('WARNING: Could not set busy timeout:', timeoutErr);
        } else {
          console.error('DEBUG: Busy timeout set to 30 seconds');
        }
      });

      // Enable foreign key constraints
      this.db.exec("PRAGMA foreign_keys = ON;", (fkErr) => {
        if (fkErr) {
          console.error('WARNING: Could not enable foreign keys:', fkErr);
        } else {
          console.error('DEBUG: Foreign key constraints enabled');
        }
      });

      // Optimize for concurrent access
      this.db.exec("PRAGMA synchronous = NORMAL;", (syncErr) => {
        if (syncErr) {
          console.error('WARNING: Could not set synchronous mode:', syncErr);
        } else {
          console.error('DEBUG: Synchronous mode set to NORMAL');
        }
      });
    });
  }

  private inferProjectRoot(): string {
    // Try to find project root from database path
    if (this.dbPath.includes('uk-gov-tech-standards-mcp')) {
      const parts = this.dbPath.split('uk-gov-tech-standards-mcp');
      return parts[0] + 'uk-gov-tech-standards-mcp';
    }
    return process.cwd();
  }

  async initialize(): Promise<void> {
    try {
      // First check database health
      await this.checkDatabaseHealth();
      
      const schemaPath = path.join(this.projectRoot, 'src', 'database', 'schema.sql');
      console.error(`DEBUG: Looking for schema at: ${schemaPath}`);
      
      // Check if schema file exists
      try {
        await fs.access(schemaPath);
        console.error(`DEBUG: Schema file found`);
      } catch {
        console.error(`ERROR: Schema file not found at ${schemaPath}`);
        const { readdirSync } = await import('fs');
        try {
          const srcFiles = readdirSync(path.join(this.projectRoot, 'src'));
          console.error(`ERROR: Files in src/: ${srcFiles.join(', ')}`);
          const dbFiles = readdirSync(path.join(this.projectRoot, 'src', 'database'));
          console.error(`ERROR: Files in src/database/: ${dbFiles.join(', ')}`);
        } catch (e) {
          console.error(`ERROR: Could not list directories:`, e);
        }
        throw new Error(`Schema file not found at ${schemaPath}`);
      }
      
      const schema = await fs.readFile(schemaPath, 'utf8');
      console.error(`DEBUG: Schema file read successfully, length: ${schema.length}`);
      
      await this.exec(schema);
      console.error(`DEBUG: Schema executed successfully`);
      
      // Verify FTS table is working
      await this.verifyFTSTable();
      
      // Initialize vector storage (optional - semantic search)
      try {
        await this.vectorStorage.initialize();
        console.error('DEBUG: Vector storage initialized successfully');
      } catch (error) {
        console.error('WARNING: Vector storage failed to initialize, semantic search disabled:', (error as Error).message);
        logger.warn('Vector storage initialization failed, semantic search will not be available:', error);
      }
      
      logger.info('Database initialized successfully');
    } catch (error) {
      console.error('ERROR: Failed to initialize database:', error);
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async checkDatabaseHealth(): Promise<void> {
    try {
      // Check basic connectivity
      await this.get('SELECT 1 as test');
      
      // Check integrity
      const integrity = await this.get('PRAGMA integrity_check');
      if (integrity.integrity_check !== 'ok') {
        throw new Error(`Database integrity check failed: ${integrity.integrity_check}`);
      }
      
      console.error('DEBUG: Database health check passed');
    } catch (error) {
      console.error('ERROR: Database health check failed:', error);
      throw error;
    }
  }

  private async verifyFTSTable(): Promise<void> {
    try {
      // Check if FTS table exists and is accessible
      const count = await this.get('SELECT COUNT(*) as count FROM standards_fts');
      console.error(`DEBUG: FTS table contains ${count.count} records`);
      
      // Test a simple FTS query
      await this.all('SELECT * FROM standards_fts WHERE standards_fts MATCH ? LIMIT 1', ['test']);
      console.error('DEBUG: FTS table verification passed');
    } catch (error) {
      console.error('WARNING: FTS table verification failed, rebuilding:', error);
      await this.rebuildFTSIndex();
    }
  }

  private exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  private get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  private all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          // Add specific handling for FTS corruption issues
          if (err.message.includes('database disk image is malformed') || 
              err.message.includes('fts5: syntax error')) {
            logger.error('FTS corruption detected, attempting recovery:', err);
            // Try to rebuild FTS index
            this.rebuildFTSIndex().then(() => {
              // Retry the query once
              this.db.all(sql, params, (retryErr, retryRows) => {
                if (retryErr) reject(retryErr);
                else resolve(retryRows);
              });
            }).catch(reject);
          } else {
            reject(err);
          }
        } else {
          resolve(rows);
        }
      });
    });
  }

  private async rebuildFTSIndex(): Promise<void> {
    logger.warn('Rebuilding FTS index due to corruption...');
    try {
      // Drop and recreate FTS table
      await this.exec('DROP TABLE IF EXISTS standards_fts;');
      
      // Recreate FTS table from schema
      const ftsSchema = `
        CREATE VIRTUAL TABLE standards_fts USING fts5(
          id,
          title,
          content,
          summary,
          tags,
          content=standards,
          content_rowid=rowid
        );
      `;
      await this.exec(ftsSchema);
      
      // Rebuild from existing data
      await this.exec('INSERT INTO standards_fts(standards_fts) VALUES("rebuild");');
      
      logger.info('FTS index rebuilt successfully');
    } catch (error) {
      logger.error('Failed to rebuild FTS index:', error);
      throw error;
    }
  }

  async insertStandard(standard: Standard): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO standards (
        id, title, category, url, content, summary, last_updated,
        source_org, tags, compliance_level, related_standards
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      standard.id,
      standard.title,
      standard.category,
      standard.url,
      standard.content,
      standard.summary || null,
      standard.lastUpdated ? standard.lastUpdated.toISOString() : null,
      standard.sourceOrg || null,
      JSON.stringify(standard.tags),
      standard.complianceLevel || null,
      JSON.stringify(standard.relatedStandards)
    ];

    await this.run(sql, params);
    await this.updateCategoryCount(standard.category);
    
    // Also add to vector storage for semantic search (if available)
    try {
      await this.vectorStorage.addStandard(standard);
    } catch (error) {
      logger.debug(`Vector storage not available for standard: ${standard.id}`);
      // Don't fail the whole operation if vector storage fails
    }
    
    logger.debug(`Inserted/updated standard: ${standard.id}`);
  }

  async getStandard(id: string): Promise<Standard | null> {
    const sql = 'SELECT * FROM standards WHERE id = ?';
    const row = await this.get(sql, [id]);
    
    if (!row) return null;
    
    return this.rowToStandard(row);
  }

  async searchStandards(query: string, category?: string, organisation?: string): Promise<SearchResult[]> {
    // If query is empty or just whitespace, return all standards filtered by category/org
    if (!query || query.trim() === '') {
      let sql = 'SELECT * FROM standards';
      const params: any[] = [];
      const conditions: string[] = [];

      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }

      if (organisation) {
        conditions.push('source_org = ?');
        params.push(organisation);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY title';

      const rows = await this.all(sql, params);
      
      return rows.map(row => ({
        standard: this.rowToStandard(row),
        relevanceScore: 1.0,
        matchedFields: []
      }));
    }

    // Use FTS for non-empty queries
    let sql = `
      SELECT s.*, 
             bm25(standards_fts) as score
      FROM standards s
      JOIN standards_fts ON s.id = standards_fts.id
      WHERE standards_fts MATCH ?
    `;
    
    const params: any[] = [query];

    if (category) {
      sql += ' AND s.category = ?';
      params.push(category);
    }

    if (organisation) {
      sql += ' AND s.source_org = ?';
      params.push(organisation);
    }

    sql += ' ORDER BY score';

    const rows = await this.all(sql, params);
    
    return rows.map(row => ({
      standard: this.rowToStandard(row),
      relevanceScore: Math.abs(row.score),
      matchedFields: this.getMatchedFields(row, query)
    }));
  }

  /**
   * Hybrid search combining FTS and semantic vector search
   * Provides both exact matches and semantic understanding
   */
  async hybridSearch(
    query: string, 
    category?: string, 
    organisation?: string,
    options: {
      semanticWeight?: number; // Weight for semantic vs FTS scores (0-1)
      semanticThreshold?: number; // Minimum semantic similarity
      maxResults?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      semanticWeight = 0.6,
      semanticThreshold = 0.3,
      maxResults = 20
    } = options;

    try {
      // Get FTS results
      const ftsResults = await this.searchStandards(query, category, organisation);
      
      // Try to get semantic results (fallback to FTS only if unavailable)
      let vectorResults: any[] = [];
      try {
        vectorResults = await this.vectorStorage.semanticSearch(query, {
          limit: maxResults,
          category,
          sourceOrg: organisation,
          threshold: semanticThreshold
        });
      } catch (error) {
        logger.debug('Vector search unavailable, using FTS only');
        vectorResults = [];
      }

      // Create a map for combining results
      const combinedResults = new Map<string, SearchResult>();

      // Add FTS results
      ftsResults.forEach(result => {
        combinedResults.set(result.standard.id, {
          ...result,
          relevanceScore: result.relevanceScore * (1 - semanticWeight)
        });
      });

      // Add or enhance with semantic results
      vectorResults.forEach(vectorResult => {
        const existingResult = combinedResults.get(vectorResult.id);
        
        if (existingResult) {
          // Combine scores: FTS + semantic
          existingResult.relevanceScore += vectorResult.score * semanticWeight;
          existingResult.matchedFields.push('semantic');
        } else {
          // Create new result from vector search
          combinedResults.set(vectorResult.id, {
            standard: {
              id: vectorResult.id,
              title: vectorResult.metadata.title,
              category: vectorResult.metadata.category,
              url: vectorResult.metadata.url,
              content: vectorResult.document.substring(0, 500) + '...', // Truncated for display
              summary: undefined,
              lastUpdated: vectorResult.metadata.lastUpdated ? new Date(vectorResult.metadata.lastUpdated) : undefined,
              sourceOrg: vectorResult.metadata.sourceOrg || undefined,
              tags: vectorResult.metadata.tags ? JSON.parse(vectorResult.metadata.tags) : [],
              complianceLevel: vectorResult.metadata.complianceLevel || undefined,
              relatedStandards: [],
              createdAt: new Date(vectorResult.metadata.createdAt),
              updatedAt: new Date(vectorResult.metadata.createdAt)
            },
            relevanceScore: vectorResult.score * semanticWeight,
            matchedFields: ['semantic']
          });
        }
      });

      // Convert to array and sort by combined score
      const results = Array.from(combinedResults.values())
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);

      logger.debug(`Hybrid search for "${query}": ${ftsResults.length} FTS + ${vectorResults.length} vector = ${results.length} combined results`);
      
      return results;
    } catch (error) {
      logger.error('Hybrid search failed, falling back to FTS only:', error);
      // Fallback to FTS-only search
      return this.searchStandards(query, category, organisation);
    }
  }

  async getCategories(): Promise<Category[]> {
    const sql = `
      SELECT category as name, COUNT(*) as count
      FROM standards
      GROUP BY category
      ORDER BY count DESC
    `;
    
    const rows = await this.all(sql, []);
    return rows.map(row => ({ name: row.name, count: row.count }));
  }

  async getRecentUpdates(daysBack: number = 30): Promise<Standard[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const sql = `
      SELECT * FROM standards 
      WHERE last_updated >= ? OR updated_at >= ?
      ORDER BY COALESCE(last_updated, updated_at) DESC
    `;
    
    const rows = await this.all(sql, [cutoffDate.toISOString(), cutoffDate.toISOString()]);
    return rows.map(row => this.rowToStandard(row));
  }

  async getAllStandards(): Promise<Standard[]> {
    const sql = 'SELECT * FROM standards ORDER BY category, title';
    const rows = await this.all(sql, []);
    return rows.map(row => this.rowToStandard(row));
  }

  async logScraping(url: string, status: 'success' | 'failed' | 'skipped', errorMessage?: string): Promise<void> {
    const sql = `
      INSERT INTO scraping_log (url, status, error_message)
      VALUES (?, ?, ?)
    `;
    await this.run(sql, [url, status, errorMessage || null]);
  }

  private async updateCategoryCount(category: string): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO categories (name, standards_count)
      VALUES (?, (SELECT COUNT(*) FROM standards WHERE category = ?))
    `;
    await this.run(sql, [category, category]);
  }

  private rowToStandard(row: any): Standard {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      url: row.url,
      content: row.content,
      summary: row.summary || undefined,
      lastUpdated: row.last_updated ? new Date(row.last_updated) : undefined,
      sourceOrg: row.source_org || undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      complianceLevel: row.compliance_level || undefined,
      relatedStandards: row.related_standards ? JSON.parse(row.related_standards) : [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private getMatchedFields(row: any, query: string): string[] {
    const fields: string[] = [];
    const queryLower = query.toLowerCase();
    
    if (row.title.toLowerCase().includes(queryLower)) fields.push('title');
    if (row.content.toLowerCase().includes(queryLower)) fields.push('content');
    if (row.summary && row.summary.toLowerCase().includes(queryLower)) fields.push('summary');
    if (row.tags && row.tags.toLowerCase().includes(queryLower)) fields.push('tags');
    
    return fields;
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) logger.error('Error closing database:', err);
        else logger.info('Database connection closed');
        resolve();
      });
    });
  }
}