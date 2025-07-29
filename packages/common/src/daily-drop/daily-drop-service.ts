import { AIService } from '../ai/ai-service'
import { executeQuery, executeTransaction } from '../database'
import { DailyDrop, DailyChallenge, MessageCategory } from '../types'
import { logger } from '../logging'
import { AppError, ErrorType } from '../errors'
import { promptTemplateService } from '../prompts'
import { fallbackContentService } from './fallback-content'

export interface DailyDropGenerationOptions {
    locale?: string
    category?: MessageCategory
    fallbackContent?: string[]
    maxRetries?: number
}

export interface DailyDropResult {
    dailyDrop: DailyDrop
    dailyChallenge?: DailyChallenge
    wasGenerated: boolean
    usedFallback: boolean
}

export class DailyDropService {
    constructor(private aiService: AIService) { }

    /**
     * Generate and store daily drop for a specific date
     */
    async generateDailyDrop(
        date: string,
        options: DailyDropGenerationOptions = {}
    ): Promise<DailyDropResult> {
        const {
            locale = 'en-US',
            category = 'motivational',
            fallbackContent = [],
            maxRetries = 3
        } = options

        logger.info('Starting daily drop generation', { date, locale, category })

        try {
            // Check if daily drop already exists for this date
            const existing = await this.getDailyDrop(date, locale)
            if (existing) {
                logger.info('Daily drop already exists for date', { date, locale })
                return {
                    dailyDrop: existing,
                    wasGenerated: false,
                    usedFallback: false
                }
            }

            // Generate new daily drop content
            let dailyDrop: DailyDrop
            let usedFallback = false

            try {
                dailyDrop = await this.generateContent(date, locale, category, maxRetries)
            } catch (error) {
                logger.warn('AI generation failed, using fallback content', {
                    date,
                    locale,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })

                dailyDrop = await this.createFallbackDailyDrop(date, locale, fallbackContent)
                usedFallback = true
            }

            // Generate daily challenge
            const dailyChallenge = await this.generateDailyChallenge(date, locale)

            logger.info('Daily drop generation completed', {
                date,
                locale,
                dailyDropId: dailyDrop.id,
                dailyChallengeId: dailyChallenge?.id,
                usedFallback
            })

            return {
                dailyDrop,
                dailyChallenge,
                wasGenerated: true,
                usedFallback
            }

        } catch (error) {
            logger.error('Daily drop generation failed', { date, locale }, error as Error)
            throw new AppError(
                ErrorType.INTERNAL,
                `Failed to generate daily drop for ${date}`,
                'DAILY_DROP_GENERATION_FAILED',
                { date, locale, error: error instanceof Error ? error.message : 'Unknown error' }
            )
        }
    }

    /**
     * Get existing daily drop for a date
     */
    async getDailyDrop(date: string, locale: string = 'en-US'): Promise<DailyDrop | null> {
        try {
            const result = await executeQuery<DailyDrop>(
                'SELECT * FROM daily_drops WHERE date = $1 AND locale = $2',
                [date, locale]
            )

            return result.rows[0] || null
        } catch (error) {
            logger.error('Failed to fetch daily drop', { date, locale }, error as Error)
            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to fetch daily drop',
                'DAILY_DROP_FETCH_FAILED',
                { date, locale }
            )
        }
    }

    /**
     * Get daily challenge for a date
     */
    async getDailyChallenge(date: string, locale: string = 'en-US'): Promise<DailyChallenge | null> {
        try {
            const result = await executeQuery<DailyChallenge>(
                'SELECT * FROM daily_challenges WHERE date = $1 AND locale = $2',
                [date, locale]
            )

            return result.rows[0] || null
        } catch (error) {
            logger.error('Failed to fetch daily challenge', { date, locale }, error as Error)
            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to fetch daily challenge',
                'DAILY_CHALLENGE_FETCH_FAILED',
                { date, locale }
            )
        }
    }

    /**
     * Generate content using AI service with deduplication
     */
    private async generateContent(
        date: string,
        locale: string,
        category: MessageCategory,
        maxRetries: number
    ): Promise<DailyDrop> {
        let attempt = 0
        let lastError: Error | null = null

        while (attempt < maxRetries) {
            attempt++

            try {
                // Create a special prompt for daily drops
                const prompt = this.buildDailyDropPrompt(category, date)

                const response = await this.aiService.generateMessage({
                    userId: 'system-daily-drop',
                    category,
                    locale,
                    temperature: 0.9 // Higher temperature for more variety
                })

                // Check for duplication against recent daily drops
                const isDuplicate = await this.checkDuplication(response.content, locale)

                if (isDuplicate && attempt < maxRetries) {
                    logger.warn('Generated content is duplicate, retrying', {
                        attempt,
                        maxRetries,
                        content: response.content.substring(0, 50)
                    })
                    continue
                }

                // Create and store the daily drop
                const dailyDrop = await this.storeDailyDrop({
                    date,
                    content: response.content,
                    locale,
                    tokens: response.tokens,
                    model: response.model
                })

                logger.info('Daily drop content generated successfully', {
                    date,
                    locale,
                    attempt,
                    tokens: response.tokens,
                    model: response.model
                })

                return dailyDrop

            } catch (error) {
                lastError = error as Error
                logger.warn('Daily drop generation attempt failed', {
                    attempt,
                    maxRetries,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })

                if (attempt < maxRetries) {
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
                }
            }
        }

        throw lastError || new Error('All generation attempts failed')
    }

    /**
     * Build a special prompt for daily drops
     */
    private buildDailyDropPrompt(category: MessageCategory, date: string): string {
        const template = promptTemplateService.getTemplate(category)
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' })

        return `${template.userPrompt} This is a Daily Drop message that will be shared with thousands of users on ${dayOfWeek}. Make it universally inspiring and appropriate for a diverse global audience. Focus on themes that unite and uplift people regardless of their background.`
    }

    /**
     * Check if content is too similar to recent daily drops
     */
    private async checkDuplication(content: string, locale: string): Promise<boolean> {
        try {
            // Simple lexical check for now - in production would use embeddings
            const result = await executeQuery<{ content: string }>(
                `SELECT content FROM daily_drops 
                 WHERE locale = $1 
                 AND created_at >= NOW() - INTERVAL '90 days'
                 ORDER BY created_at DESC
                 LIMIT 50`,
                [locale]
            )

            const recentContent = result.rows.map(row => row.content.toLowerCase())
            const newContent = content.toLowerCase()

            // Check for exact matches or very similar content
            for (const existing of recentContent) {
                if (existing === newContent) {
                    return true
                }

                // Simple similarity check - count common words
                const existingWords = new Set(existing.split(/\s+/))
                const newWords = new Set(newContent.split(/\s+/))
                const commonWords = [...existingWords].filter(word => newWords.has(word))

                // If more than 70% of words are common, consider it duplicate
                const similarity = commonWords.length / Math.max(existingWords.size, newWords.size)
                if (similarity > 0.7) {
                    return true
                }
            }

            return false

        } catch (error) {
            logger.warn('Duplication check failed, proceeding with generation', {
                error: error instanceof Error ? error.message : 'Unknown error'
            })
            return false
        }
    }

    /**
     * Store daily drop in database
     */
    private async storeDailyDrop(data: {
        date: string
        content: string
        locale: string
        tokens: number
        model: string
    }): Promise<DailyDrop> {
        return executeTransaction(async (client) => {
            const result = await client.query<DailyDrop>(
                `INSERT INTO daily_drops (date, content, locale, created_at)
                 VALUES ($1, $2, $3, NOW())
                 RETURNING *`,
                [data.date, data.content, data.locale]
            )

            if (result.rows.length === 0) {
                throw new Error('Failed to insert daily drop')
            }

            return result.rows[0]
        })
    }

    /**
     * Create fallback daily drop when AI generation fails
     */
    private async createFallbackDailyDrop(
        date: string,
        locale: string,
        fallbackContent: string[]
    ): Promise<DailyDrop> {
        let content: string

        if (fallbackContent.length > 0) {
            // Use provided fallback content
            const randomIndex = Math.floor(Math.random() * fallbackContent.length)
            content = fallbackContent[randomIndex]
        } else {
            // Use curated fallback content service
            content = fallbackContentService.getFallbackContent('motivational', date)
        }

        return this.storeDailyDrop({
            date,
            content,
            locale,
            tokens: 0,
            model: 'fallback'
        })
    }

    /**
     * Generate daily challenge
     */
    private async generateDailyChallenge(
        date: string,
        locale: string
    ): Promise<DailyChallenge | null> {
        try {
            // Check if challenge already exists
            const existing = await this.getDailyChallenge(date, locale)
            if (existing) {
                return existing
            }

            let challengeContent: string

            try {
                // Try to generate challenge using AI
                const challengePrompt = `Generate a simple, actionable daily challenge that takes 5-10 minutes to complete. Focus on mindfulness, gratitude, kindness, or personal growth. Make it exactly 25 words or fewer. Examples: "Write down three things you're grateful for today" or "Take a 5-minute walk and notice five beautiful things around you."`

                const response = await this.aiService.generateMessage({
                    userId: 'system-daily-challenge',
                    category: 'mindfulness',
                    locale,
                    temperature: 0.8
                })

                challengeContent = response.content
            } catch (error) {
                logger.warn('AI challenge generation failed, using fallback', {
                    date,
                    locale,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })

                // Use fallback challenge content
                challengeContent = fallbackContentService.getFallbackChallenge(date)
            }

            // Store the challenge
            const result = await executeQuery<DailyChallenge>(
                `INSERT INTO daily_challenges (date, task, points, locale, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 RETURNING *`,
                [date, challengeContent, 5, locale]
            )

            return result.rows[0] || null

        } catch (error) {
            logger.warn('Failed to generate daily challenge', {
                date,
                locale,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
            return null
        }
    }

    /**
     * Get default fallback content when all else fails
     */
    private getDefaultFallbackContent(date: string): string {
        const fallbackMessages = [
            "Today is a new beginning. Every moment offers a fresh start and endless possibilities.",
            "Your potential is limitless. Trust in your ability to overcome challenges and grow stronger.",
            "Small steps forward are still progress. Celebrate every victory, no matter how small.",
            "You have the power to choose your response to any situation. Choose growth and positivity.",
            "Believe in yourself. You are capable of amazing things when you put your mind to it.",
            "Today's challenges are tomorrow's strengths. Embrace the journey of becoming your best self.",
            "Your mindset shapes your reality. Choose thoughts that empower and inspire you forward.",
            "Every day is an opportunity to learn, grow, and become a better version of yourself."
        ]

        // Use date to deterministically select fallback content
        const dateHash = date.split('-').reduce((acc, part) => acc + parseInt(part), 0)
        const index = dateHash % fallbackMessages.length

        return fallbackMessages[index]
    }

    /**
     * Get historical daily drops for a date range
     */
    async getHistoricalDailyDrops(
        startDate: string,
        endDate: string,
        locale: string = 'en-US',
        limit: number = 30
    ): Promise<{ dailyDrops: DailyDrop[]; totalCount: number }> {
        try {
            // Get the daily drops
            const dropsResult = await executeQuery<DailyDrop>(
                `SELECT * FROM daily_drops 
                 WHERE date >= $1 AND date <= $2 AND locale = $3
                 ORDER BY date DESC
                 LIMIT $4`,
                [startDate, endDate, locale, limit]
            )

            // Get total count for pagination
            const countResult = await executeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM daily_drops 
                 WHERE date >= $1 AND date <= $2 AND locale = $3`,
                [startDate, endDate, locale]
            )

            const totalCount = countResult.rows[0]?.count || 0

            logger.info('Retrieved historical daily drops', {
                startDate,
                endDate,
                locale,
                limit,
                resultCount: dropsResult.rows.length,
                totalCount
            })

            return {
                dailyDrops: dropsResult.rows,
                totalCount
            }

        } catch (error) {
            logger.error('Failed to get historical daily drops', {
                startDate,
                endDate,
                locale,
                limit
            }, error as Error)

            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to retrieve historical daily drops',
                'HISTORICAL_FETCH_FAILED',
                { startDate, endDate, locale, limit }
            )
        }
    }

    /**
     * Clean up old daily drops (keep last 90 days)
     */
    async cleanupOldDailyDrops(): Promise<number> {
        try {
            const result = await executeQuery(
                `DELETE FROM daily_drops 
                 WHERE created_at < NOW() - INTERVAL '90 days'`,
                []
            )

            logger.info('Cleaned up old daily drops', { deletedCount: result.rowCount })
            return result.rowCount

        } catch (error) {
            logger.error('Failed to cleanup old daily drops', {}, error as Error)
            throw new AppError(
                ErrorType.INTERNAL,
                'Failed to cleanup old daily drops',
                'CLEANUP_FAILED'
            )
        }
    }
}