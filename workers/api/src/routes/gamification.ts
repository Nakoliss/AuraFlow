import { Request, Response } from '@cloudflare/workers-types'
import { wisdomPointsService, achievementService } from '@aura-flow/common'
import { WisdomPointAction, AppError, ErrorCode, validateRequest } from '@aura-flow/common'
import { z } from 'zod'

// Validation schemas
const awardPointsSchema = z.object({
    action: z.enum(['app_open', 'daily_challenge_complete', 'content_share', 'daily_streak', 'achievement_unlock', 'referral_success']),
    description: z.string().optional()
})

const pointsHistorySchema = z.object({
    limit: z.number().min(1).max(100).optional().default(50)
})

/**
 * Award wisdom points to a user for a specific action
 * POST /api/gamification/points/award
 */
export async function awardWisdomPoints(request: Request): Promise<Response> {
    try {
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID required', ErrorCode.AUTHENTICATION_ERROR)
        }

        const body = await request.json()
        const { action, description } = validateRequest(awardPointsSchema, body)

        const newTotal = await wisdomPointsService.awardPoints(
            userId,
            action as WisdomPointAction,
            description
        )

        return new Response(JSON.stringify({
            success: true,
            data: {
                action,
                pointsAwarded: wisdomPointsService['pointsConfig'][action as WisdomPointAction],
                newTotal,
                description: description || wisdomPointsService['getDefaultDescription'](action as WisdomPointAction, wisdomPointsService['pointsConfig'][action as WisdomPointAction])
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                error: {
                    type: error.code,
                    message: error.message
                }
            }), {
                status: error.code === ErrorCode.NOT_FOUND_ERROR ? 404 : 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            error: {
                type: 'internal_error',
                message: 'Internal server error'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * Get user's current wisdom points balance
 * GET /api/gamification/points/balance
 */
export async function getWisdomPointsBalance(request: Request): Promise<Response> {
    try {
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID required', ErrorCode.AUTHENTICATION_ERROR)
        }

        const balance = await wisdomPointsService.getPointsBalance(userId)

        return new Response(JSON.stringify({
            success: true,
            data: {
                userId,
                balance
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                error: {
                    type: error.code,
                    message: error.message
                }
            }), {
                status: error.code === ErrorCode.NOT_FOUND_ERROR ? 404 : 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            error: {
                type: 'internal_error',
                message: 'Internal server error'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * Get user's wisdom points transaction history
 * GET /api/gamification/points/history?limit=50
 */
export async function getWisdomPointsHistory(request: Request): Promise<Response> {
    try {
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID required', ErrorCode.AUTHENTICATION_ERROR)
        }

        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '50')

        const { limit: validatedLimit } = validateRequest(pointsHistorySchema, { limit })

        const history = await wisdomPointsService.getPointsHistory(userId, validatedLimit)

        return new Response(JSON.stringify({
            success: true,
            data: {
                userId,
                transactions: history,
                count: history.length
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                error: {
                    type: error.code,
                    message: error.message
                }
            }), {
                status: error.code === ErrorCode.NOT_FOUND_ERROR ? 404 : 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            error: {
                type: 'internal_error',
                message: 'Internal server error'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * Check and unlock achievements for a user
 * POST /api/gamification/achievements/check
 */
export async function checkAchievements(request: Request): Promise<Response> {
    try {
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID required', ErrorCode.AUTHENTICATION_ERROR)
        }

        const unlockedAchievements = await achievementService.checkAndUnlockAchievements(userId)

        return new Response(JSON.stringify({
            success: true,
            data: {
                userId,
                unlockedAchievements,
                count: unlockedAchievements.length
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                error: {
                    type: error.code,
                    message: error.message
                }
            }), {
                status: error.code === ErrorCode.NOT_FOUND_ERROR ? 404 : 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            error: {
                type: 'internal_error',
                message: 'Internal server error'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * Get user's earned achievements
 * GET /api/gamification/achievements/user
 */
export async function getUserAchievements(request: Request): Promise<Response> {
    try {
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID required', ErrorCode.AUTHENTICATION_ERROR)
        }

        const achievements = await achievementService.getUserAchievements(userId)

        return new Response(JSON.stringify({
            success: true,
            data: {
                userId,
                achievements,
                count: achievements.length
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                error: {
                    type: error.code,
                    message: error.message
                }
            }), {
                status: error.code === ErrorCode.NOT_FOUND_ERROR ? 404 : 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            error: {
                type: 'internal_error',
                message: 'Internal server error'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * Get all available achievements
 * GET /api/gamification/achievements/available
 */
export async function getAvailableAchievements(request: Request): Promise<Response> {
    try {
        const achievements = await achievementService.getAvailableAchievements()

        return new Response(JSON.stringify({
            success: true,
            data: {
                achievements,
                count: achievements.length
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({
            error: {
                type: 'internal_error',
                message: 'Internal server error'
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}