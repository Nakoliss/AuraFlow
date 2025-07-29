// Database seeding utilities for AuraFlow development
import { executeQuery, executeTransaction } from './database'
import { createLogger } from './logging'
import { generateId } from './utils'
import { seedAchievements } from './gamification/achievement-seeds'
import type { MessageCategory, SubscriptionTier } from './types'

const logger = createLogger('seeds')

// Sample data interfaces
interface SeedUser {
    id: string
    email: string
    passwordHash: string
    subscriptionStatus: SubscriptionTier
    wisdomPoints: number
    streakCount: number
    preferredCategories: MessageCategory[]
    timezone: string
}

interface SeedAchievement {
    id: string
    name: string
    description: string
    icon: string
    pointsRequired: number
    badgeColor: string
}

interface SeedMessage {
    id: string
    userId?: string
    content: string
    category: MessageCategory
    tokens: number
    cost: number
    model: string
    locale: string
}

interface SeedDailyDrop {
    id: string
    date: string
    content: string
    locale: string
}

interface SeedDailyChallenge {
    id: string
    date: string
    task: string
    points: number
    locale: string
}

class DatabaseSeeder {
    // Sample users for development
    private sampleUsers: SeedUser[] = [
        {
            id: generateId(),
            email: 'demo@auraflow.com',
            passwordHash: '$2b$10$example.hash.for.demo.user', // In real app, properly hash passwords
            subscriptionStatus: 'premium_core',
            wisdomPoints: 150,
            streakCount: 7,
            preferredCategories: ['motivational', 'productivity'],
            timezone: 'America/New_York'
        },
        {
            id: generateId(),
            email: 'free@auraflow.com',
            passwordHash: '$2b$10$example.hash.for.free.user',
            subscriptionStatus: 'free',
            wisdomPoints: 25,
            streakCount: 2,
            preferredCategories: ['philosophy', 'mindfulness'],
            timezone: 'Europe/London'
        },
        {
            id: generateId(),
            email: 'voice@auraflow.com',
            passwordHash: '$2b$10$example.hash.for.voice.user',
            subscriptionStatus: 'voice_pack',
            wisdomPoints: 300,
            streakCount: 15,
            preferredCategories: ['fitness', 'motivational', 'mindfulness'],
            timezone: 'Asia/Tokyo'
        }
    ]

    // Sample achievements
    private sampleAchievements: SeedAchievement[] = [
        {
            id: generateId(),
            name: 'First Steps',
            description: 'Generate your first motivational message',
            icon: '🌟',
            pointsRequired: 1,
            badgeColor: 'bronze'
        },
        {
            id: generateId(),
            name: 'Week Warrior',
            description: 'Maintain a 7-day streak',
            icon: '🔥',
            pointsRequired: 50,
            badgeColor: 'silver'
        },
        {
            id: generateId(),
            name: 'Wisdom Seeker',
            description: 'Accumulate 100 wisdom points',
            icon: '🧠',
            pointsRequired: 100,
            badgeColor: 'gold'
        },
        {
            id: generateId(),
            name: 'Category Explorer',
            description: 'Try all 5 message categories',
            icon: '🗺️',
            pointsRequired: 25,
            badgeColor: 'silver'
        },
        {
            id: generateId(),
            name: 'Monthly Master',
            description: 'Maintain a 30-day streak',
            icon: '👑',
            pointsRequired: 200,
            badgeColor: 'gold'
        }
    ]

    // Sample messages
    private sampleMessages: SeedMessage[] = [
        {
            id: generateId(),
            content: 'Every small step forward is progress. Celebrate your journey, not just the destination.',
            category: 'motivational',
            tokens: 18,
            cost: 0.000036,
            model: 'gpt-3.5-turbo',
            locale: 'en-US'
        },
        {
            id: generateId(),
            content: 'Take three deep breaths. Feel your feet on the ground. You are here, you are present.',
            category: 'mindfulness',
            tokens: 19,
            cost: 0.000038,
            model: 'gpt-3.5-turbo',
            locale: 'en-US'
        },
        {
            id: generateId(),
            content: 'Your body is capable of amazing things. Move it with intention and gratitude today.',
            category: 'fitness',
            tokens: 17,
            cost: 0.000034,
            model: 'gpt-3.5-turbo',
            locale: 'en-US'
        },
        {
            id: generateId(),
            content: 'The unexamined life is not worth living. What will you discover about yourself today?',
            category: 'philosophy',
            tokens: 18,
            cost: 0.000036,
            model: 'gpt-3.5-turbo',
            locale: 'en-US'
        },
        {
            id: generateId(),
            content: 'Focus on one important task at a time. Deep work creates extraordinary results.',
            category: 'productivity',
            tokens: 16,
            cost: 0.000032,
            model: 'gpt-3.5-turbo',
            locale: 'en-US'
        }
    ]

    // Sample daily drops
    private sampleDailyDrops: SeedDailyDrop[] = [
        {
            id: generateId(),
            date: '2025-07-28',
            content: 'Today is a new canvas. Paint it with intention, color it with kindness, and frame it with gratitude.',
            locale: 'en-US'
        },
        {
            id: generateId(),
            date: '2025-07-27',
            content: 'Growth happens in the space between comfort and fear. Step into that space today.',
            locale: 'en-US'
        },
        {
            id: generateId(),
            date: '2025-07-26',
            content: 'Your potential is not determined by your past. It is created by your choices in this moment.',
            locale: 'en-US'
        }
    ]

    // Sample daily challenges
    private sampleDailyChallenges: SeedDailyChallenge[] = [
        {
            id: generateId(),
            date: '2025-07-28',
            task: 'Write down three things you are grateful for today',
            points: 5,
            locale: 'en-US'
        },
        {
            id: generateId(),
            date: '2025-07-27',
            task: 'Take a 10-minute walk without your phone',
            points: 5,
            locale: 'en-US'
        },
        {
            id: generateId(),
            date: '2025-07-26',
            task: 'Compliment someone genuinely today',
            points: 5,
            locale: 'en-US'
        }
    ]

    // Seed users table
    async seedUsers(): Promise<void> {
        logger.info('Seeding users table')

        for (const user of this.sampleUsers) {
            await executeQuery(
                `INSERT INTO users (
          id, email, password_hash, subscription_status, wisdom_points, 
          streak_count, preferred_categories, timezone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (email) DO NOTHING`,
                [
                    user.id,
                    user.email,
                    user.passwordHash,
                    user.subscriptionStatus,
                    user.wisdomPoints,
                    user.streakCount,
                    user.preferredCategories,
                    user.timezone
                ]
            )
        }

        logger.info(`Seeded ${this.sampleUsers.length} users`)
    }

    // Seed achievements table
    async seedAchievements(): Promise<void> {
        logger.info('Seeding achievements table')
        await seedAchievements()
        logger.info('Achievement seeding completed')
    }

    // Seed generated messages table
    async seedMessages(): Promise<void> {
        logger.info('Seeding generated messages table')

        for (const message of this.sampleMessages) {
            // Assign some messages to users randomly
            const userId = Math.random() > 0.5 ? this.sampleUsers[0].id : null

            await executeQuery(
                `INSERT INTO generated_messages (
          id, user_id, content, category, tokens, cost, model, locale
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING`,
                [
                    message.id,
                    userId,
                    message.content,
                    message.category,
                    message.tokens,
                    message.cost,
                    message.model,
                    message.locale
                ]
            )
        }

        logger.info(`Seeded ${this.sampleMessages.length} messages`)
    }

    // Seed daily drops table
    async seedDailyDrops(): Promise<void> {
        logger.info('Seeding daily drops table')

        for (const drop of this.sampleDailyDrops) {
            await executeQuery(
                `INSERT INTO daily_drops (id, date, content, locale)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (date) DO NOTHING`,
                [drop.id, drop.date, drop.content, drop.locale]
            )
        }

        logger.info(`Seeded ${this.sampleDailyDrops.length} daily drops`)
    }

    // Seed daily challenges table
    async seedDailyChallenges(): Promise<void> {
        logger.info('Seeding daily challenges table')

        for (const challenge of this.sampleDailyChallenges) {
            await executeQuery(
                `INSERT INTO daily_challenges (id, date, task, points, locale)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (date, locale) DO NOTHING`,
                [challenge.id, challenge.date, challenge.task, challenge.points, challenge.locale]
            )
        }

        logger.info(`Seeded ${this.sampleDailyChallenges.length} daily challenges`)
    }

    // Seed user achievements (award some achievements to demo users)
    async seedUserAchievements(): Promise<void> {
        logger.info('Seeding user achievements')

        const demoUser = this.sampleUsers[0] // Premium user
        const firstStepsAchievement = this.sampleAchievements[0]
        const wisdomSeekerAchievement = this.sampleAchievements[2]

        // Award "First Steps" to demo user
        await executeQuery(
            `INSERT INTO user_achievements (user_id, achievement_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
            [demoUser.id, firstStepsAchievement.id]
        )

        // Award "Wisdom Seeker" to demo user
        await executeQuery(
            `INSERT INTO user_achievements (user_id, achievement_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
            [demoUser.id, wisdomSeekerAchievement.id]
        )

        logger.info('Seeded user achievements')
    }

    // Clear all data (for development reset)
    async clearAllData(): Promise<void> {
        logger.warn('Clearing all seed data')

        const tables = [
            'user_achievements',
            'audio_cache',
            'daily_challenges',
            'daily_drops',
            'generated_messages',
            'achievements',
            'users'
        ]

        for (const table of tables) {
            await executeQuery(`DELETE FROM ${table}`)
            logger.debug(`Cleared ${table} table`)
        }

        logger.info('All seed data cleared')
    }

    // Run all seeds
    async seedAll(): Promise<void> {
        logger.info('Starting database seeding process')

        try {
            await executeTransaction(async () => {
                await this.seedUsers()
                await this.seedAchievements()
                await this.seedMessages()
                await this.seedDailyDrops()
                await this.seedDailyChallenges()
                await this.seedUserAchievements()
            })

            logger.info('Database seeding completed successfully')
        } catch (error) {
            logger.error('Database seeding failed', {}, error as Error)
            throw error
        }
    }

    // Get seeded user credentials for testing
    getSampleUserCredentials(): Array<{ email: string; password: string; subscription: SubscriptionTier }> {
        return [
            { email: 'demo@auraflow.com', password: 'Demo123!', subscription: 'premium_core' },
            { email: 'free@auraflow.com', password: 'Free123!', subscription: 'free' },
            { email: 'voice@auraflow.com', password: 'Voice123!', subscription: 'voice_pack' }
        ]
    }
}

// Default seeder instance
export const databaseSeeder = new DatabaseSeeder()

// Convenience functions
export async function seedDatabase(): Promise<void> {
    return await databaseSeeder.seedAll()
}

export async function clearDatabase(): Promise<void> {
    return await databaseSeeder.clearAllData()
}

export function getSampleCredentials() {
    return databaseSeeder.getSampleUserCredentials()
}