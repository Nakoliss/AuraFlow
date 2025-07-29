import { SubscriptionTier, logger } from '@aura-flow/common'

export interface RateLimitInfo {
    limit: number
    remaining: number
    resetTime: number
    allowed: boolean
}

export interface RateLimitConfig {
    free: {
        limit: number
        windowMs: number
    }
    premium_core: {
        limit: number
        windowMs: number
        cooldownMs: number
    }
    voice_pack: {
        limit: number
        windowMs: number
        cooldownMs: number
    }
}

// Rate limit configuration based on subscription tiers
const RATE_LIMIT_CONFIG: RateLimitConfig = {
    free: {
        limit: 1, // 1 message per 24 hours
        windowMs: 24 * 60 * 60 * 1000 // 24 hours
    },
    premium_core: {
        limit: 20, // 20 messages per day
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        cooldownMs: 30 * 1000 // 30 second cooldown between messages
    },
    voice_pack: {
        limit: 20, // Same as premium core
        windowMs: 24 * 60 * 60 * 1000,
        cooldownMs: 30 * 1000
    }
}

// In-memory rate limit store (in production, use Redis or similar)
const rateLimitStore = new Map<string, {
    count: number
    resetTime: number
    lastRequest?: number
}>()

/**
 * Check if user is within rate limits
 */
export async function checkRateLimit(
    userId: string,
    subscriptionTier: SubscriptionTier
): Promise<RateLimitInfo> {
    const config = RATE_LIMIT_CONFIG[subscriptionTier]
    const now = Date.now()
    const key = `${userId}:${subscriptionTier}`

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)

    // Reset if window has expired
    if (!entry || now >= entry.resetTime) {
        entry = {
            count: 0,
            resetTime: now + config.windowMs
        }
        rateLimitStore.set(key, entry)
    }

    // Check daily limit
    const remaining = Math.max(0, config.limit - entry.count)
    const allowed = entry.count < config.limit

    // Check cooldown for premium users
    let cooldownAllowed = true
    if (subscriptionTier !== 'free' && config.cooldownMs && entry.lastRequest) {
        const timeSinceLastRequest = now - entry.lastRequest
        cooldownAllowed = timeSinceLastRequest >= config.cooldownMs
    }

    const finalAllowed = allowed && cooldownAllowed

    logger.debug('Rate limit check', {
        userId,
        subscriptionTier,
        count: entry.count,
        limit: config.limit,
        remaining,
        allowed: finalAllowed,
        cooldownAllowed,
        resetTime: entry.resetTime
    })

    return {
        limit: config.limit,
        remaining,
        resetTime: entry.resetTime,
        allowed: finalAllowed
    }
}

/**
 * Record a successful request (increment counter)
 */
export async function recordRequest(
    userId: string,
    subscriptionTier: SubscriptionTier
): Promise<void> {
    const key = `${userId}:${subscriptionTier}`
    const now = Date.now()

    const entry = rateLimitStore.get(key)
    if (entry) {
        entry.count++
        entry.lastRequest = now
        rateLimitStore.set(key, entry)

        logger.debug('Request recorded', {
            userId,
            subscriptionTier,
            count: entry.count,
            lastRequest: entry.lastRequest
        })
    }
}

/**
 * Get current rate limit info without checking
 */
export async function getRateLimitInfo(
    userId: string,
    subscriptionTier: SubscriptionTier
): Promise<RateLimitInfo> {
    const config = RATE_LIMIT_CONFIG[subscriptionTier]
    const now = Date.now()
    const key = `${userId}:${subscriptionTier}`

    const entry = rateLimitStore.get(key)

    if (!entry || now >= entry.resetTime) {
        return {
            limit: config.limit,
            remaining: config.limit,
            resetTime: now + config.windowMs,
            allowed: true
        }
    }

    const remaining = Math.max(0, config.limit - entry.count)

    return {
        limit: config.limit,
        remaining,
        resetTime: entry.resetTime,
        allowed: entry.count < config.limit
    }
}

/**
 * Reset rate limits for a user (admin function)
 */
export async function resetRateLimit(
    userId: string,
    subscriptionTier: SubscriptionTier
): Promise<void> {
    const key = `${userId}:${subscriptionTier}`
    rateLimitStore.delete(key)

    logger.info('Rate limit reset', {
        userId,
        subscriptionTier
    })
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats(): {
    totalUsers: number
    activeUsers: number
    entries: Array<{
        userId: string
        subscriptionTier: string
        count: number
        remaining: number
        resetTime: number
    }>
} {
    const now = Date.now()
    const entries: Array<{
        userId: string
        subscriptionTier: string
        count: number
        remaining: number
        resetTime: number
    }> = []

    let activeUsers = 0

    for (const [key, entry] of rateLimitStore.entries()) {
        const [userId, subscriptionTier] = key.split(':')
        const config = RATE_LIMIT_CONFIG[subscriptionTier as SubscriptionTier]

        if (now < entry.resetTime) {
            activeUsers++
        }

        entries.push({
            userId,
            subscriptionTier,
            count: entry.count,
            remaining: Math.max(0, config.limit - entry.count),
            resetTime: entry.resetTime
        })
    }

    return {
        totalUsers: rateLimitStore.size,
        activeUsers,
        entries
    }
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupExpiredEntries(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of rateLimitStore.entries()) {
        if (now >= entry.resetTime) {
            rateLimitStore.delete(key)
            cleaned++
        }
    }

    if (cleaned > 0) {
        logger.info('Cleaned up expired rate limit entries', { cleaned })
    }

    return cleaned
}

// Clean up expired entries every hour
setInterval(cleanupExpiredEntries, 60 * 60 * 1000)