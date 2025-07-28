// Database connection utilities and types for AuraFlow
import { createLogger } from './logging'
import { DatabaseError } from './errors'

const logger = createLogger('database')

// Database configuration interface
export interface DatabaseConfig {
    host: string
    port: number
    database: string
    username: string
    password: string
    ssl?: boolean
    maxConnections?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
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

// Mock database pool implementation for development
class MockDatabasePool implements DatabasePool {
    private isConnected = false
    private mockData: Map<string, any[]> = new Map()

    constructor(private config: DatabaseConfig) {
        this.initializeMockData()
    }

    private initializeMockData() {
        // Initialize with empty tables
        this.mockData.set('users', [])
        this.mockData.set('generated_messages', [])
        this.mockData.set('daily_drops', [])
        this.mockData.set('daily_challenges', [])
        this.mockData.set('achievements', [])
        this.mockData.set('user_achievements', [])
        this.mockData.set('audio_cache', [])
    }

    async query<T = any>(text: string, params: any[] = []): Promise<DatabaseResult<T>> {
        logger.debug('Executing query', { query: text, params })

        // Simple mock implementation - in real app this would use pg or similar
        const command = text.trim().split(' ')[0].toUpperCase()

        // Mock some basic operations
        if (command === 'SELECT') {
            return {
                rows: [] as T[],
                rowCount: 0,
                command: 'SELECT'
            }
        }

        if (command === 'INSERT') {
            return {
                rows: [{ id: this.generateMockId() }] as T[],
                rowCount: 1,
                command: 'INSERT'
            }
        }

        return {
            rows: [] as T[],
            rowCount: 0,
            command
        }
    }

    async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
        logger.debug('Starting transaction')

        const client: DatabaseClient = {
            query: this.query.bind(this)
        }

        try {
            const result = await callback(client)
            logger.debug('Transaction committed')
            return result
        } catch (error) {
            logger.error('Transaction rolled back', {}, error as Error)
            throw error
        }
    }

    async end(): Promise<void> {
        this.isConnected = false
        logger.info('Database connection pool closed')
    }

    private generateMockId(): string {
        return crypto.randomUUID()
    }
}

// Database connection manager
class DatabaseManager {
    private pool: DatabasePool | null = null
    private config: DatabaseConfig | null = null

    async initialize(config: DatabaseConfig): Promise<void> {
        this.config = config

        try {
            // In production, this would create a real connection pool
            // For now, we'll use the mock implementation
            this.pool = new MockDatabasePool(config)

            logger.info('Database connection pool initialized', {
                host: config.host,
                database: config.database,
                maxConnections: config.maxConnections
            })
        } catch (error) {
            throw new DatabaseError(
                `Failed to initialize database connection: ${(error as Error).message}`,
                'initialize'
            )
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
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'aura_flow',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
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