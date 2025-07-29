import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AchievementServiceImpl, AchievementCondition } from './achievement-service'
import { WisdomPointsService } from './wisdom-points-service'
import { Achievement } from '../types'
import * as database from '../database'
import { AppError, ErrorCode } from '../errors'

// Mock the database module
vi.mock('../database', () => ({
    executeQuery: vi.fn(),
    getClient: vi.fn()
}))

const mockExecuteQuery = vi.mocked(database.executeQuery)
const mockGetClient = vi.mocked(database.getClient)

describe('AchievementService', () => {
    let service: AchievementServiceImpl
    let mockWisdomPointsService: WisdomPointsService
    let mockClient: any

    beforeEach(() => {
        mockWisdomPointsService = {
            awardPoints: vi.fn(),
            getPointsBalance: vi.fn(),
            getPointsHistory: vi.fn(),
            calculateStreakBonus: vi.fn()
        }

        service = new AchievementServiceImpl(mockWisdomPointsService)

        mockClient = {
            query: vi.fn(),
            release: vi.fn()
        }
        mockGetClient.mockResolvedValue(mockClient)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('checkAndUnlockAchievements', () => {
        it('should unlock achievements when conditions are met', async () => {
            const userId = 'user-123'
            const mockAchievement: Achievement = {
                id: 'achievement-1',
                name: 'First Steps',
                description: 'Open the app for the first time',
                icon: 'star',
                pointsRequired: 1,
                badgeColor: 'gold'
            }

            // Mock user stats query
            mockExecuteQuery
                .mockResolvedValueOnce({
                    rows: [{
                        wisdom_points: 10,
                        streak_count: 1,
                        messages_generated: '5',
                        challenges_completed: '2',
                        shares_made: '1'
                    }],
                    rowCount: 1,
                    command: 'SELECT'
                })
                // Mock available achievements query
                .mockResolvedValueOnce({
                    rows: [{
                        id: mockAchievement.id,
                        name: mockAchievement.name,
                        description: mockAchievement.description,
                        icon: mockAchievement.icon,
                        points_required: mockAchievement.pointsRequired,
                        badge_color: mockAchievement.badgeColor
                    }],
                    rowCount: 1,
                    command: 'SELECT'
                })
                // Mock achievement conditions query
                .mockResolvedValueOnce({
                    rows: [{ condition_type: 'wisdom_points', threshold: 5 }],
                    rowCount: 1,
                    command: 'SELECT'
                })

            // Mock transaction queries
            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }) // INSERT user_achievement
                .mockResolvedValueOnce({ rows: [] }) // COMMIT

            // Mock wisdom points service
            vi.mocked(mockWisdomPointsService.awardPoints).mockResolvedValueOnce(20)

            const result = await service.checkAndUnlockAchievements(userId)

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(mockAchievement.id)
            expect(result[0].name).toBe(mockAchievement.name)
            expect(result[0].description).toBe(mockAchievement.description)
            expect(result[0].icon).toBe(mockAchievement.icon)
            expect(result[0].pointsRequired).toBe(mockAchievement.pointsRequired)
            expect(result[0].badgeColor).toBe(mockAchievement.badgeColor)
            expect(mockWisdomPointsService.awardPoints).toHaveBeenCalledWith(
                userId,
                'achievement_unlock',
                'Unlocked "First Steps" achievement'
            )
        })

        it('should not unlock achievements when conditions are not met', async () => {
            const userId = 'user-123'
            const mockAchievement: Achievement = {
                id: 'achievement-1',
                name: 'High Achiever',
                description: 'Earn 100 wisdom points',
                icon: 'trophy',
                pointsRequired: 100,
                badgeColor: 'gold'
            }

            // Mock user stats query (user has only 10 points)
            mockExecuteQuery
                .mockResolvedValueOnce({
                    rows: [{
                        wisdom_points: 10,
                        streak_count: 1,
                        messages_generated: '5',
                        challenges_completed: '2',
                        shares_made: '1'
                    }],
                    rowCount: 1,
                    command: 'SELECT'
                })
                // Mock available achievements query
                .mockResolvedValueOnce({
                    rows: [{
                        id: mockAchievement.id,
                        name: mockAchievement.name,
                        description: mockAchievement.description,
                        icon: mockAchievement.icon,
                        points_required: mockAchievement.pointsRequired,
                        badge_color: mockAchievement.badgeColor
                    }],
                    rowCount: 1,
                    command: 'SELECT'
                })
                // Mock achievement conditions query (requires 100 points)
                .mockResolvedValueOnce({
                    rows: [{ condition_type: 'wisdom_points', threshold: 100 }],
                    rowCount: 1,
                    command: 'SELECT'
                })

            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }) // COMMIT

            const result = await service.checkAndUnlockAchievements(userId)

            expect(result).toHaveLength(0)
            expect(mockWisdomPointsService.awardPoints).not.toHaveBeenCalled()
        })

        it('should handle multiple conditions for achievement', async () => {
            const userId = 'user-123'
            const mockAchievement: Achievement = {
                id: 'achievement-1',
                name: 'Dedicated User',
                description: 'Earn 50 points and maintain 7-day streak',
                icon: 'fire',
                pointsRequired: 50,
                badgeColor: 'gold'
            }

            // Mock user stats query
            mockExecuteQuery
                .mockResolvedValueOnce({
                    rows: [{
                        wisdom_points: 60,
                        streak_count: 8,
                        messages_generated: '10',
                        challenges_completed: '5',
                        shares_made: '3'
                    }],
                    rowCount: 1,
                    command: 'SELECT'
                })
                // Mock available achievements query
                .mockResolvedValueOnce({
                    rows: [{
                        id: mockAchievement.id,
                        name: mockAchievement.name,
                        description: mockAchievement.description,
                        icon: mockAchievement.icon,
                        points_required: mockAchievement.pointsRequired,
                        badge_color: mockAchievement.badgeColor
                    }],
                    rowCount: 1,
                    command: 'SELECT'
                })
                // Mock achievement conditions query (multiple conditions)
                .mockResolvedValueOnce({
                    rows: [
                        { condition_type: 'wisdom_points', threshold: 50 },
                        { condition_type: 'streak_days', threshold: 7 }
                    ],
                    rowCount: 2,
                    command: 'SELECT'
                })

            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [] }) // INSERT user_achievement
                .mockResolvedValueOnce({ rows: [] }) // COMMIT

            vi.mocked(mockWisdomPointsService.awardPoints).mockResolvedValueOnce(70)

            const result = await service.checkAndUnlockAchievements(userId)

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(mockAchievement.id)
            expect(result[0].name).toBe(mockAchievement.name)
            expect(result[0].pointsRequired).toBe(mockAchievement.pointsRequired)
            expect(result[0].badgeColor).toBe(mockAchievement.badgeColor)
        })

        it('should rollback transaction on error', async () => {
            const userId = 'user-123'

            mockExecuteQuery.mockRejectedValueOnce(new Error('Database error'))

            await expect(service.checkAndUnlockAchievements(userId)).rejects.toThrow('Database error')

            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
            expect(mockClient.release).toHaveBeenCalled()
        })
    })

    describe('getUserAchievements', () => {
        it('should return user achievements with details', async () => {
            const userId = 'user-123'
            const mockAchievements = [
                {
                    user_id: userId,
                    achievement_id: 'achievement-1',
                    earned_at: new Date('2024-01-01'),
                    name: 'First Steps',
                    description: 'Open the app for the first time',
                    icon: 'star',
                    badge_color: 'gold'
                },
                {
                    user_id: userId,
                    achievement_id: 'achievement-2',
                    earned_at: new Date('2024-01-02'),
                    name: 'Challenger',
                    description: 'Complete your first daily challenge',
                    icon: 'target',
                    badge_color: 'silver'
                }
            ]

            mockExecuteQuery.mockResolvedValueOnce({
                rows: mockAchievements,
                rowCount: mockAchievements.length,
                command: 'SELECT'
            })

            const result = await service.getUserAchievements(userId)

            expect(result).toHaveLength(2)
            expect(result[0]).toEqual({
                userId,
                achievementId: 'achievement-1',
                earnedAt: new Date('2024-01-01')
            })
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expect.stringContaining('FROM user_achievements ua'),
                [userId]
            )
        })
    })

    describe('getAvailableAchievements', () => {
        it('should return all available achievements', async () => {
            const mockAchievements = [
                {
                    id: 'achievement-1',
                    name: 'First Steps',
                    description: 'Open the app for the first time',
                    icon: 'star',
                    points_required: 1,
                    badge_color: 'gold'
                },
                {
                    id: 'achievement-2',
                    name: 'High Achiever',
                    description: 'Earn 100 wisdom points',
                    icon: 'trophy',
                    points_required: 100,
                    badge_color: 'gold'
                }
            ]

            mockExecuteQuery.mockResolvedValueOnce({
                rows: mockAchievements,
                rowCount: mockAchievements.length,
                command: 'SELECT'
            })

            const result = await service.getAvailableAchievements()

            expect(result).toHaveLength(2)
            expect(result[0]).toEqual({
                id: 'achievement-1',
                name: 'First Steps',
                description: 'Open the app for the first time',
                icon: 'star',
                pointsRequired: 1,
                badgeColor: 'gold'
            })
        })
    })

    describe('createAchievement', () => {
        it('should create achievement with conditions', async () => {
            const achievementData = {
                name: 'Test Achievement',
                description: 'Test description',
                icon: 'test-icon',
                pointsRequired: 50,
                badgeColor: 'gold',
                conditions: [
                    { type: 'wisdom_points' as const, threshold: 50 },
                    { type: 'streak_days' as const, threshold: 5 }
                ]
            }

            const mockCreatedAchievement = {
                id: 'new-achievement-id',
                name: achievementData.name,
                description: achievementData.description,
                icon: achievementData.icon,
                points_required: achievementData.pointsRequired,
                badge_color: achievementData.badgeColor
            }

            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [mockCreatedAchievement] }) // INSERT achievement
                .mockResolvedValueOnce({ rows: [] }) // INSERT condition 1
                .mockResolvedValueOnce({ rows: [] }) // INSERT condition 2
                .mockResolvedValueOnce({ rows: [] }) // COMMIT

            const result = await service.createAchievement(achievementData)

            expect(result).toEqual({
                id: 'new-achievement-id',
                name: achievementData.name,
                description: achievementData.description,
                icon: achievementData.icon,
                pointsRequired: achievementData.pointsRequired,
                badgeColor: achievementData.badgeColor
            })

            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO achievements'),
                [
                    achievementData.name,
                    achievementData.description,
                    achievementData.icon,
                    achievementData.pointsRequired,
                    achievementData.badgeColor
                ]
            )

            // Verify conditions were inserted
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO achievement_conditions'),
                ['new-achievement-id', 'wisdom_points', 50]
            )
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO achievement_conditions'),
                ['new-achievement-id', 'streak_days', 5]
            )
        })
    })
})