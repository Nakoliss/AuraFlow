import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WisdomPointsServiceImpl, WisdomPointAction } from './wisdom-points-service'
import * as database from '../database'
import { AppError, ErrorCode } from '../errors'

// Mock the database module
vi.mock('../database', () => ({
    executeQuery: vi.fn(),
    getClient: vi.fn()
}))

const mockExecuteQuery = vi.mocked(database.executeQuery)
const mockGetClient = vi.mocked(database.getClient)

describe('WisdomPointsService', () => {
    let service: WisdomPointsServiceImpl
    let mockClient: any

    beforeEach(() => {
        service = new WisdomPointsServiceImpl()
        mockClient = {
            query: vi.fn(),
            release: vi.fn()
        }
        mockGetClient.mockResolvedValue(mockClient)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('awardPoints', () => {
        it('should award points for app_open action', async () => {
            const userId = 'user-123'
            const action: WisdomPointAction = 'app_open'

            // Mock user query
            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({
                    rows: [{ wisdom_points: 10, streak_count: 0 }]
                }) // SELECT user
                .mockResolvedValueOnce({ rows: [] }) // UPDATE user
                .mockResolvedValueOnce({ rows: [] }) // INSERT transaction
                .mockResolvedValueOnce({ rows: [] }) // COMMIT

            const result = await service.awardPoints(userId, action)

            expect(result).toBe(11) // 10 + 1 for app_open
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
            expect(mockClient.query).toHaveBeenCalledWith(
                'SELECT wisdom_points, streak_count FROM users WHERE id = $1',
                [userId]
            )
            expect(mockClient.query).toHaveBeenCalledWith(
                'UPDATE users SET wisdom_points = $1, updated_at = NOW() WHERE id = $2',
                [11, userId]
            )
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
        })

        it('should award points with streak bonus for daily_challenge_complete', async () => {
            const userId = 'user-123'
            const action: WisdomPointAction = 'daily_challenge_complete'

            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({
                    rows: [{ wisdom_points: 50, streak_count: 10 }]
                }) // SELECT user
                .mockResolvedValueOnce({ rows: [] }) // UPDATE user
                .mockResolvedValueOnce({ rows: [] }) // INSERT transaction
                .mockResolvedValueOnce({ rows: [] }) // COMMIT

            const result = await service.awardPoints(userId, action)

            // Base 5 points + 2 streak bonus (10 days = 2 bonus)
            expect(result).toBe(57) // 50 + 5 + 2
        })

        it('should handle user not found error', async () => {
            const userId = 'nonexistent-user'
            const action: WisdomPointAction = 'app_open'

            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }) // SELECT user (empty)

            await expect(service.awardPoints(userId, action)).rejects.toThrow('User not found')

            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
        })

        it('should rollback transaction on error', async () => {
            const userId = 'user-123'
            const action: WisdomPointAction = 'app_open'

            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({
                    rows: [{ wisdom_points: 10, streak_count: 0 }]
                }) // SELECT user
                .mockRejectedValueOnce(new Error('Database error')) // UPDATE user fails

            await expect(service.awardPoints(userId, action)).rejects.toThrow('Database error')

            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
            expect(mockClient.release).toHaveBeenCalled()
        })

        it('should use custom description when provided', async () => {
            const userId = 'user-123'
            const action: WisdomPointAction = 'achievement_unlock'
            const customDescription = 'Unlocked "First Steps" achievement'

            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({
                    rows: [{ wisdom_points: 100, streak_count: 5 }]
                }) // SELECT user
                .mockResolvedValueOnce({ rows: [] }) // UPDATE user
                .mockResolvedValueOnce({ rows: [] }) // INSERT transaction
                .mockResolvedValueOnce({ rows: [] }) // COMMIT

            await service.awardPoints(userId, action, customDescription)

            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO wisdom_point_transactions'),
                [userId, action, 10, customDescription]
            )
        })
    })

    describe('getPointsBalance', () => {
        it('should return user wisdom points balance', async () => {
            const userId = 'user-123'
            const expectedPoints = 150

            mockExecuteQuery.mockResolvedValueOnce({
                rows: [{ wisdom_points: expectedPoints }]
            })

            const result = await service.getPointsBalance(userId)

            expect(result).toBe(expectedPoints)
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                'SELECT wisdom_points FROM users WHERE id = $1',
                [userId]
            )
        })

        it('should throw error for nonexistent user', async () => {
            const userId = 'nonexistent-user'

            mockExecuteQuery.mockResolvedValueOnce({ rows: [] })

            await expect(service.getPointsBalance(userId)).rejects.toThrow('User not found')
        })
    })

    describe('getPointsHistory', () => {
        it('should return user points transaction history', async () => {
            const userId = 'user-123'
            const mockTransactions = [
                {
                    id: 'tx-1',
                    user_id: userId,
                    action: 'app_open',
                    points: 1,
                    description: 'Daily app visit (+1 points)',
                    created_at: new Date('2024-01-01')
                },
                {
                    id: 'tx-2',
                    user_id: userId,
                    action: 'daily_challenge_complete',
                    points: 7,
                    description: 'Completed daily challenge (+7 points)',
                    created_at: new Date('2024-01-02')
                }
            ]

            mockExecuteQuery.mockResolvedValueOnce({ rows: mockTransactions })

            const result = await service.getPointsHistory(userId)

            expect(result).toHaveLength(2)
            expect(result[0]).toEqual({
                id: 'tx-1',
                userId,
                action: 'app_open',
                points: 1,
                description: 'Daily app visit (+1 points)',
                createdAt: new Date('2024-01-01')
            })
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, user_id, action, points, description, created_at'),
                [userId, 50]
            )
        })

        it('should respect custom limit parameter', async () => {
            const userId = 'user-123'
            const customLimit = 10

            mockExecuteQuery.mockResolvedValueOnce({ rows: [] })

            await service.getPointsHistory(userId, customLimit)

            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT $2'),
                [userId, customLimit]
            )
        })
    })

    describe('calculateStreakBonus', () => {
        it('should return 0 bonus for streaks less than 3 days', () => {
            expect(service.calculateStreakBonus(0)).toBe(0)
            expect(service.calculateStreakBonus(1)).toBe(0)
            expect(service.calculateStreakBonus(2)).toBe(0)
        })

        it('should return 1 bonus for 3-6 day streaks', () => {
            expect(service.calculateStreakBonus(3)).toBe(1)
            expect(service.calculateStreakBonus(5)).toBe(1)
            expect(service.calculateStreakBonus(6)).toBe(1)
        })

        it('should return 2 bonus for 7-13 day streaks', () => {
            expect(service.calculateStreakBonus(7)).toBe(2)
            expect(service.calculateStreakBonus(10)).toBe(2)
            expect(service.calculateStreakBonus(13)).toBe(2)
        })

        it('should return 3 bonus for 14-29 day streaks', () => {
            expect(service.calculateStreakBonus(14)).toBe(3)
            expect(service.calculateStreakBonus(20)).toBe(3)
            expect(service.calculateStreakBonus(29)).toBe(3)
        })

        it('should return 5 bonus for 30+ day streaks', () => {
            expect(service.calculateStreakBonus(30)).toBe(5)
            expect(service.calculateStreakBonus(50)).toBe(5)
            expect(service.calculateStreakBonus(100)).toBe(5)
        })
    })
})