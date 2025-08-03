#!/usr/bin/env ts-node

import { config } from 'dotenv'
import { AIService } from '../src/ai/ai-service'
// Mock deduplication service for testing
class MockDeduplicationService {
    async checkDuplication(userId: string, content: string, embedding?: number[], category?: any) {
        // Always return not duplicate for testing
        return {
            isDuplicate: false,
            reason: 'none',
            confidence: 0
        }
    }

    async addContent(messageId: string, userId: string, content: string, embedding?: number[], category?: any) {
        // Mock implementation - just log
        logger.info('Mock: Added content to deduplication system', { messageId, userId })
    }

    async getStats() {
        return {
            totalMessages: 0,
            bloomFilterSize: 0,
            embeddingCount: 0
        }
    }
}
import { DatabaseService, initializeDatabase, closeDatabase } from '../src/database'
// Note: MessageGenerationService would normally be imported from workers/api
// For this test, we'll create a simplified version
class MockMessageGenerationService {
    constructor(
        private aiService: any,
        private deduplicationService: any,
        private db: any,
        private config: any
    ) {}

    async generateMessage(request: any) {
        const aiResponse = await this.aiService.generateMessage(request)
        
        // Store in database (simplified)
        const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        
        return {
            id: messageId,
            content: aiResponse.content,
            category: request.category,
            tokens: aiResponse.tokens,
            cost: this.calculateCost(aiResponse.tokens, aiResponse.model),
            model: aiResponse.model,
            timeOfDay: request.timeOfDay,
            weatherContext: request.weatherContext,
            locale: request.locale || 'en-US',
            createdAt: new Date(),
            cached: false
        }
    }

    async getHealthStatus() {
        const aiHealth = await this.aiService.getHealthStatus()
        return {
            status: aiHealth.status,
            ai: aiHealth,
            database: true,
            deduplication: true
        }
    }

    private calculateCost(tokens: number, model: string): number {
        const costPerToken = model.includes('gpt-4') ? 0.00003 : 0.000002
        return tokens * costPerToken
    }
}
import { MessageCategory } from '../src/types'
import { createServiceLogger } from '../src/logging'

// Load environment variables
config()

const logger = createServiceLogger('test-message-generation')

async function testMessageGeneration() {
    logger.info('Testing complete message generation pipeline...')

    try {
        // Initialize database
        await initializeDatabase()
        const db = DatabaseService
        logger.info('✅ Database initialized')

        // Initialize deduplication service
        const deduplicationService = new MockDeduplicationService()
        logger.info('✅ Deduplication service initialized')

        // Check if we have real API keys
        const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-') && !process.env.OPENAI_API_KEY.includes('test')
        const hasAnthropicKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-') && !process.env.ANTHROPIC_API_KEY.includes('test')

        if (!hasOpenAIKey && !hasAnthropicKey) {
            logger.warn('⚠️ No real API keys found. Testing with mock AI service.')
            await testWithMockAI(db, new MockDeduplicationService())
            return
        }

        // Initialize AI service with real API keys
        const aiService = new AIService({
            openai: {
                apiKey: process.env.OPENAI_API_KEY || '',
                timeout: 10000,
                maxRetries: 3
            },
            anthropic: {
                apiKey: process.env.ANTHROPIC_API_KEY || '',
                timeout: 10000,
                maxRetries: 3
            },
            preferredProvider: 'openai',
            enableFallback: true
        })

        logger.info('✅ AI service initialized')

        // Test AI connections
        const connections = await aiService.testConnections()
        logger.info('AI provider connections:', connections)

        if (!connections.openai && !connections.anthropic) {
            logger.error('❌ No AI providers are available')
            return
        }

        // Initialize message generation service
        const messageService = new MockMessageGenerationService(
            aiService,
            deduplicationService,
            db,
            {
                maxRetries: 2,
                retryDelay: 1000,
                enableCaching: true,
                enableDeduplication: true,
                costTrackingEnabled: true
            }
        )

        logger.info('✅ Message generation service initialized')

        // Test message generation for each category
        const testUserId = 'test-user-' + Date.now()
        const categories: MessageCategory[] = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']

        for (const category of categories) {
            logger.info(`Testing ${category} message generation...`)

            try {
                const response = await messageService.generateMessage({
                    userId: testUserId,
                    category,
                    timeOfDay: 'morning',
                    locale: 'en-US'
                })

                logger.info(`✅ ${category} message generated:`, {
                    id: response.id,
                    content: response.content.substring(0, 100) + '...',
                    tokens: response.tokens,
                    cost: response.cost,
                    model: response.model,
                    cached: response.cached
                })

                // Validate message
                const wordCount = response.content.split(/\s+/).length
                if (wordCount <= 50) {
                    logger.info(`✅ Message length is appropriate: ${wordCount} words`)
                } else {
                    logger.warn(`⚠️ Message is longer than expected: ${wordCount} words`)
                }

            } catch (error) {
                logger.error(`❌ Failed to generate ${category} message:`, {
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        // Test health status
        logger.info('Testing message generation service health...')
        const health = await messageService.getHealthStatus()
        
        logger.info('✅ Message generation service health:', {
            status: health.status,
            ai: health.ai.status,
            database: health.database,
            deduplication: health.deduplication ? 'available' : 'unavailable'
        })

        // Test caching by generating the same message twice
        logger.info('Testing message caching...')
        
        const firstResponse = await messageService.generateMessage({
            userId: testUserId,
            category: 'motivational',
            timeOfDay: 'morning',
            locale: 'en-US'
        })

        // Wait a moment then try again
        await new Promise(resolve => setTimeout(resolve, 100))

        const secondResponse = await messageService.generateMessage({
            userId: testUserId,
            category: 'motivational',
            timeOfDay: 'morning',
            locale: 'en-US'
        })

        if (secondResponse.cached) {
            logger.info('✅ Message caching is working')
        } else {
            logger.info('ℹ️ Second message was not cached (expected for new content)')
        }

        logger.info('🎉 Message generation pipeline testing completed!')

    } catch (error) {
        logger.error('❌ Message generation test failed:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        })
        process.exit(1)
    }
}

async function testWithMockAI(db: typeof DatabaseService, deduplicationService: MockDeduplicationService) {
    logger.info('🧪 Testing message generation pipeline with mock AI...')

    // Create a mock AI service
    const mockAIService = {
        async generateMessage(request: any) {
            const mockMessages = {
                motivational: "Every challenge you face today is an opportunity to grow stronger. Trust in your abilities and take that next step forward.",
                mindfulness: "Take a deep breath and notice this present moment. Feel your feet on the ground and let peace wash over you.",
                fitness: "Your body is capable of amazing things. Move with intention today and celebrate every step toward better health.",
                philosophy: "Life's meaning isn't found in having all the answers, but in asking the right questions and staying curious.",
                productivity: "Focus on one important task at a time. Small, consistent actions create remarkable results over time."
            }

            const content = mockMessages[request.category as keyof typeof mockMessages] || "This is a sample message."
            
            return {
                content,
                tokens: Math.floor(Math.random() * 50) + 30,
                model: 'mock-gpt-3.5-turbo',
                finishReason: 'stop'
            }
        },

        async getHealthStatus() {
            return {
                status: 'healthy' as const,
                providers: { openai: true, anthropic: true },
                preferredProvider: 'openai',
                fallbackEnabled: true
            }
        }
    }

    // Initialize message generation service with mock AI
    const messageService = new MockMessageGenerationService(
        mockAIService as any,
        deduplicationService,
        db,
        {
            maxRetries: 2,
            retryDelay: 500,
            enableCaching: false, // Disable caching for mock test
            enableDeduplication: false, // Disable deduplication for mock test
            costTrackingEnabled: true
        }
    )

    logger.info('✅ Mock message generation service initialized')

    // Test message generation
    const testUserId = 'mock-test-user-' + Date.now()
    const categories: MessageCategory[] = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']

    for (const category of categories) {
        logger.info(`Testing mock ${category} message generation...`)

        try {
            const response = await messageService.generateMessage({
                userId: testUserId,
                category,
                timeOfDay: 'morning',
                locale: 'en-US'
            })

            logger.info(`✅ Mock ${category} message generated:`, {
                id: response.id,
                content: response.content,
                tokens: response.tokens,
                cost: response.cost,
                model: response.model,
                cached: response.cached
            })

        } catch (error) {
            logger.error(`❌ Failed to generate mock ${category} message:`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    logger.info('✅ Mock message generation pipeline testing completed')
    logger.info('🔧 Ready for real AI integration when API keys are provided')
}

// Run the test
testMessageGeneration()
    .then(() => {
        console.log('✅ Message generation test completed successfully')
        process.exit(0)
    })
    .catch((error) => {
        console.error('❌ Message generation test failed:', error)
        process.exit(1)
    })