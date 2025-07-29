import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIService } from './openai-service'
import { MessageRequest } from '../types'
import { AppError, ErrorType } from '../errors'

// Mock OpenAI
const mockOpenAI = {
    chat: {
        completions: {
            create: vi.fn()
        }
    },
    models: {
        list: vi.fn()
    }
}

vi.mock('openai', () => {
    return {
        default: vi.fn().mockImplementation(() => mockOpenAI),
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

describe('OpenAIService', () => {
    let openaiService: OpenAIService

    beforeEach(() => {
        vi.clearAllMocks()

        openaiService = new OpenAIService({
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
                choices: [{
                    message: { content: 'Test motivational message' },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 25 },
                model: 'gpt-3.5-turbo'
            }

            mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

            const result = await openaiService.generateMessage(mockRequest)

            expect(result).toEqual({
                content: 'Test motivational message',
                tokens: 25,
                model: 'gpt-3.5-turbo',
                finishReason: 'stop'
            })

            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: expect.stringContaining('wise, encouraging mentor') },
                    { role: 'user', content: expect.stringContaining('motivational message') }
                ],
                max_tokens: 60,
                temperature: 0.8,
                presence_penalty: 0.1,
                frequency_penalty: 0.1,
                user: 'test-user-id'
            })
        })

        it('should include time context in prompt', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Morning message' }, finish_reason: 'stop' }],
                usage: { total_tokens: 20 },
                model: 'gpt-3.5-turbo'
            }

            mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

            await openaiService.generateMessage({
                ...mockRequest,
                timeOfDay: 'morning'
            })

            const call = mockOpenAI.chat.completions.create.mock.calls[0][0]
            expect(call.messages[1].content).toContain('starting their morning')
        })

        it('should include weather context in prompt', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Sunny message' }, finish_reason: 'stop' }],
                usage: { total_tokens: 20 },
                model: 'gpt-3.5-turbo'
            }

            mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

            await openaiService.generateMessage({
                ...mockRequest,
                weatherContext: 'sunny'
            })

            const call = mockOpenAI.chat.completions.create.mock.calls[0][0]
            expect(call.messages[1].content).toContain('sunny day')
        })

        it('should use custom temperature when provided', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Test message' }, finish_reason: 'stop' }],
                usage: { total_tokens: 20 },
                model: 'gpt-3.5-turbo'
            }

            mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

            await openaiService.generateMessage({
                ...mockRequest,
                temperature: 0.5
            })

            const call = mockOpenAI.chat.completions.create.mock.calls[0][0]
            expect(call.temperature).toBe(0.5)
        })

        it('should handle empty response', async () => {
            const mockResponse = {
                choices: [{ message: { content: null }, finish_reason: 'stop' }],
                usage: { total_tokens: 0 },
                model: 'gpt-3.5-turbo'
            }

            mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

            await expect(openaiService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await openaiService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('OPENAI_EMPTY_RESPONSE')
            }
        })

        it('should handle rate limit error', async () => {
            const OpenAI = await import('openai')
            const rateLimitError = new OpenAI.default.APIError('Rate limit exceeded', null, 429, {})

            mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError)

            await expect(openaiService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await openaiService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.RATE_LIMIT)
                expect((error as AppError).code).toBe('OPENAI_RATE_LIMIT')
            }
        })

        it('should handle authentication error', async () => {
            const OpenAI = await import('openai')
            const authError = new OpenAI.default.APIError('Invalid API key', null, 401, {})

            mockOpenAI.chat.completions.create.mockRejectedValue(authError)

            await expect(openaiService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await openaiService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('OPENAI_AUTH_ERROR')
            }
        })

        it('should handle server error', async () => {
            const OpenAI = await import('openai')
            const serverError = new OpenAI.default.APIError('Internal server error', null, 500, {})

            mockOpenAI.chat.completions.create.mockRejectedValue(serverError)

            await expect(openaiService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await openaiService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('OPENAI_SERVER_ERROR')
            }
        })

        it('should handle generic error', async () => {
            const genericError = new Error('Network error')

            mockOpenAI.chat.completions.create.mockRejectedValue(genericError)

            await expect(openaiService.generateMessage(mockRequest))
                .rejects.toThrow(AppError)

            try {
                await openaiService.generateMessage(mockRequest)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).type).toBe(ErrorType.EXTERNAL_API)
                expect((error as AppError).code).toBe('OPENAI_GENERATION_ERROR')
            }
        })
    })

    describe('testConnection', () => {
        it('should return true when connection is successful', async () => {
            mockOpenAI.models.list.mockResolvedValue({ data: [] })

            const result = await openaiService.testConnection()

            expect(result).toBe(true)
            expect(mockOpenAI.models.list).toHaveBeenCalled()
        })

        it('should return false when connection fails', async () => {
            mockOpenAI.models.list.mockRejectedValue(new Error('Connection failed'))

            const result = await openaiService.testConnection()

            expect(result).toBe(false)
        })
    })

    describe('getAvailableModels', () => {
        it('should return GPT models', async () => {
            const mockModels = {
                data: [
                    { id: 'gpt-3.5-turbo' },
                    { id: 'gpt-4' },
                    { id: 'text-davinci-003' },
                    { id: 'whisper-1' }
                ]
            }

            mockOpenAI.models.list.mockResolvedValue(mockModels)

            const result = await openaiService.getAvailableModels()

            expect(result).toEqual(['gpt-3.5-turbo', 'gpt-4'])
        })

        it('should return empty array on error', async () => {
            mockOpenAI.models.list.mockRejectedValue(new Error('Failed to fetch models'))

            const result = await openaiService.getAvailableModels()

            expect(result).toEqual([])
        })
    })
})