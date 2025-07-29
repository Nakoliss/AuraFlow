import {
    PaymentService,
    EntitlementValidator,
    EntitlementType,
    MessageCategory,
    logger,
    AppError,
    ErrorCode
} from '@aura-flow/common'

export interface EntitlementMiddlewareConfig {
    paymentService: PaymentService
    entitlementValidator: EntitlementValidator
}

/**
 * Middleware to check if user has required entitlement
 */
export function createEntitlementMiddleware(
    config: EntitlementMiddlewareConfig,
    requiredEntitlement: EntitlementType
) {
    return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
        try {
            const userId = request.headers.get('x-user-id')
            if (!userId) {
                throw new AppError('User ID not found', ErrorCode.AUTHENTICATION_ERROR)
            }

            const hasEntitlement = await config.paymentService.hasEntitlement(userId, requiredEntitlement)

            if (!hasEntitlement) {
                logger.warn('Entitlement check failed', {
                    userId,
                    requiredEntitlement
                })

                return new Response(JSON.stringify({
                    error: `${requiredEntitlement} subscription required`,
                    code: ErrorCode.ENTITLEMENT_ERROR,
                    requiredEntitlement
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            logger.debug('Entitlement check passed', {
                userId,
                requiredEntitlement
            })

            return await next()
        } catch (error) {
            logger.error('Entitlement middleware error', { error })

            if (error instanceof AppError) {
                return new Response(JSON.stringify({
                    error: error.message,
                    code: error.code
                }), {
                    status: error.statusCode,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                error: 'Internal server error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }
    }
}

/**
 * Middleware to check category access
 */
export function createCategoryAccessMiddleware(
    config: EntitlementMiddlewareConfig
) {
    return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
        try {
            const userId = request.headers.get('x-user-id')
            if (!userId) {
                throw new AppError('User ID not found', ErrorCode.AUTHENTICATION_ERROR)
            }

            // Extract category from request (could be in body, query params, or path)
            let category: MessageCategory | undefined

            // Try to get category from request body
            try {
                const body = await request.clone().json()
                category = body.category
            } catch {
                // If body parsing fails, try query params
                const url = new URL(request.url)
                category = url.searchParams.get('category') as MessageCategory
            }

            if (!category) {
                throw new AppError('Category not specified', ErrorCode.VALIDATION_ERROR)
            }

            // Create a mock user object for validation
            const mockUser = {
                id: userId,
                email: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                subscriptionStatus: 'free' as const,
                wisdomPoints: 0,
                streakCount: 0,
                preferredCategories: [],
                timezone: 'UTC'
            }

            const hasAccess = await config.entitlementValidator.checkCategoryAccess(mockUser, category)

            if (!hasAccess) {
                logger.warn('Category access denied', {
                    userId,
                    category
                })

                return new Response(JSON.stringify({
                    error: `Access to ${category} category requires premium subscription`,
                    code: ErrorCode.ENTITLEMENT_ERROR,
                    category,
                    requiredEntitlement: 'premium_core'
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            logger.debug('Category access granted', {
                userId,
                category
            })

            return await next()
        } catch (error) {
            logger.error('Category access middleware error', { error })

            if (error instanceof AppError) {
                return new Response(JSON.stringify({
                    error: error.message,
                    code: error.code
                }), {
                    status: error.statusCode,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                error: 'Internal server error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }
    }
}

/**
 * Middleware to check voice access
 */
export function createVoiceAccessMiddleware(
    config: EntitlementMiddlewareConfig
) {
    return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
        try {
            const userId = request.headers.get('x-user-id')
            if (!userId) {
                throw new AppError('User ID not found', ErrorCode.AUTHENTICATION_ERROR)
            }

            // Create a mock user object for validation
            const mockUser = {
                id: userId,
                email: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                subscriptionStatus: 'free' as const,
                wisdomPoints: 0,
                streakCount: 0,
                preferredCategories: [],
                timezone: 'UTC'
            }

            const hasVoiceAccess = await config.entitlementValidator.checkVoiceAccess(mockUser)

            if (!hasVoiceAccess) {
                logger.warn('Voice access denied', { userId })

                return new Response(JSON.stringify({
                    error: 'Voice Pack subscription required for audio features',
                    code: ErrorCode.ENTITLEMENT_ERROR,
                    requiredEntitlement: 'voice_pack'
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            logger.debug('Voice access granted', { userId })

            return await next()
        } catch (error) {
            logger.error('Voice access middleware error', { error })

            if (error instanceof AppError) {
                return new Response(JSON.stringify({
                    error: error.message,
                    code: error.code
                }), {
                    status: error.statusCode,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                error: 'Internal server error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }
    }
}

/**
 * Middleware to check message generation quota
 */
export function createQuotaCheckMiddleware(
    config: EntitlementMiddlewareConfig
) {
    return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
        try {
            const userId = request.headers.get('x-user-id')
            if (!userId) {
                throw new AppError('User ID not found', ErrorCode.AUTHENTICATION_ERROR)
            }

            // Create a mock user object for validation
            const mockUser = {
                id: userId,
                email: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                subscriptionStatus: 'free' as const,
                wisdomPoints: 0,
                streakCount: 0,
                preferredCategories: [],
                timezone: 'UTC',
                lastActivityDate: new Date() // This would come from database in real implementation
            }

            const quotaCheck = await config.entitlementValidator.checkMessageGenerationQuota(mockUser)

            if (!quotaCheck.canGenerate) {
                logger.warn('Message generation quota exceeded', {
                    userId,
                    remainingMessages: quotaCheck.remainingMessages,
                    cooldownEndsAt: quotaCheck.cooldownEndsAt
                })

                return new Response(JSON.stringify({
                    error: 'Message generation quota exceeded',
                    code: ErrorCode.QUOTA_EXCEEDED_ERROR,
                    remainingMessages: quotaCheck.remainingMessages,
                    cooldownEndsAt: quotaCheck.cooldownEndsAt?.toISOString(),
                    upgradeMessage: quotaCheck.remainingMessages === 0 ?
                        'Upgrade to Premium Core for 20 daily messages' : undefined
                }), {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': quotaCheck.cooldownEndsAt ?
                            Math.ceil((quotaCheck.cooldownEndsAt.getTime() - Date.now()) / 1000).toString() :
                            '86400' // 24 hours default
                    }
                })
            }

            logger.debug('Quota check passed', {
                userId,
                remainingMessages: quotaCheck.remainingMessages
            })

            // Add quota info to request headers for downstream handlers
            const modifiedRequest = new Request(request, {
                headers: {
                    ...Object.fromEntries(request.headers.entries()),
                    'x-remaining-messages': quotaCheck.remainingMessages.toString(),
                    'x-cooldown-ends-at': quotaCheck.cooldownEndsAt?.toISOString() || ''
                }
            })

            return await next()
        } catch (error) {
            logger.error('Quota check middleware error', { error })

            if (error instanceof AppError) {
                return new Response(JSON.stringify({
                    error: error.message,
                    code: error.code
                }), {
                    status: error.statusCode,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(JSON.stringify({
                error: 'Internal server error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }
    }
}

/**
 * Utility function to get user entitlements for request context
 */
export async function getUserEntitlements(
    config: EntitlementMiddlewareConfig,
    userId: string
) {
    try {
        const entitlements = await config.paymentService.validateEntitlements(userId)

        const hasPremiumCore = entitlements.some(e =>
            e.type === 'premium_core' && e.isActive && e.expiresAt > new Date()
        )
        const hasVoicePack = entitlements.some(e =>
            e.type === 'voice_pack' && e.isActive && e.expiresAt > new Date()
        )

        return {
            entitlements,
            hasPremiumCore,
            hasVoicePack,
            subscriptionTier: hasVoicePack ? 'voice_pack' :
                hasPremiumCore ? 'premium_core' : 'free'
        }
    } catch (error) {
        logger.error('Failed to get user entitlements', { error, userId })
        return {
            entitlements: [],
            hasPremiumCore: false,
            hasVoicePack: false,
            subscriptionTier: 'free' as const
        }
    }
}