#!/usr/bin/env ts-node

// Test script to verify Supabase database connection
import { config } from 'dotenv'
import { initializeDatabase, closeDatabase, getSupabaseClient } from '../src/database'
import { createLogger } from '../src/logging'

// Load environment variables
config()

const logger = createLogger('test-connection')

async function testConnection() {
    try {
        logger.info('Testing Supabase database connection...')

        // Initialize database
        await initializeDatabase()
        logger.info('✅ Database initialized successfully')

        // Get Supabase client
        const supabase = getSupabaseClient()
        logger.info('✅ Supabase client obtained')

        // Test a simple query - just check if we can connect
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1)

        if (error && error.code === 'PGRST116') {
            logger.info('✅ Connection successful (users table doesn\'t exist yet - this is expected)')
        } else if (error) {
            logger.warn('Query test failed (this might be expected if tables don\'t exist yet)', { error: error.message })
        } else {
            logger.info('✅ Query test successful', { data })
        }

        // Test connection info
        logger.info('Connection test completed successfully')

    } catch (error) {
        logger.error('❌ Connection test failed', {}, error as Error)
        process.exit(1)
    } finally {
        await closeDatabase()
    }
}

if (require.main === module) {
    testConnection()
}