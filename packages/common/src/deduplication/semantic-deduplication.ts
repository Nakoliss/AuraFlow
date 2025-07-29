import { DatabaseService } from '../database'
import { logger } from '../logging'
import { AppError, ErrorType } from '../errors'

export interface EmbeddingResult {
    id: string
    content: string
    similarity: number
    createdAt: Date
}

export interface DeduplicationConfig {
    similarityThreshold: number
    timeWindowDays: number
    maxResults: number
}

export class SemanticDeduplicationService {
    private db: DatabaseService
    private config: DeduplicationConfig

    constructor(db: DatabaseService, config?: Partial<DeduplicationConfig>) {
        this.db = db
        this.config = {
            similarityThreshold: 0.20, // Cosine similarity threshold
            timeWindowDays: 90, // 90-day deduplication window
            maxResults: 10,
            ...config
        }
    }

    /**
     * Check if content is similar to existing messages for a user
     */
    async checkSimilarity(
        userId: string,
        embedding: number[],
        category?: string
    ): Promise<EmbeddingResult[]> {
        try {
            const startTime = Date.now()

            // Build the query with optional category filter
            let query = `
        SELECT 
          id,
          content,
          (embedding <-> $1::vector) as distance,
          created_at
        FROM messages 
        WHERE user_id = $2 
          AND created_at > NOW() - INTERVAL '${this.config.timeWindowDays} days'
          AND (embedding <-> $1::vector) < $3
      `

            const params: any[] = [
                `[${embedding.join(',')}]`, // Convert array to vector string
                userId,
                this.config.similarityThreshold
            ]

            if (category) {
                query += ` AND category = $4`
                params.push(category)
            }

            query += `
        ORDER BY distance ASC
        LIMIT $${params.length + 1}
      `
            params.push(this.config.maxResults)

            const result = await this.db.query(query, params)

            const similarMessages: EmbeddingResult[] = result.rows.map(row => ({
                id: row.id,
                content: row.content,
                similarity: 1 - row.distance, // Convert distance to similarity
                createdAt: row.created_at
            }))

            const duration = Date.now() - startTime

            logger.info('Semantic similarity check completed', {
                userId,
                category,
                similarMessages: similarMessages.length,
                threshold: this.config.similarityThreshold,
                duration
            })

            return similarMessages

        } catch (error) {
            logger.error('Semantic similarity check failed', {
                userId,
                category,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to check semantic similarity',
                'SEMANTIC_CHECK_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Check if content is duplicate based on similarity threshold
     */
    async isDuplicate(
        userId: string,
        embedding: number[],
        category?: string
    ): Promise<boolean> {
        const similarMessages = await this.checkSimilarity(userId, embedding, category)
        return similarMessages.length > 0
    }

    /**
     * Store message embedding for future deduplication
     */
    async storeEmbedding(
        messageId: string,
        userId: string,
        content: string,
        embedding: number[],
        category: string
    ): Promise<void> {
        try {
            const query = `
        UPDATE messages 
        SET embedding = $1::vector
        WHERE id = $2 AND user_id = $3
      `

            await this.db.query(query, [
                `[${embedding.join(',')}]`,
                messageId,
                userId
            ])

            logger.info('Message embedding stored', {
                messageId,
                userId,
                category,
                embeddingDimension: embedding.length
            })

        } catch (error) {
            logger.error('Failed to store message embedding', {
                messageId,
                userId,
                category,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to store message embedding',
                'EMBEDDING_STORE_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Get embedding statistics for a user
     */
    async getEmbeddingStats(userId: string): Promise<{
        totalMessages: number
        messagesWithEmbeddings: number
        oldestMessage: Date | null
        newestMessage: Date | null
    }> {
        try {
            const query = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(embedding) as messages_with_embeddings,
          MIN(created_at) as oldest_message,
          MAX(created_at) as newest_message
        FROM messages 
        WHERE user_id = $1
      `

            const result = await this.db.query(query, [userId])
            const row = result.rows[0]

            return {
                totalMessages: parseInt(row.total_messages),
                messagesWithEmbeddings: parseInt(row.messages_with_embeddings),
                oldestMessage: row.oldest_message,
                newestMessage: row.newest_message
            }

        } catch (error) {
            logger.error('Failed to get embedding statistics', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to get embedding statistics',
                'EMBEDDING_STATS_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Clean up old embeddings outside the time window
     */
    async cleanupOldEmbeddings(): Promise<number> {
        try {
            const query = `
        UPDATE messages 
        SET embedding = NULL
        WHERE created_at < NOW() - INTERVAL '${this.config.timeWindowDays + 30} days'
          AND embedding IS NOT NULL
      `

            const result = await this.db.query(query)
            const cleanedCount = result.rowCount || 0

            logger.info('Old embeddings cleaned up', {
                cleanedCount,
                timeWindowDays: this.config.timeWindowDays
            })

            return cleanedCount

        } catch (error) {
            logger.error('Failed to cleanup old embeddings', {
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to cleanup old embeddings',
                'EMBEDDING_CLEANUP_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<DeduplicationConfig>): void {
        this.config = { ...this.config, ...config }

        logger.info('Semantic deduplication configuration updated', {
            config: this.config
        })
    }
}