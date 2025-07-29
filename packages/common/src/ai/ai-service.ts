import { OpenAIService } from './openai-service'
import { AnthropicService } from './anthropic-service'
import { AIServiceConfig, AIServiceResponse, MessageRequest } from '../types'
import { logger } from '../logging'
import { AppError, ErrorType } from '../errors'

export interface AIServiceOptions {
    openai: AIServiceConfig
    anthropic: AIServiceConfig
    preferredProvider?: 'openai' | 'anthropic'
    enableFallback?: boolean
}

export class AIService {
    private openaiService: OpenAIService
    private anthropicService: AnthropicService
    private preferredProvider: 'openai' | 'anthropic'
    private enableFallback: boolean

    constructor(options: AIServiceOptions) {
        this.openaiService = new OpenAIService(options.openai)
        this.anthropicService = new AnthropicService(options.anthropic)
        this.preferredProvider = options.preferredProvider ?? 'openai'
        this.enableFallback = options.enableFallback ?? true
    }

    /**
     * Generate a message using the preferred provider with fallback
     */
    async generateMessage(request: MessageRequest): Promise<AIServiceResponse> {
        const startTime = Date.now()

        try {
            // Try preferred provider first
            const response = await this.generateWithProvider(request, this.preferredProvider)

            logger.info('Message generated successfully', {
                provider: this.preferredProvider,
                category: request.category,
                duration: Date.now() - startTime,
                tokens: response.tokens,
                userId: request.userId
            })

            return response

        } catch (error) {
            logger.warn('Primary provider failed, attempting fallback', {
                primaryProvider: this.preferredProvider,
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: request.userId
            })

            if (!this.enableFallback) {
                throw error
            }

            // Try fallback provider
            const fallbackProvider = this.preferredProvider === 'openai' ? 'anthropic' : 'openai'

            try {
                const response = await this.generateWithProvider(request, fallbackProvider)

                logger.info('Message generated with fallback provider', {
                    fallbackProvider,
                    category: request.category,
                    duration: Date.now() - startTime,
                    tokens: response.tokens,
                    userId: request.userId
                })

                return response

            } catch (fallbackError) {
                logger.error('Both providers failed', {
                    primaryProvider: this.preferredProvider,
                    fallbackProvider,
                    primaryError: error instanceof Error ? error.message : 'Unknown error',
                    fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
                    userId: request.userId
                })

                throw new AppError(
                    ErrorType.EXTERNAL_API,
                    'All AI providers failed to generate message',
                    'AI_PROVIDERS_FAILED',
                    {
                        primaryError: error instanceof Error ? error.message : 'Unknown error',
                        fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
                    }
                )
            }
        }
    }

    /**
     * Generate message with a specific provider
     */
    private async generateWithProvider(
        request: MessageRequest,
        provider: 'openai' | 'anthropic'
    ): Promise<AIServiceResponse> {
        if (provider === 'openai') {
            return await this.openaiService.generateMessage(request)
        } else {
            return await this.anthropicService.generateMessage(request)
        }
    }

    /**
     * Test connections to both providers
     */
    async testConnections(): Promise<{ openai: boolean; anthropic: boolean }> {
        const [openaiStatus, anthropicStatus] = await Promise.allSettled([
            this.openaiService.testConnection(),
            this.anthropicService.testConnection()
        ])

        return {
            openai: openaiStatus.status === 'fulfilled' ? openaiStatus.value : false,
            anthropic: anthropicStatus.status === 'fulfilled' ? anthropicStatus.value : false
        }
    }

    /**
     * Get health status of the AI service
     */
    async getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy'
        providers: { openai: boolean; anthropic: boolean }
        preferredProvider: string
        fallbackEnabled: boolean
    }> {
        const providers = await this.testConnections()

        let status: 'healthy' | 'degraded' | 'unhealthy'

        if (providers.openai && providers.anthropic) {
            status = 'healthy'
        } else if (providers.openai || providers.anthropic) {
            status = 'degraded'
        } else {
            status = 'unhealthy'
        }

        return {
            status,
            providers,
            preferredProvider: this.preferredProvider,
            fallbackEnabled: this.enableFallback
        }
    }

    /**
     * Switch preferred provider
     */
    setPreferredProvider(provider: 'openai' | 'anthropic'): void {
        this.preferredProvider = provider
        logger.info('Preferred AI provider changed', { provider })
    }

    /**
     * Enable or disable fallback
     */
    setFallbackEnabled(enabled: boolean): void {
        this.enableFallback = enabled
        logger.info('AI fallback setting changed', { enabled })
    }
}