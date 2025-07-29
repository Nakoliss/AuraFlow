// AuraFlow Cron Worker Entry Point
import { DailyDropService, AIService, initializeDatabase, getDatabaseConfig } from '@aura-flow/common'
import { logger } from '@aura-flow/common'

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
    DAILY_DROP_CATEGORY?: string
    SUPPORTED_LOCALES?: string
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        const startTime = Date.now()

        try {
            logger.info('Daily Drop generation cron job started', {
                scheduledTime: new Date(event.scheduledTime).toISOString(),
                cron: event.cron
            })

            // Initialize database connection
            await initializeDatabase({
                host: env.DB_HOST,
                port: parseInt(env.DB_PORT || '5432'),
                database: env.DB_NAME,
                username: env.DB_USER,
                password: env.DB_PASSWORD,
                ssl: env.DB_SSL === 'true',
                maxConnections: 5, // Lower for cron jobs
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

            // Get current date in UTC
            const today = new Date().toISOString().split('T')[0]

            // Parse supported locales
            const supportedLocales = env.SUPPORTED_LOCALES?.split(',') || ['en-US']

            // Generate daily drops for each supported locale
            const results = await Promise.allSettled(
                supportedLocales.map(async (locale) => {
                    const result = await dailyDropService.generateDailyDrop(today, {
                        locale: locale.trim(),
                        category: (env.DAILY_DROP_CATEGORY as any) || 'motivational',
                        maxRetries: 3
                    })

                    logger.info('Daily drop generated for locale', {
                        locale,
                        dailyDropId: result.dailyDrop.id,
                        wasGenerated: result.wasGenerated,
                        usedFallback: result.usedFallback,
                        hasDailyChallenge: !!result.dailyChallenge
                    })

                    return result
                })
            )

            // Log results
            const successful = results.filter(r => r.status === 'fulfilled').length
            const failed = results.filter(r => r.status === 'rejected').length

            if (failed > 0) {
                logger.warn('Some daily drop generations failed', {
                    successful,
                    failed,
                    totalLocales: supportedLocales.length
                })

                // Log specific failures
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        logger.error('Daily drop generation failed for locale', {
                            locale: supportedLocales[index],
                            error: result.reason
                        })
                    }
                })
            }

            // Cleanup old daily drops (run weekly - check if it's Sunday)
            const dayOfWeek = new Date().getUTCDay()
            if (dayOfWeek === 0) { // Sunday
                try {
                    const deletedCount = await dailyDropService.cleanupOldDailyDrops()
                    logger.info('Weekly cleanup completed', { deletedCount })
                } catch (error) {
                    logger.error('Weekly cleanup failed', {}, error as Error)
                }
            }

            const duration = Date.now() - startTime

            logger.info('Daily Drop generation cron job completed', {
                duration,
                successful,
                failed,
                totalLocales: supportedLocales.length,
                date: today
            })

        } catch (error) {
            const duration = Date.now() - startTime

            logger.error('Daily Drop generation cron job failed', {
                duration,
                scheduledTime: new Date(event.scheduledTime).toISOString()
            }, error as Error)

            // Re-throw to ensure Cloudflare marks the job as failed
            throw error
        }
    }
}