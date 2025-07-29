// Semantic deduplication system for AuraFlow
// Implements pgvector embedding storage, cosine similarity checking, and lexical Bloom filter

import { executeQuery, executeTransaction, DatabaseClient } from './database'
import { GeneratedMessage, MessageCategory } from './types'
import { DatabaseError, ContentGenerationError } from './errors'
import { createServiceLogger } from './logging'

const logger = createServiceLogger('deduplication')

// Configuration for deduplication system
export interface DeduplicationConfig {
  semanticSimilarityThreshold: number // Cosine similarity threshold (default: 0.20)
  deduplicationWindowDays: number // Days to check for duplicates (default: 90)
  bloomFilterCapacity: number // Expected number of items in Bloom filter
  bloomFilterErrorRate: number // False positive rate for Bloom filter
  embeddingDimension: number // OpenAI embedding dimension (1536)
}

export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  semanticSimilarityThreshold: 0.20,
  deduplicationWindowDays: 90,
  bloomFilterCapacity: 100000,
  bloomFilterErrorRate: 0.01,
  embeddingDimension: 1536
}

// Interface for embedding generation service
export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>
}

// OpenAI embedding service implementation
export class OpenAIEmbeddingService implements EmbeddingService {
  private apiKey: string
  private model: string = 'text-embedding-3-small'
  private baseUrl = 'https://api.openai.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      logger.debug('Generating embedding for text', { textLength: text.length })

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: 'float'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()
      
      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI')
      }

      const embedding = data.data[0].embedding
      
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding format returned from OpenAI')
      }

      logger.debug('Successfully generated embedding', { 
        dimension: embedding.length,
        usage: data.usage 
      })

      return embedding

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to generate embedding', { error: errorMessage })
      throw new ContentGenerationError(`Embedding generation failed: ${errorMessage}`)
    }
  }
}

// Simple Bloom filter implementation for lexical deduplication
export class BloomFilter {
  private bitArray: boolean[]
  private size: number
  private hashFunctions: number

  constructor(capacity: number, errorRate: number) {
    // Calculate optimal bit array size and number of hash functions
    this.size = Math.ceil((-capacity * Math.log(errorRate)) / (Math.log(2) ** 2))
    this.hashFunctions = Math.ceil((this.size / capacity) * Math.log(2))
    this.bitArray = new Array(this.size).fill(false)

    logger.debug('Initialized Bloom filter', {
      capacity,
      errorRate,
      size: this.size,
      hashFunctions: this.hashFunctions
    })
  }

  // Simple hash function (djb2 algorithm)
  private hash(str: string, seed: number = 0): number {
    let hash = 5381 + seed
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i)
    }
    return Math.abs(hash) % this.size
  }

  // Add item to Bloom filter
  add(item: string): void {
    for (let i = 0; i < this.hashFunctions; i++) {
      const index = this.hash(item, i)
      this.bitArray[index] = true
    }
  }

  // Check if item might be in the set (can have false positives)
  mightContain(item: string): boolean {
    for (let i = 0; i < this.hashFunctions; i++) {
      const index = this.hash(item, i)
      if (!this.bitArray[index]) {
        return false
      }
    }
    return true
  }

  // Get current false positive probability estimate
  getCurrentFalsePositiveRate(): number {
    const setBits = this.bitArray.filter(bit => bit).length
    const ratio = setBits / this.size
    return Math.pow(ratio, this.hashFunctions)
  }

  // Clear the filter
  clear(): void {
    this.bitArray.fill(false)
  }
}

// Trigram generator for lexical similarity
export class TrigramGenerator {
  static generateTrigrams(text: string): string[] {
    // Normalize text: lowercase, remove punctuation, extra spaces
    const normalized = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (normalized.length < 3) {
      return [normalized]
    }

    const trigrams: string[] = []
    
    // Add padding for word boundaries
    const padded = `  ${normalized}  `
    
    // Generate character-level trigrams
    for (let i = 0; i <= padded.length - 3; i++) {
      trigrams.push(padded.substring(i, i + 3))
    }

    return trigrams
  }

  static calculateTrigramSimilarity(text1: string, text2: string): number {
    const trigrams1 = new Set(this.generateTrigrams(text1))
    const trigrams2 = new Set(this.generateTrigrams(text2))

    const intersection = new Set([...trigrams1].filter(x => trigrams2.has(x)))
    const union = new Set([...trigrams1, ...trigrams2])

    if (union.size === 0) return 0
    return intersection.size / union.size
  }
}

// Database operations for embedding storage and retrieval
export class EmbeddingStorage {
  private config: DeduplicationConfig

  constructor(config: DeduplicationConfig = DEFAULT_DEDUPLICATION_CONFIG) {
    this.config = config
  }

  // Store message with embedding in database
  async storeMessageWithEmbedding(
    message: GeneratedMessage,
    embedding: number[]
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO messages (
          id, user_id, content, category, embedding, tokens, cost, 
          temperature, model, time_of_day, weather_context, locale, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `

      const params = [
        message.id,
        message.userId,
        message.content,
        message.category,
        `[${embedding.join(',')}]`, // PostgreSQL array format
        message.tokens,
        message.cost,
        message.temperature,
        message.model,
        message.timeOfDay,
        message.weatherContext,
        message.locale,
        message.createdAt
      ]

      await executeQuery(query, params)

      logger.debug('Stored message with embedding', {
        messageId: message.id,
        embeddingDimension: embedding.length
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to store message with embedding', {
        messageId: message.id,
        error: errorMessage
      })
      throw new DatabaseError(`Failed to store message: ${errorMessage}`, 'store_embedding')
    }
  }

  // Find similar messages using cosine similarity
  async findSimilarMessages(
    embedding: number[],
    userId: string,
    category?: MessageCategory,
    limit: number = 10
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    try {
      const embeddingStr = `[${embedding.join(',')}]`
      
      let query = `
        SELECT 
          id, 
          content, 
          (embedding <-> $1::vector) as distance,
          (1 - (embedding <-> $1::vector)) as similarity
        FROM messages 
        WHERE user_id = $2 
          AND created_at > NOW() - INTERVAL '${this.config.deduplicationWindowDays} days'
          AND (embedding <-> $1::vector) < $3
      `

      const params: any[] = [embeddingStr, userId, this.config.semanticSimilarityThreshold]

      if (category) {
        query += ` AND category = $4`
        params.push(category)
      }

      query += ` ORDER BY distance ASC LIMIT $${params.length + 1}`
      params.push(limit)

      const result = await executeQuery<{
        id: string
        content: string
        distance: number
        similarity: number
      }>(query, params)

      logger.debug('Found similar messages', {
        userId,
        category,
        count: result.rows.length,
        threshold: this.config.semanticSimilarityThreshold
      })

      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        similarity: row.similarity
      }))

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to find similar messages', {
        userId,
        category,
        error: errorMessage
      })
      throw new DatabaseError(`Failed to find similar messages: ${errorMessage}`, 'find_similar')
    }
  }

  // Get recent messages for Bloom filter initialization
  async getRecentMessagesForBloomFilter(
    userId: string,
    days: number = 30
  ): Promise<string[]> {
    try {
      const query = `
        SELECT content 
        FROM messages 
        WHERE user_id = $1 
          AND created_at > NOW() - INTERVAL '${days} days'
        ORDER BY created_at DESC
      `

      const result = await executeQuery<{ content: string }>(query, [userId])

      logger.debug('Retrieved recent messages for Bloom filter', {
        userId,
        count: result.rows.length,
        days
      })

      return result.rows.map(row => row.content)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get recent messages for Bloom filter', {
        userId,
        error: errorMessage
      })
      throw new DatabaseError(`Failed to get recent messages: ${errorMessage}`, 'get_recent')
    }
  }
}

// Main semantic deduplication service
export class SemanticDeduplicationService {
  private embeddingService: EmbeddingService
  private embeddingStorage: EmbeddingStorage
  private bloomFilters: Map<string, BloomFilter> = new Map()
  private config: DeduplicationConfig

  constructor(
    embeddingService: EmbeddingService,
    config: DeduplicationConfig = DEFAULT_DEDUPLICATION_CONFIG
  ) {
    this.embeddingService = embeddingService
    this.embeddingStorage = new EmbeddingStorage(config)
    this.config = config
  }

  // Initialize Bloom filter for a user
  private async initializeBloomFilter(userId: string): Promise<BloomFilter> {
    const bloomFilter = new BloomFilter(
      this.config.bloomFilterCapacity,
      this.config.bloomFilterErrorRate
    )

    try {
      // Load recent messages to populate Bloom filter
      const recentMessages = await this.embeddingStorage.getRecentMessagesForBloomFilter(userId)
      
      for (const content of recentMessages) {
        const trigrams = TrigramGenerator.generateTrigrams(content)
        for (const trigram of trigrams) {
          bloomFilter.add(trigram)
        }
      }

      this.bloomFilters.set(userId, bloomFilter)

      logger.debug('Initialized Bloom filter for user', {
        userId,
        messageCount: recentMessages.length,
        falsePositiveRate: bloomFilter.getCurrentFalsePositiveRate()
      })

      return bloomFilter

    } catch (error) {
      logger.error('Failed to initialize Bloom filter', { userId, error })
      // Return empty filter on error
      return bloomFilter
    }
  }

  // Get or create Bloom filter for user
  private async getBloomFilter(userId: string): Promise<BloomFilter> {
    let bloomFilter = this.bloomFilters.get(userId)
    
    if (!bloomFilter) {
      bloomFilter = await this.initializeBloomFilter(userId)
    }

    return bloomFilter
  }

  // Check for lexical similarity using Bloom filter and trigrams
  async checkLexicalSimilarity(content: string, userId: string): Promise<{
    isDuplicate: boolean
    similarity: number
    method: 'bloom_filter' | 'trigram'
  }> {
    try {
      const bloomFilter = await this.getBloomFilter(userId)
      const trigrams = TrigramGenerator.generateTrigrams(content)

      // Quick Bloom filter check
      let bloomHits = 0
      for (const trigram of trigrams) {
        if (bloomFilter.mightContain(trigram)) {
          bloomHits++
        }
      }

      const bloomSimilarity = trigrams.length > 0 ? bloomHits / trigrams.length : 0

      // If Bloom filter suggests high similarity, do detailed trigram comparison
      if (bloomSimilarity > 0.7) {
        const recentMessages = await this.embeddingStorage.getRecentMessagesForBloomFilter(userId, 7)
        
        let maxTrigramSimilarity = 0
        for (const recentContent of recentMessages) {
          const similarity = TrigramGenerator.calculateTrigramSimilarity(content, recentContent)
          maxTrigramSimilarity = Math.max(maxTrigramSimilarity, similarity)
        }

        if (maxTrigramSimilarity > 0.8) {
          return {
            isDuplicate: true,
            similarity: maxTrigramSimilarity,
            method: 'trigram'
          }
        }
      }

      return {
        isDuplicate: false,
        similarity: bloomSimilarity,
        method: 'bloom_filter'
      }

    } catch (error) {
      logger.error('Lexical similarity check failed', { userId, error })
      return {
        isDuplicate: false,
        similarity: 0,
        method: 'bloom_filter'
      }
    }
  }

  // Check for semantic similarity using embeddings
  async checkSemanticSimilarity(
    content: string,
    userId: string,
    category?: MessageCategory
  ): Promise<{
    isDuplicate: boolean
    similarity: number
    similarMessages: Array<{ id: string; content: string; similarity: number }>
  }> {
    try {
      // Generate embedding for the content
      const embedding = await this.embeddingService.generateEmbedding(content)

      // Find similar messages
      const similarMessages = await this.embeddingStorage.findSimilarMessages(
        embedding,
        userId,
        category,
        5
      )

      const maxSimilarity = similarMessages.length > 0 
        ? Math.max(...similarMessages.map(m => m.similarity))
        : 0

      const isDuplicate = maxSimilarity > (1 - this.config.semanticSimilarityThreshold)

      logger.debug('Semantic similarity check completed', {
        userId,
        category,
        maxSimilarity,
        isDuplicate,
        similarCount: similarMessages.length
      })

      return {
        isDuplicate,
        similarity: maxSimilarity,
        similarMessages
      }

    } catch (error) {
      logger.error('Semantic similarity check failed', { userId, category, error })
      return {
        isDuplicate: false,
        similarity: 0,
        similarMessages: []
      }
    }
  }

  // Main deduplication check combining both methods
  async checkForDuplicates(
    content: string,
    userId: string,
    category?: MessageCategory
  ): Promise<{
    isDuplicate: boolean
    reason: 'lexical' | 'semantic' | 'none'
    similarity: number
    details: {
      lexical: { similarity: number; method: string }
      semantic: { similarity: number; similarMessages: any[] }
    }
  }> {
    try {
      logger.debug('Starting deduplication check', { userId, category, contentLength: content.length })

      // First, quick lexical check
      const lexicalResult = await this.checkLexicalSimilarity(content, userId)

      if (lexicalResult.isDuplicate) {
        return {
          isDuplicate: true,
          reason: 'lexical',
          similarity: lexicalResult.similarity,
          details: {
            lexical: { similarity: lexicalResult.similarity, method: lexicalResult.method },
            semantic: { similarity: 0, similarMessages: [] }
          }
        }
      }

      // If lexical check passes, do semantic check
      const semanticResult = await this.checkSemanticSimilarity(content, userId, category)

      return {
        isDuplicate: semanticResult.isDuplicate,
        reason: semanticResult.isDuplicate ? 'semantic' : 'none',
        similarity: Math.max(lexicalResult.similarity, semanticResult.similarity),
        details: {
          lexical: { similarity: lexicalResult.similarity, method: lexicalResult.method },
          semantic: { 
            similarity: semanticResult.similarity, 
            similarMessages: semanticResult.similarMessages 
          }
        }
      }

    } catch (error) {
      logger.error('Deduplication check failed', { userId, category, error })
      return {
        isDuplicate: false,
        reason: 'none',
        similarity: 0,
        details: {
          lexical: { similarity: 0, method: 'error' },
          semantic: { similarity: 0, similarMessages: [] }
        }
      }
    }
  }

  // Store message after successful generation
  async storeMessage(message: GeneratedMessage): Promise<void> {
    try {
      // Generate embedding if not already present
      let embedding = message.embedding
      if (!embedding || embedding.length === 0) {
        embedding = await this.embeddingService.generateEmbedding(message.content)
      }

      // Store in database
      await this.embeddingStorage.storeMessageWithEmbedding(message, embedding)

      // Update Bloom filter
      if (message.userId) {
        const bloomFilter = await this.getBloomFilter(message.userId)
        const trigrams = TrigramGenerator.generateTrigrams(message.content)
        for (const trigram of trigrams) {
          bloomFilter.add(trigram)
        }
      }

      logger.info('Successfully stored message with deduplication data', {
        messageId: message.id,
        userId: message.userId,
        category: message.category
      })

    } catch (error) {
      logger.error('Failed to store message', { messageId: message.id, error })
      throw error
    }
  }

  // Clear Bloom filter for user (useful for testing or cache invalidation)
  clearUserBloomFilter(userId: string): void {
    this.bloomFilters.delete(userId)
    logger.debug('Cleared Bloom filter for user', { userId })
  }

  // Get deduplication statistics
  getStats(): {
    activeBloomFilters: number
    config: DeduplicationConfig
  } {
    return {
      activeBloomFilters: this.bloomFilters.size,
      config: this.config
    }
  }
}