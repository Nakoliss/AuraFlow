import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EntitlementValidator } from './entitlement-validator'
import { PaymentService } from './payment-service'
import { User, Entitlement } from '../types'

vi.mock('../logging', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}))

describe('EntitlementValidator', () => {
    let validator: EntitlementValidator
    let mockPaymentService: vi.Mocked<PaymentService>
    let mockUser: User

    beforeEach(() => {
        mockPaymentService = {
            validateEntitlements: vi.fn(),
            processSubscription: vi.fn(),
            handleWebhook: vi.fn(),
            syncRevenueCat: vi.fn(),
            hasEntitlement: vi.fn()
        } as any

        validator = new EntitlementValidator(mockPaymentService)

        mockUser = {
            id: 'user123',
            email: 'test@example.com',
            createdAt: new Date(),
            updatedAt: new Date(),
            subscriptionStatus: 'free',
            wisdomPoints: 0,
            streakCount: 0,
            preferredCategories: ['motivational'],
            timezone: 'UTC'
        }
    })

    describe('validateUserEntitlements', () => {
        it('should return entitlements from payment service', async () => {
            const mockEntitlements: Entitlement[] = [
                {
                    type: 'premium_core',
                    expiresAt: new Date(Date.now() + 86400000),
                    platform: 'web',
                    isActive: true
                },
                {
                    type: 'voice_pack',
                    expiresAt: new Date(Date.now() + 86400000),
                    platform: 'web',
                    isActive: true
                }
            ]

            mockPaymentService.validateEntitlements.mockResolvedValue(mockEntitlements)

            const result = await validator.validateUserEntitlements(mockUser)

            expect(result.hasPremiumCore).toBe(true)
            expect(result.hasVoicePack).toBe(true)
            expect(result.entitlements).toEqual(mockEntitlements)
        })

        it('should fallback to database status on payment service failure', async () => {
            mockPaymentService.validateEntitlements.mockRejectedValue(new Error('Service error'))

            const userWithPremium: User = {
                ...mockUser,
                subscriptionStatus: 'premium_core',
                premiumExpiresAt: new Date(Date.now() + 86400000)
            }

            const result = await validator.validateUserEntitlements(userWithPremium)

            expect(result.hasPremiumCore).toBe(true)
            expect(result.hasVoicePack).toBe(false)
            expect(result.entitlements).toHaveLength(1)
            expect(result.entitlements[0].type).toBe('premium_core')
        })

        it('should handle expired database subscriptions in fallback', async () => {
            mockPaymentService.validateEntitlements.mockRejectedValue(new Error('Service error'))

            const userWithExpiredPremium: User = {
                ...mockUser,
                subscriptionStatus: 'premium_core',
                premiumExpiresAt: new Date(Date.now() - 86400000) // Yesterday
            }

            const result = await validator.validateUserEntitlements(userWithExpiredPremium)

            expect(result.hasPremiumCore).toBe(false)
            expect(result.hasVoicePack).toBe(false)
            expect(result.entitlements).toHaveLength(0)
        })
    })

    describe('checkMessageGenerationQuota', () => {
        it('should allow 20 messages for premium users', async () => {
            const mockEntitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(mockEntitlements)

            const result = await validator.checkMessageGenerationQuota(mockUser)

            expect(result.canGenerate).toBe(true)
            expect(result.remainingMessages).toBe(20)
            expect(result.cooldownEndsAt).toBeDefined()
        })

        it('should allow 1 message per 24h for free users', async () => {
            mockPaymentService.validateEntitlements.mockResolvedValue([])

            const result = await validator.checkMessageGenerationQuota(mockUser)

            expect(result.canGenerate).toBe(true)
            expect(result.remainingMessages).toBe(1)
        })

        it('should block free users within 24h cooldown', async () => {
            mockPaymentService.validateEntitlements.mockResolvedValue([])

            const userWithRecentActivity: User = {
                ...mockUser,
                lastActivityDate: new Date(Date.now() - 3600000) // 1 hour ago
            }

            const result = await validator.checkMessageGenerationQuota(userWithRecentActivity)

            expect(result.canGenerate).toBe(false)
            expect(result.remainingMessages).toBe(0)
            expect(result.cooldownEndsAt).toBeDefined()
        })

        it('should allow free users after 24h cooldown', async () => {
            mockPaymentService.validateEntitlements.mockResolvedValue([])

            const userWithOldActivity: User = {
                ...mockUser,
                lastActivityDate: new Date(Date.now() - 25 * 3600000) // 25 hours ago
            }

            const result = await validator.checkMessageGenerationQuota(userWithOldActivity)

            expect(result.canGenerate).toBe(true)
            expect(result.remainingMessages).toBe(1)
        })
    })

    describe('checkCategoryAccess', () => {
        it('should allow all categories for premium users', async () => {
            const mockEntitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(mockEntitlements)

            const categories = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']

            for (const category of categories) {
                const result = await validator.checkCategoryAccess(mockUser, category)
                expect(result).toBe(true)
            }
        })

        it('should only allow motivational and philosophy for free users', async () => {
            mockPaymentService.validateEntitlements.mockResolvedValue([])

            expect(await validator.checkCategoryAccess(mockUser, 'motivational')).toBe(true)
            expect(await validator.checkCategoryAccess(mockUser, 'philosophy')).toBe(true)
            expect(await validator.checkCategoryAccess(mockUser, 'mindfulness')).toBe(false)
            expect(await validator.checkCategoryAccess(mockUser, 'fitness')).toBe(false)
            expect(await validator.checkCategoryAccess(mockUser, 'productivity')).toBe(false)
        })
    })

    describe('checkVoiceAccess', () => {
        it('should allow voice access for voice pack users', async () => {
            const mockEntitlements: Entitlement[] = [{
                type: 'voice_pack',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(mockEntitlements)

            const result = await validator.checkVoiceAccess(mockUser)

            expect(result).toBe(true)
        })

        it('should deny voice access for users without voice pack', async () => {
            const mockEntitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(mockEntitlements)

            const result = await validator.checkVoiceAccess(mockUser)

            expect(result).toBe(false)
        })

        it('should deny voice access for expired voice pack', async () => {
            const mockEntitlements: Entitlement[] = [{
                type: 'voice_pack',
                expiresAt: new Date(Date.now() - 86400000), // Yesterday
                platform: 'web',
                isActive: false
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(mockEntitlements)

            const result = await validator.checkVoiceAccess(mockUser)

            expect(result).toBe(false)
        })
    })
})