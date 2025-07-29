import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import generateRoutes from './generate'
import { MessageGenerationService } from '../services/message-generation'
import { AuthService } from '@aura-flow/common'

// Mock services
const mockAuthService = {
    validateAccessToken: vi.fn()
} as unknown as AuthService

const mockMessageService = {
    generateMessage: vi.fn(),
    getHealthStatus: vi.fn()
} as unknown as MessageGenerationService

// Mock middleware functions
vi.mock('../middleware/rate-limiting', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({
        allowed: true,
        limit: 20,
        remaining: 19,
        resetTime: Date.now() + 86400000
    }),
    getRateLimitInfo: vi.fn().mockResolvedValue({
        limit: 20,
        remaining: 19,
        resetTime: Date.now() + 86400000
    })
}))

vi.mock('../middleware/subscription', () => ({
    checkSubscriptionAccess: vi.fn().mockResolvedValue(true)
}))

// Mock logger
vi.mock('@aura-flow/common', async () => {
    const actual = await vi.importActual('@aura-flow/common')
    return {
        ...actual,
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        },
        extractTokenFromHeader: vi.fn().mockReturnValue('valid-token')
    }
})

describe('Generate Routes', () => {
    let app: Hono

    beforeEach(() => {
        vi.clearAllMocks()

        app = new Hono()

        // Set up context with mocked services
        app.use('*', async (c, next) => {
            c.set('authService', mockAuthService)
            c.set('messageService', mockMessageService)
            await next()
        })

        app.route('/', generateRoutes)
    })

    describe('POST /', () => {
        const validSession = {
            userId: 'user-123',
            email: 'test@example.com',
            subscriptionTier: 'premium_core' as const
        }

        const validRequest = {
            category: 'motivational',
            timeOfDay: 'morning',
            weatherContext: 'sunny'
        }

        const mockGeneratedMessage = {
            id: 'msg-123',
            content: 'Test motivational message',
            category: 'motivational' as const,
            tokens: 25,
            cost: 0.00005,
            model: 'gpt-3.5-turbo',
            timeOfDay: 'morning' as const,
            weatherContext: 'sunny' as const,
            locale: 'en-US',
            createdAt: new Date(),
            cached: false
        }

        it('should generate message successfully', async () => {
            vi.mocked(mockAuthService.validateAccessToken).mockResolvedValue(validSession)
            vi.mocked(mockMessageService.generateMessage).mockResolvedValue(mockGeneratedMessage)

            const response = await app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify(validRequest)
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toMatchObject({
                id: 'msg-123',
                content: 'Test motivational message',
                category: 'motivational',
                cached: false
            })

            expect(data.metadata).toMatchObject({
                tokens: 25,
                model: 'gpt-3.5-turbo'
            })

            expect(data.rateLimit).toMatchObject({
                limit: 20,
                remaining: 18 // Should be decremented
            })
        })

        it('should return 401 for invalid token', async () => {
            vi.mocked(mockAuthService.validateAccessToken).mockResolvedValue(null)

            const response = await app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer invalid-token'
                },
                body: JSON.stringify(validRequest)
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                code: 'INVALID_TOKEN'
            })
        })

        it('should validate request body', async () => {
            const invalidRequest = {
                category: 'invalid-category'
            }

            const response = await app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify(invalidRequest)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                code: 'INVALID_CATEGORY'
            })
        })

        it('should validate temperature parameter', async () => {
            const invalidRequest = {
                category: 'motivational',
                temperature: 3.0 // Invalid - should be between 0 and 2
            }

            const response = await app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify(invalidRequest)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                code: 'INVALID_TEMPERATURE'
            })
        })

        it('should validate timeOfDay parameter', async () => {
            const invalidRequest = {
                category: 'motivational',
                timeOfDay: 'afternoon' // Invalid - should be 'morning' or 'evening'
            }

            const response = await app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify(invalidRequest)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                code: 'INVALID_TIME_OF_DAY'
            })
        })

        it('should validate weatherContext parameter', async () => {
            const invalidRequest = {
                category: 'motivational',
                weatherContext: 'windy' // Invalid - should be 'sunny', 'rain', 'cold', or 'hot'
            }

            const response = await app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify(invalidRequest)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                code: 'INVALID_WEATHER_CONTEXT'
            })
        })

        it('should handle missing category', async () => {
            const invalidRequest = {
                timeOfDay: 'morning'
                // Missing category
            }

            const response = await app.request('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token'
                },
                body: JSON.stringify(invalidRequest)
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                code: 'INVALID_CATEGORY'
            })
        })
    })

    describe('GET /health', () => {
        it('should return health status', async () => {
            const mockHealth = {
                status: 'healthy' as const,
                ai: {
                    status: 'healthy' as const,
                    providers: { openai: true, anthropic: true },
                    preferredProvider: 'openai',
                    fallbackEnabled: true
                },
                database: true,
                deduplication: {
                    lexical: { bloomFilter: { elementCount: 100 } }
                }
            }

            vi.mocked(mockMessageService.getHealthStatus).mockResolvedValue(mockHealth)

            const response = await app.request('/health', {
                method: 'GET'
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toMatchObject({
                status: 'healthy',
                services: {
                    ai: mockHealth.ai,
                    database: true,
                    deduplication: mockHealth.deduplication
                }
            })
        })

        it('should return 503 for unhealthy service', async () => {
            const mockHealth = {
                status: 'unhealthy' as const,
                ai: {
                    status: 'unhealthy' as const,
                    providers: { openai: false, anthropic: false },
                    preferredProvider: 'openai',
                    fallbackEnabled: true
                },
                database: false,
                deduplication: null
            }

            vi.mocked(mockMessageService.getHealthStatus).mockResolvedValue(mockHealth)

            const response = await app.request('/health', {
                method: 'GET'
            })

            expect(response.status).toBe(503)

            const data = await response.json()
            expect(data.status).toBe('unhealthy')
        })
    })

    describe('GET /categories', () => {
        it('should return categories for free user', async () => {
            const response = await app.request('/categories', {
                method: 'GET'
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.subscriptionTier).toBe('free')
            expect(data.categories).toHaveLength(2) // Only free categories
            expect(data.categories.map((c: any) => c.id)).toEqual(['motivational', 'philosophy'])
        })

        it('should return all categories for premium user', async () => {
            vi.mocked(mockAuthService.validateAccessToken).mockResolvedValue({
                userId: 'user-123',
                email: 'test@example.com',
                subscriptionTier: 'premium_core'
            })

            const response = await app.request('/categories', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token'
                }
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data.subscriptionTier).toBe('premium_core')
            expect(data.categories).toHaveLength(5) // All categories
        })
    })
})