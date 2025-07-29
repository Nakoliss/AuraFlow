import { SemanticDeduplicationService, EmbeddingResult } from './semantic-deduplication'
import { LexicalDeduplicationService } from './bloom-filter'
import { DatabaseService } from '../database'
import { logger } from '../logging'
import { AppError, ErrorType } from '../errors'

export interface DeduplicationResult {
    isDuplicate: boolean
    reason: 'semantic' | 'lexical' | 'none'
    confidence: number
    similarMessages?: EmbeddingResult[]
    details?: {
        semanticSimilarity?: number
        lexicalSimilarity?: number
        threshold?: number
    }
}

export interface DeduplicationServiceConfig {
    semantic: {
        similarityThreshold: number
        timeWindowDays: number
        maxResults: number
    }
    lexical: {
        expectedElements: number
        falsePositiveRate: number
        maxCacheSize: number
        similarityThreshold: number
    }
    enableSemanticCheck: boolean
    enableLexicalCheck: boolean
}

export class DeduplicationService {
    private semanticService: SemanticDeduplicationService
    private lexicalService: LexicalDeduplicationService
    private config: DeduplicationServiceConfig

    constructor(db: DatabaseService, config?: Partial<DeduplicationServiceConfig>) {
        const defaultConfig: DeduplicationServiceConfig = {
            semantic: {
                similarityThreshold: 0.20,
                timeWindowDays: 90,
                maxResults: 10
            },
            lexical: {
                expectedElements: 100000,
                falsePositiveRate: 0.01,
                maxCacheSize: 1000,
                similarityThreshold: 0.8
            },
            enableSemanticCheck: true,
            enableLexicalCheck: true
        }

        this.config = { ...defaultConfig, ...config }

        this.semanticService = new SemanticDeduplicationService(db, this.config.semantic)
        this.lexicalService = new LexicalDeduplicationService({
            ...this.config.lexical,
            maxCacheSize: this.config.lexical.maxCacheSize
        })

        logger.info('Deduplication service initialized', {
            enableSemanticCheck: this.config.enableSemanticCheck,
            enableLexicalCheck: this.config.enableLexicalCheck,
            semanticThreshold: this.config.semantic.similarityThreshold,
            lexicalThreshold: this.config.lexical.similarityThreshold
        })
    }

    /**
     * Check if content is duplicate using both semantic and lexical methods
     */
    async checkDuplication(
        userId: string,
        content: string,
        embedding?: number[],
        category?: string
    ): Promise<DeduplicationResult> {
        const startTime = Date.now()

        try {
            let semanticResult: EmbeddingResult[] = []
            let lexicalIsDuplicate = false
            let semanticSimilarity = 0
            let lexicalSimilarity = 0

            // Perform semantic check if enabled and embedding is provided
            if (this.config.enableSemanticCheck && embedding) {
                semanticResult = await this.semanticService.checkSimilarity(userId, embedding, category)
                semanticSimilarity = semanticResult.length > 0 ? semanticResult[0].similarity : 0
            }

            // Perform lexical check if enabled
            if (this.config.enableLexicalCheck) {
                lexicalIsDuplicate = this.lexicalService.isPotentialDuplicate(
                    content,
                    this.config.lexical.similarityThreshold
                )
                // For lexical similarity, we approximate based on the threshold check
                lexicalSimilarity = lexicalIsDuplicate ? this.config.lexical.similarityThreshold : 0
            }

            // Determine if content is duplicate
            const isSemanticDuplicate = semanticResult.length > 0
            const isDuplicate = isSemanticDuplicate || lexicalIsDuplicate

            // Determine primary reason and confidence
            let reason: 'semantic' | 'lexical' | 'none' = 'none'
            let confidence = 0

            if (isSemanticDuplicate && lexicalIsDuplicate) {
                // Both methods agree - high confidence
                reason = semanticSimilarity > lexicalSimilarity ? 'semantic' : 'lexical'
                confidence = Math.max(semanticSimilarity, lexicalSimilarity)
            } else if (isSemanticDuplicate) {
                reason = 'semantic'
                confidence = semanticSimilarity
            } else if (lexicalIsDuplicate) {
                reason = 'lexical'
                confidence = lexicalSimilarity
            }

            const duration = Date.now() - startTime

            logger.info('Deduplication check completed', {
                userId,
                category,
                isDuplicate,
                reason,
                confidence,
                semanticMatches: semanticResult.length,
                lexicalMatch: lexicalIsDuplicate,
                duration
            })

            return {
                isDuplicate,
                reason,
                confidence,
                similarMessages: semanticResult.length > 0 ? semanticResult : undefined,
                details: {
                    semanticSimilarity,
                    lexicalSimilarity,
                    threshold: reason === 'semantic'
                        ? this.config.semantic.similarityThreshold
                        : this.config.lexical.similarityThreshold
                }
            }

        } catch (error) {
            logger.error('Deduplication check failed', {
                userId,
                category,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to check content duplication',
                'DEDUPLICATION_CHECK_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Add content to deduplication systems after successful generation
     */
    async addContent(
        messageId: string,
        userId: string,
        content: string,
        embedding?: number[],
        category?: string
    ): Promise<void> {
        try {
            const promises: Promise<void>[] = []

            // Add to semantic system if embedding is provided
            if (this.config.enableSemanticCheck && embedding && category) {
                promises.push(
                    this.semanticService.storeEmbedding(messageId, userId, content, embedding, category)
                )
            }

            // Add to lexical system
            if (this.config.enableLexicalCheck) {
                promises.push(
                    Promise.resolve(this.lexicalService.addText(content))
                )
            }

            await Promise.all(promises)

            logger.info('Content added to deduplication systems', {
                messageId,
                userId,
                category,
                hasEmbedding: !!embedding,
                contentLength: content.length
            })

        } catch (error) {
            logger.error('Failed to add content to deduplication systems', {
                messageId,
                userId,
                category,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to add content to deduplication systems',
                'DEDUPLICATION_ADD_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Get comprehensive deduplication statistics
     */
    async getStats(userId?: string): Promise<{
        semantic?: Awaited<ReturnType<SemanticDeduplicationService['getEmbeddingStats']>>
        lexical: ReturnType<LexicalDeduplicationService['getStats']>
        config: DeduplicationServiceConfig
    }> {
        try {
            const stats: any = {
                lexical: this.lexicalService.getStats(),
                config: this.config
            }

            if (this.config.enableSemanticCheck && userId) {
                stats.semantic = await this.semanticService.getEmbeddingStats(userId)
            }

            return stats

        } catch (error) {
            logger.error('Failed to get deduplication statistics', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to get deduplication statistics',
                'DEDUPLICATION_STATS_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Perform maintenance tasks
     */
    async performMaintenance(): Promise<{
        semanticCleaned: number
        lexicalStats: ReturnType<LexicalDeduplicationService['getStats']>
    }> {
        try {
            const startTime = Date.now()

            // Clean up old semantic embeddings
            const semanticCleaned = this.config.enableSemanticCheck
                ? await this.semanticService.cleanupOldEmbeddings()
                : 0

            // Get lexical stats (no cleanup needed for Bloom filter)
            const lexicalStats = this.lexicalService.getStats()

            const duration = Date.now() - startTime

            logger.info('Deduplication maintenance completed', {
                semanticCleaned,
                lexicalFillRatio: lexicalStats.fillRatio,
                duration
            })

            return {
                semanticCleaned,
                lexicalStats
            }

        } catch (error) {
            logger.error('Deduplication maintenance failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to perform deduplication maintenance',
                'DEDUPLICATION_MAINTENANCE_FAILED',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<DeduplicationServiceConfig>): void {
        this.config = { ...this.config, ...config }

        // Update semantic service config
        if (config.semantic) {
            this.semanticService.updateConfig(config.semantic)
        }

        logger.info('Deduplication service configuration updated', {
            config: this.config
        })
    }

    /**
     * Clear all deduplication data (use with caution)
     */
    clear(): void {
        this.lexicalService.clear()

        logger.warn('Deduplication service data cleared')
    }
}