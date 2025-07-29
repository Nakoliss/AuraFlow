import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RevenueCatService, RevenueCatConfig } from './revenuecat-service'
import { SubscriptionRequest, PaymentWebhook, RevenueCatWebhookData } from '../types'

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

describe('RevenueCatService', () => {
    let service: RevenueCatService
    let config: RevenueCatConfig

    beforeEach(() => {
        config = {
            apiKey: 'test-api-key',
            environment: 'sandbox'
        }
        service = new RevenueCatService(config)
        vi.clearAllMocks()
    })

    describe('processSubscription', () => {
        it('should process subscription and return entitlements', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'ios'
            }

            const mockSubscriberData = {
                subscriber: {
                    entitlements: {
                        premium_core: {
                            expires_date: '2024-12-31T23:59:59Z',
                            product_identifier: 'premium_core',
                            purchase_date: '2024-01-01T00:00:00Z'
                        }
                    },
                    subscriptions: {
                        'premium_core_monthly': {
                            store: 'APP_STORE'
                        }
                    }
                }
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscriberData)
            } as Response)

            const result = await service.processSubscription(request)

            expect(result.success).toBe(true)
            expect(result.entitlements).toHaveLength(1)
            expect(result.entitlements[0].type).toBe('premium_core')
            expect(result.entitlements[0].platform).toBe('ios')
        })

        it('should handle API errors gracefully', async () => {
            const request: SubscriptionRequest = {
                userId: 'user123',
                planId: 'premium_core',
                platform: 'ios'
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response)

            const result = await service.processSubscription(request)

            expect(result.success).toBe(false)
            expect(result.error).toContain('Failed to fetch RevenueCat entitlements')
        })
    })

    describe('getEntitlements', () => {
        it('should fetch and parse entitlements correctly', async () => {
            const userId = 'user123'
            const mockSubscriberData = {
                subscriber: {
                    entitlements: {
                        premium_core: {
                            expires_date: '2024-12-31T23:59:59Z',
                            product_identifier: 'premium_core',
                            purchase_date: '2024-01-01T00:00:00Z'
                        },
                        voice_pack: {
                            expires_date: '2024-12-31T23:59:59Z',
                            product_identifier: 'voice_pack',
                            purchase_date: '2024-01-01T00:00:00Z'
                        }
                    },
                    subscriptions: {
                        'premium_core_monthly': {
                            store: 'APP_STORE'
                        }
                    }
                }
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscriberData)
            } as Response)

            const entitlements = await service.getEntitlements(userId)

            expect(entitlements).toHaveLength(2)
            expect(entitlements.find(e => e.type === 'premium_core')).toBeDefined()
            expect(entitlements.find(e => e.type === 'voice_pack')).toBeDefined()
        })

        it('should return empty array for non-existent users', async () => {
            const userId = 'nonexistent'

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            } as Response)

            const entitlements = await service.getEntitlements(userId)

            expect(entitlements).toEqual([])
        })

        it('should handle lifetime entitlements (no expiration date)', async () => {
            const userId = 'user123'
            const mockSubscriberData = {
                subscriber: {
                    entitlements: {
                        premium_core: {
                            expires_date: null, // Lifetime entitlement
                            product_identifier: 'premium_core',
                            purchase_date: '2024-01-01T00:00:00Z'
                        }
                    },
                    subscriptions: {
                        'premium_core_lifetime': {
                            store: 'APP_STORE'
                        }
                    }
                }
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscriberData)
            } as Response)

            const entitlements = await service.getEntitlements(userId)

            expect(entitlements).toHaveLength(1)
            expect(entitlements[0].isActive).toBe(true)
            // Should be set to 1 year from now for lifetime
            expect(entitlements[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
        })

        it('should filter out unknown entitlement types', async () => {
            const userId = 'user123'
            const mockSubscriberData = {
                subscriber: {
                    entitlements: {
                        premium_core: {
                            expires_date: '2024-12-31T23:59:59Z',
                            product_identifier: 'premium_core',
                            purchase_date: '2024-01-01T00:00:00Z'
                        },
                        unknown_entitlement: {
                            expires_date: '2024-12-31T23:59:59Z',
                            product_identifier: 'unknown',
                            purchase_date: '2024-01-01T00:00:00Z'
                        }
                    },
                    subscriptions: {
                        'premium_core_monthly': {
                            store: 'APP_STORE'
                        }
                    }
                }
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscriberData)
            } as Response)

            const entitlements = await service.getEntitlements(userId)

            expect(entitlements).toHaveLength(1)
            expect(entitlements[0].type).toBe('premium_core')
        })
    })

    describe('handleWebhook', () => {
        it('should handle INITIAL_PURCHASE events', async () => {
            const webhook: PaymentWebhook = {
                type: 'revenuecat',
                event: 'INITIAL_PURCHASE',
                data: {
                    event: {
                        type: 'INITIAL_PURCHASE',
                        app_user_id: 'user123',
                        product_id: 'premium_core',
                        id: 'event123',
                        event_timestamp_ms: Date.now(),
                        original_app_user_id: 'user123',
                        period_type: 'NORMAL',
                        purchased_at_ms: Date.now(),
                        environment: 'SANDBOX' as const,
                        is_family_share: false,
                        country_code: 'US',
                        app_id: 'app123',
                        currency: 'USD',
                        price: 4.99,
                        price_in_purchased_currency: 4.99,
                        store: 'APP_STORE' as const,
                        takehome_percentage: 0.7,
                        transaction_id: 'txn123',
                        original_transaction_id: 'txn123'
                    }
                } as RevenueCatWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should handle RENEWAL events', async () => {
            const webhook: PaymentWebhook = {
                type: 'revenuecat',
                event: 'RENEWAL',
                data: {
                    event: {
                        type: 'RENEWAL',
                        app_user_id: 'user123',
                        product_id: 'premium_core',
                        id: 'event123',
                        event_timestamp_ms: Date.now(),
                        original_app_user_id: 'user123',
                        period_type: 'NORMAL',
                        purchased_at_ms: Date.now(),
                        environment: 'SANDBOX' as const,
                        is_family_share: false,
                        country_code: 'US',
                        app_id: 'app123',
                        currency: 'USD',
                        price: 4.99,
                        price_in_purchased_currency: 4.99,
                        store: 'APP_STORE' as const,
                        takehome_percentage: 0.7,
                        transaction_id: 'txn123',
                        original_transaction_id: 'txn123'
                    }
                } as RevenueCatWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should handle CANCELLATION events', async () => {
            const webhook: PaymentWebhook = {
                type: 'revenuecat',
                event: 'CANCELLATION',
                data: {
                    event: {
                        type: 'CANCELLATION',
                        app_user_id: 'user123',
                        product_id: 'premium_core',
                        id: 'event123',
                        event_timestamp_ms: Date.now(),
                        original_app_user_id: 'user123',
                        period_type: 'NORMAL',
                        purchased_at_ms: Date.now(),
                        environment: 'SANDBOX' as const,
                        is_family_share: false,
                        country_code: 'US',
                        app_id: 'app123',
                        currency: 'USD',
                        price: 4.99,
                        price_in_purchased_currency: 4.99,
                        store: 'APP_STORE' as const,
                        takehome_percentage: 0.7,
                        transaction_id: 'txn123',
                        original_transaction_id: 'txn123'
                    }
                } as RevenueCatWebhookData,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })

        it('should log warning for unhandled event types', async () => {
            const webhook: PaymentWebhook = {
                type: 'revenuecat',
                event: 'UNKNOWN_EVENT',
                data: {
                    event: {
                        type: 'UNKNOWN_EVENT',
                        app_user_id: 'user123',
                        product_id: 'premium_core',
                        id: 'event123',
                        event_timestamp_ms: Date.now(),
                        original_app_user_id: 'user123',
                        period_type: 'NORMAL',
                        purchased_at_ms: Date.now(),
                        environment: 'SANDBOX' as const,
                        is_family_share: false,
                        country_code: 'US',
                        app_id: 'app123',
                        currency: 'USD',
                        price: 4.99,
                        price_in_purchased_currency: 4.99,
                        store: 'APP_STORE' as const,
                        takehome_percentage: 0.7,
                        transaction_id: 'txn123',
                        original_transaction_id: 'txn123'
                    }
                } as any,
                timestamp: new Date()
            }

            await expect(service.handleWebhook(webhook)).resolves.not.toThrow()
        })
    })

    describe('syncSubscriberData', () => {
        it('should sync subscriber data successfully', async () => {
            const userId = 'user123'
            const mockSubscriberData = {
                subscriber: {
                    entitlements: {},
                    subscriptions: {}
                }
            }

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubscriberData)
            } as Response)

            await expect(service.syncSubscriberData(userId)).resolves.not.toThrow()
        })
    })
})