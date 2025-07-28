import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { migrationRunner, runMigrations, getMigrationStatus } from './migrations'
import { initializeDatabase, closeDatabase } from './database'

describe('migrations', () => {
    beforeEach(async () => {
        await initializeDatabase({
            host: 'localhost',
            port: 5432,
            database: 'test_aura_flow',
            username: 'test_user',
            password: 'test_password'
        })
    })

    afterEach(async () => {
        await closeDatabase()
    })

    describe('migrationRunner', () => {
        it('should get applied migrations', async () => {
            const appliedMigrations = await migrationRunner.getAppliedMigrations()

            expect(Array.isArray(appliedMigrations)).toBe(true)
        })

        it('should initialize migration table', async () => {
            await expect(migrationRunner.initializeMigrationTable()).resolves.not.toThrow()
        })
    })

    describe('runMigrations', () => {
        it('should run migrations successfully', async () => {
            const results = await runMigrations()

            expect(Array.isArray(results)).toBe(true)
        })
    })

    describe('getMigrationStatus', () => {
        it('should return migration status', async () => {
            const status = await getMigrationStatus()

            expect(status).toMatchObject({
                applied: expect.any(Array),
                pending: expect.any(Array),
                total: expect.any(Number)
            })
        })
    })
})