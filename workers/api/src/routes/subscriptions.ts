import {
    PaymentService,
    PaymentServiceConfig,
    EntitlementValidator,
    SubscriptionRequest,
    PaymentWebhook,
    RevenueCatWebhookData,
    StripeWebhookData,
    logger,
    AppError,
    ErrorCode,
    validateSchema,
    z
} from '@aura-flow/common'

// Validation schemas
const subscriptionRequestSchema = z.object({
    planId: z.enum(['premium_core', 'voice_pack']),
    platform: z.enum(['ios', 'android', 'web']),
    priceId: z.string().optional()
})

const webhookSchema = z.object({
    type: z.enum(['revenuecat', 'stripe']),
    data: z.any(),
    timestamp: z.string().optional()
})

// Initialize payment service
const paymentConfig: PaymentServiceConfig = {
    revenueCat: {
        apiKey: process.env.REVENUECAT_API_KEY || '',
        environment: (process.env.REVENUECAT_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
    },
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        environment: (process.env.STRIPE_ENVIRONMENT as 'test' | 'live') || 'test'
    }
}

const paymentService = new PaymentService(paymentConfig)
const entitlementValidator = new EntitlementValidator(paymentService)

/**
 * POST /subscriptions/create
 * Create a new subscription
 */
export async function createSubscription(request: Request): Promise<Response> {
    try {
        // Extract user ID from auth token (assuming middleware sets this)
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID not found', ErrorCode.AUTHENTICATION_ERROR)
        }

        const body = await request.json()
        const validatedData = validateSchema(subscriptionRequestSchema, body)

        const subscriptionRequest: SubscriptionRequest = {
            userId,
            planId: validatedData.planId,
            platform: validatedData.platform,
            priceId: validatedData.priceId
        }

        logger.info('Creating subscription', {
            userId,
            planId: validatedData.planId,
            platform: validatedData.platform
        })

        const result = await paymentService.processSubscription(subscriptionRequest)

        if (result.success) {
            logger.info('Subscription created successfully', {
                userId,
                subscriptionId: result.subscriptionId
            })

            return new Response(JSON.stringify({
                success: true,
                subscriptionId: result.subscriptionId,
                entitlements: result.entitlements
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        } else {
            logger.error('Subscription creation failed', { userId, error: result.error })

            return new Response(JSON.stringify({
                success: false,
                error: result.error || 'Failed to create subscription'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }
    } catch (error) {
        logger.error('Subscription creation error', { error })

        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                success: false,
                error: error.message,
                code: error.code
            }), {
                status: error.statusCode,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * GET /subscriptions/status
 * Get current subscription status and entitlements
 */
export async function getSubscriptionStatus(request: Request): Promise<Response> {
    try {
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID not found', ErrorCode.AUTHENTICATION_ERROR)
        }

        logger.debug('Fetching subscription status', { userId })

        const entitlements = await paymentService.validateEntitlements(userId)

        // Determine current subscription tier based on entitlements
        const hasPremiumCore = entitlements.some(e =>
            e.type === 'premium_core' && e.isActive && e.expiresAt > new Date()
        )
        const hasVoicePack = entitlements.some(e =>
            e.type === 'voice_pack' && e.isActive && e.expiresAt > new Date()
        )

        const subscriptionTier = hasVoicePack ? 'voice_pack' :
            hasPremiumCore ? 'premium_core' : 'free'

        const response = {
            userId,
            subscriptionTier,
            entitlements: entitlements.map(e => ({
                type: e.type,
                platform: e.platform,
                expiresAt: e.expiresAt.toISOString(),
                isActive: e.isActive
            })),
            capabilities: {
                dailyMessageLimit: hasPremiumCore ? 20 : 1,
                availableCategories: hasPremiumCore ?
                    ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity'] :
                    ['motivational', 'philosophy'],
                hasVoiceAccess: hasVoicePack,
                cooldownSeconds: hasPremiumCore ? 30 : 0
            }
        }

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        logger.error('Failed to get subscription status', { error })

        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                error: error.message,
                code: error.code
            }), {
                status: error.statusCode,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            error: 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * POST /subscriptions/sync
 * Sync subscription data with RevenueCat
 */
export async function syncSubscription(request: Request): Promise<Response> {
    try {
        const userId = request.headers.get('x-user-id')
        if (!userId) {
            throw new AppError('User ID not found', ErrorCode.AUTHENTICATION_ERROR)
        }

        logger.info('Syncing subscription data', { userId })

        await paymentService.syncRevenueCat(userId)

        return new Response(JSON.stringify({
            success: true,
            message: 'Subscription data synced successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        logger.error('Failed to sync subscription', { error })

        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                success: false,
                error: error.message,
                code: error.code
            }), {
                status: error.statusCode,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * POST /webhooks/revenuecat
 * Handle RevenueCat webhook events
 */
export async function handleRevenueCatWebhook(request: Request): Promise<Response> {
    try {
        const body = await request.text()
        const data = JSON.parse(body) as RevenueCatWebhookData

        logger.info('Received RevenueCat webhook', {
            eventType: data.event.type,
            userId: data.event.app_user_id
        })

        const webhook: PaymentWebhook = {
            type: 'revenuecat',
            event: data.event.type,
            data,
            timestamp: new Date(data.event.event_timestamp_ms)
        }

        await paymentService.handleWebhook(webhook)

        return new Response(JSON.stringify({
            success: true,
            message: 'Webhook processed successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        logger.error('Failed to process RevenueCat webhook', { error })

        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to process webhook'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
    try {
        const body = await request.text()
        const signature = request.headers.get('stripe-signature')

        if (!signature) {
            throw new AppError('Missing Stripe signature', ErrorCode.WEBHOOK_ERROR)
        }

        // In a real implementation, you would verify the webhook signature here
        // For now, we'll just parse the body
        const data = JSON.parse(body) as StripeWebhookData

        logger.info('Received Stripe webhook', {
            eventType: data.type,
            eventId: data.id
        })

        const webhook: PaymentWebhook = {
            type: 'stripe',
            event: data.type,
            data,
            timestamp: new Date(data.created * 1000)
        }

        await paymentService.handleWebhook(webhook)

        return new Response(JSON.stringify({
            success: true,
            message: 'Webhook processed successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        logger.error('Failed to process Stripe webhook', { error })

        if (error instanceof AppError) {
            return new Response(JSON.stringify({
                success: false,
                error: error.message,
                code: error.code
            }), {
                status: error.statusCode,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to process webhook'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * GET /subscriptions/plans
 * Get available subscription plans
 */
export async function getSubscriptionPlans(request: Request): Promise<Response> {
    try {
        const plans = [
            {
                id: 'premium_core',
                name: 'Premium Core',
                description: 'Full access to all message categories',
                price: '$4.99/month',
                features: [
                    '20 messages per day',
                    'All 5 message categories',
                    '30-second cooldown between messages',
                    'Time and weather context',
                    'Message history and favorites'
                ],
                stripePriceId: process.env.STRIPE_PREMIUM_CORE_PRICE_ID,
                revenueCatProductId: 'premium_core_monthly'
            },
            {
                id: 'voice_pack',
                name: 'Voice Pack',
                description: 'Premium Core + voice features',
                price: '$5.98/month',
                features: [
                    'All Premium Core features',
                    'Text-to-speech with 5 voice options',
                    'Audio message playback',
                    'Micro-meditations'
                ],
                stripePriceId: process.env.STRIPE_VOICE_PACK_PRICE_ID,
                revenueCatProductId: 'voice_pack_monthly'
            }
        ]

        return new Response(JSON.stringify({
            plans
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        logger.error('Failed to get subscription plans', { error })

        return new Response(JSON.stringify({
            error: 'Failed to get subscription plans'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}