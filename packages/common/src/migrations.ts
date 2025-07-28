// Database migration utilities for AuraFlow
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { executeQuery, executeTransaction } from './database'
import { createLogger } from './logging'
import { DatabaseError } from './errors'

const logger = createLogger('migrations')

export interface Migration {
    id: string
    filename: string
    description: string
    sql: string
    appliedAt?: Date
}

export interface MigrationResult {
    migration: Migration
    success: boolean
    error?: string
    duration: number
}

// Migration tracking table
const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(255) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL
);
`

class MigrationRunner {
    private migrationsPath: string

    constructor(migrationsPath?: string) {
        this.migrationsPath = migrationsPath || join(__dirname, '../migrations')
    }

    // Initialize migration tracking table
    async initializeMigrationTable(): Promise<void> {
        try {
            await executeQuery(MIGRATIONS_TABLE_SQL)
            logger.info('Migration tracking table initialized')
        } catch (error) {
            throw new DatabaseError(
                `Failed to initialize migration table: ${(error as Error).message}`,
                'initialize_migrations'
            )
        }
    }

    // Load migration files from disk
    loadMigrations(): Migration[] {
        try {
            const files = readdirSync(this.migrationsPath)
                .filter(file => file.endsWith('.sql'))
                .sort()

            return files.map(filename => {
                const filePath = join(this.migrationsPath, filename)
                const sql = readFileSync(filePath, 'utf-8')

                // Extract migration ID from filename (e.g., "001_initial_schema.sql" -> "001")
                const id = filename.split('_')[0]

                // Extract description from filename or SQL comments
                const description = this.extractDescription(filename, sql)

                return {
                    id,
                    filename,
                    description,
                    sql
                }
            })
        } catch (error) {
            throw new DatabaseError(
                `Failed to load migrations: ${(error as Error).message}`,
                'load_migrations'
            )
        }
    }

    // Get applied migrations from database
    async getAppliedMigrations(): Promise<string[]> {
        try {
            const result = await executeQuery<{ id: string }>(
                'SELECT id FROM schema_migrations ORDER BY applied_at'
            )
            return result.rows.map(row => row.id)
        } catch (error) {
            // If table doesn't exist, return empty array
            if ((error as Error).message.includes('does not exist')) {
                return []
            }
            throw error
        }
    }

    // Get pending migrations
    async getPendingMigrations(): Promise<Migration[]> {
        const allMigrations = this.loadMigrations()
        const appliedMigrations = await this.getAppliedMigrations()

        return allMigrations.filter(migration =>
            !appliedMigrations.includes(migration.id)
        )
    }

    // Apply a single migration
    async applyMigration(migration: Migration): Promise<MigrationResult> {
        const startTime = Date.now()

        logger.info(`Applying migration: ${migration.filename}`, {
            migrationId: migration.id,
            description: migration.description
        })

        try {
            await executeTransaction(async (client) => {
                // Execute the migration SQL
                await client.query(migration.sql)

                // Record the migration as applied
                const checksum = this.calculateChecksum(migration.sql)
                await client.query(
                    `INSERT INTO schema_migrations (id, filename, description, checksum) 
           VALUES ($1, $2, $3, $4)`,
                    [migration.id, migration.filename, migration.description, checksum]
                )
            })

            const duration = Date.now() - startTime

            logger.info(`Migration applied successfully: ${migration.filename}`, {
                migrationId: migration.id,
                duration
            })

            return {
                migration,
                success: true,
                duration
            }
        } catch (error) {
            const duration = Date.now() - startTime
            const errorMessage = (error as Error).message

            logger.error(`Migration failed: ${migration.filename}`, {
                migrationId: migration.id,
                duration,
                error: errorMessage
            })

            return {
                migration,
                success: false,
                error: errorMessage,
                duration
            }
        }
    }

    // Apply all pending migrations
    async migrate(): Promise<MigrationResult[]> {
        await this.initializeMigrationTable()

        const pendingMigrations = await this.getPendingMigrations()

        if (pendingMigrations.length === 0) {
            logger.info('No pending migrations to apply')
            return []
        }

        logger.info(`Applying ${pendingMigrations.length} pending migrations`)

        const results: MigrationResult[] = []

        for (const migration of pendingMigrations) {
            const result = await this.applyMigration(migration)
            results.push(result)

            // Stop on first failure
            if (!result.success) {
                logger.error('Migration failed, stopping migration process', {
                    failedMigration: migration.id
                })
                break
            }
        }

        const successful = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length

        logger.info('Migration process completed', {
            successful,
            failed,
            total: results.length
        })

        return results
    }

    // Rollback functionality (basic implementation)
    async rollback(migrationId: string): Promise<void> {
        logger.warn(`Rollback requested for migration: ${migrationId}`)

        // In a production system, you'd have down migrations
        // For now, we'll just remove the migration record
        await executeQuery(
            'DELETE FROM schema_migrations WHERE id = $1',
            [migrationId]
        )

        logger.info(`Migration record removed: ${migrationId}`)
    }

    // Get migration status
    async getStatus(): Promise<{
        applied: Migration[]
        pending: Migration[]
        total: number
    }> {
        const allMigrations = this.loadMigrations()
        const appliedIds = await this.getAppliedMigrations()

        const applied = allMigrations.filter(m => appliedIds.includes(m.id))
        const pending = allMigrations.filter(m => !appliedIds.includes(m.id))

        return {
            applied,
            pending,
            total: allMigrations.length
        }
    }

    // Extract description from filename or SQL comments
    private extractDescription(filename: string, sql: string): string {
        // Try to extract from filename first
        const parts = filename.replace('.sql', '').split('_')
        if (parts.length > 1) {
            return parts.slice(1).join(' ').replace(/[_-]/g, ' ')
        }

        // Try to extract from SQL comments
        const commentMatch = sql.match(/--\s*Description:\s*(.+)/i)
        if (commentMatch) {
            return commentMatch[1].trim()
        }

        return 'No description'
    }

    // Calculate simple checksum for migration content
    private calculateChecksum(content: string): string {
        // Simple hash implementation - in production use crypto.createHash
        let hash = 0
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16)
    }
}

// Default migration runner instance
export const migrationRunner = new MigrationRunner()

// Convenience functions
export async function runMigrations(): Promise<MigrationResult[]> {
    return await migrationRunner.migrate()
}

export async function getMigrationStatus() {
    return await migrationRunner.getStatus()
}

export async function rollbackMigration(migrationId: string): Promise<void> {
    return await migrationRunner.rollback(migrationId)
}