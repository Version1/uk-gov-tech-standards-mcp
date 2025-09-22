import { pipeline } from '@xenova/transformers';
import logger from '../utils/logger.js';

/**
 * Service for generating text embeddings using Transformers.js
 * Uses a lightweight, efficient model that runs locally without API calls
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private embeddingPipeline: any = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Initialize the embedding pipeline
   * Uses 'Xenova/all-MiniLM-L6-v2' - a good balance of speed and quality
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing embedding service...');
      
      // Use a lightweight, fast embedding model
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          // Cache the model locally to avoid re-downloading
          cache_dir: './models'
        }
      );

      this.isInitialized = true;
      logger.info('Embedding service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize embedding service:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for a text string
   * @param text - The text to embed
   * @returns Float32Array of embeddings
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.isInitialized || !this.embeddingPipeline) {
      await this.initialize();
    }

    try {
      // Clean and prepare text
      const cleanText = this.preprocessText(text);
      
      // Generate embeddings
      const result = await this.embeddingPipeline!(cleanText, {
        pooling: 'mean',
        normalize: true
      });

      // Extract the embedding array
      const embedding = result.data as Float32Array;
      
      logger.debug(`Generated embedding for text (length: ${text.length}), embedding dimension: ${embedding.length}`);
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient for processing many texts at once
   */
  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    if (!this.isInitialized || !this.embeddingPipeline) {
      await this.initialize();
    }

    const embeddings: Float32Array[] = [];
    
    // Process in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      logger.info(`Processing embedding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
      
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Create a searchable text representation for embedding
   * Combines title, summary, content, and tags for comprehensive semantic understanding
   */
  createEmbeddingText(standard: {
    title: string;
    content: string;
    summary?: string;
    tags: string[];
    category: string;
  }): string {
    const parts = [
      // Title gets extra weight by being repeated
      standard.title,
      standard.title,
      
      // Category for context
      `Category: ${standard.category}`,
      
      // Summary if available
      standard.summary || '',
      
      // Tags for additional context
      standard.tags.length > 0 ? `Tags: ${standard.tags.join(', ')}` : '',
      
      // Content (truncated to avoid overwhelming the embedding)
      this.truncateContent(standard.content, 1000)
    ].filter(Boolean);

    return parts.join('\n\n');
  }

  /**
   * Preprocess text for better embedding quality
   */
  private preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-.,!?]/g, '') // Remove special characters except basic punctuation
      .substring(0, 512); // Limit length for the model
  }

  /**
   * Truncate content while preserving sentence boundaries
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Find the last sentence boundary before maxLength
    const truncated = content.substring(0, maxLength);
    const lastSentence = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentence > maxLength * 0.8) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + '...';
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default EmbeddingService;
