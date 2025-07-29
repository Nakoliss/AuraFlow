import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicService } from './anthropic-service'
import { MessageRequest } from '../types'
import { AppError, ErrorType } from '../errors'

// Mock Anthropic
const mockAnthropic = {
    messages: {
        create: vi.fn()
    }
}

vi.mock('@anthropic-ai/sdk', () => {
    return {
        default: vi.fn().mockImplementation(() => mockAnthropic),
        APIError: class APIError extends Error {
            constructor(message: string, request: any, status: number, headers: any) {
                super(message)
                this.status = status
            }
            status: number
        }
    }
})

// Mock logger
vi.mock('../logging', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}))

describe('AnthropicService', () => {
    let anthropicService: AnthropicService

    beforeEach(() => {
        vi.clearAllMocks()

        anthropicService = new AnthropicService({
            apiKey: 'test-api-key',
            timeout: 5000,
            maxRetries: 2
        })
    })

    describe('generateMessage', () => {
        const mockRequest: MessageRequest = {
            userId: 'test-user-id',
            category: 'motivational',
            locale: 'en-US'
        }

        it('should generate message successfully', async () => {
            const mockResponse = {
                content: [{ type: 'text', text: 'Test motivational message' }],
                usage: { input_tokens: 15, output_tokens: 10 },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
            }

            mockAnthropic.messages.create.mockResolvedValue(mockResponse)

            const result = await anthropicService.generateMessage(mockRequest)

            expect(result).toEqual({
                content: 'Test motivational message',
                tokens: 25,
                model: 'claude-3-haiku-20240307',
                finishReason: 'end_turn'
            })

            expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
                model: 'claude-3-haiku-20240307',
                max_tokens: 60,
                temperature: 0.8,
                system: expect.stringContaining('wise, encouraging mentor'),
                messages: [
                    { role: 'user', content: expect.stringContaining('motivational message') }
                ]
            })
        })

        it('should include time context in prompt', async () => {
            const mockResponse = {
                content: [{ type: 'text', text: 'Morning message' }],
                usage: { input_tokens: 15, output_tokens: 8 },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
            }

            mockAnthropic.messages.create.mockResolvedValue(mockResponse)

            await anthropicService.generateMessage({
                ...mockRequest,
                timeOfDay: 'morning'
            })

            const call = mockAnthropic.messages.create.mock.calls[0][0]
            expect(call.messages[0].content).toContain('starting their morning')
        })

        it('should include weather context in prompt', async () => {
            const mockResponse = {
                content: [{ type: 'text', text: 'Sunny message' }],
                usage: { input_tokens: 15, output_tokens: 8 },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
            }

            mockAnthropic.messages.create.mockResolvedValue(mockResponse)

            await anthropicService.generateMessage({
                ...mockRequest,
                weatherContext: 'sunny'
            })

            const call = mockAnthropic.messages.create.mock.calls[0][0]
            expect(call.messages[0].content).toContain('sunny day')
        })

        it('should use custom temperature when provided', async () => {
            const mockResponse = {
                content: [{ type: 'text', text: 'Test message' }],
                usage: { input_tokens: 15, output_tokens: 8 },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
            }

            mockAnthropic.messages.create.mockResolvedValue(mockResponse)

            await anthropicService.generateMessage({
                ...mockRequest,
                temperature: 0.5
            })

            const call = mockAnthropic.messages.create.mock.calls[0][0]
            expect(call.temperature).toBe(0.5)
        })

        it('should handle non-text response', async () => {
            const mockResponse = {
                content: [{ type: 'image', source: { type: 'base64', data: 'abc123' } }],
                usage: { input_tokens: 15, output_tokens: 0 },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
            }

            mockAnthropic.messages.create.mockResolvedValue(mockResponse)

            await expect(anthropicService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await anthropicService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('ANTHROPIC_INVALID_RESPONSE')
            }
        })

        it('should handle empty text response', async () => {
            const mockResponse = {
                content: [{ type: 'text', text: '' }],
                usage: { input_tokens: 15, output_tokens: 0 },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
            }

            mockAnthropic.messages.create.mockResolvedValue(mockResponse)

            await expect(anthropicService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)
        })

        it('should handle rate limit error', async () => {
            const Anthropic = await import('@anthropic-ai/sdk')
            const rateLimitError = new Anthropic.default.APIError('Rate limit exceeded', null, 429, {})

            mockAnthropic.messages.create.mockRejectedValue(rateLimitError)

            await expect(anthropicService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await anthropicService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.RATE_LIMIT)
                expect((error as AppError).code).toBe('ANTHROPIC_RATE_LIMIT')
            }
        })

        it('should handle authentication error', async () => {
            const Anthropic = await import('@anthropic-ai/sdk')
            const authError = new Anthropic.default.APIError('Invalid API key', null, 401, {})

            mockAnthropic.messages.create.mockRejectedValue(authError)

            await expect(anthropicService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await anthropicService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('ANTHROPIC_AUTH_ERROR')
            }
        })

        it('should handle server error', async () => {
            const Anthropic = await import('@anthropic-ai/sdk')
            const serverError = new Anthropic.default.APIError('Internal server error', null, 500, {})

            mockAnthropic.messages.create.mockRejectedValue(serverError)

            await expect(anthropicService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await anthropicService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('ANTHROPIC_SERVER_ERROR')
            }
        })

        it('should handle generic error', async () => {
            const genericError = new Error('Network error')

            mockAnthropic.messages.create.mockRejectedValue(genericError)

            await expect(anthropicService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await anthropicService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('ANTHROPIC_GENERATION_ERROR')
            }
        })
    })

    describe('testConnection', () => {
        it('should return true when connection is successful', async () => {
            const mockResponse = {
                content: [{ type: 'text', text: 'Hi' }],
                usage: { input_tokens: 1, output_tokens: 1 },
                model: 'claude-3-haiku-20240307',
                stop_reason: 'end_turn'
            }

            mockAnthropic.messages.create.mockResolvedValue(mockResponse)

            const result = await anthropicService.testConnection()

            expect(result).toBe(true)
            expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            })
        })

        it('should return false when connection fails', async () => {
            mockAnthropic.messages.create.mockRejectedValue(new Error('Connection failed'))

            const result = await anthropicService.testConnection()

            expect(result).toBe(false)
        })
    })

    describe('getAvailableModels', () => {
        it('should return known Anthropic models', () => {
            const result = anthropicService.getAvailableModels()

            expect(result).toEqual([
                'claude-3-haiku-20240307',
                'claude-3-sonnet-20240229',
                'claude-3-opus-20240229'
            ])
        })
    })
})