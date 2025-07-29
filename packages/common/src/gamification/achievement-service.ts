import { executeQuery, getClient, DatabaseClient } from '../database'
import { Achievement, UserAchievement } from '../types'
import { AppError, ErrorCode } from '../errors'
import { wisdomPointsService, WisdomPointsService } from './wisdom-points-service'

export interface AchievementCondition {
    type: 'wisdom_points' | 'streak_days' | 'messages_generated' | 'challenges_completed' | 'shares_made'
    threshold: number
}

export interface AchievementDefinition extends Achievement {
    conditions: AchievementCondition[]
}

export interface AchievementService {
    checkAndUnlockAchievements(userId: string): Promise<Achievement[]>
    getUserAchievements(userId: string): Promise<UserAchievement[]>
    getAvailableAchievements(): Promise<Achievement[]>
    createAchievement(achievement: Omit<AchievementDefinition, 'id'>): Promise<Achievement>
}

export class AchievementServiceImpl implements AchievementService {
    constructor(private wisdomPointsService: WisdomPointsService) { }

    async checkAndUnlockAchievements(userId: string): Promise<Achievement[]> {
        const client = await getClient() as DatabaseClient & { release: () => void }
        const unlockedAchievements: Achievement[] = []

        try {
            await client.query('BEGIN')

            // Get user's current stats
            const userStats = await this.getUserStats(userId)

            // Get all achievements user hasn't unlocked yet
            const availableAchievements = await this.getAvailableAchievementsForUser(userId)

            for (const achievement of availableAchievements) {
                const conditions = await this.getAchievementConditions(achievement.id)

                if (this.checkAchievementConditions(userStats, conditions)) {
                    // Unlock the achievement
                    await client.query(`
            INSERT INTO user_achievements (user_id, achievement_id, earned_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id, achievement_id) DO NOTHING
          `, [userId, achievement.id])

                    // Award wisdom points for unlocking achievement
                    await this.wisdomPointsService.awardPoints(
                        userId,
                        'achievement_unlock',
                        `Unlocked "${achievement.name}" achievement`
                    )

                    unlockedAchievements.push(achievement)
                }
            }

            await client.query('COMMIT')

            return unlockedAchievements
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    async getUserAchievements(userId: string): Promise<UserAchievement[]> {
        const result = await executeQuery(`
      SELECT ua.user_id, ua.achievement_id, ua.earned_at,
             a.name, a.description, a.icon, a.badge_color
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1
      ORDER BY ua.earned_at DESC
    `, [userId])

        return result.rows.map(row => ({
            userId: row.user_id,
            achievementId: row.achievement_id,
            earnedAt: row.earned_at
        }))
    }

    async getAvailableAchievements(): Promise<Achievement[]> {
        const result = await executeQuery(`
      SELECT id, name, description, icon, points_required, badge_color
      FROM achievements
      ORDER BY points_required ASC
    `)

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            icon: row.icon,
            pointsRequired: row.points_required,
            badgeColor: row.badge_color
        }))
    }

    async createAchievement(achievement: Omit<AchievementDefinition, 'id'>): Promise<Achievement> {
        const client = await getClient() as DatabaseClient & { release: () => void }

        try {
            await client.query('BEGIN')

            // Insert achievement
            const achievementResult = await client.query(`
        INSERT INTO achievements (name, description, icon, points_required, badge_color)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, icon, points_required, badge_color
      `, [
                achievement.name,
                achievement.description,
                achievement.icon,
                achievement.pointsRequired,
                achievement.badgeColor
            ])

            const newAchievement = achievementResult.rows[0]

            // Insert achievement conditions
            for (const condition of achievement.conditions) {
                await client.query(`
          INSERT INTO achievement_conditions (achievement_id, condition_type, threshold)
          VALUES ($1, $2, $3)
        `, [newAchievement.id, condition.type, condition.threshold])
            }

            await client.query('COMMIT')

            return {
                id: newAchievement.id,
                name: newAchievement.name,
                description: newAchievement.description,
                icon: newAchievement.icon,
                pointsRequired: newAchievement.points_required,
                badgeColor: newAchievement.badge_color
            }
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    private async getUserStats(userId: string): Promise<Record<string, number>> {
        const result = await executeQuery(`
      SELECT 
        u.wisdom_points,
        u.streak_count,
        COUNT(DISTINCT gm.id) as messages_generated,
        COUNT(DISTINCT wpt.id) FILTER (WHERE wpt.action = 'daily_challenge_complete') as challenges_completed,
        COUNT(DISTINCT wpt2.id) FILTER (WHERE wpt2.action = 'content_share') as shares_made
      FROM users u
      LEFT JOIN generated_messages gm ON u.id = gm.user_id
      LEFT JOIN wisdom_point_transactions wpt ON u.id = wpt.user_id
      LEFT JOIN wisdom_point_transactions wpt2 ON u.id = wpt2.user_id
      WHERE u.id = $1
      GROUP BY u.id, u.wisdom_points, u.streak_count
    `, [userId])

        if (result.rows.length === 0) {
            throw new AppError('User not found', ErrorCode.NOT_FOUND_ERROR)
        }

        const row = result.rows[0]
        return {
            wisdom_points: row.wisdom_points,
            streak_days: row.streak_count,
            messages_generated: parseInt(row.messages_generated),
            challenges_completed: parseInt(row.challenges_completed),
            shares_made: parseInt(row.shares_made)
        }
    }

    private async getAvailableAchievementsForUser(userId: string): Promise<Achievement[]> {
        const result = await executeQuery(`
      SELECT a.id, a.name, a.description, a.icon, a.points_required, a.badge_color
      FROM achievements a
      WHERE a.id NOT IN (
        SELECT ua.achievement_id 
        FROM user_achievements ua 
        WHERE ua.user_id = $1
      )
      ORDER BY a.points_required ASC
    `, [userId])

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            icon: row.icon,
            pointsRequired: row.points_required,
            badgeColor: row.badge_color
        }))
    }

    private async getAchievementConditions(achievementId: string): Promise<AchievementCondition[]> {
        const result = await executeQuery(`
      SELECT condition_type, threshold
      FROM achievement_conditions
      WHERE achievement_id = $1
    `, [achievementId])

        return result.rows.map(row => ({
            type: row.condition_type as AchievementCondition['type'],
            threshold: row.threshold
        }))
    }

    private checkAchievementConditions(
        userStats: Record<string, number>,
        conditions: AchievementCondition[]
    ): boolean {
        return conditions.every(condition => {
            const userValue = userStats[condition.type] || 0
            return userValue >= condition.threshold
        })
    }
}

// Singleton instance
export const achievementService = new AchievementServiceImpl(wisdomPointsService)