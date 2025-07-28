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