// Validation utilities for user input and API requests
import { ValidationError } from './errors'
import type { MessageCategory, SubscriptionTier } from './types'
import { MESSAGE_CATEGORIES, SUBSCRIPTION_TIERS } from './constants'

// Re-export zod for convenience
import { z } from 'zod'
export { z }

// Basic validation functions
export function isRequired(value: any, fieldName: string): void {
    if (value === null || value === undefined || value === '') {
        throw new ValidationError(`${fieldName} is required`, fieldName)
    }
}

export function isString(value: any, fieldName: string): void {
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName)
    }
}

export function isNumber(value: any, fieldName: string): void {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`${fieldName} must be a valid number`, fieldName)
    }
}

export function isBoolean(value: any, fieldName: string): void {
    if (typeof value !== 'boolean') {
        throw new ValidationError(`${fieldName} must be a boolean`, fieldName)
    }
}

export function isArray(value: any, fieldName: string): void {
    if (!Array.isArray(value)) {
        throw new ValidationError(`${fieldName} must be an array`, fieldName)
    }
}

// String validation
export function minLength(value: string, min: number, fieldName: string): void {
    if (value.length < min) {
        throw new ValidationError(`${fieldName} must be at least ${min} characters long`, fieldName)
    }
}

export function maxLength(value: string, max: number, fieldName: string): void {
    if (value.length > max) {
        throw new ValidationError(`${fieldName} must be no more than ${max} characters long`, fieldName)
    }
}

export function isEmail(value: string, fieldName: string = 'email'): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
        throw new ValidationError(`${fieldName} must be a valid email address`, fieldName)
    }
}

export function isUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(value)) {
        throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName)
    }
}

// Number validation
export function minValue(value: number, min: number, fieldName: string): void {
    if (value < min) {
        throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName)
    }
}

export function maxValue(value: number, max: number, fieldName: string): void {
    if (value > max) {
        throw new ValidationError(`${fieldName} must be no more than ${max}`, fieldName)
    }
}

export function isInteger(value: number, fieldName: string): void {
    if (!Number.isInteger(value)) {
        throw new ValidationError(`${fieldName} must be an integer`, fieldName)
    }
}

export function isPositive(value: number, fieldName: string): void {
    if (value <= 0) {
        throw new ValidationError(`${fieldName} must be positive`, fieldName)
    }
}

// Enum validation
export function isOneOf<T>(value: T, allowedValues: readonly T[], fieldName: string): void {
    if (!allowedValues.includes(value)) {
        throw new ValidationError(
            `${fieldName} must be one of: ${allowedValues.join(', ')}`,
            fieldName
        )
    }
}

// AuraFlow-specific validation
export function isValidMessageCategory(category: string): category is MessageCategory {
    return MESSAGE_CATEGORIES.includes(category as MessageCategory)
}

export function validateMessageCategory(category: string, fieldName: string = 'category'): MessageCategory {
    if (!isValidMessageCategory(category)) {
        throw new ValidationError(
            `${fieldName} must be one of: ${MESSAGE_CATEGORIES.join(', ')}`,
            fieldName
        )
    }
    return category
}

export function isValidSubscriptionTier(tier: string): tier is SubscriptionTier {
    return SUBSCRIPTION_TIERS.includes(tier as SubscriptionTier)
}

export function validateSubscriptionTier(tier: string, fieldName: string = 'subscriptionTier'): SubscriptionTier {
    if (!isValidSubscriptionTier(tier)) {
        throw new ValidationError(
            `${fieldName} must be one of: ${SUBSCRIPTION_TIERS.join(', ')}`,
            fieldName
        )
    }
    return tier
}

export function validateMessageContent(content: string, fieldName: string = 'content'): void {
    isRequired(content, fieldName)
    isString(content, fieldName)

    const trimmed = content.trim()
    if (trimmed === '') {
        throw new ValidationError(`${fieldName} cannot be empty`, fieldName)
    }

    const wordCount = trimmed.split(/\s+/).length
    if (wordCount > 40) {
        throw new ValidationError(`${fieldName} must be 40 words or less (currently ${wordCount} words)`, fieldName)
    }
}

export function validatePassword(password: string, fieldName: string = 'password'): void {
    isRequired(password, fieldName)
    isString(password, fieldName)
    minLength(password, 8, fieldName)

    // Check for at least one uppercase, one lowercase, one number
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        throw new ValidationError(
            `${fieldName} must contain at least one uppercase letter, one lowercase letter, and one number`,
            fieldName
        )
    }
}

export function validateTimezone(timezone: string, fieldName: string = 'timezone'): void {
    isRequired(timezone, fieldName)
    isString(timezone, fieldName)

    try {
        // Test if timezone is valid by creating a date with it
        Intl.DateTimeFormat(undefined, { timeZone: timezone })
    } catch (error) {
        throw new ValidationError(`${fieldName} must be a valid timezone`, fieldName)
    }
}

// Composite validation functions
export function validateUserRegistration(data: {
    email: string
    password: string
    timezone?: string
}): void {
    isRequired(data.email, 'email')
    isEmail(data.email, 'email')

    validatePassword(data.password, 'password')

    if (data.timezone) {
        validateTimezone(data.timezone, 'timezone')
    }
}

export function validateMessageGeneration(data: {
    category: string
    userId?: string
}): void {
    validateMessageCategory(data.category, 'category')

    if (data.userId) {
        isUUID(data.userId, 'userId')
    }
}

// Sanitization utilities
export function sanitizeString(value: string): string {
    return value.trim().replace(/\s+/g, ' ')
}

export function sanitizeEmail(email: string): string {
    return email.toLowerCase().trim()
}

export function sanitizeMessageContent(content: string): string {
    return content
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters except common punctuation
}

// Validation result type for batch validation
export interface ValidationResult {
    isValid: boolean
    errors: Array<{ field: string; message: string }>
}

export function validateFields(validations: Array<() => void>): ValidationResult {
    const errors: Array<{ field: string; message: string }> = []

    for (const validation of validations) {
        try {
            validation()
        } catch (error) {
            if (error instanceof ValidationError) {
                errors.push({
                    field: error.field || 'unknown',
                    message: error.message
                })
            } else {
                errors.push({
                    field: 'unknown',
                    message: 'Validation failed'
                })
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    }
}

// Request validation utilities
export function validateRequest<T>(
    schema: any, // zod schema
    data: unknown
): T {
    try {
        return schema.parse(data)
    } catch (error: any) {
        if (error.errors) {
            const firstError = error.errors[0]
            throw new ValidationError(
                `${firstError.path.join('.')}: ${firstError.message}`,
                firstError.path.join('.')
            )
        }
        throw new ValidationError('Invalid request data')
    }
}

export function validateSchema<T>(
    data: unknown,
    schema: any // zod schema
): T {
    return validateRequest<T>(schema, data)
}