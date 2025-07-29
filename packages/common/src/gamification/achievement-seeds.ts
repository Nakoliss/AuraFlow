import { executeQuery } from '../database'
import { AchievementDefinition } from './achievement-service'

export const defaultAchievements: Omit<AchievementDefinition, 'id'>[] = [
    {
        name: 'First Steps',
        description: 'Open the app for the first time',
        icon: '🌟',
        pointsRequired: 1,
        badgeColor: 'gold',
        conditions: [
            { type: 'wisdom_points', threshold: 1 }
        ]
    },
    {
        name: 'Daily Visitor',
        description: 'Visit the app for 3 consecutive days',
        icon: '📅',
        pointsRequired: 3,
        badgeColor: 'silver',
        conditions: [
            { type: 'streak_days', threshold: 3 }
        ]
    },
    {
        name: 'Wisdom Seeker',
        description: 'Earn your first 25 wisdom points',
        icon: '🧠',
        pointsRequired: 25,
        badgeColor: 'bronze',
        conditions: [
            { type: 'wisdom_points', threshold: 25 }
        ]
    },
    {
        name: 'Challenge Accepted',
        description: 'Complete your first daily challenge',
        icon: '🎯',
        pointsRequired: 5,
        badgeColor: 'gold',
        conditions: [
            { type: 'challenges_completed', threshold: 1 }
        ]
    },
    {
        name: 'Inspiration Generator',
        description: 'Generate 10 motivational messages',
        icon: '💡',
        pointsRequired: 10,
        badgeColor: 'silver',
        conditions: [
            { type: 'messages_generated', threshold: 10 }
        ]
    },
    {
        name: 'Social Butterfly',
        description: 'Share your first piece of content',
        icon: '🦋',
        pointsRequired: 3,
        badgeColor: 'gold',
        conditions: [
            { type: 'shares_made', threshold: 1 }
        ]
    },
    {
        name: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        icon: '🔥',
        pointsRequired: 14,
        badgeColor: 'gold',
        conditions: [
            { type: 'streak_days', threshold: 7 }
        ]
    },
    {
        name: 'Wisdom Master',
        description: 'Accumulate 100 wisdom points',
        icon: '👑',
        pointsRequired: 100,
        badgeColor: 'gold',
        conditions: [
            { type: 'wisdom_points', threshold: 100 }
        ]
    },
    {
        name: 'Challenge Champion',
        description: 'Complete 10 daily challenges',
        icon: '🏆',
        pointsRequired: 50,
        badgeColor: 'gold',
        conditions: [
            { type: 'challenges_completed', threshold: 10 }
        ]
    },
    {
        name: 'Content Creator',
        description: 'Generate 50 messages across all categories',
        icon: '✨',
        pointsRequired: 50,
        badgeColor: 'silver',
        conditions: [
            { type: 'messages_generated', threshold: 50 }
        ]
    },
    {
        name: 'Sharing is Caring',
        description: 'Share content 5 times',
        icon: '❤️',
        pointsRequired: 15,
        badgeColor: 'bronze',
        conditions: [
            { type: 'shares_made', threshold: 5 }
        ]
    },
    {
        name: 'Monthly Dedication',
        description: 'Maintain a 30-day streak',
        icon: '🌙',
        pointsRequired: 60,
        badgeColor: 'gold',
        conditions: [
            { type: 'streak_days', threshold: 30 }
        ]
    },
    {
        name: 'Wisdom Sage',
        description: 'Accumulate 500 wisdom points',
        icon: '🧙‍♂️',
        pointsRequired: 500,
        badgeColor: 'gold',
        conditions: [
            { type: 'wisdom_points', threshold: 500 }
        ]
    },
    {
        name: 'Prolific Creator',
        description: 'Generate 100 messages',
        icon: '🎨',
        pointsRequired: 100,
        badgeColor: 'gold',
        conditions: [
            { type: 'messages_generated', threshold: 100 }
        ]
    },
    {
        name: 'Ultimate Challenger',
        description: 'Complete 30 daily challenges',
        icon: '⚡',
        pointsRequired: 150,
        badgeColor: 'gold',
        conditions: [
            { type: 'challenges_completed', threshold: 30 }
        ]
    }
]

export async function seedAchievements(): Promise<void> {
    console.log('Seeding default achievements...')

    for (const achievement of defaultAchievements) {
        try {
            // Check if achievement already exists
            const existingResult = await executeQuery(
                'SELECT id FROM achievements WHERE name = $1',
                [achievement.name]
            )

            if (existingResult.rows.length > 0) {
                console.log(`Achievement "${achievement.name}" already exists, skipping...`)
                continue
            }

            // Insert achievement
            const achievementResult = await executeQuery(`
        INSERT INTO achievements (name, description, icon, points_required, badge_color)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
                achievement.name,
                achievement.description,
                achievement.icon,
                achievement.pointsRequired,
                achievement.badgeColor
            ])

            const achievementId = achievementResult.rows[0].id

            // Insert achievement conditions
            for (const condition of achievement.conditions) {
                await executeQuery(`
          INSERT INTO achievement_conditions (achievement_id, condition_type, threshold)
          VALUES ($1, $2, $3)
        `, [achievementId, condition.type, condition.threshold])
            }

            console.log(`✓ Created achievement: "${achievement.name}"`)
        } catch (error) {
            console.error(`✗ Failed to create achievement "${achievement.name}":`, error)
        }
    }

    console.log('Achievement seeding completed!')
}