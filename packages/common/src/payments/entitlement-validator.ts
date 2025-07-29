import { Entitlement, EntitlementType, User } from '../types'
import { PaymentService } from './payment-service'
import { createLogger } from '../logging'

const logger = createLogger('entitlement-validator')

export class EntitlementValidator {
    constructor(private paymentService: PaymentService) { }

    async validateUserEntitlements(user: User): Promise<{
        hasPremiumCore: boolean
        hasVoicePack: boolean
        entitlements: Entitlement[]
    }> {
        try {
            const entitlements = await this.paymentService.validateEntitlements(user.id)

            const hasPremiumCore = this.hasActiveEntitlement(entitlements, 'premium_core')
            const hasVoicePack = this.hasActiveEntitlement(entitlements, 'voice_pack')

            logger.debug('User entitlements validated', {
                userId: user.id,
                hasPremiumCore,
                hasVoicePack,
                entitlementCount: entitlements.length
            })

            return {
                hasPremiumCore,
                hasVoicePack,
                entitlements
            }
        } catch (error) {
            logger.error('Failed to validate user entitlements', { error, userId: user.id })

            // Fallback to database subscription status if payment service fails
            return this.fallbackToDbStatus(user)
        }
    }

    async checkMessageGenerationQuota(user: User): Promise<{
        canGenerate: boolean
        remainingMessages: number
        cooldownEndsAt?: Date
    }> {
        const validation = await this.validateUserEntitlements(user)

        if (validation.hasPremiumCore) {
            // Premium users get 20 messages per day with 30-second cooldown
            return {
                canGenerate: true,
                remainingMessages: 20, // This would be calculated based on usage
                cooldownEndsAt: new Date(Date.now() + 30 * 1000) // 30 seconds
            }
        } else {
            // Free users get 1 message per 24 hours
            const lastMessageTime = user.lastActivityDate
            const canGenerate = !lastMessageTime ||
                (Date.now() - lastMessageTime.getTime()) >= 24 * 60 * 60 * 1000

            return {
                canGenerate,
                remainingMessages: canGenerate ? 1 : 0,
                cooldownEndsAt: lastMessageTime ?
                    new Date(lastMessageTime.getTime() + 24 * 60 * 60 * 1000) :
                    undefined
            }
        }
    }

    async checkCategoryAccess(user: User, category: string): Promise<boolean> {
        const validation = await this.validateUserEntitlements(user)

        if (validation.hasPremiumCore) {
            // Premium users have access to all categories
            return true
        } else {
            // Free users only have access to motivational and philosophical categories
            return category === 'motivational' || category === 'philosophy'
        }
    }

    async checkVoiceAccess(user: User): Promise<boolean> {
        const validation = await this.validateUserEntitlements(user)
        return validation.hasVoicePack
    }

    private hasActiveEntitlement(entitlements: Entitlement[], type: EntitlementType): boolean {
        const entitlement = entitlements.find(e => e.type === type)

        if (!entitlement) {
            return false
        }

        return entitlement.isActive && entitlement.expiresAt > new Date()
    }

    private fallbackToDbStatus(user: User): {
        hasPremiumCore: boolean
        hasVoicePack: boolean
        entitlements: Entitlement[]
    } {
        logger.info('Using database fallback for entitlement validation', { userId: user.id })

        const now = new Date()
        const hasPremiumCore = user.subscriptionStatus === 'premium_core' &&
            Boolean(user.premiumExpiresAt && user.premiumExpiresAt > now)

        const hasVoicePack = user.subscriptionStatus === 'voice_pack' &&
            Boolean(user.voicePackExpiresAt && user.voicePackExpiresAt > now)

        const entitlements: Entitlement[] = []

        if (hasPremiumCore && user.premiumExpiresAt) {
            entitlements.push({
                type: 'premium_core',
                expiresAt: user.premiumExpiresAt,
                platform: 'web', // Default fallback
                isActive: true
            })
        }

        if (hasVoicePack && user.voicePackExpiresAt) {
            entitlements.push({
                type: 'voice_pack',
                expiresAt: user.voicePackExpiresAt,
                platform: 'web', // Default fallback
                isActive: true
            })
        }

        return {
            hasPremiumCore,
            hasVoicePack,
            entitlements
        }
    }
}