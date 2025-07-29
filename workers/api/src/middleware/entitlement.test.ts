import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    createEntitlementMiddleware,
    createCategoryAccessMiddleware,
    createVoiceAccessMiddleware,
    createQuotaCheckMiddleware,
    getUserEntitlements
} from './entitlement'
import { PaymentService, EntitlementValidator, Entitlement } from '@aura-flow/common'

// Mock dependencies
vi.mock('@aura-flow/common', async () => {
    const actual = await vi.importActual('@aura-flow/common')
    return {
        ...actual,
        logger: {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }
    }
})

describe('Entitlement Middleware', () => {
    let mockPaymentService: vi.Mocked<PaymentService>
    let mockEntitlementValidator: vi.Mocked<EntitlementValidator>
    let config: any

    beforeEach(() => {
        mockPaymentService = {
            hasEntitlement: vi.fn(),
            validateEntitlements: vi.fn(),
            processSubscription: vi.fn(),
            handleWebhook: vi.fn(),
            syncRevenueCat: vi.fn()
        } as any

        mockEntitlementValidator = {
            checkCategoryAccess: vi.fn(),
            checkVoiceAccess: vi.fn(),
            checkMessageGenerationQuota: vi.fn(),
            validateUserEntitlements: vi.fn()
        } as any

        config = {
            paymentService: mockPaymentService,
            entitlementValidator: mockEntitlementValidator
        }
    })

    describe('createEntitlementMiddleware', () => {
        it('should allow access with valid entitlement', async () => {
            const middleware = createEntitlementMiddleware(config, 'premium_core')
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn().mockResolvedValue(new Response('success'))

            mockPaymentService.hasEntitlement.mockResolvedValue(true)

            const response = await middleware(mockRequest, mockNext)

            expect(mockPaymentService.hasEntitlement).toHaveBeenCalledWith('user123', 'premium_core')
            expect(mockNext).toHaveBeenCalled()
            expect(await response.text()).toBe('success')
        })

        it('should deny access without valid entitlement', async () => {
            const middleware = createEntitlementMiddleware(config, 'premium_core')
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn()

            mockPaymentService.hasEntitlement.mockResolvedValue(false)

            const response = await middleware(mockRequest, mockNext)
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.error).toContain('premium_core subscription required')
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('should handle missing user ID', async () => {
            const middleware = createEntitlementMiddleware(config, 'premium_core')
            const mockRequest = new Request('http://localhost/test')
            const mockNext = vi.fn()

            const response = await middleware(mockRequest, mockNext)
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.error).toContain('User ID not found')
            expect(mockNext).not.toHaveBeenCalled()
        })
    })

    describe('createCategoryAccessMiddleware', () => {
        it('should allow access to free categories', async () => {
            const middleware = createCategoryAccessMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                method: 'POST',
                headers: {
                    'x-user-id': 'user123',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ category: 'motivational' })
            })
            const mockNext = vi.fn().mockResolvedValue(new Response('success'))

            mockEntitlementValidator.checkCategoryAccess.mockResolvedValue(true)

            const response = await middleware(mockRequest, mockNext)

            expect(mockEntitlementValidator.checkCategoryAccess).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'user123' }),
                'motivational'
            )
            expect(mockNext).toHaveBeenCalled()
            expect(await response.text()).toBe('success')
        })

        it('should deny access to premium categories for free users', async () => {
            const middleware = createCategoryAccessMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                method: 'POST',
                headers: {
                    'x-user-id': 'user123',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ category: 'fitness' })
            })
            const mockNext = vi.fn()

            mockEntitlementValidator.checkCategoryAccess.mockResolvedValue(false)

            const response = await middleware(mockRequest, mockNext)
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.error).toContain('Access to fitness category requires premium subscription')
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('should handle category from query params', async () => {
            const middleware = createCategoryAccessMiddleware(config)
            const mockRequest = new Request('http://localhost/test?category=philosophy', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn().mockResolvedValue(new Response('success'))

            mockEntitlementValidator.checkCategoryAccess.mockResolvedValue(true)

            const response = await middleware(mockRequest, mockNext)

            expect(mockEntitlementValidator.checkCategoryAccess).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'user123' }),
                'philosophy'
            )
            expect(mockNext).toHaveBeenCalled()
        })

        it('should handle missing category', async () => {
            const middleware = createCategoryAccessMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn()

            const response = await middleware(mockRequest, mockNext)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toContain('Category not specified')
            expect(mockNext).not.toHaveBeenCalled()
        })
    })

    describe('createVoiceAccessMiddleware', () => {
        it('should allow access with voice pack', async () => {
            const middleware = createVoiceAccessMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn().mockResolvedValue(new Response('success'))

            mockEntitlementValidator.checkVoiceAccess.mockResolvedValue(true)

            const response = await middleware(mockRequest, mockNext)

            expect(mockEntitlementValidator.checkVoiceAccess).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'user123' })
            )
            expect(mockNext).toHaveBeenCalled()
            expect(await response.text()).toBe('success')
        })

        it('should deny access without voice pack', async () => {
            const middleware = createVoiceAccessMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn()

            mockEntitlementValidator.checkVoiceAccess.mockResolvedValue(false)

            const response = await middleware(mockRequest, mockNext)
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.error).toContain('Voice Pack subscription required')
            expect(mockNext).not.toHaveBeenCalled()
        })
    })

    describe('createQuotaCheckMiddleware', () => {
        it('should allow generation within quota', async () => {
            const middleware = createQuotaCheckMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn().mockResolvedValue(new Response('success'))

            mockEntitlementValidator.checkMessageGenerationQuota.mockResolvedValue({
                canGenerate: true,
                remainingMessages: 5,
                cooldownEndsAt: new Date(Date.now() + 30000)
            })

            const response = await middleware(mockRequest, mockNext)

            expect(mockEntitlementValidator.checkMessageGenerationQuota).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'user123' })
            )
            expect(mockNext).toHaveBeenCalled()
            expect(await response.text()).toBe('success')
        })

        it('should deny generation when quota exceeded', async () => {
            const middleware = createQuotaCheckMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn()

            const cooldownEndsAt = new Date(Date.now() + 3600000) // 1 hour from now
            mockEntitlementValidator.checkMessageGenerationQuota.mockResolvedValue({
                canGenerate: false,
                remainingMessages: 0,
                cooldownEndsAt
            })

            const response = await middleware(mockRequest, mockNext)
            const data = await response.json()

            expect(response.status).toBe(429)
            expect(data.error).toContain('Message generation quota exceeded')
            expect(data.remainingMessages).toBe(0)
            expect(data.cooldownEndsAt).toBe(cooldownEndsAt.toISOString())
            expect(response.headers.get('Retry-After')).toBeTruthy()
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('should include upgrade message for free users', async () => {
            const middleware = createQuotaCheckMiddleware(config)
            const mockRequest = new Request('http://localhost/test', {
                headers: { 'x-user-id': 'user123' }
            })
            const mockNext = vi.fn()

            mockEntitlementValidator.checkMessageGenerationQuota.mockResolvedValue({
                canGenerate: false,
                remainingMessages: 0,
                cooldownEndsAt: new Date(Date.now() + 86400000)
            })

            const response = await middleware(mockRequest, mockNext)
            const data = await response.json()

            expect(response.status).toBe(429)
            expect(data.upgradeMessage).toContain('Upgrade to Premium Core')
            expect(mockNext).not.toHaveBeenCalled()
        })
    })

    describe('getUserEntitlements', () => {
        it('should return user entitlements for premium user', async () => {
            const entitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(entitlements)

            const result = await getUserEntitlements(config, 'user123')

            expect(result.entitlements).toEqual(entitlements)
            expect(result.hasPremiumCore).toBe(true)
            expect(result.hasVoicePack).toBe(false)
            expect(result.subscriptionTier).toBe('premium_core')
        })

        it('should return user entitlements for voice pack user', async () => {
            const entitlements: Entitlement[] = [{
                type: 'voice_pack',
                expiresAt: new Date(Date.now() + 86400000),
                platform: 'web',
                isActive: true
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(entitlements)

            const result = await getUserEntitlements(config, 'user123')

            expect(result.entitlements).toEqual(entitlements)
            expect(result.hasPremiumCore).toBe(false)
            expect(result.hasVoicePack).toBe(true)
            expect(result.subscriptionTier).toBe('voice_pack')
        })

        it('should return default values for free user', async () => {
            mockPaymentService.validateEntitlements.mockResolvedValue([])

            const result = await getUserEntitlements(config, 'user123')

            expect(result.entitlements).toEqual([])
            expect(result.hasPremiumCore).toBe(false)
            expect(result.hasVoicePack).toBe(false)
            expect(result.subscriptionTier).toBe('free')
        })

        it('should handle validation errors gracefully', async () => {
            mockPaymentService.validateEntitlements.mockRejectedValue(new Error('Service error'))

            const result = await getUserEntitlements(config, 'user123')

            expect(result.entitlements).toEqual([])
            expect(result.hasPremiumCore).toBe(false)
            expect(result.hasVoicePack).toBe(false)
            expect(result.subscriptionTier).toBe('free')
        })

        it('should handle expired entitlements', async () => {
            const entitlements: Entitlement[] = [{
                type: 'premium_core',
                expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
                platform: 'web',
                isActive: false
            }]

            mockPaymentService.validateEntitlements.mockResolvedValue(entitlements)

            const result = await getUserEntitlements(config, 'user123')

            expect(result.entitlements).toEqual(entitlements)
            expect(result.hasPremiumCore).toBe(false)
            expect(result.hasVoicePack).toBe(false)
            expect(result.subscriptionTier).toBe('free')
        })
    })
})