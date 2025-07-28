import { describe, it, expect } from 'vitest'
import {
    AuraFlowError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    RateLimitError,
    QuotaExceededError,
    ExternalServiceError,
    DatabaseError,
    ContentGenerationError,
    isOperationalError,
    formatErrorForClient,
    formatErrorForLogging
} from './errors'

describe('errors', () => {
    describe('AuraFlowError', () => {
        it('should create error with correct properties', () => {
            const error = new AuraFlowError('Test message', 'TEST_CODE', 400, true)

            expect(error.message).toBe('Test message')
            expect(error.code).toBe('TEST_CODE')
            expect(error.statusCode).toBe(400)
            expect(error.isOperational).toBe(true)
            expect(error.name).toBe('AuraFlowError')
        })

        it('should have default values', () => {
            const error = new AuraFlowError('Test message', 'TEST_CODE')

            expect(error.statusCode).toBe(500)
            expect(error.isOperational).toBe(true)
        })
    })

    describe('ValidationError', () => {
        it('should create validation error with field', () => {
            const error = new ValidationError('Invalid email', 'email')

            expect(error.message).toBe('Invalid email')
            expect(error.field).toBe('email')
            expect(error.code).toBe('VALIDATION_ERROR')
            expect(error.statusCode).toBe(400)
        })

        it('should create validation error without field', () => {
            const error = new ValidationError('Invalid input')

            expect(error.field).toBeUndefined()
        })
    })

    describe('QuotaExceededError', () => {
        it('should create quota error with details', () => {
            const error = new QuotaExceededError('daily_messages', 20, 25)

            expect(error.message).toBe('daily_messages quota exceeded: 25/20')
            expect(error.quotaType).toBe('daily_messages')
            expect(error.limit).toBe(20)
            expect(error.current).toBe(25)
            expect(error.statusCode).toBe(429)
        })
    })

    describe('ExternalServiceError', () => {
        it('should create external service error', () => {
            const originalError = new Error('Connection timeout')
            const error = new ExternalServiceError('OpenAI', 'API request failed', originalError)

            expect(error.message).toBe('OpenAI service error: API request failed')
            expect(error.service).toBe('OpenAI')
            expect(error.originalError).toBe(originalError)
            expect(error.statusCode).toBe(502)
        })
    })

    describe('isOperationalError', () => {
        it('should return true for operational AuraFlow errors', () => {
            const error = new ValidationError('Test error')
            expect(isOperationalError(error)).toBe(true)
        })

        it('should return false for non-operational errors', () => {
            const error = new AuraFlowError('Test', 'TEST', 500, false)
            expect(isOperationalError(error)).toBe(false)
        })

        it('should return false for regular errors', () => {
            const error = new Error('Regular error')
            expect(isOperationalError(error)).toBe(false)
        })
    })

    describe('formatErrorForClient', () => {
        it('should format AuraFlow error for client', () => {
            const error = new ValidationError('Invalid email', 'email')
            const formatted = formatErrorForClient(error)

            expect(formatted).toEqual({
                message: 'Invalid email',
                code: 'VALIDATION_ERROR',
                statusCode: 400
            })
        })

        it('should format regular error for client', () => {
            const error = new Error('Internal error')
            const formatted = formatErrorForClient(error)

            expect(formatted).toEqual({
                message: 'An unexpected error occurred',
                statusCode: 500
            })
        })
    })

    describe('formatErrorForLogging', () => {
        it('should format AuraFlow error for logging', () => {
            const error = new QuotaExceededError('daily_messages', 20, 25)
            const formatted = formatErrorForLogging(error)

            expect(formatted).toMatchObject({
                name: 'QuotaExceededError',
                message: 'daily_messages quota exceeded: 25/20',
                code: 'QUOTA_EXCEEDED_ERROR',
                statusCode: 429,
                isOperational: true,
                quotaType: 'daily_messages',
                limit: 20,
                current: 25
            })
            expect(formatted.stack).toBeDefined()
        })

        it('should format regular error for logging', () => {
            const error = new Error('Test error')
            const formatted = formatErrorForLogging(error)

            expect(formatted).toMatchObject({
                name: 'Error',
                message: 'Test error'
            })
            expect(formatted.stack).toBeDefined()
        })
    })
})