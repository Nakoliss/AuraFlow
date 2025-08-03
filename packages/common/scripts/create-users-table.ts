#!/usr/bin/env ts-node

// Simple script to create the users table
import { config } from 'dotenv'
import { getSupabaseClient } from '../src/database'
import { createLogger } from '../src/logging'

// Load environment variables
config()

const logger = createLogger('create-users-table')

async function createUsersTable() {
    try {
        logger.info('Creating users table...')
        
        // Initialize database first
        const { initializeDatabase } = await import('../src/database')
        await initializeDatabase()
        
        const supabase = getSupabaseClient()
        
        // Create users table using Supabase SQL
        const { error } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    subscription_status VARCHAR(20) DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium_core', 'voice_pack')),
                    premium_expires_at TIMESTAMP WITH TIME ZONE,
                    voice_pack_expires_at TIMESTAMP WITH TIME ZONE,
                    wisdom_points INTEGER DEFAULT 0,
                    streak_count INTEGER DEFAULT 0,
                    last_activity_date DATE,
                    preferred_categories TEXT[] DEFAULT '{}',
                    notification_time TIME,
                    voice_preference VARCHAR(50),
                    timezone VARCHAR(100) DEFAULT 'UTC'
                );
            `
        })
        
        if (error) {
            throw new Error(`Failed to create users table: ${error.message}`)
        }
        
        logger.info('✅ Users table created successfully')
        
    } catch (error) {
        logger.error('❌ Failed to create users table', {}, error as Error)
        throw error
    }
}

async function main() {
    try {
        await createUsersTable()
        console.log('✅ Users table creation completed')
    } catch (error) {
        console.error('❌ Users table creation failed:', (error as Error).message)
        process.exit(1)
    }
}

if (require.main === module) {
    main()
}