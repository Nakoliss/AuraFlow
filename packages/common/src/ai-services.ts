import { MessageCategory, GeneratedMessage, MessageRequest, WeatherBucket } from './types'
import { ExternalServiceError, ContentGenerationError } from './errors'
import { createServiceLogger } from './logging'

const logger = createServiceLogger('ai-services')

// AI Service Configuration
export interface AIServiceConfig {
  openai: {
    apiKey: string
    model: string
    maxTokens: number
    temperature: number
  }
  anthropic: {
    apiKey: string
    model: string
    maxTokens: number
    temperature: number
  }
}

// OpenAI API Response Types
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

// Anthropic API Response Types
interface AnthropicResponse {
  content: Array<{
    text: string
    type: string
  }>
  usage: {
    input_tokens: number
    output_tokens: number
  }
  model: string
}

// Prompt Templates for Different Categories
export class PromptTemplateSystem {
  private static readonly BASE_CONSTRAINTS = `
Keep the message under 40 words. Make it inspiring, actionable, and positive.
Avoid clichés and generic advice. Be specific and memorable.
`

  private static readonly TIME_CONTEXT = {
    morning: 'This is for someone starting their day. Focus on energy, motivation, and setting intentions.',
    evening: 'This is for someone ending their day. Focus on reflection, gratitude, and peaceful closure.'
  }

  private static readonly WEATHER_CONTEXT: Record<WeatherBucket, string> = {
    sunny: 'The weather is sunny and bright. Incorporate themes of energy, optimism, and outdoor possibilities.',
    rainy: 'The weather is rainy. Focus on cozy reflection, indoor productivity, or finding beauty in quiet moments.',
    cold: 'The weather is cold. Emphasize warmth, comfort, resilience, and inner strength.',
    hot: 'The weather is hot. Focus on staying cool, finding shade, hydration, or summer energy.'
  }

  static generatePrompt(request: MessageRequest): string {
    const categoryPrompts = {
      motivational: 'Generate a motivational message that inspires action and builds confidence. Focus on overcoming challenges and achieving goals.',
      mindfulness: 'Generate a mindfulness message that promotes present-moment awareness and inner peace. Focus on breathing, observation, or gentle self-compassion.',
      fitness: 'Generate a fitness-related message that motivates physical activity and healthy habits. Focus on movement, strength, or wellness.',
      philosophy: 'Generate a philosophical message that provokes thoughtful reflection. Focus on wisdom, meaning, or life perspectives.',
      productivity: 'Generate a productivity message that helps with focus and efficiency. Focus on time management, prioritization, or workflow optimization.'
    }

    let prompt = categoryPrompts[request.category] + '\n\n'
    prompt += this.BASE_CONSTRAINTS + '\n'

    // Add time context if available
    if (request.timeOfDay) {
      prompt += this.TIME_CONTEXT[request.timeOfDay] + '\n'
    }

    // Add weather context if available
    if (request.weatherContext) {
      prompt += this.WEATHER_CONTEXT[request.weatherContext] + '\n'
    }

    prompt += '\nGenerate only the message content, no additional text or formatting.'

    return prompt
  }
}

// OpenAI Service Adapter
export class OpenAIService {
  private config: AIServiceConfig['openai']
  private baseUrl = 'https://api.openai.com/v1'

  constructor(config: AIServiceConfig['openai']) {
    this.config = config
  }

  async generateMessage(request: MessageRequest): Promise<GeneratedMessage> {
    const prompt = PromptTemplateSystem.generatePrompt(request)
    
    try {
      logger.info('Generating message with OpenAI', { 
        category: request.category, 
        userId: request.userId 
      })

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating concise, impactful motivational content.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: 1,
          frequency_penalty: 0.5,
          presence_penalty: 0.3
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ExternalServiceError(
          'OpenAI',
          `API error: ${response.status}`,
          new Error(JSON.stringify(errorData))
        )
      }

      const data: OpenAIResponse = await response.json()
      
      if (!data.choices || data.choices.length === 0) {
        throw new ContentGenerationError(
          'No content generated by OpenAI',
          request.category
        )
      }

      const content = data.choices[0].message.content.trim()
      
      // Validate content length (40 words max)
      const wordCount = content.split(/\s+/).length
      if (wordCount > 40) {
        logger.warn('Generated content exceeds word limit', { wordCount, content })
      }

      const cost = this.calculateCost(data.usage.total_tokens)

      logger.info('Successfully generated message with OpenAI', {
        tokens: data.usage.total_tokens,
        cost,
        wordCount
      })

      return {
        id: crypto.randomUUID(),
        content,
        category: request.category,
        embedding: [], // Will be populated by embedding service
        tokens: data.usage.total_tokens,
        cost,
        createdAt: new Date(),
        model: data.model,
        temperature: this.config.temperature,
        timeOfDay: request.timeOfDay,
        weatherContext: request.weatherContext,
        locale: request.locale
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('OpenAI service error', { error: errorMessage, request })
      
      if (error instanceof ExternalServiceError || error instanceof ContentGenerationError) {
        throw error
      }
      
      throw new ExternalServiceError(
        'OpenAI',
        `Service failed: ${errorMessage}`,
        error instanceof Error ? error : new Error(errorMessage)
      )
    }
  }

  private calculateCost(tokens: number): number {
    // GPT-4 pricing: $0.03 per 1K input tokens, $0.06 per 1K output tokens
    // Simplified calculation assuming 50/50 split
    const costPer1KTokens = 0.045 // Average of input/output costs
    return (tokens / 1000) * costPer1KTokens
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Anthropic Service Adapter (Fallback)
export class AnthropicService {
  private config: AIServiceConfig['anthropic']
  private baseUrl = 'https://api.anthropic.com/v1'

  constructor(config: AIServiceConfig['anthropic']) {
    this.config = config
  }

  async generateMessage(request: MessageRequest): Promise<GeneratedMessage> {
    const prompt = PromptTemplateSystem.generatePrompt(request)
    
    try {
      logger.info('Generating message with Anthropic (fallback)', { 
        category: request.category, 
        userId: request.userId 
      })

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ExternalServiceError(
          'Anthropic',
          `API error: ${response.status}`,
          new Error(JSON.stringify(errorData))
        )
      }

      const data: AnthropicResponse = await response.json()
      
      if (!data.content || data.content.length === 0) {
        throw new ContentGenerationError(
          'No content generated by Anthropic',
          request.category
        )
      }

      const content = data.content[0].text.trim()
      
      // Validate content length (40 words max)
      const wordCount = content.split(/\s+/).length
      if (wordCount > 40) {
        logger.warn('Generated content exceeds word limit', { wordCount, content })
      }

      const totalTokens = data.usage.input_tokens + data.usage.output_tokens
      const cost = this.calculateCost(data.usage.input_tokens, data.usage.output_tokens)

      logger.info('Successfully generated message with Anthropic', {
        tokens: totalTokens,
        cost,
        wordCount
      })

      return {
        id: crypto.randomUUID(),
        content,
        category: request.category,
        embedding: [], // Will be populated by embedding service
        tokens: totalTokens,
        cost,
        createdAt: new Date(),
        model: data.model,
        temperature: this.config.temperature,
        timeOfDay: request.timeOfDay,
        weatherContext: request.weatherContext,
        locale: request.locale
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Anthropic service error', { error: errorMessage, request })
      
      if (error instanceof ExternalServiceError || error instanceof ContentGenerationError) {
        throw error
      }
      
      throw new ExternalServiceError(
        'Anthropic',
        `Service failed: ${errorMessage}`,
        error instanceof Error ? error : new Error(errorMessage)
      )
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude pricing: $0.015 per 1K input tokens, $0.075 per 1K output tokens
    const inputCost = (inputTokens / 1000) * 0.015
    const outputCost = (outputTokens / 1000) * 0.075
    return inputCost + outputCost
  }

  async testConnection(): Promise<boolean> {
    try {
      // Anthropic doesn't have a simple health check endpoint, so we'll try a minimal request
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        })
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// AI Service Manager with Fallback Logic
export class AIServiceManager {
  private openaiService: OpenAIService
  private anthropicService: AnthropicService
  private fallbackEnabled: boolean

  constructor(config: AIServiceConfig, fallbackEnabled = true) {
    this.openaiService = new OpenAIService(config.openai)
    this.anthropicService = new AnthropicService(config.anthropic)
    this.fallbackEnabled = fallbackEnabled
  }

  async generateMessage(request: MessageRequest): Promise<GeneratedMessage> {
    try {
      // Try OpenAI first
      return await this.openaiService.generateMessage(request)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.warn('OpenAI service failed, attempting fallback', { error: errorMessage })
      
      if (!this.fallbackEnabled) {
        throw error
      }

      try {
        // Fallback to Anthropic
        const result = await this.anthropicService.generateMessage(request)
        logger.info('Successfully used Anthropic fallback')
        return result
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        logger.error('Both AI services failed', { 
          openaiError: errorMessage, 
          anthropicError: fallbackErrorMessage 
        })
        
        throw new ContentGenerationError(
          'All AI services failed to generate content',
          request.category
        )
      }
    }
  }

  async healthCheck(): Promise<{ openai: boolean; anthropic: boolean }> {
    const [openaiHealthy, anthropicHealthy] = await Promise.all([
      this.openaiService.testConnection(),
      this.anthropicService.testConnection()
    ])

    return {
      openai: openaiHealthy,
      anthropic: anthropicHealthy
    }
  }
}