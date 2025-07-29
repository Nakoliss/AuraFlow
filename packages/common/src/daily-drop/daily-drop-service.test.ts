import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DailyDropService } from './daily-drop-service'
import { AIService } from '../ai/ai-service'
import { executeQuery, executeTransaction } from '../database'
import { DailyDrop, DailyChallenge } from '../types'

// Mock dependencies
vi.mock('../database')
vi.mock('../ai/ai-service')
vi.mock('../errors', () => ({
    AppError: class AppError extends Error {
        constructor(public type: string, message: string, public code: string, public details?: any) {
            super(message)
        }
    },
    ErrorType: {
        INTERNAL: 'internal_error',
        EXTERNAL_API: 'external_api_error'
    }
}))
vi.mock('../logging', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        logDatabaseOperation: vi.fn()
    },
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        logDatabaseOperation: vi.fn()
    }))
}))

const mockExecuteQuery = vi.mocked(executeQuery)
const mockExecuteTransaction = vi.mocked(executeTransaction)

describe('DailyDropService', () => {
    let dailyDropService: DailyDropService
    let mockAIService: AIService

    beforeEach(() => {
        vi.clearAllMocks()

        mockAIService = {
            generateMessage: vi.fn(),
            testConnections: vi.fn(),
            getHealthStatus: vi.fn(),
            setPreferredProvider: vi.fn(),
            setFallbackEnabled: vi.fn()
        } as any

        dailyDropService = new DailyDropService(mockAIService)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('getDailyDrop', () => {
        it('should return existing daily drop', async () => {
            const mockDailyDrop: DailyDrop = {
                id: 'test-id',
                date: '2024-01-15',
                content: 'Test daily drop content',
                locale: 'en-US',
                createdAt: new Date()
            }

            mockExecuteQuery.mockResolvedValue({
                rows: [mockDailyDrop],
                rowCount: 1,
                command: 'SELECT'
            })

            const result = await dailyDropService.getDailyDrop('2024-01-15', 'en-US')

            expect(result).toEqual(mockDailyDrop)
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                'SELECT * FROM daily_drops WHERE date = $1 AND locale = $2',
                ['2024-01-15', 'en-US']
            )
        })

        it('should return null when no daily drop exists', async () => {
            mockExecuteQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'SELECT'
            })

            const result = await dailyDropService.getDailyDrop('2024-01-15', 'en-US')

            expect(result).toBeNull()
        })

        it('should handle database errors', async () => {
            mockExecuteQuery.mockRejectedValue(new Error('Database error'))

            await expect(
                dailyDropService.getDailyDrop('2024-01-15', 'en-US')
            ).rejects.toThrow('Failed to fetch daily drop')
        })
    })

    describe('getDailyChallenge', () => {
        it('should return existing daily challenge', async () => {
            const mockChallenge: DailyChallenge = {
                id: 'challenge-id',
                date: '2024-01-15',
                task: 'Write down three things you are grateful for',
                points: 5,
                locale: 'en-US',
                createdAt: new Date()
            }

            mockExecuteQuery.mockResolvedValue({
                rows: [mockChallenge],
                rowCount: 1,
                command: 'SELECT'
            })

            const result = await dailyDropService.getDailyChallenge('2024-01-15', 'en-US')

            expect(result).toEqual(mockChallenge)
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                'SELECT * FROM daily_challenges WHERE date = $1 AND locale = $2',
                ['2024-01-15', 'en-US']
            )
        })

        it('should return null when no challenge exists', async () => {
            mockExecuteQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'SELECT'
            })

            const result = await dailyDropService.getDailyChallenge('2024-01-15', 'en-US')

            expect(result).toBeNull()
        })
    })

    describe('generateDailyDrop', () => {
        it('should return existing daily drop if already exists', async () => {
            const existingDrop: DailyDrop = {
                id: 'existing-id',
                date: '2024-01-15',
                content: 'Existing content',
                locale: 'en-US',
                createdAt: new Date()
            }

            // Mock getDailyDrop to return existing drop
            mockExecuteQuery.mockResolvedValueOnce({
                rows: [existingDrop],
                rowCount: 1,
                command: 'SELECT'
            })

            const result = await dailyDropService.generateDailyDrop('2024-01-15')

            expect(result.dailyDrop).toEqual(existingDrop)
            expect(result.wasGenerated).toBe(false)
            expect(result.usedFallback).toBe(false)
        })

        it('should generate new daily drop when none exists', async () => {
            const newDrop: DailyDrop = {
                id: 'new-id',
                date: '2024-01-15',
                content: 'Generated content',
                locale: 'en-US',
                createdAt: new Date()
            }

            // Mock getDailyDrop to return null (no existing drop)
            mockExecuteQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT'
            })

            // Mock AI service response
            vi.mocked(mockAIService.generateMessage).mockResolvedValue({
                content: 'Generated content',
                tokens: 25,
                model: 'gpt-3.5-turbo',
                finishReason: 'stop'
            })

            // Mock duplication check (no duplicates)
            mockExecuteQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT'
            })

            // Mock transaction for storing daily drop
            mockExecuteTransaction.mockResolvedValueOnce(newDrop)

            // Mock daily challenge generation
            mockExecuteQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT' }) // No existing challenge
                .mockResolvedValueOnce({ // Store challenge
                    rows: [{
                        id: 'challenge-id',
                        date: '2024-01-15',
                        task: 'Generated challenge',
                        points: 5,
                        locale: 'en-US',
                        createdAt: new Date()
                    }],
                    rowCount: 1,
                    command: 'INSERT'
                })

            vi.mocked(mockAIService.generateMessage).mockResolvedValueOnce({
                content: 'Generated challenge',
                tokens: 15,
                model: 'gpt-3.5-turbo',
                finishReason: 'stop'
            })

            const result = await dailyDropService.generateDailyDrop('2024-01-15')

            expect(result.dailyDrop).toEqual(newDrop)
            expect(result.wasGenerated).toBe(true)
            expect(result.usedFallback).toBe(false)
            expect(result.dailyChallenge).toBeDefined()
        })

        it('should use fallback content when AI generation fails', async () => {
            const fallbackDrop: DailyDrop = {
                id: 'fallback-id',
                date: '2024-01-15',
                content: 'Today is a new beginning. Every moment offers a fresh start and endless possibilities.',
                locale: 'en-US',
                createdAt: new Date()
            }

            // Mock getDailyDrop to return null (no existing drop)
            mockExecuteQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT'
            })

            // Mock AI service to fail immediately
            vi.mocked(mockAIService.generateMessage).mockRejectedValueOnce(new Error('AI service failed'))

            // Mock transaction for storing fallback daily drop
            mockExecuteTransaction.mockResolvedValueOnce(fallbackDrop)

            // Mock daily challenge generation (also fallback)
            mockExecuteQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT' }) // No existing challenge
                .mockResolvedValueOnce({ // Store fallback challenge
                    rows: [{
                        id: 'challenge-id',
                        date: '2024-01-15',
                        task: 'Write down three things you\'re grateful for today and why they matter to you.',
                        points: 5,
                        locale: 'en-US',
                        createdAt: new Date()
                    }],
                    rowCount: 1,
                    command: 'INSERT'
                })

            const result = await dailyDropService.generateDailyDrop('2024-01-15', { maxRetries: 1 })

            expect(result.dailyDrop).toEqual(fallbackDrop)
            expect(result.wasGenerated).toBe(true)
            expect(result.usedFallback).toBe(true)
        }, 10000)

        it('should handle generation errors gracefully', async () => {
            // Mock getDailyDrop to return null
            mockExecuteQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT'
            })

            // Mock AI service to fail
            vi.mocked(mockAIService.generateMessage).mockRejectedValueOnce(new Error('AI service failed'))

            // Mock transaction to fail
            mockExecuteTransaction.mockRejectedValueOnce(new Error('Database error'))

            await expect(
                dailyDropService.generateDailyDrop('2024-01-15', { maxRetries: 1 })
            ).rejects.toThrow('Failed to generate daily drop for 2024-01-15')
        }, 10000)
    })

    describe('getHistoricalDailyDrops', () => {
        it('should return historical daily drops', async () => {
            const mockDrops = [
                {
                    id: 'drop1',
                    date: '2024-01-15',
                    content: 'Historical drop 1',
                    locale: 'en-US',
                    createdAt: new Date('2024-01-15')
                },
                {
                    id: 'drop2',
                    date: '2024-01-14',
                    content: 'Historical drop 2',
                    locale: 'en-US',
                    createdAt: new Date('2024-01-14')
                }
            ]

            // Mock the drops query
            mockExecuteQuery.mockResolvedValueOnce({
                rows: mockDrops,
                rowCount: 2,
                command: 'SELECT'
            })

            // Mock the count query
            mockExecuteQuery.mockResolvedValueOnce({
                rows: [{ count: 5 }],
                rowCount: 1,
                command: 'SELECT'
            })

            const result = await dailyDropService.getHistoricalDailyDrops(
                '2024-01-10',
                '2024-01-20',
                'en-US',
                10
            )

            expect(result.dailyDrops).toEqual(mockDrops)
            expect(result.totalCount).toBe(5)
            expect(mockExecuteQuery).toHaveBeenCalledTimes(2)
        })

        it('should handle database errors', async () => {
            mockExecuteQuery.mockRejectedValue(new Error('Database error'))

            await expect(
                dailyDropService.getHistoricalDailyDrops('2024-01-10', '2024-01-20')
            ).rejects.toThrow('Failed to retrieve historical daily drops')
        })
    })

    describe('cleanupOldDailyDrops', () => {
        it('should delete old daily drops successfully', async () => {
            mockExecuteQuery.mockResolvedValue({
                rows: [],
                rowCount: 15,
                command: 'DELETE'
            })

            const result = await dailyDropService.cleanupOldDailyDrops()

            expect(result).toBe(15)
            expect(mockExecuteQuery).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM daily_drops'),
                []
            )
        })

        it('should handle cleanup errors', async () => {
            mockExecuteQuery.mockRejectedValue(new Error('Database error'))

            await expect(
                dailyDropService.cleanupOldDailyDrops()
            ).rejects.toThrow('Failed to cleanup old daily drops')
        })
    })
})