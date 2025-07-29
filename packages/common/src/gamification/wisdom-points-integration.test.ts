import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { wisdomPointsService } from './wisdom-points-service'
import { initializeDatabase, closeDatabase, executeQuery } from '../database'
import { WisdomPointAction } from '../types'

describe('Wisdom Points Integration Tests', () => {
    beforeEach(async () => {
        // Initialize database with test configuration
        await initializeDatabase({
            host: 'localhost',
            port: 5432,
            database: 'aura_flow_test',
            username: 'test',
            password: 'test'
        })

        // Create test user
        await executeQuery(`
      INSERT INTO users (id, email, password_hash, wisdom_points, streak_count)
      VALUES ('test-user-123', 'test@example.com', 'hashed_password', 10, 5)
      ON CONFLICT (id) DO UPDATE SET
        wisdom_points = 10,
        streak_count = 5
    `)
    })

    afterEach(async () => {
        // Clean up test data
        await executeQuery('DELETE FROM wisdom_point_transactions WHERE user_id = $1', ['test-user-123'])
        await executeQuery('DELETE FROM users WHERE id = $1', ['test-user-123'])
        await closeDatabase()
    })

    it('should award points and create transaction record', async () => {
        const userId = 'test-user-123'
        const action: WisdomPointAction = 'daily_challenge_complete'

        // Award points
        const newTotal = await wisdomPointsService.awardPoints(userId, action)

        // Should be 10 (initial) + 5 (base) + 2 (streak bonus for 5 days) = 17
        expect(newTotal).toBe(17)

        // Verify balance
        const balance = await wisdomPointsService.getPointsBalance(userId)
        expect(balance).toBe(17)

        // Verify transaction history
        const history = await wisdomPointsService.getPointsHistory(userId, 10)
        expect(history).toHaveLength(1)
        expect(history[0].action).toBe(action)
        expect(history[0].points).toBe(7) // 5 base + 2 streak bonus
        expect(history[0].userId).toBe(userId)
    })

    it('should handle multiple point awards correctly', async () => {
        const userId = 'test-user-123'

        // Award points for app open (no streak bonus)
        await wisdomPointsService.awardPoints(userId, 'app_open')

        // Award points for content share (with streak bonus)
        await wisdomPointsService.awardPoints(userId, 'content_share')

        // Final balance should be: 10 + 1 (app_open) + 3 (content_share) + 2 (streak bonus) = 16
        const balance = await wisdomPointsService.getPointsBalance(userId)
        expect(balance).toBe(16)

        // Verify transaction history
        const history = await wisdomPointsService.getPointsHistory(userId)
        expect(history).toHaveLength(2)

        // Most recent first
        expect(history[0].action).toBe('content_share')
        expect(history[0].points).toBe(5) // 3 base + 2 streak bonus

        expect(history[1].action).toBe('app_open')
        expect(history[1].points).toBe(1) // 1 base, no streak bonus
    })

    it('should calculate streak bonuses correctly', async () => {
        const service = wisdomPointsService

        expect(service.calculateStreakBonus(0)).toBe(0)
        expect(service.calculateStreakBonus(2)).toBe(0)
        expect(service.calculateStreakBonus(3)).toBe(1)
        expect(service.calculateStreakBonus(7)).toBe(2)
        expect(service.calculateStreakBonus(14)).toBe(3)
        expect(service.calculateStreakBonus(30)).toBe(5)
        expect(service.calculateStreakBonus(100)).toBe(5)
    })

    it('should use custom description when provided', async () => {
        const userId = 'test-user-123'
        const customDescription = 'Unlocked "First Steps" achievement'

        await wisdomPointsService.awardPoints(userId, 'achievement_unlock', customDescription)

        const history = await wisdomPointsService.getPointsHistory(userId, 1)
        expect(history[0].description).toBe(customDescription)
    })
})