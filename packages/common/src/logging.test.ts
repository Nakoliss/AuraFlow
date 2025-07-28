import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    Logger,
    PerformanceTimer,
    createLogger,
    createAPILogger,
    timed,
    logCostMetrics
} from './logging'

describe('logging', () => {
    let consoleSpy: any

    beforeEach(() => {
        consoleSpy = {
            debug: vi.spyOn(console, 'debug').mockImplementation(() => { }),
            info: vi.spyOn(console, 'info').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { })
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Logger', () => {
        it('should create logger with service name', () => {
            const logger = new Logger('test-service')
            logger.info('Test message')

            expect(consoleSpy.info).toHaveBeenCalledWith(
                expect.stringContaining('[test-service] Test message')
            )
        })

        it('should respect minimum log level', () => {
            const logger = new Logger('test-service', 'warn')

            logger.debug('Debug message')
            logger.info('Info message')
            logger.warn('Warn message')

            expect(consoleSpy.debug).not.toHaveBeenCalled()
            expect(consoleSpy.info).not.toHaveBeenCalled()
            expect(consoleSpy.warn).toHaveBeenCalled()
        })

        it('should include context in log entries', () => {
            const logger = new Logger('test-service', 'info', { userId: 'user123' })
            logger.info('Test message', { operation: 'test' })

            const logCall = consoleSpy.info.mock.calls[0][0]
            const logEntry = JSON.parse(logCall)

            expect(logEntry.context).toMatchObject({
                userId: 'user123',
                operation: 'test'
            })
        })

        it('should log errors with error details', () => {
            const logger = new Logger('test-service')
            const error = new Error('Test error')

            logger.error('Operation failed', { operation: 'test' }, error)

            const logCall = consoleSpy.error.mock.calls[0][0]
            const logEntry = JSON.parse(logCall)

            expect(logEntry.error).toMatchObject({
                name: 'Error',
                message: 'Test error'
            })
            expect(logEntry.error.stack).toBeDefined()
        })

        it('should create child logger with additional context', () => {
            const parentLogger = new Logger('test-service', 'info', { service: 'parent' })
            const childLogger = parentLogger.child({ requestId: 'req123' })

            childLogger.info('Child message')

            const logCall = consoleSpy.info.mock.calls[0][0]
            const logEntry = JSON.parse(logCall)

            expect(logEntry.context).toMatchObject({
                service: 'parent',
                requestId: 'req123'
            })
        })

        describe('convenience methods', () => {
            let logger: Logger

            beforeEach(() => {
                logger = new Logger('test-service')
            })

            it('should log request', () => {
                logger.logRequest('GET', '/api/messages', { userId: 'user123' })

                const logCall = consoleSpy.info.mock.calls[0][0]
                const logEntry = JSON.parse(logCall)

                expect(logEntry.message).toContain('GET /api/messages')
                expect(logEntry.context.operation).toBe('request')
                expect(logEntry.context.userId).toBe('user123')
            })

            it('should log response', () => {
                logger.logResponse('GET', '/api/messages', 200, 150)

                const logCall = consoleSpy.info.mock.calls[0][0]
                const logEntry = JSON.parse(logCall)

                expect(logEntry.message).toContain('GET /api/messages - 200')
                expect(logEntry.context.operation).toBe('response')
                expect(logEntry.context.statusCode).toBe(200)
                expect(logEntry.context.duration).toBe(150)
            })

            it('should log message generation', () => {
                logger.logMessageGeneration('motivational', 50, 0.001, 200)

                const logCall = consoleSpy.info.mock.calls[0][0]
                const logEntry = JSON.parse(logCall)

                expect(logEntry.message).toContain('Message generated')
                expect(logEntry.context.operation).toBe('message_generation')
                expect(logEntry.context.category).toBe('motivational')
                expect(logEntry.context.tokens).toBe(50)
                expect(logEntry.context.cost).toBe(0.001)
            })

            it('should log user action', () => {
                logger.logUserAction('generate_message', 'user123')

                const logCall = consoleSpy.info.mock.calls[0][0]
                const logEntry = JSON.parse(logCall)

                expect(logEntry.message).toContain('User action: generate_message')
                expect(logEntry.context.operation).toBe('user_action')
                expect(logEntry.context.userId).toBe('user123')
            })
        })
    })

    describe('PerformanceTimer', () => {
        it('should measure operation duration', () => {
            const logger = new Logger('test-service', 'debug')
            const timer = new PerformanceTimer(logger, 'test_operation')

            // Simulate some work
            const duration = timer.end()

            expect(duration).toBeGreaterThanOrEqual(0)
            expect(consoleSpy.debug).toHaveBeenCalled()
        })

        it('should return result and log duration', () => {
            const logger = new Logger('test-service', 'debug')
            const timer = new PerformanceTimer(logger, 'test_operation')

            const result = timer.endWithResult('test result')

            expect(result).toBe('test result')
            expect(consoleSpy.debug).toHaveBeenCalled()
        })

        it('should log error with duration', () => {
            const logger = new Logger('test-service')
            const timer = new PerformanceTimer(logger, 'test_operation')
            const error = new Error('Test error')

            timer.endWithError(error)

            expect(consoleSpy.error).toHaveBeenCalled()
            const logCall = consoleSpy.error.mock.calls[0][0]
            const logEntry = JSON.parse(logCall)

            expect(logEntry.message).toContain('Operation failed: test_operation')
            expect(logEntry.context.duration).toBeGreaterThanOrEqual(0)
        })
    })

    describe('factory functions', () => {
        it('should create logger with createLogger', () => {
            const logger = createLogger('test-service', 'debug')
            logger.debug('Test message')

            expect(consoleSpy.debug).toHaveBeenCalled()
        })

        it('should create API logger with request ID', () => {
            const logger = createAPILogger('req123')
            logger.info('API call')

            const logCall = consoleSpy.info.mock.calls[0][0]
            const logEntry = JSON.parse(logCall)

            expect(logEntry.context.requestId).toBe('req123')
        })
    })

    describe('timed decorator', () => {
        it('should time synchronous function', () => {
            const logger = new Logger('test-service', 'debug')
            const originalFn = (x: number, y: number) => x + y
            const timedFn = timed(logger, 'add_operation', originalFn)

            const result = timedFn(2, 3)

            expect(result).toBe(5)
            expect(consoleSpy.debug).toHaveBeenCalled()
        })

        it('should time async function', async () => {
            const logger = new Logger('test-service', 'debug')
            const originalFn = async (x: number) => {
                await new Promise(resolve => setTimeout(resolve, 10))
                return x * 2
            }
            const timedFn = timed(logger, 'async_operation', originalFn)

            const result = await timedFn(5)

            expect(result).toBe(10)
            expect(consoleSpy.debug).toHaveBeenCalled()
        })

        it('should handle function errors', () => {
            const logger = new Logger('test-service')
            const originalFn = () => {
                throw new Error('Test error')
            }
            const timedFn = timed(logger, 'error_operation', originalFn)

            expect(() => timedFn()).toThrow('Test error')
            expect(consoleSpy.error).toHaveBeenCalled()
        })
    })

    describe('logCostMetrics', () => {
        it('should log cost metrics', () => {
            const logger = new Logger('test-service')
            const metrics = {
                tokens: 100,
                cost: 0.002,
                model: 'gpt-3.5-turbo',
                operation: 'message_generation'
            }

            logCostMetrics(logger, metrics, { userId: 'user123' })

            const logCall = consoleSpy.info.mock.calls[0][0]
            const logEntry = JSON.parse(logCall)

            expect(logEntry.message).toContain('Cost metrics recorded')
            expect(logEntry.context.operation).toBe('cost_tracking')
            expect(logEntry.context.tokens).toBe(100)
            expect(logEntry.context.cost).toBe(0.002)
            expect(logEntry.context.model).toBe('gpt-3.5-turbo')
            expect(logEntry.context.userId).toBe('user123')
        })
    })
})