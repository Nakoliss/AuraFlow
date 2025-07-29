import { executeQuery, getClient, DatabaseClient } from '../database'
import { User, WisdomPointAction, WisdomPointTransaction } from '../types'
import { AppError, ErrorCode } from '../errors'

export interface WisdomPointsConfig {
    app_open: number
    daily_challenge_complete: number
    content_share: number
    daily_streak: number
    achievement_unlock: number
    referral_success: number
}

export interface WisdomPointsService {
    awardPoints(userId: string, action: WisdomPointAction, description?: string): Promise<number>
    getPointsBalance(userId: string): Promise<number>
    getPointsHistory(userId: string, limit?: number): Promise<WisdomPointTransaction[]>
    calculateStreakBonus(streakCount: number): number
}

export class WisdomPointsServiceImpl implements WisdomPointsService {
    private readonly pointsConfig: WisdomPointsConfig = {
        app_open: 1,
        daily_challenge_complete: 5,
        content_share: 3,
        daily_streak: 2,
        achievement_unlock: 10,
        referral_success: 15
    }

    async awardPoints(
        userId: string,
        action: WisdomPointAction,
        description?: string
    ): Promise<number> {
        const client = await getClient() as DatabaseClient & { release: () => void }

        try {
            await client.query('BEGIN')

            // Get current user data
            const userResult = await client.query(
                'SELECT wisdom_points, streak_count FROM users WHERE id = $1',
                [userId]
            )

            if (userResult.rows.length === 0) {
                throw new AppError('User not found', ErrorCode.NOT_FOUND_ERROR)
            }

            const currentPoints = userResult.rows[0].wisdom_points
            const streakCount = userResult.rows[0].streak_count

            // Calculate base points for action
            let pointsToAward = this.pointsConfig[action]

            // Apply streak bonus for certain actions
            if (action === 'daily_challenge_complete' || action === 'content_share') {
                const streakBonus = this.calculateStreakBonus(streakCount)
                pointsToAward += streakBonus
            }

            // Update user's wisdom points
            const newTotal = currentPoints + pointsToAward
            await client.query(
                'UPDATE users SET wisdom_points = $1, updated_at = NOW() WHERE id = $2',
                [newTotal, userId]
            )

            // Record the transaction
            const transactionDescription = description || this.getDefaultDescription(action, pointsToAward)
            await client.query(`
        INSERT INTO wisdom_point_transactions (
          id, user_id, action, points, description, created_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [userId, action, pointsToAward, transactionDescription])

            await client.query('COMMIT')

            return newTotal
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    async getPointsBalance(userId: string): Promise<number> {
        const result = await executeQuery(
            'SELECT wisdom_points FROM users WHERE id = $1',
            [userId]
        )

        if (result.rows.length === 0) {
            throw new AppError('User not found', ErrorCode.NOT_FOUND_ERROR)
        }

        return result.rows[0].wisdom_points
    }

    async getPointsHistory(userId: string, limit = 50): Promise<WisdomPointTransaction[]> {
        const result = await executeQuery(`
      SELECT id, user_id, action, points, description, created_at
      FROM wisdom_point_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit])

        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            action: row.action as WisdomPointAction,
            points: row.points,
            description: row.description,
            createdAt: row.created_at
        }))
    }

    calculateStreakBonus(streakCount: number): number {
        if (streakCount < 3) return 0
        if (streakCount < 7) return 1
        if (streakCount < 14) return 2
        if (streakCount < 30) return 3
        return 5 // Max bonus for 30+ day streaks
    }

    private getDefaultDescription(action: WisdomPointAction, points: number): string {
        const descriptions: Record<WisdomPointAction, string> = {
            app_open: `Daily app visit (+${points} points)`,
            daily_challenge_complete: `Completed daily challenge (+${points} points)`,
            content_share: `Shared inspirational content (+${points} points)`,
            daily_streak: `Maintained daily streak (+${points} points)`,
            achievement_unlock: `Unlocked new achievement (+${points} points)`,
            referral_success: `Successful friend referral (+${points} points)`
        }

        return descriptions[action]
    }
}

// Singleton instance
export const wisdomPointsService = new WisdomPointsServiceImpl()