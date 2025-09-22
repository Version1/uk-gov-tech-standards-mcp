// Import ChromaDB client
import { EmbeddingService } from './embedding-service.js';
import { Standard } from '../types/standard.js';
import logger from '../utils/logger.js';
import path from 'path';

/**
 * Vector storage service using Chroma DB for semantic search
 */
export class VectorStorageService {
  private static instance: VectorStorageService;
  private chroma: any = null;
  private collection: any = null;
  private embeddingService: EmbeddingService;
  private isInitialized = false;
  private readonly collectionName = 'uk_gov_standards';
  private readonly chromaPath: string;

  private constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    // Store Chroma data in a dedicated directory
    this.chromaPath = path.resolve('./chroma_data');
  }

  static getInstance(): VectorStorageService {
    if (!VectorStorageService.instance) {
      VectorStorageService.instance = new VectorStorageService();
    }
    return VectorStorageService.instance;
  }

  /**
   * Initialize Chroma DB and create/get collection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing vector storage service...');
      
      // Initialize Chroma client
      const { ChromaClient } = await import('chromadb');
      this.chroma = new ChromaClient();

      // Initialize embedding service
      await this.embeddingService.initialize();

      // Create a custom embedding function that uses our service
      const customEmbeddingFunction = {
        generate: async (texts: string[]) => {
          return await this.embeddingService.generateEmbeddings(texts);
        }
      };

      // Create or get collection
      try {
        this.collection = await this.chroma.getCollection({
          name: this.collectionName,
          embeddingFunction: customEmbeddingFunction
        });
        logger.info(`Using existing collection: ${this.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.chroma.createCollection({
          name: this.collectionName,
          embeddingFunction: customEmbeddingFunction,
          metadata: {
            description: 'UK Government Technology Standards embeddings',
            created_at: new Date().toISOString()
          }
        });
        logger.info(`Created new collection: ${this.collectionName}`);
      }

      this.isInitialized = true;
      logger.info('Vector storage service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector storage service:', error);
      throw error;
    }
  }

  /**
   * Add a standard to the vector store
   */
  async addStandard(standard: Standard): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Create embedding text
      const embeddingText = this.embeddingService.createEmbeddingText(standard);

      // Add to Chroma collection (embeddings will be generated automatically)
      await this.collection!.add({
        ids: [standard.id],
        documents: [embeddingText],
        metadatas: [{
          id: standard.id,
          title: standard.title,
          category: standard.category,
          sourceOrg: standard.sourceOrg || '',
          complianceLevel: standard.complianceLevel || '',
          url: standard.url,
          tags: JSON.stringify(standard.tags),
          lastUpdated: standard.lastUpdated?.toISOString() || '',
          createdAt: standard.createdAt.toISOString()
        }]
      });

      logger.debug(`Added standard to vector store: ${standard.id}`);
    } catch (error) {
      logger.error(`Failed to add standard to vector store: ${standard.id}`, error);
      throw error;
    }
  }

  /**
   * Add multiple standards in batch
   */
  async addStandards(standards: Standard[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (standards.length === 0) {
      return;
    }

    try {
      logger.info(`Adding ${standards.length} standards to vector store...`);

      // Prepare embedding texts
      const embeddingTexts = standards.map(standard => 
        this.embeddingService.createEmbeddingText(standard)
      );

      // Prepare data for Chroma
      const ids = standards.map(s => s.id);
      const documents = embeddingTexts;
      const metadatas = standards.map(standard => ({
        id: standard.id,
        title: standard.title,
        category: standard.category,
        sourceOrg: standard.sourceOrg || '',
        complianceLevel: standard.complianceLevel || '',
        url: standard.url,
        tags: JSON.stringify(standard.tags),
        lastUpdated: standard.lastUpdated?.toISOString() || '',
        createdAt: standard.createdAt.toISOString()
      }));

      // Add to collection (embeddings will be generated automatically)
      await this.collection!.add({
        ids,
        documents,
        metadatas
      });

      logger.info(`Successfully added ${standards.length} standards to vector store`);
    } catch (error) {
      logger.error('Failed to add standards to vector store:', error);
      throw error;
    }
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    query: string, 
    options: {
      limit?: number;
      category?: string;
      sourceOrg?: string;
      complianceLevel?: string;
      threshold?: number; // Minimum similarity score
    } = {}
  ): Promise<Array<{
    id: string;
    score: number;
    metadata: any;
    document: string;
  }>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Build where clause for filtering
      const whereClause: any = {};
      if (options.category) {
        whereClause.category = options.category;
      }
      if (options.sourceOrg) {
        whereClause.sourceOrg = options.sourceOrg;
      }
      if (options.complianceLevel) {
        whereClause.complianceLevel = options.complianceLevel;
      }

      // Query Chroma (embeddings will be generated automatically)
      const results = await this.collection!.query({
        queryTexts: [query],
        nResults: options.limit || 10,
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined
      });

      // Process results
      const processedResults = [];
      if (results.ids && results.distances && results.metadatas && results.documents) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const score = 1 - (results.distances[0][i] || 0); // Convert distance to similarity
          
          // Apply threshold filter
          if (options.threshold && score < options.threshold) {
            continue;
          }

          processedResults.push({
            id: results.ids[0][i],
            score,
            metadata: results.metadatas[0][i],
            document: results.documents[0][i] || ''
          });
        }
      }

      logger.debug(`Semantic search for "${query}" returned ${processedResults.length} results`);
      return processedResults;
    } catch (error) {
      logger.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Update a standard in the vector store
   */
  async updateStandard(standard: Standard): Promise<void> {
    try {
      // Remove existing
      await this.removeStandard(standard.id);
      
      // Add updated version
      await this.addStandard(standard);
      
      logger.debug(`Updated standard in vector store: ${standard.id}`);
    } catch (error) {
      logger.error(`Failed to update standard in vector store: ${standard.id}`, error);
      throw error;
    }
  }

  /**
   * Remove a standard from the vector store
   */
  async removeStandard(standardId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.collection!.delete({
        ids: [standardId]
      });
      
      logger.debug(`Removed standard from vector store: ${standardId}`);
    } catch (error) {
      logger.error(`Failed to remove standard from vector store: ${standardId}`, error);
      // Don't throw - removal might fail if item doesn't exist
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    collectionName: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const count = await this.collection!.count();
      return {
        totalDocuments: count,
        collectionName: this.collectionName
      };
    } catch (error) {
      logger.error('Failed to get vector store stats:', error);
      return {
        totalDocuments: 0,
        collectionName: this.collectionName
      };
    }
  }

  /**
   * Clear all data from the collection
   */
  async clearCollection(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.chroma!.deleteCollection({ name: this.collectionName });
      
      // Recreate empty collection
      this.collection = await this.chroma!.createCollection({
        name: this.collectionName,
        metadata: {
          description: 'UK Government Technology Standards embeddings',
          created_at: new Date().toISOString()
        }
      });

      logger.info('Vector store collection cleared and recreated');
    } catch (error) {
      logger.error('Failed to clear vector store collection:', error);
      throw error;
    }
  }
}

export default VectorStorageService;
