import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIService } from './ai-service'
import { OpenAIService } from './openai-service'
import { AnthropicService } from './anthropic-service'
import { MessageRequest, AIServiceResponse } from '../types'
import { AppError, ErrorType } from '../errors'

// Mock the service classes
vi.mock('./openai-service')
vi.mock('./anthropic-service')

// Mock logger
vi.mock('../logging', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}))

describe('AIService', () => {
    let aiService: AIService
    let mockOpenAIService: any
    let mockAnthropicService: any

    const mockRequest: MessageRequest = {
        userId: 'test-user-id',
        category: 'motivational',
        locale: 'en-US'
    }

    const mockResponse: AIServiceResponse = {
        content: 'Test message',
        tokens: 25,
        model: 'test-model',
        finishReason: 'stop'
    }

    beforeEach(() => {
        vi.clearAllMocks()

        mockOpenAIService = {
            generateMessage: vi.fn(),
            testConnection: vi.fn()
        }

        mockAnthropicService = {
            generateMessage: vi.fn(),
            testConnection: vi.fn()
        }

        vi.mocked(OpenAIService).mockImplementation(() => mockOpenAIService)
        vi.mocked(AnthropicService).mockImplementation(() => mockAnthropicService)

        aiService = new AIService({
            openai: { apiKey: 'openai-key' },
            anthropic: { apiKey: 'anthropic-key' },
            preferredProvider: 'openai',
            enableFallback: true
        })
    })

    describe('generateMessage', () => {
        it('should use preferred provider (OpenAI) successfully', async () => {
            mockOpenAIService.generateMessage.mockResolvedValue(mockResponse)

            const result = await aiService.generateMessage(mockRequest)

            expect(result).toEqual(mockResponse)
            expect(mockOpenAIService.generateMessage).toHaveBeenCalledWith(mockRequest)
            expect(mockAnthropicService.generateMessage).not.toHaveBeenCalled()
        })

        it('should use preferred provider (Anthropic) successfully', async () => {
            aiService.setPreferredProvider('anthropic')
            mockAnthropicService.generateMessage.mockResolvedValue(mockResponse)

            const result = await aiService.generateMessage(mockRequest)

            expect(result).toEqual(mockResponse)
            expect(mockAnthropicService.generateMessage).toHaveBeenCalledWith(mockRequest)
            expect(mockOpenAIService.generateMessage).not.toHaveBeenCalled()
        })

        it('should fallback to Anthropic when OpenAI fails', async () => {
            const openaiError = new AppError(ErrorType.EXTERNAL_API, 'OpenAI failed', 'OPENAI_ERROR')
            mockOpenAIService.generateMessage.mockRejectedValue(openaiError)
            mockAnthropicService.generateMessage.mockResolvedValue(mockResponse)

            const result = await aiService.generateMessage(mockRequest)

            expect(result).toEqual(mockResponse)
            expect(mockOpenAIService.generateMessage).toHaveBeenCalledWith(mockRequest)
            expect(mockAnthropicService.generateMessage).toHaveBeenCalledWith(mockRequest)
        })

        it('should fallback to OpenAI when Anthropic fails', async () => {
            aiService.setPreferredProvider('anthropic')
            const anthropicError = new AppError(ErrorType.EXTERNAL_API, 'Anthropic failed', 'ANTHROPIC_ERROR')
            mockAnthropicService.generateMessage.mockRejectedValue(anthropicError)
            mockOpenAIService.generateMessage.mockResolvedValue(mockResponse)

            const result = await aiService.generateMessage(mockRequest)

            expect(result).toEqual(mockResponse)
            expect(mockAnthropicService.generateMessage).toHaveBeenCalledWith(mockRequest)
            expect(mockOpenAIService.generateMessage).toHaveBeenCalledWith(mockRequest)
        })

        it('should throw error when both providers fail', async () => {
            const openaiError = new AppError(ErrorType.EXTERNAL_API, 'OpenAI failed', 'OPENAI_ERROR')
            const anthropicError = new AppError(ErrorType.EXTERNAL_API, 'Anthropic failed', 'ANTHROPIC_ERROR')

            mockOpenAIService.generateMessage.mockRejectedValue(openaiError)
            mockAnthropicService.generateMessage.mockRejectedValue(anthropicError)

            await expect(aiService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await aiService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('AI_PROVIDERS_FAILED')
            }
        })

        it('should not fallback when fallback is disabled', async () => {
            aiService.setFallbackEnabled(false)
            const openaiError = new AppError(ErrorType.EXTERNAL_API, 'OpenAI failed', 'OPENAI_ERROR')
            mockOpenAIService.generateMessage.mockRejectedValue(openaiError)

            await expect(aiService.generateMessage(mockRequest))
                .rejects.toThrow(openaiError)

            expect(mockOpenAIService.generateMessage).toHaveBeenCalledWith(mockRequest)
            expect(mockAnthropicService.generateMessage).not.toHaveBeenCalled()
        })
    })

    describe('testConnections', () => {
        it('should test both providers', async () => {
            mockOpenAIService.testConnection.mockResolvedValue(true)
            mockAnthropicService.testConnection.mockResolvedValue(true)

            const result = await aiService.testConnections()

            expect(result).toEqual({
                openai: true,
                anthropic: true
            })
        })

        it('should handle connection failures', async () => {
            mockOpenAIService.testConnection.mockResolvedValue(false)
            mockAnthropicService.testConnection.mockRejectedValue(new Error('Connection failed'))

            const result = await aiService.testConnections()

            expect(result).toEqual({
                openai: false,
                anthropic: false
            })
        })
    })

    describe('getHealthStatus', () => {
        it('should return healthy when both providers work', async () => {
            mockOpenAIService.testConnection.mockResolvedValue(true)
            mockAnthropicService.testConnection.mockResolvedValue(true)

            const result = await aiService.getHealthStatus()

            expect(result).toEqual({
                status: 'healthy',
                providers: { openai: true, anthropic: true },
                preferredProvider: 'openai',
                fallbackEnabled: true
            })
        })

        it('should return degraded when one provider fails', async () => {
            mockOpenAIService.testConnection.mockResolvedValue(true)
            mockAnthropicService.testConnection.mockResolvedValue(false)

            const result = await aiService.getHealthStatus()

            expect(result).toEqual({
                status: 'degraded',
                providers: { openai: true, anthropic: false },
                preferredProvider: 'openai',
                fallbackEnabled: true
            })
        })

        it('should return unhealthy when both providers fail', async () => {
            mockOpenAIService.testConnection.mockResolvedValue(false)
            mockAnthropicService.testConnection.mockResolvedValue(false)

            const result = await aiService.getHealthStatus()

            expect(result).toEqual({
                status: 'unhealthy',
                providers: { openai: false, anthropic: false },
                preferredProvider: 'openai',
                fallbackEnabled: true
            })
        })
    })

    describe('setPreferredProvider', () => {
        it('should change preferred provider to anthropic', () => {
            aiService.setPreferredProvider('anthropic')

            // Test by checking which provider is called first
            mockAnthropicService.generateMessage.mockResolvedValue(mockResponse)

            aiService.generateMessage(mockRequest)

            expect(mockAnthropicService.generateMessage).toHaveBeenCalled()
        })

        it('should change preferred provider to openai', () => {
            aiService.setPreferredProvider('openai')

            // Test by checking which provider is called first
            mockOpenAIService.generateMessage.mockResolvedValue(mockResponse)

            aiService.generateMessage(mockRequest)

            expect(mockOpenAIService.generateMessage).toHaveBeenCalled()
        })
    })

    describe('setFallbackEnabled', () => {
        it('should enable fallback', async () => {
            aiService.setFallbackEnabled(true)

            const openaiError = new AppError(ErrorType.EXTERNAL_API, 'OpenAI failed', 'OPENAI_ERROR')
            mockOpenAIService.generateMessage.mockRejectedValue(openaiError)
            mockAnthropicService.generateMessage.mockResolvedValue(mockResponse)

            const result = await aiService.generateMessage(mockRequest)

            expect(result).toEqual(mockResponse)
            expect(mockAnthropicService.generateMessage).toHaveBeenCalled()
        })

        it('should disable fallback', async () => {
            aiService.setFallbackEnabled(false)

            const openaiError = new AppError(ErrorType.EXTERNAL_API, 'OpenAI failed', 'OPENAI_ERROR')
            mockOpenAIService.generateMessage.mockRejectedValue(openaiError)

            await expect(aiService.generateMessage(mockRequest))
                .rejects.toThrow(openaiError)

            expect(mockAnthropicService.generateMessage).not.toHaveBeenCalled()
        })
    })
})