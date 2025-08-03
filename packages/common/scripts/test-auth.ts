#!/usr/bin/env ts-node

// Test script to verify authentication works with real database
import { config } from 'dotenv'
import { initializeDatabase, closeDatabase } from '../src/database'
import { userService } from '../src/user-service'
import { authService } from '../src/auth'
import { createLogger } from '../src/logging'

// Load environment variables
config()

const logger = createLogger('test-auth')

async function testAuthentication() {
    try {
        logger.info('Testing authentication with real database...')

        // Initialize database
        await initializeDatabase()
        logger.info('✅ Database initialized')

        // Test user creation
        const testEmail = 'test@example.com'
        const testPassword = 'testpassword123'
        
        logger.info('Creating test user...')
        const passwordHash = await authService.hashPassword(testPassword)
        
        const user = await userService.createUser({
            email: testEmail,
            passwordHash,
            timezone: 'UTC'
        })
        
        logger.info('✅ User created successfully', { userId: user.id, email: user.email })

        // Test user login
        logger.info('Testing user login...')
        const userWithPassword = await userService.findUserByEmailForAuth(testEmail)
        
        if (!userWithPassword) {
            throw new Error('User not found after creation')
        }
        
        const isPasswordValid = await authService.verifyPassword(testPassword, userWithPassword.passwordHash)
        
        if (!isPasswordValid) {
            throw new Error('Password verification failed')
        }
        
        logger.info('✅ Password verification successful')

        // Test token generation
        const tokens = authService.generateTokens({
            id: user.id,
            email: user.email,
            subscriptionStatus: user.subscriptionStatus
        })
        
        logger.info('✅ Token generation successful', { 
            hasAccessToken: !!tokens.accessToken,
            hasRefreshToken: !!tokens.refreshToken
        })

        // Test token verification
        const payload = authService.verifyAccessToken(tokens.accessToken)
        logger.info('✅ Token verification successful', { userId: payload.userId, email: payload.email })

        logger.info('🎉 All authentication tests passed!')

    } catch (error) {
        logger.error('❌ Authentication test failed', {}, error as Error)
        throw error
    } finally {
        await closeDatabase()
    }
}

async function main() {
    try {
        await testAuthentication()
        console.log('✅ Authentication test completed successfully')
    } catch (error) {
        console.error('❌ Authentication test failed:', (error as Error).message)
        process.exit(1)
    }
}

if (require.main === module) {
    main()
}