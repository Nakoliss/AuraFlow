import { Hono } from 'hono'
import { validator } from 'hono/validator'
import {
    MessageCategory,
    TimeOfDay,
    WeatherBucket,
    AppError,
    ErrorType,
    logger,
    AuthService,
    extractTokenFromHeader
} from '@aura-flow/common'
import { MessageGenerationService } from '../services/message-generation'
import { getRateLimitInfo, checkRateLimit } from '../middleware/rate-limiting'
import { checkSubscriptionAccess } from '../middleware/subscription'

const app = new Hono()

// Request validation schema
const generateRequestSchema = validator('json', (value, c) => {
    const body = value as any

    // Validate required fields
    if (!body.category || typeof body.category !== 'string') {
        return c.json({
            error: 'Validation Error',
            message: 'Category is required and must be a string',
            code: 'INVALID_CATEGORY'
        }, 400)
    }

    // Validate category
    const validCategories: MessageCategory[] = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']
    if (!validCategories.includes(body.category)) {
        return c.json({
            error: 'Validation Error',
            message: 'Invalid category',
            code: 'INVALID_CATEGORY',
            validCategories
        }, 400)
    }

    // Validate optional fields
    if (body.timeOfDay && !['morning', 'evening'].includes(body.timeOfDay)) {
        return c.json({
            error: 'Validation Error',
            message: 'Invalid timeOfDay. Must be "morning" or "evening"',
            code: 'INVALID_TIME_OF_DAY'
        }, 400)
    }

    if (body.weatherContext && !['sunny', 'rain', 'cold', 'hot'].includes(body.weatherContext)) {
        return c.json({
            error: 'Validation Error',
            message: 'Invalid weatherContext. Must be "sunny", "rain", "cold", or "hot"',
            code: 'INVALID_WEATHER_CONTEXT'
        }, 400)
    }

    if (body.temperature !== undefined) {
        const temp = parseFloat(body.temperature)
        if (isNaN(temp) || temp < 0 || temp > 2) {
            return c.json({
                error: 'Validation Error',
                message: 'Temperature must be a number between 0 and 2',
                code: 'INVALID_TEMPERATURE'
            }, 400)
        }
    }

    if (body.locale && typeof body.locale !== 'string') {
        return c.json({
            error: 'Validation Error',
            message: 'Locale must be a string',
            code: 'INVALID_LOCALE'
        }, 400)
    }

    return {
        category: body.category as MessageCategory,
        timeOfDay: body.timeOfDay as TimeOfDay | undefined,
        weatherContext: body.weatherContext as WeatherBucket | undefined,
        temperature: body.temperature ? parseFloat(body.temperature) : undefined,
        locale: body.locale as string | undefined
    }
})

/**
 * POST /generate - Generate a new message
 */
app.post('/', generateRequestSchema, async (c) => {
    const startTime = Date.now()

    try {
        // Get services from context (these would be injected in a real implementation)
        const authService = c.get('authService') as AuthService
        const messageService = c.get('messageService') as MessageGenerationService

        if (!authService || !messageService) {
            throw new AppError(
                ErrorType.INTERNAL,
                'Required services not available',
                'SERVICES_UNAVAILABLE'
            )
        }

        // Extract and validate authentication
        const token = extractTokenFromHeader(c.req.header('Authorization'))
        const session = await authService.validateAccessToken(token)

        if (!session) {
            return c.json({
                error: 'Authentication Error',
                message: 'Invalid or expired token',
                code: 'INVALID_TOKEN'
            }, 401)
        }

        const validatedData = c.req.valid('json')

        // Check subscription access for category
        const hasAccess = await checkSubscriptionAccess(session, validatedData.category)
        if (!hasAccess) {
            return c.json({
                error: 'Subscription Required',
                message: 'This category requires a premium subscription',
                code: 'PREMIUM_REQUIRED',
                category: validatedData.category
            }, 402)
        }

        // Check rate limits
        const rateLimitResult = await checkRateLimit(session.userId, session.subscriptionTier)
        if (!rateLimitResult.allowed) {
            return c.json({
                error: 'Rate Limit Exceeded',
                message: 'You have exceeded your message generation limit',
                code: 'RATE_LIMIT_EXCEEDED',
                limit: rateLimitResult.limit,
                remaining: rateLimitResult.remaining,
                resetTime: rateLimitResult.resetTime
            }, 429)
        }

        // Generate message
        const message = await messageService.generateMessage({
            userId: session.userId,
            category: validatedData.category,
            timeOfDay: validatedData.timeOfDay,
            weatherContext: validatedData.weatherContext,
            temperature: validatedData.temperature,
            locale: validatedData.locale
        })

        const duration = Date.now() - startTime

        logger.info('Message generation request completed', {
            userId: session.userId,
            category: validatedData.category,
            messageId: message.id,
            cached: message.cached,
            duration,
            tokens: message.tokens,
            cost: message.cost
        })

        // Return response with rate limit headers
        const rateLimitInfo = await getRateLimitInfo(session.userId, session.subscriptionTier)

        c.header('X-RateLimit-Limit', rateLimitInfo.limit.toString())
        c.header('X-RateLimit-Remaining', rateLimitInfo.remaining.toString())
        c.header('X-RateLimit-Reset', rateLimitInfo.resetTime.toString())

        return c.json({
            id: message.id,
            content: message.content,
            category: message.category,
            timeOfDay: message.timeOfDay,
            weatherContext: message.weatherContext,
            locale: message.locale,
            cached: message.cached,
            metadata: {
                tokens: message.tokens,
                model: message.model,
                createdAt: message.createdAt
            },
            rateLimit: {
                limit: rateLimitInfo.limit,
                remaining: rateLimitInfo.remaining - 1, // Subtract 1 for this request
                resetTime: rateLimitInfo.resetTime
            }
        })

    } catch (error) {
        const duration = Date.now() - startTime

        logger.error('Message generation request failed', {
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        })

        if (error instanceof AppError) {
            const statusCode = getStatusCodeForError(error.type)
            return c.json({
                error: error.type,
                message: error.message,
                code: error.code,
                details: error.details
            }, statusCode)
        }

        return c.json({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred during message generation',
            code: 'INTERNAL_ERROR'
        }, 500)
    }
})

/**
 * GET /health - Get message generation service health
 */
app.get('/health', async (c) => {
    try {
        const messageService = c.get('messageService') as MessageGenerationService

        if (!messageService) {
            return c.json({
                status: 'unhealthy',
                message: 'Message service not available'
            }, 503)
        }

        const health = await messageService.getHealthStatus()

        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 200 : 503

        return c.json({
            status: health.status,
            timestamp: new Date().toISOString(),
            services: {
                ai: health.ai,
                database: health.database,
                deduplication: health.deduplication
            }
        }, statusCode)

    } catch (error) {
        logger.error('Health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        })

        return c.json({
            status: 'unhealthy',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        }, 503)
    }
})

/**
 * GET /categories - Get available message categories
 */
app.get('/categories', async (c) => {
    try {
        // Get authentication (optional for this endpoint)
        let subscriptionTier = 'free'

        try {
            const authService = c.get('authService') as AuthService
            if (authService) {
                const token = extractTokenFromHeader(c.req.header('Authorization'))
                const session = await authService.validateAccessToken(token)
                if (session) {
                    subscriptionTier = session.subscriptionTier
                }
            }
        } catch (error) {
            // Ignore auth errors for this endpoint
        }

        const allCategories = [
            {
                id: 'motivational',
                name: 'Motivational',
                description: 'Inspiring messages to boost your motivation and drive',
                premium: false
            },
            {
                id: 'philosophy',
                name: 'Philosophy',
                description: 'Thoughtful insights and wisdom for deeper reflection',
                premium: false
            },
            {
                id: 'mindfulness',
                name: 'Mindfulness',
                description: 'Messages focused on presence, awareness, and inner peace',
                premium: true
            },
            {
                id: 'fitness',
                name: 'Fitness',
                description: 'Encouraging messages for physical health and movement',
                premium: true
            },
            {
                id: 'productivity',
                name: 'Productivity',
                description: 'Tips and motivation for focus and getting things done',
                premium: true
            }
        ]

        const availableCategories = allCategories.filter(category =>
            !category.premium || subscriptionTier !== 'free'
        )

        return c.json({
            categories: availableCategories,
            subscriptionTier,
            totalCategories: allCategories.length,
            availableCategories: availableCategories.length
        })

    } catch (error) {
        logger.error('Categories request failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        })

        return c.json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve categories',
            code: 'CATEGORIES_ERROR'
        }, 500)
    }
})

/**
 * Map error types to HTTP status codes
 */
function getStatusCodeForError(errorType: string): number {
    switch (errorType) {
        case ErrorType.VALIDATION:
            return 400
        case ErrorType.AUTHENTICATION:
            return 401
        case ErrorType.AUTHORIZATION:
            return 403
        case ErrorType.PAYMENT_REQUIRED:
            return 402
        case ErrorType.RATE_LIMIT:
            return 429
        case ErrorType.QUOTA_EXCEEDED:
            return 429
        case ErrorType.CONTENT_GENERATION:
            return 422
        case ErrorType.EXTERNAL_API:
            return 502
        default:
            return 500
    }
}

export default app