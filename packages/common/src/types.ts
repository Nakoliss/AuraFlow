// Core types for AuraFlow application
export type MessageCategory = 'motivational' | 'mindfulness' | 'fitness' | 'philosophy' | 'productivity'

export type SubscriptionTier = 'free' | 'premium_core' | 'voice_pack'

export type WeatherBucket = 'sunny' | 'rain' | 'cold' | 'hot'

export type TimeOfDay = 'morning' | 'evening'

export interface User {
    id: string
    email: string
    createdAt: Date
    updatedAt: Date
    subscriptionStatus: SubscriptionTier
    premiumExpiresAt?: Date
    voicePackExpiresAt?: Date
    wisdomPoints: number
    streakCount: number
    lastActivityDate?: Date
    preferredCategories: MessageCategory[]
    notificationTime?: string
    voicePreference?: string
    timezone: string
}

export interface MessageRequest {
    userId: string
    category: MessageCategory
    timeOfDay?: TimeOfDay
    weatherContext?: WeatherBucket
    locale: string
}

export interface GeneratedMessage {
    id: string
    userId?: string
    content: string
    category: MessageCategory
    embedding?: number[]
    tokens: number
    cost: number
    temperature: number
    model: string
    timeOfDay?: TimeOfDay
    weatherContext?: WeatherBucket
    locale: string
    createdAt: Date
}

export interface DailyDrop {
    id: string
    date: string
    content: string
    locale: string
    embedding?: number[]
    createdAt: Date
}

export interface DailyChallenge {
    id: string
    date: string
    task: string
    points: number
    locale: string
    createdAt: Date
}

export interface Achievement {
    id: string
    name: string
    description: string
    icon: string
    pointsRequired: number
    badgeColor: string
}

export interface UserAchievement {
    userId: string
    achievementId: string
    earnedAt: Date
}

export interface AudioCache {
    id: string
    messageId: string
    voice: string
    audioUrl: string
    duration: number
    fileSize: number
    createdAt: Date
}

// AI Service Types
export interface MessageRequest {
    userId: string
    category: MessageCategory
    timeOfDay?: TimeOfDay
    weatherContext?: WeatherBucket
    locale: string
    temperature?: number
}

export interface AIServiceResponse {
    content: string
    tokens: number
    model: string
    finishReason: string
}

export interface PromptTemplate {
    category: MessageCategory
    systemPrompt: string
    userPrompt: string
    maxTokens: number
    temperature: number
}

export interface AIServiceConfig {
    apiKey: string
    baseUrl?: string
    timeout?: number
    maxRetries?: number
}

// Payment and Subscription Types
export type Platform = 'ios' | 'android' | 'web'

export type EntitlementType = 'premium_core' | 'voice_pack'

export interface Entitlement {
    type: EntitlementType
    expiresAt: Date
    platform: Platform
    isActive: boolean
}

export interface SubscriptionRequest {
    userId: string
    planId: string
    platform: Platform
    priceId?: string
}

export interface SubscriptionResult {
    success: boolean
    subscriptionId?: string
    entitlements: Entitlement[]
    error?: string
}

export interface PaymentWebhook {
    type: 'revenuecat' | 'stripe'
    event: string
    data: any
    timestamp: Date
}

export interface RevenueCatWebhookData {
    event: {
        type: string
        id: string
        event_timestamp_ms: number
        app_user_id: string
        original_app_user_id: string
        product_id: string
        period_type: string
        purchased_at_ms: number
        expiration_at_ms?: number
        environment: 'SANDBOX' | 'PRODUCTION'
        entitlement_id?: string
        entitlement_ids?: string[]
        is_family_share: boolean
        country_code: string
        app_id: string
        offer_code?: string
        currency: string
        price: number
        price_in_purchased_currency: number
        subscriber_attributes?: Record<string, any>
        store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL'
        takehome_percentage: number
        transaction_id: string
        original_transaction_id: string
    }
}

export interface StripeWebhookData {
    id: string
    object: string
    api_version: string
    created: number
    data: {
        object: any
        previous_attributes?: any
    }
    livemode: boolean
    pending_webhooks: number
    request: {
        id: string
        idempotency_key?: string
    }
    type: string
}