// Application constants
export const MESSAGE_CATEGORIES = [
    'motivational',
    'mindfulness',
    'fitness',
    'philosophy',
    'productivity'
] as const

export const SUBSCRIPTION_TIERS = [
    'free',
    'premium_core',
    'voice_pack'
] as const

export const WEATHER_BUCKETS = [
    'sunny',
    'rain',
    'cold',
    'hot'
] as const

export const VOICE_OPTIONS = [
    'emma',
    'josh',
    'arnold',
    'domi',
    'elli'
] as const

// Business logic constants
export const FREE_TIER_LIMITS = {
    DAILY_MESSAGES: 1,
    COOLDOWN_HOURS: 24,
    ALLOWED_CATEGORIES: ['motivational', 'philosophy'] as const
}

export const PREMIUM_CORE_LIMITS = {
    DAILY_MESSAGES: 20,
    COOLDOWN_SECONDS: 30,
    ALLOWED_CATEGORIES: MESSAGE_CATEGORIES
}

export const CONTENT_LIMITS = {
    MAX_WORDS: 40,
    DEDUPLICATION_THRESHOLD: 0.20,
    DEDUPLICATION_WINDOW_DAYS: 90
}

export const GAMIFICATION = {
    POINTS: {
        OPEN_APP: 1,
        COMPLETE_CHALLENGE: 5,
        SHARE_CONTENT: 3
    }
}

export const PRICING = {
    PREMIUM_CORE_MONTHLY: 4.99,
    VOICE_PACK_MONTHLY: 0.99
}