// Structured logging utilities for AuraFlow application

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
    userId?: string
    requestId?: string
    sessionId?: string
    operation?: string
    category?: string
    service?: string
    duration?: number
    cost?: number
    tokens?: number
    [key: string]: any
}

export interface LogEntry {
    timestamp: string
    level: LogLevel
    message: string
    context?: LogContext
    error?: {
        name: string
        message: string
        stack?: string
        code?: string
    }
}

export class Logger {
    private serviceName: string
    private minLevel: LogLevel
    private context: LogContext

    constructor(serviceName: string, minLevel: LogLevel = 'info', context: LogContext = {}) {
        this.serviceName = serviceName
        this.minLevel = minLevel
        this.context = context
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: Record<LogLevel, number> = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        }
        return levels[level] >= levels[this.minLevel]
    }

    private formatLogEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: `[${this.serviceName}] ${message}`,
            context: { ...this.context, ...context }
        }

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                ...(error instanceof Error && 'code' in error && { code: (error as any).code })
            }
        }

        return entry
    }

    private output(entry: LogEntry): void {
        // In production, this would send to a logging service
        // For now, we'll use console with structured output
        const logString = JSON.stringify(entry, null, 2)

        switch (entry.level) {
            case 'debug':
                console.debug(logString)
                break
            case 'info':
                console.info(logString)
                break
            case 'warn':
                console.warn(logString)
                break
            case 'error':
                console.error(logString)
                break
        }
    }

    debug(message: string, context?: LogContext): void {
        if (this.shouldLog('debug')) {
            this.output(this.formatLogEntry('debug', message, context))
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.shouldLog('info')) {
            this.output(this.formatLogEntry('info', message, context))
        }
    }

    warn(message: string, context?: LogContext, error?: Error): void {
        if (this.shouldLog('warn')) {
            this.output(this.formatLogEntry('warn', message, context, error))
        }
    }

    error(message: string, context?: LogContext, error?: Error): void {
        if (this.shouldLog('error')) {
            this.output(this.formatLogEntry('error', message, context, error))
        }
    }

    // Convenience methods for common operations
    logRequest(method: string, path: string, context?: LogContext): void {
        this.info(`${method} ${path}`, { operation: 'request', ...context })
    }

    logResponse(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
        this.info(`${method} ${path} - ${statusCode}`, {
            operation: 'response',
            statusCode,
            duration,
            ...context
        })
    }

    logMessageGeneration(category: string, tokens: number, cost: number, duration: number, context?: LogContext): void {
        this.info('Message generated', {
            operation: 'message_generation',
            category,
            tokens,
            cost,
            duration,
            ...context
        })
    }

    logDatabaseOperation(operation: string, table: string, duration: number, context?: LogContext): void {
        this.debug(`Database ${operation} on ${table}`, {
            operation: 'database',
            table,
            duration,
            ...context
        })
    }

    logExternalService(service: string, operation: string, duration: number, success: boolean, context?: LogContext): void {
        const level = success ? 'info' : 'warn'
        this[level](`External service call: ${service}.${operation}`, {
            operation: 'external_service',
            service,
            duration,
            success,
            ...context
        })
    }

    logUserAction(action: string, userId: string, context?: LogContext): void {
        this.info(`User action: ${action}`, {
            operation: 'user_action',
            userId,
            ...context
        })
    }

    logPaymentEvent(event: string, userId: string, amount?: number, context?: LogContext): void {
        this.info(`Payment event: ${event}`, {
            operation: 'payment',
            userId,
            amount,
            ...context
        })
    }

    // Create child logger with additional context
    child(additionalContext: LogContext): Logger {
        return new Logger(this.serviceName, this.minLevel, { ...this.context, ...additionalContext })
    }

    // Create logger for specific request
    forRequest(requestId: string, userId?: string): Logger {
        return this.child({ requestId, userId })
    }
}

// Performance measurement utilities
export class PerformanceTimer {
    private startTime: number
    private logger: Logger
    private operation: string
    private context: LogContext

    constructor(logger: Logger, operation: string, context: LogContext = {}) {
        this.startTime = Date.now()
        this.logger = logger
        this.operation = operation
        this.context = context
    }

    end(additionalContext?: LogContext): number {
        const duration = Date.now() - this.startTime
        this.logger.debug(`Operation completed: ${this.operation}`, {
            ...this.context,
            ...additionalContext,
            duration
        })
        return duration
    }

    endWithResult<T>(result: T, additionalContext?: LogContext): T {
        this.end(additionalContext)
        return result
    }

    endWithError(error: Error, additionalContext?: LogContext): void {
        const duration = Date.now() - this.startTime
        this.logger.error(`Operation failed: ${this.operation}`, {
            ...this.context,
            ...additionalContext,
            duration
        }, error)
    }
}

// Factory functions for common loggers
export function createLogger(serviceName: string, minLevel: LogLevel = 'info'): Logger {
    return new Logger(serviceName, minLevel)
}

export function createAPILogger(requestId?: string): Logger {
    return createLogger('api').child({ requestId })
}

export function createWorkerLogger(workerName: string): Logger {
    return createLogger(`worker:${workerName}`)
}

export function createServiceLogger(serviceName: string): Logger {
    return createLogger(`service:${serviceName}`)
}

// Timing decorator for functions
export function timed<T extends (...args: any[]) => any>(
    logger: Logger,
    operation: string,
    fn: T
): T {
    return ((...args: any[]) => {
        const timer = new PerformanceTimer(logger, operation)
        try {
            const result = fn(...args)

            // Handle promises
            if (result && typeof result.then === 'function') {
                return result
                    .then((value: any) => timer.endWithResult(value))
                    .catch((error: Error) => {
                        timer.endWithError(error)
                        throw error
                    })
            }

            return timer.endWithResult(result)
        } catch (error) {
            timer.endWithError(error as Error)
            throw error
        }
    }) as T
}

// Cost tracking utilities
export interface CostMetrics {
    tokens: number
    cost: number
    model: string
    operation: string
}

export function logCostMetrics(logger: Logger, metrics: CostMetrics, context?: LogContext): void {
    logger.info('Cost metrics recorded', {
        ...metrics,
        ...context,
        operation: 'cost_tracking'
    })
}

// Default logger instance
export const defaultLogger = createLogger('aura-flow')

// Export logger as the default logger for convenience
export const logger = defaultLogger