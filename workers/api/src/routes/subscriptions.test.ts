import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    createSubscription,
    getSubscriptionStatus,
    syncSubscription,
    handleRevenueCatWebhook,
    handleStripeWebhook,
    getSubscriptionPlans
} from './subscriptions'
import { PaymentService, RevenueCatWebhookData, StripeWebhookData } from '@aura-flow/common'

// Mock the payment service
vi.mock('@aura-flow/common', async () => {
    const actual = await vi.importActual('@aura-flow/common')
    return {
        ...actual,
        PaymentService: vi.fn(),
        EntitlementValidator: vi.fn(),
        logger: {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }
    }
})

describe('Subscription Routes', () => {
    let mockPaymentService: vi.Mocked<PaymentService>

    beforeEach(() => {
        mockPaymentService = {
            processSubscription: vi.fn(),
            validateEntitlements: vi.fn(),
            syncRevenueCat: vi.fn(),
            handleWebhook: vi.fn(),
            hasEntitlement: vi.fn()
        } as any

        // Mock the PaymentService constructor
        vi.mocked(PaymentService).mockImplementation(() => mockPaymentService)

        // Set up environment variables
        process.env.REVENUECAT_API_KEY = 'test-rc-key'
        process.env.STRIPE_SECRET_KEY = 'test-stripe-key'
        process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret'
    })

    describe('createSubscription', () => {
        it('should create subscription successfully', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user123'
                },
                body: JSON.stringify({
                    planId: 'premium_core',
                    platform: 'web',
                    priceId: 'price_123'
                })
            })

            mockPaymentService.processSubscription.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_123',
                entitlements: [{
                    type: 'premium_core',
                    expiresAt: new Date(),
                    platform: 'web',
                    isActive: true
                }]
            })

            const response = await createSubscription(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.subscriptionId).toBe('sub_123')
            expect(data.entitlements).toHaveLength(1)
        })

        it('should handle missing user ID', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    planId: 'premium_core',
                    platform: 'web'
                })
            })

            const response = await createSubscription(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.success).toBe(false)
            expect(data.error).toContain('User ID not found')
        })

        it('should handle validation errors', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user123'
                },
                body: JSON.stringify({
                    planId: 'invalid_plan',
                    platform: 'web'
                })
            })

            const response = await createSubscription(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
        })

        it('should handle subscription creation failure', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user123'
                },
                body: JSON.stringify({
                    planId: 'premium_core',
                    platform: 'web'
                })
            })

            mockPaymentService.processSubscription.mockResolvedValue({
                success: false,
                entitlements: [],
                error: 'Payment failed'
            })

            const response = await createSubscription(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
            expect(data.error).toBe('Payment failed')
        })
    })

    describe('getSubscriptionStatus', () => {
        it('should return subscription status for premium user', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/status', {
                method: 'GET',
                headers: {
                    'x-user-id': 'user123'
                }
            })

            mockPaymentService.validateEntitlements.mockResolvedValue([{
                type: 'premium_core',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }])

            const response = await getSubscriptionStatus(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.subscriptionTier).toBe('premium_core')
            expect(data.capabilities.dailyMessageLimit).toBe(20)
            expect(data.capabilities.availableCategories).toHaveLength(5)
            expect(data.capabilities.hasVoiceAccess).toBe(false)
        })

        it('should return subscription status for voice pack user', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/status', {
                method: 'GET',
                headers: {
                    'x-user-id': 'user123'
                }
            })

            mockPaymentService.validateEntitlements.mockResolvedValue([{
                type: 'voice_pack',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }])

            const response = await getSubscriptionStatus(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.subscriptionTier).toBe('voice_pack')
            expect(data.capabilities.hasVoiceAccess).toBe(true)
        })

        it('should return subscription status for free user', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/status', {
                method: 'GET',
                headers: {
                    'x-user-id': 'user123'
                }
            })

            mockPaymentService.validateEntitlements.mockResolvedValue([])

            const response = await getSubscriptionStatus(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.subscriptionTier).toBe('free')
            expect(data.capabilities.dailyMessageLimit).toBe(1)
            expect(data.capabilities.availableCategories).toHaveLength(2)
            expect(data.capabilities.hasVoiceAccess).toBe(false)
        })

        it('should handle missing user ID', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/status', {
                method: 'GET'
            })

            const response = await getSubscriptionStatus(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.error).toContain('User ID not found')
        })
    })

    describe('syncSubscription', () => {
        it('should sync subscription successfully', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/sync', {
                method: 'POST',
                headers: {
                    'x-user-id': 'user123'
                }
            })

            mockPaymentService.syncRevenueCat.mockResolvedValue()

            const response = await syncSubscription(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(mockPaymentService.syncRevenueCat).toHaveBeenCalledWith('user123')
        })

        it('should handle sync errors', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/sync', {
                method: 'POST',
                headers: {
                    'x-user-id': 'user123'
                }
            })

            mockPaymentService.syncRevenueCat.mockRejectedValue(new Error('Sync failed'))

            const response = await syncSubscription(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(500)
            expect(data.success).toBe(false)
        })
    })

    describe('handleRevenueCatWebhook', () => {
        it('should handle RevenueCat webhook successfully', async () => {
            const webhookData: RevenueCatWebhookData = {
                event: {
                    type: 'INITIAL_PURCHASE',
                    id: 'event123',
                    event_timestamp_ms: Date.now(),
                    app_user_id: 'user123',
                    original_app_user_id: 'user123',
                    product_id: 'premium_core',
                    period_type: 'NORMAL',
                    purchased_at_ms: Date.now(),
                    environment: 'SANDBOX',
                    is_family_share: false,
                    country_code: 'US',
                    app_id: 'app123',
                    currency: 'USD',
                    price: 4.99,
                    price_in_purchased_currency: 4.99,
                    store: 'APP_STORE',
                    takehome_percentage: 0.7,
                    transaction_id: 'txn123',
                    original_transaction_id: 'txn123'
                }
            }

            const mockRequest = new Request('http://localhost/webhooks/revenuecat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(webhookData)
            })

            mockPaymentService.handleWebhook.mockResolvedValue()

            const response = await handleRevenueCatWebhook(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'revenuecat',
                    event: 'INITIAL_PURCHASE'
                })
            )
        })

        it('should handle webhook processing errors', async () => {
            const mockRequest = new Request('http://localhost/webhooks/revenuecat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ invalid: 'data' })
            })

            mockPaymentService.handleWebhook.mockRejectedValue(new Error('Webhook failed'))

            const response = await handleRevenueCatWebhook(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
        })
    })

    describe('handleStripeWebhook', () => {
        it('should handle Stripe webhook successfully', async () => {
            const webhookData: StripeWebhookData = {
                id: 'evt_123',
                object: 'event',
                api_version: '2023-10-16',
                created: Math.floor(Date.now() / 1000),
                data: {
                    object: {
                        id: 'sub_123',
                        metadata: { user_id: 'user123' }
                    }
                },
                livemode: false,
                pending_webhooks: 1,
                request: { id: 'req_123' },
                type: 'customer.subscription.created'
            }

            const mockRequest = new Request('http://localhost/webhooks/stripe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'stripe-signature': 'test-signature'
                },
                body: JSON.stringify(webhookData)
            })

            mockPaymentService.handleWebhook.mockResolvedValue()

            const response = await handleStripeWebhook(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'stripe',
                    event: 'customer.subscription.created'
                })
            )
        })

        it('should handle missing signature', async () => {
            const mockRequest = new Request('http://localhost/webhooks/stripe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: 'test' })
            })

            const response = await handleStripeWebhook(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
            expect(data.error).toContain('Missing Stripe signature')
        })
    })

    describe('getSubscriptionPlans', () => {
        it('should return available subscription plans', async () => {
            const mockRequest = new Request('http://localhost/subscriptions/plans', {
                method: 'GET'
            })

            const response = await getSubscriptionPlans(mockRequest)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.plans).toHaveLength(2)
            expect(data.plans[0].id).toBe('premium_core')
            expect(data.plans[1].id).toBe('voice_pack')
            expect(data.plans[0].features).toBeInstanceOf(Array)
            expect(data.plans[1].features).toBeInstanceOf(Array)
        })
    })
})