import { Hono } from 'hono'
import { DailyDropService, AIService, initializeDatabase, getDatabaseConfig } from '@aura-flow/common'
import { logger } from '@aura-flow/common'
import { AppError, ErrorType } from '@aura-flow/common'

interface Env {
    // Database configuration
    DB_HOST: string
    DB_PORT: string
    DB_NAME: string
    DB_USER: string
    DB_PASSWORD: string
    DB_SSL: string

    // AI service configuration
    OPENAI_API_KEY: string
    ANTHROPIC_API_KEY: string

    // Optional configuration
    PREFERRED_AI_PROVIDER?: string
    ENABLE_AI_FALLBACK?: string
    SUPPORTED_LOCALES?: string
    CACHE_TTL?: string
}

const app = new Hono<{ Bindings: Env }>()

// Cache for daily drops (in-memory cache for this worker instance)
const dailyDropCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

/**
 * Get cached data if still valid
 */
function getCachedData(key: string): any | null {
    const cached = dailyDropCache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
        dailyDropCache.delete(key)
        return null
    }

    return cached.data
}

/**
 * Set data in cache
 */
function setCachedData(key: string, data: any, ttlMs: number): void {
    dailyDropCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttlMs
    })
}

/**
 * Initialize services for the request
 */
async function initializeServices(env: Env): Promise<{
    dailyDropService: DailyDropService
    aiService: AIService
}> {
    // Initialize database connection
    await initializeDatabase({
        host: env.DB_HOST,
        port: parseInt(env.DB_PORT || '5432'),
        database: env.DB_NAME,
        username: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL === 'true',
        maxConnections: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
    })

    // Initialize AI service
    const aiService = new AIService({
        openai: {
            apiKey: env.OPENAI_API_KEY,
            timeout: 30000,
            maxRetries: 3
        },
        anthropic: {
            apiKey: env.ANTHROPIC_API_KEY,
            timeout: 30000,
            maxRetries: 3
        },
        preferredProvider: (env.PREFERRED_AI_PROVIDER as 'openai' | 'anthropic') || 'openai',
        enableFallback: env.ENABLE_AI_FALLBACK !== 'false'
    })

    // Initialize daily drop service
    const dailyDropService = new DailyDropService(aiService)

    return { dailyDropService, aiService }
}

/**
 * GET /daily-drop
 * Get the daily drop for today with optional localization
 */
app.get('/', async (c) => {
    const startTime = Date.now()

    try {
        const locale = c.req.query('locale') || 'en-US'
        const date = c.req.query('date') || new Date().toISOString().split('T')[0]

        // Validate locale format
        if (!/^[a-z]{2}-[A-Z]{2}$/.test(locale)) {
            return c.json({
                error: 'Invalid locale format. Expected format: en-US, es-ES, etc.'
            }, 400)
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return c.json({
                error: 'Invalid date format. Expected format: YYYY-MM-DD'
            }, 400)
        }

        // Check cache first
        const cacheKey = `daily-drop:${date}:${locale}`
        const cacheTTL = parseInt(c.env.CACHE_TTL || '3600000') // Default 1 hour

        let cachedData = getCachedData(cacheKey)
        if (cachedData) {
            logger.info('Daily drop served from cache', {
                date,
                locale,
                duration: Date.now() - startTime
            })

            return c.json(cachedData)
        }

        // Initialize services
        const { dailyDropService } = await initializeServices(c.env)

        // Get daily drop
        let dailyDrop = await dailyDropService.getDailyDrop(date, locale)

        // If no daily drop exists, try to generate one
        if (!dailyDrop) {
            logger.info('Daily drop not found, attempting generation', { date, locale })

            try {
                const result = await dailyDropService.generateDailyDrop(date, {
                    locale,
                    category: 'motivational', // Default category for daily drops
                    maxRetries: 2
                })

                dailyDrop = result.dailyDrop

                logger.info('Daily drop generated on-demand', {
                    date,
                    locale,
                    dailyDropId: dailyDrop.id,
                    usedFallback: result.usedFallback
                })
            } catch (error) {
                logger.error('Failed to generate daily drop on-demand', {
                    date,
                    locale
                }, error as Error)

                return c.json({
                    error: 'Daily drop not available',
                    message: 'Unable to retrieve or generate daily drop for the requested date'
                }, 503)
            }
        }

        // Get daily challenge
        const dailyChallenge = await dailyDropService.getDailyChallenge(date, locale)

        // Prepare response
        const responseData = {
            date,
            locale,
            dailyDrop: {
                id: dailyDrop.id,
                content: dailyDrop.content,
                createdAt: dailyDrop.createdAt
            },
            dailyChallenge: dailyChallenge ? {
                id: dailyChallenge.id,
                task: dailyChallenge.task,
                points: dailyChallenge.points,
                createdAt: dailyChallenge.createdAt
            } : null,
            meta: {
                generatedAt: new Date().toISOString(),
                cached: false
            }
        }

        // Cache the response
        setCachedData(cacheKey, responseData, cacheTTL)

        const duration = Date.now() - startTime

        logger.info('Daily drop served successfully', {
            date,
            locale,
            duration,
            dailyDropId: dailyDrop.id,
            hasDailyChallenge: !!dailyChallenge
        })

        return c.json(responseData)

    } catch (error) {
        const duration = Date.now() - startTime

        logger.error('Daily drop request failed', {
            duration,
            query: c.req.query()
        }, error as Error)

        if (error instanceof AppError) {
            return c.json({
                error: error.type,
                message: error.message,
                code: error.code
            }, error.type === ErrorType.VALIDATION ? 400 : 500)
        }

        return c.json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while fetching daily drop'
        }, 500)
    }
})

/**
 * GET /daily-drop/history
 * Get historical daily drops for a date range
 */
app.get('/history', async (c) => {
    const startTime = Date.now()

    try {
        const locale = c.req.query('locale') || 'en-US'
        const startDate = c.req.query('start_date')
        const endDate = c.req.query('end_date')
        const limit = parseInt(c.req.query('limit') || '30')

        // Validate required parameters
        if (!startDate || !endDate) {
            return c.json({
                error: 'Missing required parameters',
                message: 'Both start_date and end_date are required'
            }, 400)
        }

        // Validate date formats
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            return c.json({
                error: 'Invalid date format. Expected format: YYYY-MM-DD'
            }, 400)
        }

        // Validate limit
        if (limit < 1 || limit > 100) {
            return c.json({
                error: 'Invalid limit. Must be between 1 and 100'
            }, 400)
        }

        // Check cache
        const cacheKey = `daily-drop-history:${startDate}:${endDate}:${locale}:${limit}`
        const cacheTTL = parseInt(c.env.CACHE_TTL || '1800000') // Default 30 minutes for history

        let cachedData = getCachedData(cacheKey)
        if (cachedData) {
            logger.info('Daily drop history served from cache', {
                startDate,
                endDate,
                locale,
                limit,
                duration: Date.now() - startTime
            })

            return c.json(cachedData)
        }

        // Initialize services
        const { dailyDropService } = await initializeServices(c.env)

        // Query historical data
        const { dailyDrops, totalCount } = await dailyDropService.getHistoricalDailyDrops(
            startDate,
            endDate,
            locale,
            limit
        )

        const responseData = {
            startDate,
            endDate,
            locale,
            limit,
            dailyDrops: dailyDrops.map(drop => ({
                id: drop.id,
                date: drop.date,
                content: drop.content,
                createdAt: drop.createdAt
            })),
            totalCount,
            meta: {
                generatedAt: new Date().toISOString(),
                cached: false
            }
        }

        // Cache the response
        setCachedData(cacheKey, responseData, cacheTTL)

        const duration = Date.now() - startTime

        logger.info('Daily drop history served successfully', {
            startDate,
            endDate,
            locale,
            limit,
            duration,
            count: responseData.dailyDrops.length
        })

        return c.json(responseData)

    } catch (error) {
        const duration = Date.now() - startTime

        logger.error('Daily drop history request failed', {
            duration,
            query: c.req.query()
        }, error as Error)

        return c.json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while fetching daily drop history'
        }, 500)
    }
})

/**
 * GET /daily-drop/health
 * Health check for daily drop service
 */
app.get('/health', async (c) => {
    try {
        const { aiService } = await initializeServices(c.env)

        const healthStatus = await aiService.getHealthStatus()

        return c.json({
            status: 'healthy',
            services: {
                ai: healthStatus,
                cache: {
                    status: 'healthy',
                    entries: dailyDropCache.size
                }
            },
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        logger.error('Daily drop health check failed', {}, error as Error)

        return c.json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, 503)
    }
})

export default app