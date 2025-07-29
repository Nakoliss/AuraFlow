import {
    Entitlement,
    SubscriptionRequest,
    SubscriptionResult,
    PaymentWebhook,
    Platform,
    EntitlementType
} from '../types'
import { RevenueCatService } from './revenuecat-service'
import { StripeService } from './stripe-service'
import { logger } from '../logging'
import { AppError, ErrorCode } from '../errors'

export interface PaymentServiceConfig {
    revenueCat: {
        apiKey: string
        environment: 'sandbox' | 'production'
    }
    stripe: {
        secretKey: string
        webhookSecret: string
        environment: 'test' | 'live'
    }
}

export class PaymentService {
    private revenueCatService: RevenueCatService
    private stripeService: StripeService

    constructor(private config: PaymentServiceConfig) {
        this.revenueCatService = new RevenueCatService(config.revenueCat)
        this.stripeService = new StripeService(config.stripe)
    }

    async processSubscription(request: SubscriptionRequest): Promise<SubscriptionResult> {
        try {
            logger.info('Processing subscription request', {
                userId: request.userId,
                platform: request.platform,
                planId: request.planId
            })

            if (request.platform === 'web') {
                return await this.stripeService.createSubscription(request)
            } else {
                // Mobile platforms use RevenueCat
                return await this.revenueCatService.processSubscription(request)
            }
        } catch (error) {
            logger.error('Failed to process subscription', { error, request })
            throw new AppError(
                'Failed to process subscription',
                ErrorCode.PAYMENT_PROCESSING_ERROR,
                { originalError: error }
            )
        }
    }

    async validateEntitlements(userId: string): Promise<Entitlement[]> {
        try {
            logger.debug('Validating entitlements', { userId })

            // Get entitlements from both services and merge
            const [revenueCatEntitlements, stripeEntitlements] = await Promise.allSettled([
                this.revenueCatService.getEntitlements(userId),
                this.stripeService.getEntitlements(userId)
            ])

            const entitlements: Entitlement[] = []

            if (revenueCatEntitlements.status === 'fulfilled') {
                entitlements.push(...revenueCatEntitlements.value)
            } else {
                logger.warn('Failed to get RevenueCat entitlements', {
                    userId,
                    error: revenueCatEntitlements.reason
                })
            }

            if (stripeEntitlements.status === 'fulfilled') {
                entitlements.push(...stripeEntitlements.value)
            } else {
                logger.warn('Failed to get Stripe entitlements', {
                    userId,
                    error: stripeEntitlements.reason
                })
            }

            // Remove duplicates and keep the most recent expiration
            const mergedEntitlements = this.mergeEntitlements(entitlements)

            logger.debug('Entitlements validated', {
                userId,
                entitlementCount: mergedEntitlements.length
            })

            return mergedEntitlements
        } catch (error) {
            logger.error('Failed to validate entitlements', { error, userId })
            throw new AppError(
                'Failed to validate entitlements',
                ErrorCode.ENTITLEMENT_VALIDATION_ERROR,
                { userId, originalError: error }
            )
        }
    }

    async handleWebhook(webhook: PaymentWebhook): Promise<void> {
        try {
            logger.info('Processing payment webhook', {
                type: webhook.type,
                event: webhook.event
            })

            if (webhook.type === 'revenuecat') {
                await this.revenueCatService.handleWebhook(webhook)
            } else if (webhook.type === 'stripe') {
                await this.stripeService.handleWebhook(webhook)
            } else {
                throw new AppError(
                    `Unknown webhook type: ${webhook.type}`,
                    ErrorCode.INVALID_WEBHOOK_TYPE
                )
            }

            logger.info('Webhook processed successfully', {
                type: webhook.type,
                event: webhook.event
            })
        } catch (error) {
            logger.error('Failed to process webhook', { error, webhook })
            throw new AppError(
                'Failed to process webhook',
                ErrorCode.WEBHOOK_PROCESSING_ERROR,
                { webhook, originalError: error }
            )
        }
    }

    async syncRevenueCat(userId: string): Promise<void> {
        try {
            logger.info('Syncing RevenueCat data', { userId })
            await this.revenueCatService.syncSubscriberData(userId)
            logger.info('RevenueCat sync completed', { userId })
        } catch (error) {
            logger.error('Failed to sync RevenueCat data', { error, userId })
            throw new AppError(
                'Failed to sync RevenueCat data',
                ErrorCode.REVENUECAT_SYNC_ERROR,
                { userId, originalError: error }
            )
        }
    }

    async hasEntitlement(userId: string, entitlementType: EntitlementType): Promise<boolean> {
        try {
            const entitlements = await this.validateEntitlements(userId)
            const entitlement = entitlements.find(e => e.type === entitlementType)

            if (!entitlement) {
                return false
            }

            const isActive = entitlement.isActive && entitlement.expiresAt > new Date()

            logger.debug('Entitlement check result', {
                userId,
                entitlementType,
                isActive,
                expiresAt: entitlement.expiresAt
            })

            return isActive
        } catch (error) {
            logger.error('Failed to check entitlement', { error, userId, entitlementType })
            // Default to false on error to prevent unauthorized access
            return false
        }
    }

    private mergeEntitlements(entitlements: Entitlement[]): Entitlement[] {
        const entitlementMap = new Map<EntitlementType, Entitlement>()

        for (const entitlement of entitlements) {
            const existing = entitlementMap.get(entitlement.type)

            if (!existing || entitlement.expiresAt > existing.expiresAt) {
                entitlementMap.set(entitlement.type, entitlement)
            }
        }

        return Array.from(entitlementMap.values())
    }
}