import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { awardWisdomPoints, getWisdomPointsBalance, getWisdomPointsHistory } from './gamification'
import * as wisdomPointsService from '@aura-flow/common'
import { AppError, ErrorCode } from '@aura-flow/common'

// Mock the wisdom points service
vi.mock('@aura-flow/common', () => ({
    wisdomPointsService: {
        awardPoints: vi.fn(),
        getPointsBalance: vi.fn(),
        getPointsHistory: vi.fn(),
        pointsConfig: {
            app_open: 1,
            daily_challenge_complete: 5,
            content_share: 3,
            daily_streak: 2,
            achievement_unlock: 10,
            referral_success: 15
        },
        getDefaultDescription: vi.fn()
    }
}))

const mockWisdomPointsService = vi.mocked(wisdomPointsService.wisdomPointsService)

describe('Gamification API Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('awardWisdomPoints', () => {
        it('should award points for valid action', async () => {
            const userId = 'user-123'
            const action = 'app_open'
            const newTotal = 11

            mockWisdomPointsService.awardPoints.mockResolvedValueOnce(newTotal)
            mockWisdomPointsService.getDefaultDescription.mockReturnValueOnce('Daily app visit (+1 points)')

            const request = new Request('http://localhost/api/gamification/points/award', {
                method: 'POST',
                headers: {
                    'x-user-id': userId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            })

            const response = await awardWisdomPoints(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.action).toBe(action)
            expect(data.data.pointsAwarded).toBe(1)
            expect(data.data.newTotal).toBe(newTotal)
            expect(mockWisdomPointsService.awardPoints).toHaveBeenCalledWith(userId, action, undefined)
        })

        it('should award points with custom description', async () => {
            const userId = 'user-123'
            const action = 'achievement_unlock'
            const description = 'Unlocked "First Steps" achievement'
            const newTotal = 110

            mockWisdomPointsService.awardPoints.mockResolvedValueOnce(newTotal)

            const request = new Request('http://localhost/api/gamification/points/award', {
                method: 'POST',
                headers: {
                    'x-user-id': userId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, description })
            })

            const response = await awardWisdomPoints(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.description).toBe(description)
            expect(mockWisdomPointsService.awardPoints).toHaveBeenCalledWith(userId, action, description)
        })

        it('should return 400 for invalid action', async () => {
            const userId = 'user-123'
            const action = 'invalid_action'

            const request = new Request('http://localhost/api/gamification/points/award', {
                method: 'POST',
                headers: {
                    'x-user-id': userId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            })

            const response = await awardWisdomPoints(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toBeDefined()
        })

        it('should return 401 when user ID is missing', async () => {
            const request = new Request('http://localhost/api/gamification/points/award', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'app_open' })
            })

            const response = await awardWisdomPoints(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.type).toBe(ErrorCode.AUTHENTICATION_ERROR)
        })

        it('should return 404 when user not found', async () => {
            const userId = 'nonexistent-user'
            const action = 'app_open'

            mockWisdomPointsService.awardPoints.mockRejectedValueOnce(
                new AppError('User not found', ErrorCode.NOT_FOUND_ERROR)
            )

            const request = new Request('http://localhost/api/gamification/points/award', {
                method: 'POST',
                headers: {
                    'x-user-id': userId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            })

            const response = await awardWisdomPoints(request)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.type).toBe(ErrorCode.NOT_FOUND_ERROR)
        })

        it('should handle internal server errors', async () => {
            const userId = 'user-123'
            const action = 'app_open'

            mockWisdomPointsService.awardPoints.mockRejectedValueOnce(new Error('Database error'))

            const request = new Request('http://localhost/api/gamification/points/award', {
                method: 'POST',
                headers: {
                    'x-user-id': userId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            })

            const response = await awardWisdomPoints(request)
            const data = await response.json()

            expect(response.status).toBe(500)
            expect(data.error.type).toBe('internal_error')
        })
    })

    describe('getWisdomPointsBalance', () => {
        it('should return user wisdom points balance', async () => {
            const userId = 'user-123'
            const balance = 150

            mockWisdomPointsService.getPointsBalance.mockResolvedValueOnce(balance)

            const request = new Request('http://localhost/api/gamification/points/balance', {
                method: 'GET',
                headers: {
                    'x-user-id': userId
                }
            })

            const response = await getWisdomPointsBalance(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.userId).toBe(userId)
            expect(data.data.balance).toBe(balance)
            expect(mockWisdomPointsService.getPointsBalance).toHaveBeenCalledWith(userId)
        })

        it('should return 401 when user ID is missing', async () => {
            const request = new Request('http://localhost/api/gamification/points/balance', {
                method: 'GET'
            })

            const response = await getWisdomPointsBalance(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.type).toBe(ErrorCode.AUTHENTICATION_ERROR)
        })

        it('should return 404 when user not found', async () => {
            const userId = 'nonexistent-user'

            mockWisdomPointsService.getPointsBalance.mockRejectedValueOnce(
                new AppError('User not found', ErrorCode.NOT_FOUND_ERROR)
            )

            const request = new Request('http://localhost/api/gamification/points/balance', {
                method: 'GET',
                headers: {
                    'x-user-id': userId
                }
            })

            const response = await getWisdomPointsBalance(request)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.type).toBe(ErrorCode.NOT_FOUND_ERROR)
        })
    })

    describe('getWisdomPointsHistory', () => {
        it('should return user wisdom points history', async () => {
            const userId = 'user-123'
            const mockHistory = [
                {
                    id: 'tx-1',
                    userId,
                    action: 'app_open' as const,
                    points: 1,
                    description: 'Daily app visit (+1 points)',
                    createdAt: new Date('2024-01-01')
                },
                {
                    id: 'tx-2',
                    userId,
                    action: 'daily_challenge_complete' as const,
                    points: 7,
                    description: 'Completed daily challenge (+7 points)',
                    createdAt: new Date('2024-01-02')
                }
            ]

            mockWisdomPointsService.getPointsHistory.mockResolvedValueOnce(mockHistory)

            const request = new Request('http://localhost/api/gamification/points/history', {
                method: 'GET',
                headers: {
                    'x-user-id': userId
                }
            })

            const response = await getWisdomPointsHistory(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.data.userId).toBe(userId)
            expect(data.data.transactions).toEqual(mockHistory)
            expect(data.data.count).toBe(2)
            expect(mockWisdomPointsService.getPointsHistory).toHaveBeenCalledWith(userId, 50)
        })

        it('should respect custom limit parameter', async () => {
            const userId = 'user-123'
            const customLimit = 10

            mockWisdomPointsService.getPointsHistory.mockResolvedValueOnce([])

            const request = new Request(`http://localhost/api/gamification/points/history?limit=${customLimit}`, {
                method: 'GET',
                headers: {
                    'x-user-id': userId
                }
            })

            const response = await getWisdomPointsHistory(request)

            expect(response.status).toBe(200)
            expect(mockWisdomPointsService.getPointsHistory).toHaveBeenCalledWith(userId, customLimit)
        })

        it('should return 401 when user ID is missing', async () => {
            const request = new Request('http://localhost/api/gamification/points/history', {
                method: 'GET'
            })

            const response = await getWisdomPointsHistory(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.type).toBe(ErrorCode.AUTHENTICATION_ERROR)
        })

        it('should validate limit parameter', async () => {
            const userId = 'user-123'

            const request = new Request('http://localhost/api/gamification/points/history?limit=200', {
                method: 'GET',
                headers: {
                    'x-user-id': userId
                }
            })

            const response = await getWisdomPointsHistory(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toBeDefined()
        })
    })
})