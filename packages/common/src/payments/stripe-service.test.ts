import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StripeService, StripeConfig } from './stripe-service'
import { SubscriptionRequest, PaymentWebhook, StripeWebhookData } from '../types'

// Mock fetch globally
global.fetch = vi.fn()

vi.mock('../logging', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}))

describe('StripeService', () => {
    let service: StripeService
    let config: StripeConfig

    beforeEach(() => {
        config = {
            secretKey: 'sk_test_123',
            webhookSecret: 'whsec_123',
            environment: 'test'
        }
        service = new StripeService(config)
        vi.clearAllMocks()
    })

    describe('createSubscription', () => {
        it('should create subscription for new customer', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'web',
                priceId: 'price_123'
            }

            // Mock customer search (not found)
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            } as Response)

            // Mock customer creation
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 'cus_123', metadata: { user_id: 'user123' } })
            } as Response)

            // Mock subscription creation
            const mockSubscription = {
                id: 'sub_123',
                object: 'subscription',
                status: 'active',
                current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
                current_period_start: Math.floor(Date.now() / 1000),
                customer: 'cus_123',
                items: {
                    data: [{
                        id: 'si_123',
                        price: {
                            id: 'price_premium_core',
                            product: 'prod_123',
                            nickname: 'Premium Core'
                        }
                    }]
                },
                metadata: { user_id: 'user123', plan_id: 'premium_core' }
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscription)
            } as Response)

            const result = await service.createSubscription(request)

            expect(result.success).toBe(true)
            expect(result.subscriptionId).toBe('sub_123')
            expect(result.entitlements).toHaveLength(1)
            expect(result.entitlements[0].platform).toBe('web')
        })

        it('should handle existing customer', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'web',
                priceId: 'price_123'
            }

            // Mock customer search (found)
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ id: 'cus_123', metadata: { user_id: 'user123' } }]
                })
            } as Response)

            // Mock subscription creation
            const mockSubscription = {
                id: 'sub_123',
                object: 'subscription',
                status: 'active',
                current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
                current_period_start: Math.floor(Date.now() / 1000),
                customer: 'cus_123',
                items: {
                    data: [{
                        id: 'si_123',
                        price: {
                            id: 'price_123',
                            product: 'prod_123'
                        }
                    }]
                },
                metadata: { user_id: 'user123', plan_id: 'premium_core' }
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscription)
            } as Response)

            const result = await service.createSubscription(request)

            expect(result.success).toBe(true)
            expect(result.subscriptionId).toBe('sub_123')
        })

        it('should handle API errors', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'web',
                priceId: 'price_123'
            }

            // Mock customer search failure
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({ error: { message: 'Server error' } })
            } as Response)

            const result = await service.createSubscription(request)

            expect(result.success).toBe(false)
            expect(result.error).toContain('Failed to search Stripe customers')
        })
    })

    describe('getEntitlements', () => {
        it('should fetch entitlements for existing customer', async () => {
            const userId = 'user123'

            // Mock customer search
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ id: 'cus_123', metadata: { user_id: 'user123' } }]
                })
            } as Response)

            // Mock subscriptions fetch
            const mockSubscriptions = {
                data: [{
                    id: 'sub_123',
                    status: 'active',
                    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
                    items: {
                        data: [{
                            price: {
                                id: 'price_premium_core'
                            }
                        }]
                    }
                }]
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscriptions)
            } as Response)

            const entitlements = await service.getEntitlements(userId)

            expect(entitlements).toHaveLength(1)
            expect(entitlements[0].type).toBe('premium_core')
            expect(entitlements[0].platform).toBe('web')
            expect(entitlements[0].isActive).toBe(true)
        })

        it('should return empty array for non-existent customer', async () => {
            const userId = 'nonexistent'

            // Mock customer search (not found)
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            } as Response)

            const entitlements = await service.getEntitlements(userId)

            expect(entitlements).toEqual([])
        })

        it('should handle multiple subscriptions', async () => {
            const userId = 'user123'

            // Mock customer search
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ id: 'cus_123', metadata: { user_id: 'user123' } }]
                })
            } as Response)

            // Mock subscriptions fetch with multiple items
            const mockSubscriptions = {
                data: [{
                    id: 'sub_123',
                    status: 'active',
                    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
                    items: {
                        data: [
                            {
                                price: {
                                    id: 'price_premium_core'
                                }
                            },
                            {
                                price: {
                                    id: 'price_voice_pack'
                                }
                            }
                        ]
                    }
                }]
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscriptions)
            } as Response)

            const entitlements = await service.getEntitlements(userId)

            expect(entitlements).toHaveLength(2)
            expect(entitlements.find(e => e.type === 'premium_core')).toBeDefined()
            expect(entitlements.find(e => e.type === 'voice_pack')).toBeDefined()
        })
    })

    describe('handleWebhook', () => {
        it('should handle customer.subscription.created events', async () => {
            const webhook: PaymentWebhook = {
                type: 'stripe',
                event: 'customer.subscription.created',
                data: {
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
                } as StripeWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should handle customer.subscription.updated events', async () => {
            const webhook: PaymentWebhook = {
                type: 'stripe',
                event: 'customer.subscription.updated',
                data: {
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
                    type: 'customer.subscription.updated'
                } as StripeWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should handle customer.subscription.deleted events', async () => {
            const webhook: PaymentWebhook = {
                type: 'stripe',
                event: 'customer.subscription.deleted',
                data: {
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
                    type: 'customer.subscription.deleted'
                } as StripeWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should handle invoice.payment_succeeded events', async () => {
            const webhook: PaymentWebhook = {
                type: 'stripe',
                event: 'invoice.payment_succeeded',
                data: {
                    id: 'evt_123',
                    object: 'event',
                    api_version: '2023-10-16',
                    created: Math.floor(Date.now() / 1000),
                    data: {
                        object: {
                            id: 'in_123',
                            customer: 'cus_123'
                        }
                    },
                    livemode: false,
                    pending_webhooks: 1,
                    request: { id: 'req_123' },
                    type: 'invoice.payment_succeeded'
                } as StripeWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should handle invoice.payment_failed events', async () => {
            const webhook: PaymentWebhook = {
                type: 'stripe',
                event: 'invoice.payment_failed',
                data: {
                    id: 'evt_123',
                    object: 'event',
                    api_version: '2023-10-16',
                    created: Math.floor(Date.now() / 1000),
                    data: {
                        object: {
                            id: 'in_123',
                            customer: 'cus_123'
                        }
                    },
                    livemode: false,
                    pending_webhooks: 1,
                    request: { id: 'req_123' },
                    type: 'invoice.payment_failed'
                } as StripeWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should log warning for unhandled event types', async () => {
            const webhook: PaymentWebhook = {
                type: 'stripe',
                event: 'unknown.event',
                data: {
                    id: 'evt_123',
                    object: 'event',
                    api_version: '2023-10-16',
                    created: Math.floor(Date.now() / 1000),
                    data: { object: {} },
                    livemode: false,
                    pending_webhooks: 1,
                    request: { id: 'req_123' },
                    type: 'unknown.event'
                } as any,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })
    })
})