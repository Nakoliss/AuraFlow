// Custom error classes for AuraFlow application

export class AuraFlowError extends Error {
    public readonly code: string
    public readonly statusCode: number
    public readonly isOperational: boolean

    constructor(message: string, code: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message)
        this.name = this.constructor.name
        this.code = code
        this.statusCode = statusCode
        this.isOperational = isOperational

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if ('captureStackTrace' in Error) {
            (Error as any).captureStackTrace(this, this.constructor)
        }
    }
}

export class ValidationError extends AuraFlowError {
    public readonly field?: string

    constructor(message: string, field?: string) {
        super(message, 'VALIDATION_ERROR', 400)
        this.field = field
    }
}

export class AuthenticationError extends AuraFlowError {
    constructor(message: string = 'Authentication failed') {
        super(message, 'AUTHENTICATION_ERROR', 401)
    }
}

export class AuthorizationError extends AuraFlowError {
    constructor(message: string = 'Insufficient permissions') {
        super(message, 'AUTHORIZATION_ERROR', 403)
    }
}

export class NotFoundError extends AuraFlowError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 'NOT_FOUND_ERROR', 404)
    }
}

export class RateLimitError extends AuraFlowError {
    public readonly retryAfter?: number

    constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
        super(message, 'RATE_LIMIT_ERROR', 429)
        this.retryAfter = retryAfter
    }
}

export class QuotaExceededError extends AuraFlowError {
    public readonly quotaType: string
    public readonly limit: number
    public readonly current: number

    constructor(quotaType: string, limit: number, current: number) {
        super(`${quotaType} quota exceeded: ${current}/${limit}`, 'QUOTA_EXCEEDED_ERROR', 429)
        this.quotaType = quotaType
        this.limit = limit
        this.current = current
    }
}

export class ExternalServiceError extends AuraFlowError {
    public readonly service: string
    public readonly originalError?: Error

    constructor(service: string, message: string, originalError?: Error) {
        super(`${service} service error: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502)
        this.service = service
        this.originalError = originalError
    }
}

export class DatabaseError extends AuraFlowError {
    public readonly operation?: string

    constructor(message: string, operation?: string) {
        super(message, 'DATABASE_ERROR', 500)
        this.operation = operation
    }
}

export class ContentGenerationError extends AuraFlowError {
    public readonly category?: string
    public readonly attempt?: number

    constructor(message: string, category?: string, attempt?: number) {
        super(message, 'CONTENT_GENERATION_ERROR', 500)
        this.category = category
        this.attempt = attempt
    }
}

// Error handling utilities
export function isOperationalError(error: Error): boolean {
    if (error instanceof AuraFlowError) {
        return error.isOperational
    }
    return false
}

export function formatErrorForClient(error: Error): { message: string; code?: string; statusCode: number } {
    if (error instanceof AuraFlowError) {
        return {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
        }
    }

    // Don't expose internal error details to clients
    return {
        message: 'An unexpected error occurred',
        statusCode: 500
    }
}

export function formatErrorForLogging(error: Error): Record<string, any> {
    const baseInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack
    }

    if (error instanceof AuraFlowError) {
        return {
            ...baseInfo,
            code: error.code,
            statusCode: error.statusCode,
            isOperational: error.isOperational,
            ...(error instanceof ValidationError && { field: error.field }),
            ...(error instanceof RateLimitError && { retryAfter: error.retryAfter }),
            ...(error instanceof QuotaExceededError && {
                quotaType: error.quotaType,
                limit: error.limit,
                current: error.current
            }),
            ...(error instanceof ExternalServiceError && {
                service: error.service,
                originalError: error.originalError?.message
            }),
            ...(error instanceof DatabaseError && { operation: error.operation }),
            ...(error instanceof ContentGenerationError && {
                category: error.category,
                attempt: error.attempt
            })
        }
    }

    return baseInfo
}