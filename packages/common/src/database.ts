// Database connection utilities and types for AuraFlow
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from './logging'
import { DatabaseError } from './errors'

const logger = createLogger('database')

// Database configuration interface for Supabase
export interface DatabaseConfig {
    supabaseUrl: string
    supabaseAnonKey: string
    supabaseServiceKey?: string // For admin operations
}

// Connection pool interface (would be implemented with actual DB driver)
export interface DatabasePool {
    query<T = any>(text: string, params?: any[]): Promise<DatabaseResult<T>>
    transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>
    end(): Promise<void>
}

// Database client interface for transactions
export interface DatabaseClient {
    query<T = any>(text: string, params?: any[]): Promise<DatabaseResult<T>>
}

// Database query result interface
export interface DatabaseResult<T = any> {
    rows: T[]
    rowCount: number
    command: string
}

// Supabase database pool implementation
class SupabaseDatabasePool implements DatabasePool {
    private supabase: SupabaseClient
    private config: DatabaseConfig

    constructor(config: DatabaseConfig) {
        this.config = config
        this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey)
        
        logger.info('Supabase client initialized', {
            url: config.supabaseUrl,
            hasServiceKey: !!config.supabaseServiceKey
        })
    }

    async query<T = any>(text: string, params: any[] = []): Promise<DatabaseResult<T>> {
        try {
            logger.debug('Executing raw SQL query', { query: text, params })

            // Use Supabase's RPC for raw SQL queries
            const { data, error } = await this.supabase.rpc('execute_sql', {
                query: text,
                params: params || []
            })

            if (error) {
                logger.error('SQL query failed', { query: text, error: error.message })
                throw new DatabaseError(`Query execution failed: ${error.message}`, 'query')
            }

            const result: DatabaseResult<T> = {
                rows: data || [],
                rowCount: data?.length || 0,
                command: text.trim().split(' ')[0].toUpperCase()
            }

            logger.debug('Query executed successfully', {
                command: result.command,
                rowCount: result.rowCount
            })

            return result

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Database query failed', { query: text, params, error: errorMessage })
            throw new DatabaseError(`Query execution failed: ${errorMessage}`, 'query')
        }
    }

    async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
        logger.debug('Starting transaction')

        // Supabase doesn't have explicit transaction support in the client
        // We'll simulate it by creating a client that can be used for multiple operations
        const client: DatabaseClient = {
            query: this.query.bind(this)
        }

        try {
            const result = await callback(client)
            logger.debug('Transaction completed')
            return result
        } catch (error) {
            logger.error('Transaction failed', {}, error as Error)
            throw error
        }
    }

    async end(): Promise<void> {
        // Supabase client doesn't need explicit cleanup
        logger.info('Database connection closed')
    }

    // Get the underlying Supabase client for direct operations
    getSupabaseClient(): SupabaseClient {
        return this.supabase
    }
}

// Database connection manager
class DatabaseManager {
    private pool: DatabasePool | null = null
    private config: DatabaseConfig | null = null

    async initialize(config: DatabaseConfig): Promise<void> {
        this.config = config

        try {
            // Create real Supabase connection pool
            this.pool = new SupabaseDatabasePool(config)

            // Test the connection
            await this.testConnection()

            logger.info('Database connection pool initialized', {
                supabaseUrl: config.supabaseUrl,
                hasServiceKey: !!config.supabaseServiceKey
            })
        } catch (error) {
            throw new DatabaseError(
                `Failed to initialize database connection: ${(error as Error).message}`,
                'initialize'
            )
        }
    }

    private async testConnection(): Promise<void> {
        try {
            // For Supabase, we'll test by trying to access the client directly
            const supabasePool = this.pool as SupabaseDatabasePool
            const supabase = supabasePool.getSupabaseClient()
            
            // Simple test - try to query a system table or just verify the client works
            const { error } = await supabase.from('users').select('count').limit(1)
            
            // During setup, tables might not exist yet, so we'll be more permissive
            // Only fail if it's a real connection/auth error
            if (error && !error.message.includes('does not exist') && error.code !== 'PGRST116') {
                throw new Error(`Supabase connection test failed: ${error.message}`)
            }
            
            logger.info('Database connection test successful')
        } catch (error) {
            logger.error('Database connection test failed', {}, error as Error)
            throw new DatabaseError('Database connection test failed', 'connection_test')
        }
    }

    getPool(): DatabasePool {
        if (!this.pool) {
            throw new DatabaseError('Database not initialized. Call initialize() first.')
        }
        return this.pool
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end()
            this.pool = null
            logger.info('Database connection closed')
        }
    }

    isInitialized(): boolean {
        return this.pool !== null
    }

    getSupabaseClient(): SupabaseClient {
        if (!this.pool) {
            throw new DatabaseError('Database not initialized. Call initialize() first.')
        }
        if (this.pool instanceof SupabaseDatabasePool) {
            return this.pool.getSupabaseClient()
        }
        throw new DatabaseError('Database not initialized with Supabase')
    }
}

// Singleton database manager instance
export const db = new DatabaseManager()

// Helper functions for common database operations
export async function executeQuery<T = any>(
    query: string,
    params: any[] = []
): Promise<DatabaseResult<T>> {
    const pool = db.getPool()

    try {
        const result = await pool.query<T>(query, params)

        logger.logDatabaseOperation(
            'query',
            extractTableName(query),
            0, // Duration would be measured in real implementation
            { rowCount: result.rowCount }
        )

        return result
    } catch (error) {
        logger.error('Database query failed', { query, params }, error as Error)
        throw new DatabaseError(
            `Query execution failed: ${(error as Error).message}`,
            'query'
        )
    }
}

export async function executeTransaction<T>(
    callback: (client: DatabaseClient) => Promise<T>
): Promise<T> {
    const pool = db.getPool()

    try {
        return await pool.transaction(callback)
    } catch (error) {
        logger.error('Database transaction failed', {}, error as Error)
        throw new DatabaseError(
            `Transaction failed: ${(error as Error).message}`,
            'transaction'
        )
    }
}

// Utility function to extract table name from SQL query
function extractTableName(query: string): string {
    const normalized = query.toLowerCase().trim()

    // Simple regex to extract table name from common SQL operations
    const patterns = [
        /(?:from|into|update|table)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
        /(?:insert\s+into)\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    ]

    for (const pattern of patterns) {
        const match = normalized.match(pattern)
        if (match) {
            return match[1]
        }
    }

    return 'unknown'
}

// Database configuration from environment variables
export function getDatabaseConfig(): DatabaseConfig {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new DatabaseError(
            'Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
        )
    }

    return {
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY
    }
}

// Initialize database with configuration
export async function initializeDatabase(config?: DatabaseConfig): Promise<void> {
    const dbConfig = config || getDatabaseConfig()
    await db.initialize(dbConfig)
}

// Close database connections
export async function closeDatabase(): Promise<void> {
    await db.close()
}

// Get Supabase client for direct operations
export function getSupabaseClient(): SupabaseClient {
    return db.getSupabaseClient()
}

// Export database manager as DatabaseService for backward compatibility
export const DatabaseService = db

// Get a database client for transactions
export async function getClient(): Promise<DatabaseClient> {
    const pool = db.getPool()

    // In a real implementation, this would get a client from the pool
    // For now, we'll return a mock client that uses the pool
    return {
        query: async <T = any>(text: string, params?: any[]) => {
            return await pool.query<T>(text, params)
        },
        release: () => {
            // In real implementation, this would release the client back to pool
        }
    } as DatabaseClient & { release: () => void }
}