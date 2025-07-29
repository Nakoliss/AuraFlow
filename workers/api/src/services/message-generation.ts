import {
    AIService,
    DeduplicationService,
    DatabaseService,
    MessageRequest,
    GeneratedMessage,
    MessageCategory,
    TimeOfDay,
    WeatherBucket,
    AppError,
    ErrorType,
    logger
} from '@aura-flow/common'

export interface MessageGenerationRequest {
    userId: string
    category: MessageCategory
    timeOfDay?: TimeOfDay
    weatherContext?: WeatherBucket
    locale?: string
    temperature?: number
}

export interface MessageGenerationResponse {
    id: string
    content: string
    category: MessageCategory
    tokens: number
    cost: number
    model: string
    timeOfDay?: TimeOfDay
    weatherContext?: WeatherBucket
    locale: string
    createdAt: Date
    cached: boolean
}

export interface MessageGenerationConfig {
    maxRetries: number
    retryDelay: number
    enableCaching: boolean
    enableDeduplication: boolean
    costTrackingEnabled: boolean
}

export class MessageGenerationService {
    private aiService: AIService
    private deduplicationService: DeduplicationService
    private db: DatabaseService
    private config: MessageGenerationConfig

    constructor(
        aiService: AIService,
        deduplicationService: DeduplicationService,
        db: DatabaseService,
        config?: Partial<MessageGenerationConfig>
    ) {
        this.aiService = aiService
        this.deduplicationService = deduplicationService
        this.db = db
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            enableCaching: true,
            enableDeduplication: true,
            costTrackingEnabled: true,
            ...config
        }

        logger.info('Message generation service initialized', {
            config: this.config
        })
    }

    /**
     * Generate a new message for a user
     */
    async generateMessage(request: MessageGenerationRequest): Promise<MessageGenerationResponse> {
        const startTime = Date.now()

        try {
            // Validate request
            this.validateRequest(request)

            // Check cache first if enabled
            if (this.config.enableCaching) {
                const cachedMessage = await this.checkCache(request)
                if (cachedMessage) {
                    logger.info('Message served from cache', {
                        userId: request.userId,
                        category: request.category,
                        messageId: cachedMessage.id,
                        duration: Date.now() - startTime
                    })

                    return {
                        ...cachedMessage,
                        cached: true
                    }
                }
            }

            // Generate message with retries
            let lastError: Error | null = null

            for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
                try {
                    const message = await this.generateNewMessage(request, attempt)

                    logger.info('Message generated successfully', {
                        userId: request.userId,
                        category: request.category,
                        messageId: message.id,
                        attempt,
                        duration: Date.now() - startTime,
                        tokens: message.tokens,
                        cost: message.cost
                    })

                    return {
                        ...message,
                        cached: false
                    }

                } catch (error) {
                    lastError = error instanceof Error ? error : new Error('Unknown error')

                    logger.warn('Message generation attempt failed', {
                        userId: request.userId,
                        category: request.category,
                        attempt,
                        error: lastError.message,
                        willRetry: attempt < this.config.maxRetries
                    })

                    if (attempt < this.config.maxRetries) {
                        await this.delay(this.config.retryDelay * attempt)
                    }
                }
            }

            // All retries failed
            throw new AppError(
                ErrorType.CONTENT_GENERATION,
                'Failed to generate message after all retries',
                'MESSAGE_GENERATION_FAILED',
                {
                    attempts: this.config.maxRetries,
                    lastError: lastError?.message
                }
            )

        } catch (error) {
            const duration = Date.now() - startTime

            logger.error('Message generation failed', {
                userId: request.userId,
                category: request.category,
                duration,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw error
        }
    }

    /**
     * Generate a new message (single attempt)
     */
    private async generateNewMessage(
        request: MessageGenerationRequest,
        attempt: number
    ): Promise<MessageGenerationResponse> {
        // Create AI request
        const aiRequest: MessageRequest = {
            userId: request.userId,
            category: request.category,
            timeOfDay: request.timeOfDay,
            weatherContext: request.weatherContext,
            locale: request.locale || 'en-US',
            temperature: request.temperature
        }

        // Generate content with AI
        const aiResponse = await this.aiService.generateMessage(aiRequest)

        // Check for duplication if enabled
        if (this.config.enableDeduplication) {
            // For now, we'll skip embedding generation and just use lexical deduplication
            // In a full implementation, you'd generate embeddings here
            const duplicationResult = await this.deduplicationService.checkDuplication(
                request.userId,
                aiResponse.content,
                undefined, // No embedding for now
                request.category
            )

            if (duplicationResult.isDuplicate) {
                logger.info('Generated content is duplicate, retrying', {
                    userId: request.userId,
                    category: request.category,
                    reason: duplicationResult.reason,
                    confidence: duplicationResult.confidence,
                    attempt
                })

                throw new AppError(
                    ErrorType.CONTENT_GENERATION,
                    'Generated content is duplicate',
                    'DUPLICATE_CONTENT',
                    {
                        reason: duplicationResult.reason,
                        confidence: duplicationResult.confidence
                    }
                )
            }
        }

        // Store message in database
        const messageId = await this.storeMessage(request, aiResponse)

        // Add to deduplication systems
        if (this.config.enableDeduplication) {
            await this.deduplicationService.addContent(
                messageId,
                request.userId,
                aiResponse.content,
                undefined, // No embedding for now
                request.category
            )
        }

        // Track costs if enabled
        if (this.config.costTrackingEnabled) {
            await this.trackCosts(request.userId, aiResponse)
        }

        return {
            id: messageId,
            content: aiResponse.content,
            category: request.category,
            tokens: aiResponse.tokens,
            cost: this.calculateCost(aiResponse.tokens, aiResponse.model),
            model: aiResponse.model,
            timeOfDay: request.timeOfDay,
            weatherContext: request.weatherContext,
            locale: request.locale || 'en-US',
            createdAt: new Date(),
            cached: false
        }
    }

    /**
     * Check cache for existing similar message
     */
    private async checkCache(request: MessageGenerationRequest): Promise<MessageGenerationResponse | null> {
        try {
            // Simple cache check based on user, category, and time context
            const cacheKey = this.generateCacheKey(request)

            const query = `
        SELECT id, content, tokens, model, created_at
        FROM messages 
        WHERE user_id = $1 
          AND category = $2
          AND created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 1
      `

            const result = await this.db.query(query, [request.userId, request.category])

            if (result.rows.length > 0) {
                const row = result.rows[0]
                return {
                    id: row.id,
                    content: row.content,
                    category: request.category,
                    tokens: row.tokens,
                    cost: this.calculateCost(row.tokens, row.model),
                    model: row.model,
                    timeOfDay: request.timeOfDay,
                    weatherContext: request.weatherContext,
                    locale: request.locale || 'en-US',
                    createdAt: row.created_at,
                    cached: true
                }
            }

            return null

        } catch (error) {
            logger.warn('Cache check failed', {
                userId: request.userId,
                category: request.category,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            return null // Don't fail generation due to cache issues
        }
    }

    /**
     * Store generated message in database
     */
    private async storeMessage(request: MessageGenerationRequest, aiResponse: any): Promise<string> {
        const query = `
      INSERT INTO messages (
        user_id, content, category, tokens, cost, temperature, model,
        time_of_day, weather_context, locale, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id
    `

        const cost = this.calculateCost(aiResponse.tokens, aiResponse.model)

        const result = await this.db.query(query, [
            request.userId,
            aiResponse.content,
            request.category,
            aiResponse.tokens,
            cost,
            request.temperature || 0.8,
            aiResponse.model,
            request.timeOfDay,
            request.weatherContext,
            request.locale || 'en-US'
        ])

        return result.rows[0].id
    }

    /**
     * Track API costs for monitoring
     */
    private async trackCosts(userId: string, aiResponse: any): Promise<void> {
        try {
            const cost = this.calculateCost(aiResponse.tokens, aiResponse.model)

            // This could be expanded to store in a separate costs table
            logger.info('API cost tracked', {
                userId,
                model: aiResponse.model,
                tokens: aiResponse.tokens,
                cost
            })

        } catch (error) {
            logger.warn('Cost tracking failed', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    /**
     * Calculate cost based on tokens and model
     */
    private calculateCost(tokens: number, model: string): number {
        // Simplified cost calculation - in production, use actual API pricing
        const costPerToken = model.includes('gpt-4') ? 0.00003 : 0.000002
        return tokens * costPerToken
    }

    /**
     * Generate cache key for request
     */
    private generateCacheKey(request: MessageGenerationRequest): string {
        return `msg:${request.userId}:${request.category}:${request.timeOfDay || 'any'}:${request.weatherContext || 'any'}`
    }

    /**
     * Validate message generation request
     */
    private validateRequest(request: MessageGenerationRequest): void {
        if (!request.userId) {
            throw new AppError(
                ErrorType.VALIDATION,
                'User ID is required',
                'MISSING_USER_ID'
            )
        }

        if (!request.category) {
            throw new AppError(
                ErrorType.VALIDATION,
                'Message category is required',
                'MISSING_CATEGORY'
            )
        }

        const validCategories: MessageCategory[] = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']
        if (!validCategories.includes(request.category)) {
            throw new AppError(
                ErrorType.VALIDATION,
                'Invalid message category',
                'INVALID_CATEGORY',
                { validCategories }
            )
        }

        if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
            throw new AppError(
                ErrorType.VALIDATION,
                'Temperature must be between 0 and 2',
                'INVALID_TEMPERATURE'
            )
        }
    }

    /**
     * Delay utility for retries
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Get service health status
     */
    async getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy'
        ai: Awaited<ReturnType<AIService['getHealthStatus']>>
        database: boolean
        deduplication: any
    }> {
        try {
            const [aiHealth, dbHealth, deduplicationStats] = await Promise.allSettled([
                this.aiService.getHealthStatus(),
                this.checkDatabaseHealth(),
                this.deduplicationService.getStats()
            ])

            const ai = aiHealth.status === 'fulfilled' ? aiHealth.value : { status: 'unhealthy' as const, providers: { openai: false, anthropic: false }, preferredProvider: 'openai', fallbackEnabled: false }
            const database = dbHealth.status === 'fulfilled' ? dbHealth.value : false
            const deduplication = deduplicationStats.status === 'fulfilled' ? deduplicationStats.value : null

            let status: 'healthy' | 'degraded' | 'unhealthy'

            if (ai.status === 'healthy' && database) {
                status = 'healthy'
            } else if ((ai.status === 'degraded' || ai.status === 'healthy') && database) {
                status = 'degraded'
            } else {
                status = 'unhealthy'
            }

            return {
                status,
                ai,
                database,
                deduplication
            }

        } catch (error) {
            logger.error('Health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            return {
                status: 'unhealthy',
                ai: { status: 'unhealthy', providers: { openai: false, anthropic: false }, preferredProvider: 'openai', fallbackEnabled: false },
                database: false,
                deduplication: null
            }
        }
    }

    /**
     * Check database health
     */
    private async checkDatabaseHealth(): Promise<boolean> {
        try {
            await this.db.query('SELECT 1')
            return true
        } catch (error) {
            return false
        }
    }
}