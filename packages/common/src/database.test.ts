import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    initializeDatabase,
    closeDatabase,
    executeQuery,
    executeTransaction,
    getDatabaseConfig
} from './database'

describe('database', () => {
    beforeEach(async () => {
        // Initialize with test configuration
        await initializeDatabase({
            host: 'localhost',
            port: 5432,
            database: 'test_aura_flow',
            username: 'test_user',
            password: 'test_password',
            ssl: false,
            maxConnections: 5
        })
    })

    afterEach(async () => {
        await closeDatabase()
    })

    describe('executeQuery', () => {
        it('should execute a simple query', async () => {
            const result = await executeQuery('SELECT 1 as test')

            expect(result).toBeDefined()
            expect(result.command).toBe('SELECT')
            expect(result.rowCount).toBeGreaterThanOrEqual(0)
            expect(Array.isArray(result.rows)).toBe(true)
        })

        it('should execute query with parameters', async () => {
            const result = await executeQuery('SELECT $1 as value', ['test'])

            expect(result).toBeDefined()
            expect(result.command).toBe('SELECT')
        })

        it('should handle INSERT queries', async () => {
            const result = await executeQuery(
                'INSERT INTO test_table (name) VALUES ($1)',
                ['test']
            )

            expect(result.command).toBe('INSERT')
            expect(result.rowCount).toBe(1)
        })
    })

    describe('executeTransaction', () => {
        it('should execute transaction successfully', async () => {
            const result = await executeTransaction(async (client) => {
                await client.query('SELECT 1')
                return 'success'
            })

            expect(result).toBe('success')
        })

        it('should rollback on error', async () => {
            await expect(
                executeTransaction(async (client) => {
                    await client.query('SELECT 1')
                    throw new Error('Test error')
                })
            ).rejects.toThrow('Test error')
        })
    })

    describe('getDatabaseConfig', () => {
        it('should return default configuration', () => {
            const config = getDatabaseConfig()

            expect(config).toMatchObject({
                host: 'localhost',
                port: 5432,
                database: 'aura_flow',
                username: 'postgres',
                ssl: false,
                maxConnections: 20
            })
        })

        it('should use environment variables when available', () => {
            const originalEnv = process.env

            process.env = {
                ...originalEnv,
                DB_HOST: 'custom-host',
                DB_PORT: '3306',
                DB_NAME: 'custom_db',
                DB_USER: 'custom_user',
                DB_PASSWORD: 'custom_pass',
                DB_SSL: 'true',
                DB_MAX_CONNECTIONS: '50'
            }

            const config = getDatabaseConfig()

            expect(config).toMatchObject({
                host: 'custom-host',
                port: 3306,
                database: 'custom_db',
                username: 'custom_user',
                password: 'custom_pass',
                ssl: true,
                maxConnections: 50
            })

            process.env = originalEnv
        })
    })
})