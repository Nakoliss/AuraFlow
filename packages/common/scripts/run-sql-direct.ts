#!/usr/bin/env ts-node

// Script to run SQL directly against Supabase
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createLogger } from '../src/logging'

// Load environment variables
config()

const logger = createLogger('sql-runner')

async function runSqlFile(filename: string) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY')
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Read the SQL file
        const sqlPath = join(__dirname, '../migrations', filename)
        const sql = readFileSync(sqlPath, 'utf8')
        
        logger.info(`Running SQL file: ${filename}`)
        
        // Split SQL into individual statements and run them
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'))
        
        for (const statement of statements) {
            if (statement.trim()) {
                logger.debug(`Executing: ${statement.substring(0, 100)}...`)
                
                const { error } = await supabase.rpc('exec_sql', { sql: statement })
                
                if (error) {
                    logger.error(`SQL Error: ${error.message}`)
                    throw error
                }
            }
        }
        
        logger.info(`✅ Successfully ran ${filename}`)
        
    } catch (error) {
        logger.error(`❌ Failed to run ${filename}`, {}, error as Error)
        throw error
    }
}

async function main() {
    const filename = process.argv[2]
    
    if (!filename) {
        console.log('Usage: pnpm run-sql <filename>')
        console.log('Example: pnpm run-sql 001_initial_schema.sql')
        process.exit(1)
    }
    
    try {
        await runSqlFile(filename)
        console.log('✅ SQL execution completed successfully')
    } catch (error) {
        console.error('❌ SQL execution failed:', (error as Error).message)
        process.exit(1)
    }
}

if (require.main === module) {
    main()
}