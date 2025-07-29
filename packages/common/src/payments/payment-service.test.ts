import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentService, PaymentServiceConfig } from './payment-service'
import { RevenueCatService } from './revenuecat-service'
import { StripeService } from './stripe-service'
import {
    SubscriptionRequest,
    PaymentWebhook,
    Entitlement,
    EntitlementType
} from '../types'
import { AppError, ErrorCode } from '../errors'

// Mock the services
vi.mock('./revenuecat-service')
vi.mock('./stripe-service')
vi.mock('../logging', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}))

describe('PaymentService', () => {
    let paymentService: PaymentService
    let mockRevenueCatService: vi.Mocked<RevenueCatService>
    let mockStripeService: vi.Mocked<StripeService>
    let config: PaymentServiceConfig

    beforeEach(() => {
        config = {
            revenueCat: {
                apiKey: 'test-rc-key',
                environment: 'sandbox'
            },
            stripe: {
                secretKey: 'test-stripe-key',
                webhookSecret: 'test-webhook-secret',
                environment: 'test'
            }
        }

        mockRevenueCatService = {
            processSubscription: vi.fn(),
            getEntitlements: vi.fn(),
            handleWebhook: vi.fn(),
            syncSubscriberData: vi.fn()
        } as any

        mockStripeService = {
            createSubscription: vi.fn(),
            getEntitlements: vi.fn(),
            handleWebhook: vi.fn()
        } as any

        vi.mocked(RevenueCatService).mockImplementation(() => mockRevenueCatService)
        vi.mocked(StripeService).mockImplementation(() => mockStripeService)

        paymentService = new PaymentService(config)
    })

    describe('processSubscription', () => {
        it('should process web subscription via Stripe', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'web',
                priceId: 'price_123'
            }

            const expectedResult = {
                success: true,
                subscriptionId: 'sub_123',
                entitlements: []
            }

            mockStripeService.createSubscription.mockResolvedValue(expectedResult)

            const result = await paymentService.processSubscription(request)

            expect(mockStripeService.createSubscription).toHaveBeenCalledWith(request)
            expect(result).toEqual(expectedResult)
        })

        it('should process mobile subscription via RevenueCat', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'ios'
            }

            const expectedResult = {
                success: true,
                subscriptionId: 'rc_123',
                entitlements: []
            }

            mockRevenueCatService.processSubscription.mockResolvedValue(expectedResult)

            const result = await paymentService.processSubscription(request)

            expect(mockRevenueCatService.processSubscription).toHaveBeenCalledWith(request)
            expect(result).toEqual(expectedResult)
        })

        it('should handle subscription processing errors', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'web'
            }

            mockStripeService.createSubscription.mockRejectedValue(new Error('Stripe error'))

            await expect(paymentService.processSubscription(request)).rejects.toThrow(AppError)
        })
    })

    describe('validateEntitlements', () => {
        it('should merge entitlements from both services', async () => {
            const userId = 'user123'
            const rcEntitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date('2024-12-31'),
                platform: 'ios',
                isActive: true
            }]
            const stripeEntitlements: Entitlement[] = [{
                type: 'voice_pack',
                expiresAt: new Date('2024-12-31'),
                platform: 'web',
                isActive: true
            }]

            mockRevenueCatService.getEntitlements.mockResolvedValue(rcEntitlements)
            mockStripeService.getEntitlements.mockResolvedValue(stripeEntitlements)

            const result = await paymentService.validateEntitlements(userId)

            expect(result).toHaveLength(2)
            expect(result).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'premium_core' }),
                expect.objectContaining({ type: 'voice_pack' })
            ]))
        })

        it('should handle partial service failures gracefully', async () => {
            const userId = 'user123'
            const stripeEntitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date('2024-12-31'),
                platform: 'web',
                isActive: true
            }]

            mockRevenueCatService.getEntitlements.mockRejectedValue(new Error('RC error'))
            mockStripeService.getEntitlements.mockResolvedValue(stripeEntitlements)

            const result = await paymentService.validateEntitlements(userId)

            expect(result).toHaveLength(1)
            expect(result[0].type).toBe('premium_core')
        })

        it('should merge duplicate entitlements keeping the latest expiration', async () => {
            const userId = 'user123'
            const rcEntitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date('2024-06-30'),
                platform: 'ios',
                isActive: true
            }]
            const stripeEntitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date('2024-12-31'),
                platform: 'web',
                isActive: true
            }]

            mockRevenueCatService.getEntitlements.mockResolvedValue(rcEntitlements)
            mockStripeService.getEntitlements.mockResolvedValue(stripeEntitlements)

            const result = await paymentService.validateEntitlements(userId)

            expect(result).toHaveLength(1)
            expect(result[0].expiresAt).toEqual(new Date('2024-12-31'))
            expect(result[0].platform).toBe('web')
        })
    })

    describe('handleWebhook', () => {
        it('should handle RevenueCat webhooks', async () => {
            const webhook: PaymentWebhook = {
                type: 'revenuecat',
                event: 'INITIAL_PURCHASE',
                data: { event: { type: 'INITIAL_PURCHASE' } },
                timestamp: new Date()
            }

            await paymentService.handleWebhook(webhook)

            expect(mockRevenueCatService.handleWebhook).toHaveBeenCalledWith(webhook)
        })

        it('should handle Stripe webhooks', async () => {
            const webhook: PaymentWebhook = {
                type: 'stripe',
                event: 'customer.subscription.created',
                data: { type: 'customer.subscription.created' },
                timestamp: new Date()
            }

            await paymentService.handleWebhook(webhook)

            expect(mockStripeService.handleWebhook).toHaveBeenCalledWith(webhook)
        })

        it('should throw error for unknown webhook types', async () => {
            const webhook: PaymentWebhook = {
                type: 'unknown' as any,
                event: 'test',
                data: {},
                timestamp: new Date()
            }

            await expect(paymentService.handleWebhook(webhook)).rejects.toThrow(AppError)
        })
    })

    describe('hasEntitlement', () => {
        it('should return true for active entitlements', async () => {
            const userId = 'user123'
            const entitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() + 86400000), // Tomorrow
                platform: 'web',
                isActive: true
            }]

            mockRevenueCatService.getEntitlements.mockResolvedValue([])
            mockStripeService.getEntitlements.mockResolvedValue(entitlements)

            const result = await paymentService.hasEntitlement(userId, 'premium_core')

            expect(result).toBe(true)
        })

        it('should return false for expired entitlements', async () => {
            const userId = 'user123'
            const entitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() - 86400000), // Yesterday
                platform: 'web',
                isActive: true
            }]

            mockRevenueCatService.getEntitlements.mockResolvedValue([])
            mockStripeService.getEntitlements.mockResolvedValue(entitlements)

            const result = await paymentService.hasEntitlement(userId, 'premium_core')

            expect(result).toBe(false)
        })

        it('should return false for inactive entitlements', async () => {
            const userId = 'user123'
            const entitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() + 86400000), // Tomorrow
                platform: 'web',
                isActive: false
            }]

            mockRevenueCatService.getEntitlements.mockResolvedValue([])
            mockStripeService.getEntitlements.mockResolvedValue(entitlements)

            const result = await paymentService.hasEntitlement(userId, 'premium_core')

            expect(result).toBe(false)
        })

        it('should return false on validation errors', async () => {
            const userId = 'user123'

            mockRevenueCatService.getEntitlements.mockRejectedValue(new Error('Service error'))
            mockStripeService.getEntitlements.mockRejectedValue(new Error('Service error'))

            const result = await paymentService.hasEntitlement(userId, 'premium_core')

            expect(result).toBe(false)
        })
    })

    describe('syncRevenueCat', () => {
        it('should sync RevenueCat data successfully', async () => {
            const userId = 'user123'

            await paymentService.syncRevenueCat(userId)

            expect(mockRevenueCatService.syncSubscriberData).toHaveBeenCalledWith(userId)
        })

        it('should handle sync errors', async () => {
            const userId = 'user123'

            mockRevenueCatService.syncSubscriberData.mockRejectedValue(new Error('Sync error'))

            await expect(paymentService.syncRevenueCat(userId)).rejects.toThrow(AppError)
        })
    })
})