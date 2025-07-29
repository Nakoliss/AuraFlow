import {
    Entitlement,
    SubscriptionRequest,
    SubscriptionResult,
    PaymentWebhook,
    RevenueCatWebhookData,
    Platform,
    EntitlementType
} from '../types'
import { createLogger } from '../logging'

const logger = createLogger('revenuecat-service')
import { AppError, ErrorCode } from '../errors'

export interface RevenueCatConfig {
    apiKey: string
    environment: 'sandbox' | 'production'
}

interface RevenueCatSubscriber {
    request_date: string
    request_date_ms: number
    subscriber: {
        entitlements: Record<string, {
            expires_date: string | null
            grace_period_expires_date: string | null
            product_identifier: string
            purchase_date: string
        }>
        first_seen: string
        last_seen: string
        management_url: string | null
        non_subscriptions: Record<string, any>
        original_app_user_id: string
        original_application_version: string | null
        original_purchase_date: string | null
        other_purchases: Record<string, any>
        subscriptions: Record<string, {
            auto_resume_date: string | null
            billing_issues_detected_at: string | null
            expires_date: string
            grace_period_expires_date: string | null
            is_sandbox: boolean
            original_purchase_date: string
            ownership_type: string
            period_type: string
            purchase_date: string
            refunded_at: string | null
            store: string
            unsubscribe_detected_at: string | null
        }>
    }
}

export class RevenueCatService {
    private baseUrl: string
    private headers: Record<string, string>

    constructor(private config: RevenueCatConfig) {
        this.baseUrl = 'https://api.revenuecat.com/v1'
        this.headers = {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'X-Platform': 'server'
        }
    }

    async processSubscription(request: SubscriptionRequest): Promise<SubscriptionResult> {
        try {
            logger.info('Processing RevenueCat subscription', {
                userId: request.userId,
                planId: request.planId,
                platform: request.platform
            })

            // For RevenueCat, the actual purchase happens on the client side
            // This method validates the subscription and returns current entitlements
            const entitlements = await this.getEntitlements(request.userId)

            return {
                success: true,
                entitlements,
                subscriptionId: `rc_${request.userId}_${Date.now()}`
            }
        } catch (error) {
            logger.error('Failed to process RevenueCat subscription', { error, request })
            return {
                success: false,
                entitlements: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    async getEntitlements(userId: string): Promise<Entitlement[]> {
        try {
            logger.debug('Fetching RevenueCat entitlements', { userId })

            const response = await fetch(`${this.baseUrl}/subscribers/${userId}`, {
                method: 'GET',
                headers: this.headers
            })

            if (!response.ok) {
                if (response.status === 404) {
                    // User not found in RevenueCat, return empty entitlements
                    logger.debug('User not found in RevenueCat', { userId })
                    return []
                }
                throw new Error(`RevenueCat API error: ${response.status} ${response.statusText}`)
            }

            const data: RevenueCatSubscriber = await response.json()
            const entitlements: Entitlement[] = []

            // Process entitlements
            for (const [entitlementId, entitlement] of Object.entries(data.subscriber.entitlements)) {
                const entitlementType = this.mapEntitlementType(entitlementId)
                if (!entitlementType) continue

                const expiresAt = entitlement.expires_date
                    ? new Date(entitlement.expires_date)
                    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now for lifetime

                const isActive = !entitlement.expires_date || expiresAt > new Date()

                entitlements.push({
                    type: entitlementType,
                    expiresAt,
                    platform: this.determinePlatform(data.subscriber.subscriptions),
                    isActive
                })
            }

            logger.debug('RevenueCat entitlements fetched', {
                userId,
                entitlementCount: entitlements.length
            })

            return entitlements
        } catch (error) {
            logger.error('Failed to fetch RevenueCat entitlements', { error, userId })
            throw new AppError(
                'Failed to fetch RevenueCat entitlements',
                ErrorCode.REVENUECAT_API_ERROR,
                { userId, originalError: error }
            )
        }
    }

    async handleWebhook(webhook: PaymentWebhook): Promise<void> {
        try {
            const data = webhook.data as RevenueCatWebhookData
            const event = data.event

            logger.info('Processing RevenueCat webhook', {
                eventType: event.type,
                userId: event.app_user_id,
                productId: event.product_id
            })

            switch (event.type) {
                case 'INITIAL_PURCHASE':
                case 'RENEWAL':
                case 'PRODUCT_CHANGE':
                    await this.handleSubscriptionActivation(event)
                    break

                case 'CANCELLATION':
                case 'EXPIRATION':
                    await this.handleSubscriptionDeactivation(event)
                    break

                case 'BILLING_ISSUE':
                    await this.handleBillingIssue(event)
                    break

                default:
                    logger.warn('Unhandled RevenueCat webhook event', { eventType: event.type })
            }
        } catch (error) {
            logger.error('Failed to process RevenueCat webhook', { error, webhook })
            throw error
        }
    }

    async syncSubscriberData(userId: string): Promise<void> {
        try {
            logger.info('Syncing RevenueCat subscriber data', { userId })

            // Fetch latest subscriber data
            const entitlements = await this.getEntitlements(userId)

            // Update user subscription status in database
            // This would typically update the users table with current subscription status
            logger.info('RevenueCat subscriber data synced', {
                userId,
                entitlementCount: entitlements.length
            })
        } catch (error) {
            logger.error('Failed to sync RevenueCat subscriber data', { error, userId })
            throw error
        }
    }

    private mapEntitlementType(entitlementId: string): EntitlementType | null {
        // Map RevenueCat entitlement IDs to our internal types
        switch (entitlementId.toLowerCase()) {
            case 'premium_core':
            case 'premium':
                return 'premium_core'
            case 'voice_pack':
            case 'voice':
                return 'voice_pack'
            default:
                logger.warn('Unknown entitlement type', { entitlementId })
                return null
        }
    }

    private determinePlatform(subscriptions: Record<string, any>): Platform {
        // Determine platform based on subscription store
        for (const subscription of Object.values(subscriptions)) {
            if (subscription.store === 'APP_STORE') return 'ios'
            if (subscription.store === 'PLAY_STORE') return 'android'
        }
        return 'ios' // Default fallback
    }

    private async handleSubscriptionActivation(event: RevenueCatWebhookData['event']): Promise<void> {
        logger.info('Handling subscription activation', {
            userId: event.app_user_id,
            productId: event.product_id
        })

        // Update user subscription status in database
        // This would typically involve updating the users table
        // with new subscription status and expiration dates
    }

    private async handleSubscriptionDeactivation(event: RevenueCatWebhookData['event']): Promise<void> {
        logger.info('Handling subscription deactivation', {
            userId: event.app_user_id,
            productId: event.product_id
        })

        // Update user subscription status in database
        // Mark subscription as expired or cancelled
    }

    private async handleBillingIssue(event: RevenueCatWebhookData['event']): Promise<void> {
        logger.warn('Billing issue detected', {
            userId: event.app_user_id,
            productId: event.product_id
        })

        // Handle billing issues - could trigger notifications or grace period logic
    }
}