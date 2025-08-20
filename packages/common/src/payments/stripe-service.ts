import {
    Entitlement,
    SubscriptionRequest,
    SubscriptionResult,
    PaymentWebhook,
    StripeWebhookData,
    Platform,
    EntitlementType
} from '../types'
import { createLogger } from '../logging'

const logger = createLogger('stripe-service')
import { AppError, ErrorCode } from '../errors'

export interface StripeConfig {
    secretKey: string
    webhookSecret: string
    environment: 'test' | 'live'
}

interface StripeSubscription {
    id: string
    object: 'subscription'
    status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing'
    current_period_end: number
    current_period_start: number
    customer: string
    items: {
        data: Array<{
            id: string
            price: {
                id: string
                product: string
                nickname?: string
            }
        }>
    }
    metadata: Record<string, string>
}

interface StripeCustomer {
    id: string
    email: string
    metadata: Record<string, string>
    subscriptions: {
        data: StripeSubscription[]
    }
}

export class StripeService {
    private baseUrl: string
    private headers: Record<string, string>

    constructor(private config: StripeConfig) {
        this.baseUrl = 'https://api.stripe.com/v1'
        this.headers = {
            'Authorization': `Bearer ${config.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Stripe-Version': '2023-10-16'
        }
    }

    async createSubscription(request: SubscriptionRequest): Promise<SubscriptionResult> {
        try {
            logger.info('Creating Stripe subscription', {
                userId: request.userId,
                planId: request.planId,
                priceId: request.priceId
            })

            // First, find or create customer
            const customer = await this.findOrCreateCustomer(request.userId)

            // Create subscription
            const subscriptionData = new URLSearchParams({
                customer: customer.id,
                'items[0][price]': request.priceId || this.mapPlanToPrice(request.planId),
                'payment_behavior': 'default_incomplete',
                'payment_settings[save_default_payment_method]': 'on_subscription',
                'expand[]': 'latest_invoice.payment_intent',
                'metadata[user_id]': request.userId,
                'metadata[plan_id]': request.planId
            })

            const response = await fetch(`${this.baseUrl}/subscriptions`, {
                method: 'POST',
                headers: this.headers,
                body: subscriptionData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(`Stripe API error: ${error.error?.message || response.statusText}`)
            }

            const subscription: StripeSubscription = await response.json()
            const entitlements = this.mapSubscriptionToEntitlements(subscription)

            logger.info('Stripe subscription created', {
                userId: request.userId,
                subscriptionId: subscription.id
            })

            return {
                success: true,
                subscriptionId: subscription.id,
                entitlements
            }
        } catch (error) {
            logger.error('Failed to create Stripe subscription', { error, request })
            return {
                success: false,
                entitlements: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    async getEntitlements(userId: string): Promise<Entitlement[]> {
        try {
            logger.debug('Fetching Stripe entitlements', { userId })

            const customer = await this.findCustomerByUserId(userId)
            if (!customer) {
                logger.debug('Customer not found in Stripe', { userId })
                return []
            }

            const entitlements: Entitlement[] = []

            // Get active subscriptions
            const subscriptionsResponse = await fetch(
                `${this.baseUrl}/subscriptions?customer=${customer.id}&status=active&expand[]=data.items.data.price.product`,
                {
                    method: 'GET',
                    headers: this.headers
                }
            )

            if (!subscriptionsResponse.ok) {
                throw new Error(`Stripe API error: ${subscriptionsResponse.statusText}`)
            }

            const subscriptionsData = await subscriptionsResponse.json()

            for (const subscription of subscriptionsData.data) {
                const subscriptionEntitlements = this.mapSubscriptionToEntitlements(subscription)
                entitlements.push(...subscriptionEntitlements)
            }

            logger.debug('Stripe entitlements fetched', {
                userId,
                entitlementCount: entitlements.length
            })

            return entitlements
        } catch (error) {
            logger.error('Failed to fetch Stripe entitlements', { error, userId })
            throw new AppError(
                'Failed to fetch Stripe entitlements',
                ErrorCode.STRIPE_API_ERROR,
                { userId, originalError: error }
            )
        }
    }

    async handleWebhook(webhook: PaymentWebhook): Promise<void> {
        try {
            const data = webhook.data as StripeWebhookData

            logger.info('Processing Stripe webhook', {
                eventType: data.type,
                eventId: data.id
            })

            switch (data.type) {
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    await this.handleSubscriptionChange(data.data.object)
                    break

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionCancellation(data.data.object)
                    break

                case 'invoice.payment_succeeded':
                    await this.handlePaymentSuccess(data.data.object)
                    break

                case 'invoice.payment_failed':
                    await this.handlePaymentFailure(data.data.object)
                    break

                default:
                    logger.warn('Unhandled Stripe webhook event', { eventType: data.type })
            }
        } catch (error) {
            logger.error('Failed to process Stripe webhook', { error, webhook })
            throw error
        }
    }

    private async findOrCreateCustomer(userId: string): Promise<StripeCustomer> {
        // First try to find existing customer
        const existingCustomer = await this.findCustomerByUserId(userId)
        if (existingCustomer) {
            return existingCustomer
        }

        // Create new customer
        const customerData = new URLSearchParams({
            'metadata[user_id]': userId
        })

        const response = await fetch(`${this.baseUrl}/customers`, {
            method: 'POST',
            headers: this.headers,
            body: customerData
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Failed to create Stripe customer: ${error.error?.message}`)
        }

        return await response.json()
    }

    private async findCustomerByUserId(userId: string): Promise<StripeCustomer | null> {
        const response = await fetch(
            `${this.baseUrl}/customers/search?query=metadata['user_id']:'${userId}'`,
            {
                method: 'GET',
                headers: this.headers
            }
        )

        if (!response.ok) {
            throw new Error(`Failed to search Stripe customers: ${response.statusText}`)
        }

        const data = await response.json()
        return data.data.length > 0 ? data.data[0] : null
    }

    private mapPlanToPrice(planId: string): string {
        // Map internal plan IDs to Stripe price IDs
        const priceMap: Record<string, string> = {
            'premium_core': process.env.STRIPE_PREMIUM_CORE_PRICE_ID || 'price_premium_core',
            'voice_pack': process.env.STRIPE_VOICE_PACK_PRICE_ID || 'price_voice_pack'
        }

        return priceMap[planId] || planId
    }

    private mapSubscriptionToEntitlements(subscription: StripeSubscription): Entitlement[] {
        const entitlements: Entitlement[] = []
        const expiresAt = new Date(subscription.current_period_end * 1000)
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'

        for (const item of subscription.items.data) {
            const entitlementType = this.mapPriceToEntitlementType(item.price.id)
            if (entitlementType) {
                entitlements.push({
                    type: entitlementType,
                    expiresAt,
                    platform: 'ios', // Default to iOS for mobile-only app
                    isActive
                })
            }
        }

        return entitlements
    }

    private mapPriceToEntitlementType(priceId: string): EntitlementType | null {
        // Map Stripe price IDs to our internal entitlement types
        if (priceId.includes('premium') || priceId.includes('core')) {
            return 'premium_core'
        }
        if (priceId.includes('voice')) {
            return 'voice_pack'
        }

        logger.warn('Unknown price ID', { priceId })
        return null
    }

    private async handleSubscriptionChange(subscription: any): Promise<void> {
        const userId = subscription.metadata?.user_id
        if (!userId) {
            logger.warn('Subscription webhook missing user_id', { subscriptionId: subscription.id })
            return
        }

        logger.info('Handling subscription change', {
            userId,
            subscriptionId: subscription.id,
            status: subscription.status
        })

        // Update user subscription status in database
        // This would typically involve updating the users table
    }

    private async handleSubscriptionCancellation(subscription: any): Promise<void> {
        const userId = subscription.metadata?.user_id
        if (!userId) {
            logger.warn('Subscription cancellation webhook missing user_id', { subscriptionId: subscription.id })
            return
        }

        logger.info('Handling subscription cancellation', {
            userId,
            subscriptionId: subscription.id
        })

        // Update user subscription status in database
    }

    private async handlePaymentSuccess(invoice: any): Promise<void> {
        logger.info('Payment succeeded', {
            invoiceId: invoice.id,
            customerId: invoice.customer
        })

        // Handle successful payment - could trigger notifications or unlock features
    }

    private async handlePaymentFailure(invoice: any): Promise<void> {
        logger.warn('Payment failed', {
            invoiceId: invoice.id,
            customerId: invoice.customer
        })

        // Handle failed payment - could trigger retry logic or notifications
    }
}