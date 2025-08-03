#!/usr/bin/env ts-node

// Database setup script for AuraFlow
import { config } from 'dotenv'
import { initializeDatabase, closeDatabase } from '../src/database'

// Load environment variables
config()
import { runMigrations, getMigrationStatus } from '../src/migrations'
import { seedDatabase, clearDatabase, getSampleCredentials } from '../src/seeds'
import { createLogger } from '../src/logging'

const logger = createLogger('db-setup')

async function main() {
    const command = process.argv[2]

    if (!command) {
        console.log(`
AuraFlow Database Setup Tool

Usage:
  pnpm db:migrate     - Run pending migrations
  pnpm db:seed        - Seed database with sample data
  pnpm db:reset       - Clear and re-seed database
  pnpm db:status      - Show migration status
  pnpm db:setup       - Full setup (migrate + seed)

Environment Variables:
  SUPABASE_URL        - Supabase project URL (required)
  SUPABASE_ANON_KEY   - Supabase anonymous key (required)
  SUPABASE_SERVICE_KEY - Supabase service key (for admin operations)
`)
        process.exit(0)
    }

    try {
        // Initialize database connection
        await initializeDatabase()
        logger.info('Database connection established')

        switch (command) {
            case 'migrate':
                await handleMigrate()
                break

            case 'seed':
                await handleSeed()
                break

            case 'reset':
                await handleReset()
                break

            case 'status':
                await handleStatus()
                break

            case 'setup':
                await handleSetup()
                break

            default:
                console.error(`Unknown command: ${command}`)
                process.exit(1)
        }

    } catch (error) {
        logger.error('Database setup failed', {}, error as Error)
        console.error('❌ Database setup failed:', (error as Error).message)
        process.exit(1)
    } finally {
        await closeDatabase()
    }
}

async function handleMigrate() {
    console.log('🔄 Running database migrations...')

    const results = await runMigrations()

    if (results.length === 0) {
        console.log('✅ No pending migrations')
        return
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`\n📊 Migration Results:`)
    console.log(`  ✅ Successful: ${successful}`)
    console.log(`  ❌ Failed: ${failed}`)
    console.log(`  📝 Total: ${results.length}`)

    results.forEach(result => {
        const status = result.success ? '✅' : '❌'
        const duration = `${result.duration}ms`
        console.log(`  ${status} ${result.migration.filename} (${duration})`)

        if (!result.success && result.error) {
            console.log(`      Error: ${result.error}`)
        }
    })

    if (failed > 0) {
        throw new Error(`${failed} migrations failed`)
    }

    console.log('\n✅ All migrations completed successfully')
}

async function handleSeed() {
    console.log('🌱 Seeding database with sample data...')

    await seedDatabase()

    console.log('\n✅ Database seeded successfully')
    console.log('\n👤 Sample user accounts created:')

    const credentials = getSampleCredentials()
    credentials.forEach(cred => {
        console.log(`  📧 ${cred.email} (${cred.subscription})`)
        console.log(`  🔑 Password: ${cred.password}`)
        console.log('')
    })
}

async function handleReset() {
    console.log('🗑️  Clearing existing data...')
    await clearDatabase()

    console.log('🌱 Re-seeding database...')
    await seedDatabase()

    console.log('\n✅ Database reset completed')
    console.log('\n👤 Sample user accounts created:')

    const credentials = getSampleCredentials()
    credentials.forEach(cred => {
        console.log(`  📧 ${cred.email} (${cred.subscription})`)
        console.log(`  🔑 Password: ${cred.password}`)
        console.log('')
    })
}

async function handleStatus() {
    console.log('📊 Checking migration status...')

    const status = await getMigrationStatus()

    console.log(`\n📈 Migration Status:`)
    console.log(`  ✅ Applied: ${status.applied.length}`)
    console.log(`  ⏳ Pending: ${status.pending.length}`)
    console.log(`  📝 Total: ${status.total}`)

    if (status.applied.length > 0) {
        console.log('\n✅ Applied Migrations:')
        status.applied.forEach(migration => {
            console.log(`  • ${migration.filename} - ${migration.description}`)
        })
    }

    if (status.pending.length > 0) {
        console.log('\n⏳ Pending Migrations:')
        status.pending.forEach(migration => {
            console.log(`  • ${migration.filename} - ${migration.description}`)
        })
    }
}

async function handleSetup() {
    console.log('🚀 Running full database setup...')

    await handleMigrate()
    console.log('')
    await handleSeed()

    console.log('\n🎉 Database setup completed successfully!')
    console.log('\n🔗 Next steps:')
    console.log('  1. Start the API server: pnpm dev')
    console.log('  2. Test with sample users shown above')
    console.log('  3. Check the API documentation for endpoints')
}

// Handle process signals
process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down...')
    await closeDatabase()
    process.exit(0)
})

process.on('SIGTERM', async () => {
    console.log('\n⏹️  Shutting down...')
    await closeDatabase()
    process.exit(0)
})

// Run the main function
main().catch(error => {
    console.error('Unhandled error:', error)
    process.exit(1)
})