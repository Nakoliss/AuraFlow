import OpenAI from 'openai'
import { AIServiceConfig, AIServiceResponse, MessageCategory, MessageRequest } from '../types'
import { promptTemplateService } from '../prompts'
import { logger } from '../logging'
import { AppError, ErrorType } from '../errors'

export class OpenAIService {
    private client: OpenAI
    private config: AIServiceConfig

    constructor(config: AIServiceConfig) {
        this.config = {
            timeout: 10000,
            maxRetries: 3,
            ...config
        }

        this.client = new OpenAI({
            apiKey: this.config.apiKey,
            timeout: this.config.timeout,
            maxRetries: this.config.maxRetries
        })
    }

    /**
     * Generate a message using OpenAI's API
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

            logger.info('Generating message with OpenAI', {
                category: request.category,
                timeOfDay: request.timeOfDay,
                weatherContext: request.weatherContext,
                temperature,
                userId: request.userId
            })

            const completion = await this.client.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: template.maxTokens,
                temperature,
                presence_penalty: 0.1,
                frequency_penalty: 0.1,
                user: request.userId // For OpenAI usage tracking
            })

            const choice = completion.choices[0]
            if (!choice?.message?.content) {
                throw new AppError(
                    ErrorType.EXTERNAL_API,
                    'OpenAI returned empty response',
                    'OPENAI_EMPTY_RESPONSE'
                )
            }

            const duration = Date.now() - startTime
            const tokens = completion.usage?.total_tokens ?? 0

            logger.info('OpenAI message generated successfully', {
                duration,
                tokens,
                model: completion.model,
                finishReason: choice.finish_reason,
                userId: request.userId
            })

            return {
                content: choice.message.content.trim(),
                tokens,
                model: completion.model,
                finishReason: choice.finish_reason ?? 'unknown'
            }

        } catch (error) {
            logger.error('OpenAI message generation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                category: request.category,
                userId: request.userId
            })

            if (error instanceof OpenAI.APIError) {
                // Handle specific OpenAI errors
                if (error.status === 429) {
                    throw new AppError(
                        ErrorType.RATE_LIMIT,
                        'OpenAI rate limit exceeded',
                        'OPENAI_RATE_LIMIT',
                        { retryAfter: 60 }
                    )
                } else if (error.status === 401) {
                    throw new AppError(
                        ErrorType.EXTERNAL_API,
                        'OpenAI authentication failed',
                        'OPENAI_AUTH_ERROR'
                    )
                } else if (error.status >= 500) {
                    throw new AppError(
                        ErrorType.EXTERNAL_API,
                        'OpenAI server error',
                        'OPENAI_SERVER_ERROR'
                    )
                }
            }

            throw new AppError(
                ErrorType.EXTERNAL_API,
                'Failed to generate message with OpenAI',
                'OPENAI_GENERATION_ERROR',
                { originalError: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Test the connection to OpenAI
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.client.models.list()
            return true
        } catch (error) {
            logger.error('OpenAI connection test failed', { error })
            return false
        }
    }

    /**
     * Get available models
     */
    async getAvailableModels(): Promise<string[]> {
        try {
            const models = await this.client.models.list()
            return models.data
                .filter(model => model.id.includes('gpt'))
                .map(model => model.id)
                .sort()
        } catch (error) {
            logger.error('Failed to fetch OpenAI models', { error })
            return []
        }
    }
}