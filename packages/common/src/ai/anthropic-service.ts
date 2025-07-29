import Anthropic from '@anthropic-ai/sdk'
import { AIServiceConfig, AIServiceResponse, MessageRequest } from '../types'
import { promptTemplateService } from '../prompts'
import { logger } from '../logging'
import { AppError, ErrorType } from '../errors'

export class AnthropicService {
    private client: Anthropic
    private config: AIServiceConfig

    constructor(config: AIServiceConfig) {
        this.config = {
            timeout: 10000,
            maxRetries: 3,
            ...config
        }

        this.client = new Anthropic({
            apiKey: this.config.apiKey,
            timeout: this.config.timeout,
            maxRetries: this.config.maxRetries
        })
    }

    /**
     * Generate a message using Anthropic's API
     */
    async generateMessage(request: MessageRequest): Promise<AIServiceResponse> {
        try {
            const startTime = Date.now()

            // Get contextualized prompt
            const { systemPrompt, userPrompt } = promptTemplateService.buildContextualPrompt(
                request.category,
                request.timeOfDay,
                request.weatherContext
            )

            // Get template for token limits and temperature
            const template = promptTemplateService.getTemplate(request.category)
            const temperature = request.temperature ?? template.temperature

            logger.info('Generating message with Anthropic', {
                category: request.category,
                timeOfDay: request.timeOfDay,
                weatherContext: request.weatherContext,
                temperature,
                userId: request.userId
            })

            const message = await this.client.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: template.maxTokens,
                temperature,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt }
                ]
            })

            const content = message.content[0]
            if (content.type !== 'text' || !content.text) {
                throw new AppError(
                    ErrorType.EXTERNAL_API,
                    'Anthropic returned non-text response',
                    'ANTHROPIC_INVALID_RESPONSE'
                )
            }

            const duration = Date.now() - startTime
            const tokens = message.usage.input_tokens + message.usage.output_tokens

            logger.info('Anthropic message generated successfully', {
                duration,
                tokens,
                inputTokens: message.usage.input_tokens,
                outputTokens: message.usage.output_tokens,
                model: message.model,
                stopReason: message.stop_reason,
                userId: request.userId
            })

            return {
                content: content.text.trim(),
                tokens,
                model: message.model,
                finishReason: message.stop_reason ?? 'unknown'
            }

        } catch (error) {
            logger.error('Anthropic message generation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                category: request.category,
                userId: request.userId
            })

            if (error instanceof Anthropic.APIError) {
                // Handle specific Anthropic errors
                if (error.status === 429) {
                    throw new AppError(
                        ErrorType.RATE_LIMIT,
                        'Anthropic rate limit exceeded',
                        'ANTHROPIC_RATE_LIMIT',
                        { retryAfter: 60 }
                    )
                } else if (error.status === 401) {
                    throw new AppError(
                        ErrorType.EXTERNAL_API,
                        'Anthropic authentication failed',
                        'ANTHROPIC_AUTH_ERROR'
                    )
                } else if (error.status >= 500) {
                    throw new AppError(
                        ErrorType.EXTERNAL_API,
                        'Anthropic server error',
                        'ANTHROPIC_SERVER_ERROR'
                    )
                }
            }

            throw new AppError(
                ErrorType.EXTERNAL_API,
                'Failed to generate message with Anthropic',
                'ANTHROPIC_GENERATION_ERROR',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Test the connection to Anthropic
     */
    async testConnection(): Promise<boolean> {
        try {
            // Test with a minimal message
            await this.client.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            })
            return true
        } catch (error) {
            logger.error('Anthropic connection test failed', { error })
            return false
        }
    }

    /**
     * Get available models (Anthropic doesn't have a models endpoint, so we return known models)
     */
    getAvailableModels(): string[] {
        return [
            'claude-3-haiku-20240307',
            'claude-3-sonnet-20240229',
            'claude-3-opus-20240229'
        ]
    }
}