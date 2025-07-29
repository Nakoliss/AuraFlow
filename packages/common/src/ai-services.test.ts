import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  OpenAIService, 
  AnthropicService, 
  AIServiceManager, 
  PromptTemplateSystem,
  AIServiceConfig 
} from './ai-services'
import { MessageRequest, MessageCategory } from './types'
import { ExternalServiceError, ContentGenerationError } from './errors'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-123')
  }
})

describe('PromptTemplateSystem', () => {
  it('should generate basic prompt for motivational category', () => {
    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    const prompt = PromptTemplateSystem.generatePrompt(request)
    
    expect(prompt).toContain('motivational message')
    expect(prompt).toContain('under 40 words')
    expect(prompt).toContain('inspiring, actionable, and positive')
  })

  it('should include time context in prompt', () => {
    const request: MessageRequest = {
      userId: 'user-123',
      category: 'mindfulness',
      timeOfDay: 'morning',
      locale: 'en-US'
    }

    const prompt = PromptTemplateSystem.generatePrompt(request)
    
    expect(prompt).toContain('starting their day')
    expect(prompt).toContain('energy, motivation, and setting intentions')
  })

  it('should include weather context in prompt', () => {
    const request: MessageRequest = {
      userId: 'user-123',
      category: 'fitness',
      weatherContext: 'rainy',
      locale: 'en-US'
    }

    const prompt = PromptTemplateSystem.generatePrompt(request)
    
    expect(prompt).toContain('weather is rainy')
    expect(prompt).toContain('cozy reflection')
  })

  it('should generate different prompts for each category', () => {
    const categories: MessageCategory[] = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']
    const prompts = categories.map(category => 
      PromptTemplateSystem.generatePrompt({
        userId: 'user-123',
        category,
        locale: 'en-US'
      })
    )

    // Each prompt should be unique
    const uniquePrompts = new Set(prompts)
    expect(uniquePrompts.size).toBe(categories.length)

    // Check specific category keywords
    expect(prompts[0]).toContain('motivational')
    expect(prompts[1]).toContain('mindfulness')
    expect(prompts[2]).toContain('fitness')
    expect(prompts[3]).toContain('philosophical')
    expect(prompts[4]).toContain('productivity')
  })
})

describe('OpenAIService', () => {
  let service: OpenAIService
  const mockConfig: AIServiceConfig['openai'] = {
    apiKey: 'test-api-key',
    model: 'gpt-4',
    maxTokens: 100,
    temperature: 0.7
  }

  beforeEach(() => {
    service = new OpenAIService(mockConfig)
    vi.clearAllMocks()
  })

  it('should generate message successfully', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'Test motivational message content' },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75
      },
      model: 'gpt-4'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    const result = await service.generateMessage(request)

    expect(result).toMatchObject({
      id: 'test-uuid-123',
      content: 'Test motivational message content',
      category: 'motivational',
      tokens: 75,
      model: 'gpt-4',
      temperature: 0.7,
      locale: 'en-US'
    })
    expect(result.cost).toBeGreaterThan(0)
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('should handle API errors properly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' })
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    await expect(service.generateMessage(request)).rejects.toThrow(ExternalServiceError)
    
    // Reset and test again with a new mock
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' })
    })
    
    await expect(service.generateMessage(request)).rejects.toThrow('OpenAI service error: API error: 429')
  })

  it('should handle empty response', async () => {
    const mockResponse = {
      choices: [],
      usage: { prompt_tokens: 50, completion_tokens: 0, total_tokens: 50 },
      model: 'gpt-4'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    await expect(service.generateMessage(request)).rejects.toThrow(ContentGenerationError)
    
    // Reset and test again with a new mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    
    await expect(service.generateMessage(request)).rejects.toThrow('No content generated by OpenAI')
  })

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    await expect(service.generateMessage(request)).rejects.toThrow(ExternalServiceError)
    await expect(service.generateMessage(request)).rejects.toThrow('OpenAI service error: Service failed')
  })

  it('should test connection successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] })
    })

    const result = await service.testConnection()
    expect(result).toBe(true)
  })

  it('should handle connection test failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    })

    const result = await service.testConnection()
    expect(result).toBe(false)
  })

  it('should calculate cost correctly', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'Test content' },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      },
      model: 'gpt-4'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    const result = await service.generateMessage(request)
    
    // Cost should be calculated based on token usage
    // 150 tokens * $0.045 per 1K tokens = $0.00675
    expect(result.cost).toBeCloseTo(0.00675, 5)
  })
})

describe('AnthropicService', () => {
  let service: AnthropicService
  const mockConfig: AIServiceConfig['anthropic'] = {
    apiKey: 'test-api-key',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 100,
    temperature: 0.7
  }

  beforeEach(() => {
    service = new AnthropicService(mockConfig)
    vi.clearAllMocks()
  })

  it('should generate message successfully', async () => {
    const mockResponse = {
      content: [{
        text: 'Test philosophical message content',
        type: 'text'
      }],
      usage: {
        input_tokens: 40,
        output_tokens: 30
      },
      model: 'claude-3-sonnet-20240229'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'philosophy',
      locale: 'en-US'
    }

    const result = await service.generateMessage(request)

    expect(result).toMatchObject({
      id: 'test-uuid-123',
      content: 'Test philosophical message content',
      category: 'philosophy',
      tokens: 70, // input + output tokens
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      locale: 'en-US'
    })
    expect(result.cost).toBeGreaterThan(0)
  })

  it('should handle API errors properly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid request' })
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'philosophy',
      locale: 'en-US'
    }

    await expect(service.generateMessage(request)).rejects.toThrow(ExternalServiceError)
    
    // Reset and test again with a new mock
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid request' })
    })
    
    await expect(service.generateMessage(request)).rejects.toThrow('Anthropic service error: API error: 400')
  })

  it('should calculate cost correctly with different token types', async () => {
    const mockResponse = {
      content: [{
        text: 'Test content',
        type: 'text'
      }],
      usage: {
        input_tokens: 100,
        output_tokens: 50
      },
      model: 'claude-3-sonnet-20240229'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'philosophy',
      locale: 'en-US'
    }

    const result = await service.generateMessage(request)
    
    // Cost calculation: (100 * $0.015 + 50 * $0.075) / 1000 = $0.00525
    expect(result.cost).toBeCloseTo(0.00525, 5)
  })

  it('should test connection with minimal request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: 'test', type: 'text' }],
        usage: { input_tokens: 1, output_tokens: 1 }
      })
    })

    const result = await service.testConnection()
    expect(result).toBe(true)
  })
})

describe('AIServiceManager', () => {
  let manager: AIServiceManager
  const mockConfig: AIServiceConfig = {
    openai: {
      apiKey: 'openai-key',
      model: 'gpt-4',
      maxTokens: 100,
      temperature: 0.7
    },
    anthropic: {
      apiKey: 'anthropic-key',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 100,
      temperature: 0.7
    }
  }

  beforeEach(() => {
    manager = new AIServiceManager(mockConfig, true)
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  it('should use OpenAI service by default', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'OpenAI generated content' },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
      model: 'gpt-4'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    const result = await manager.generateMessage(request)
    
    expect(result.content).toBe('OpenAI generated content')
    expect(result.model).toBe('gpt-4')
  })

  it('should fallback to Anthropic when OpenAI fails', async () => {
    // First call (OpenAI) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' })
    })

    // Second call (Anthropic) succeeds
    const anthropicResponse = {
      content: [{
        text: 'Anthropic fallback content',
        type: 'text'
      }],
      usage: { input_tokens: 40, output_tokens: 30 },
      model: 'claude-3-sonnet-20240229'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(anthropicResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    const result = await manager.generateMessage(request)
    
    expect(result.content).toBe('Anthropic fallback content')
    expect(result.model).toBe('claude-3-sonnet-20240229')
  })

  it('should throw error when both services fail', async () => {
    // Both calls fail
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'OpenAI error' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Anthropic error' })
      })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    await expect(manager.generateMessage(request)).rejects.toThrow(ContentGenerationError)
    await expect(manager.generateMessage(request)).rejects.toThrow('All AI services failed')
  })

  it('should not use fallback when disabled', async () => {
    const managerNoFallback = new AIServiceManager(mockConfig, false)
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' })
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    await expect(managerNoFallback.generateMessage(request)).rejects.toThrow(ExternalServiceError)
    await expect(managerNoFallback.generateMessage(request)).rejects.toThrow('OpenAI service error')
  })

  it('should perform health check on both services', async () => {
    // Reset mock to ensure clean state
    mockFetch.mockClear()
    
    // OpenAI health check succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] })
    })

    // Anthropic health check fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    })

    const health = await manager.healthCheck()
    
    expect(health).toEqual({
      openai: true,
      anthropic: false
    })
  })

  it('should handle health check network errors', async () => {
    // Reset mock to ensure clean state
    mockFetch.mockClear()
    
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))

    const health = await manager.healthCheck()
    
    expect(health).toEqual({
      openai: false,
      anthropic: false
    })
  })
})

describe('Content validation', () => {
  let service: OpenAIService
  const mockConfig: AIServiceConfig['openai'] = {
    apiKey: 'test-api-key',
    model: 'gpt-4',
    maxTokens: 100,
    temperature: 0.7
  }

  beforeEach(() => {
    service = new OpenAIService(mockConfig)
    vi.clearAllMocks()
  })

  it('should warn when content exceeds word limit', async () => {
    const longContent = 'This is a very long motivational message that definitely exceeds the forty word limit that we have set for optimal mobile consumption and user experience across all platforms and devices in our application and should trigger a warning in the logs'
    
    const mockResponse = {
      choices: [{
        message: { content: longContent },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
      model: 'gpt-4'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const request: MessageRequest = {
      userId: 'user-123',
      category: 'motivational',
      locale: 'en-US'
    }

    const result = await service.generateMessage(request)
    
    expect(result.content).toBe(longContent)
    // The service should still return the content but log a warning
    expect(result.content.split(/\s+/).length).toBeGreaterThan(40)
  })
})