import { MessageCategory, SubscriptionTier, logger } from '@aura-flow/common'

export interface UserSession {
    userId: string
    email: string
    subscriptionTier: SubscriptionTier
    premiumExpiresAt?: Date
    voicePackExpiresAt?: Date
}

/**
 * Check if user has access to a specific message category
 */
export async function checkSubscriptionAccess(
    session: UserSession,
    category: MessageCategory
): Promise<boolean> {
    // Free categories available to all users
    const freeCategories: MessageCategory[] = ['motivational', 'philosophy']

    if (freeCategories.includes(category)) {
        return true
    }

    // Premium categories require premium_core or voice_pack subscription
    const premiumCategories: MessageCategory[] = ['mindfulness', 'fitness', 'productivity']

    if (premiumCategories.includes(category)) {
        const hasPremiumAccess = checkPremiumAccess(session)

        logger.debug('Premium category access check', {
            userId: session.userId,
            category,
            subscriptionTier: session.subscriptionTier,
            hasPremiumAccess,
            premiumExpiresAt: session.premiumExpiresAt
        })

        return hasPremiumAccess
    }

    // Unknown category - deny access
    logger.warn('Unknown category access check', {
        userId: session.userId,
        category
    })

    return false
}

/**
 * Check if user has premium access (premium_core or voice_pack)
 */
export function checkPremiumAccess(session: UserSession): boolean {
    const now = new Date()

    // Check if user has active premium subscription
    if (session.subscriptionTier === 'premium_core' || session.subscriptionTier === 'voice_pack') {
        // Check if subscription hasn't expired
        if (session.premiumExpiresAt && session.premiumExpiresAt > now) {
            return true
        }
    }

    return false
}

/**
 * Check if user has voice pack access
 */
export function checkVoicePackAccess(session: UserSession): boolean {
    const now = new Date()

    if (session.subscriptionTier === 'voice_pack') {
        // Check if voice pack subscription hasn't expired
        if (session.voicePackExpiresAt && session.voicePackExpiresAt > now) {
            return true
        }
    }

    return false
}

/**
 * Get user's subscription status and capabilities
 */
export function getSubscriptionCapabilities(session: UserSession): {
    tier: SubscriptionTier
    isPremium: boolean
    hasVoicePack: boolean
    availableCategories: MessageCategory[]
    dailyMessageLimit: number
    hasCooldown: boolean
    cooldownSeconds: number
    expiresAt?: Date
} {
    const isPremium = checkPremiumAccess(session)
    const hasVoicePack = checkVoicePackAccess(session)

    const allCategories: MessageCategory[] = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']
    const freeCategories: MessageCategory[] = ['motivational', 'philosophy']

    const availableCategories = isPremium ? allCategories : freeCategories

    const dailyMessageLimit = isPremium ? 20 : 1
    const hasCooldown = isPremium
    const cooldownSeconds = isPremium ? 30 : 0

    return {
        tier: session.subscriptionTier,
        isPremium,
        hasVoicePack,
        availableCategories,
        dailyMessageLimit,
        hasCooldown,
        cooldownSeconds,
        expiresAt: session.premiumExpiresAt
    }
}

/**
 * Get subscription tier display information
 */
export function getSubscriptionTierInfo(tier: SubscriptionTier): {
    name: string
    description: string
    features: string[]
    price?: string
} {
    switch (tier) {
        case 'free':
            return {
                name: 'Free',
                description: 'Basic motivational messages',
                features: [
                    '1 message per day',
                    'Motivational and Philosophy categories',
                    'Basic message generation'
                ]
            }

        case 'premium_core':
            return {
                name: 'Premium Core',
                description: 'Full access to all message categories',
                features: [
                    '20 messages per day',
                    'All 5 message categories',
                    '30-second cooldown between messages',
                    'Time and weather context',
                    'Message history and favorites'
                ],
                price: '$4.99/month'
            }

        case 'voice_pack':
            return {
                name: 'Voice Pack',
                description: 'Premium Core + voice features',
                features: [
                    'All Premium Core features',
                    'Text-to-speech with 5 voice options',
                    'Audio message playback',
                    'Micro-meditations'
                ],
                price: '$5.98/month (Premium Core + $0.99)'
            }

        default:
            return {
                name: 'Unknown',
                description: 'Unknown subscription tier',
                features: []
            }
    }
}

/**
 * Check if user needs to upgrade for a specific feature
 */
export function checkFeatureAccess(
    session: UserSession,
    feature: 'premium_categories' | 'voice_pack' | 'unlimited_messages' | 'no_cooldown'
): {
    hasAccess: boolean
    requiredTier?: SubscriptionTier
    upgradeMessage?: string
} {
    const isPremium = checkPremiumAccess(session)
    const hasVoicePack = checkVoicePackAccess(session)

    switch (feature) {
        case 'premium_categories':
            return {
                hasAccess: isPremium,
                requiredTier: isPremium ? undefined : 'premium_core',
                upgradeMessage: isPremium ? undefined : 'Upgrade to Premium Core to access all message categories'
            }

        case 'voice_pack':
            return {
                hasAccess: hasVoicePack,
                requiredTier: hasVoicePack ? undefined : 'voice_pack',
                upgradeMessage: hasVoicePack ? undefined : 'Upgrade to Voice Pack to enable text-to-speech features'
            }

        case 'unlimited_messages':
            return {
                hasAccess: isPremium,
                requiredTier: isPremium ? undefined : 'premium_core',
                upgradeMessage: isPremium ? undefined : 'Upgrade to Premium Core for 20 daily messages'
            }

        case 'no_cooldown':
            // Free users don't have cooldown (but they have daily limits)
            // Premium users have cooldown but more messages
            return {
                hasAccess: true,
                upgradeMessage: undefined
            }

        default:
            return {
                hasAccess: false,
                upgradeMessage: 'Unknown feature'
            }
    }
}