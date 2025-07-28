import { describe, it, expect } from 'vitest'
import {
    isRequired,
    isString,
    isNumber,
    isEmail,
    isUUID,
    minLength,
    maxLength,
    validateMessageCategory,
    validateSubscriptionTier,
    validateMessageContent,
    validatePassword,
    validateTimezone,
    validateUserRegistration,
    validateMessageGeneration,
    sanitizeString,
    sanitizeEmail,
    sanitizeMessageContent,
    validateFields
} from './validation'
import { ValidationError } from './errors'

describe('validation', () => {
    describe('basic validation functions', () => {
        describe('isRequired', () => {
            it('should pass for valid values', () => {
                expect(() => isRequired('test', 'field')).not.toThrow()
                expect(() => isRequired(0, 'field')).not.toThrow()
                expect(() => isRequired(false, 'field')).not.toThrow()
            })

            it('should throw for invalid values', () => {
                expect(() => isRequired(null, 'field')).toThrow(ValidationError)
                expect(() => isRequired(undefined, 'field')).toThrow(ValidationError)
                expect(() => isRequired('', 'field')).toThrow(ValidationError)
            })
        })

        describe('isEmail', () => {
            it('should pass for valid emails', () => {
                expect(() => isEmail('test@example.com', 'email')).not.toThrow()
                expect(() => isEmail('user.name+tag@domain.co.uk', 'email')).not.toThrow()
            })

            it('should throw for invalid emails', () => {
                expect(() => isEmail('invalid-email', 'email')).toThrow(ValidationError)
                expect(() => isEmail('@domain.com', 'email')).toThrow(ValidationError)
                expect(() => isEmail('user@', 'email')).toThrow(ValidationError)
            })
        })

        describe('isUUID', () => {
            it('should pass for valid UUIDs', () => {
                expect(() => isUUID('123e4567-e89b-12d3-a456-426614174000', 'id')).not.toThrow()
            })

            it('should throw for invalid UUIDs', () => {
                expect(() => isUUID('not-a-uuid', 'id')).toThrow(ValidationError)
                expect(() => isUUID('123e4567-e89b-12d3-a456', 'id')).toThrow(ValidationError)
            })
        })
    })

    describe('AuraFlow-specific validation', () => {
        describe('validateMessageCategory', () => {
            it('should pass for valid categories', () => {
                expect(validateMessageCategory('motivational')).toBe('motivational')
                expect(validateMessageCategory('mindfulness')).toBe('mindfulness')
                expect(validateMessageCategory('fitness')).toBe('fitness')
                expect(validateMessageCategory('philosophy')).toBe('philosophy')
                expect(validateMessageCategory('productivity')).toBe('productivity')
            })

            it('should throw for invalid categories', () => {
                expect(() => validateMessageCategory('invalid')).toThrow(ValidationError)
                expect(() => validateMessageCategory('')).toThrow(ValidationError)
            })
        })

        describe('validateSubscriptionTier', () => {
            it('should pass for valid tiers', () => {
                expect(validateSubscriptionTier('free')).toBe('free')
                expect(validateSubscriptionTier('premium_core')).toBe('premium_core')
                expect(validateSubscriptionTier('voice_pack')).toBe('voice_pack')
            })

            it('should throw for invalid tiers', () => {
                expect(() => validateSubscriptionTier('invalid')).toThrow(ValidationError)
                expect(() => validateSubscriptionTier('premium')).toThrow(ValidationError)
            })
        })

        describe('validateMessageContent', () => {
            it('should pass for valid content', () => {
                expect(() => validateMessageContent('This is a valid message')).not.toThrow()
                expect(() => validateMessageContent('Short')).not.toThrow()
            })

            it('should throw for empty content', () => {
                expect(() => validateMessageContent('')).toThrow(ValidationError)
                expect(() => validateMessageContent('   ')).toThrow(ValidationError)
            })

            it('should throw for content exceeding word limit', () => {
                const longMessage = 'This is a very long message that exceeds the forty word limit for AuraFlow messages and should be rejected by the validation function because it contains too many words for optimal mobile consumption and user experience which makes it unsuitable for the platform and its design goals and requirements'
                expect(() => validateMessageContent(longMessage)).toThrow(ValidationError)
            })
        })

        describe('validatePassword', () => {
            it('should pass for valid passwords', () => {
                expect(() => validatePassword('Password123')).not.toThrow()
                expect(() => validatePassword('MySecure1Pass')).not.toThrow()
            })

            it('should throw for invalid passwords', () => {
                expect(() => validatePassword('short')).toThrow(ValidationError)
                expect(() => validatePassword('nouppercase123')).toThrow(ValidationError)
                expect(() => validatePassword('NOLOWERCASE123')).toThrow(ValidationError)
                expect(() => validatePassword('NoNumbers')).toThrow(ValidationError)
            })
        })

        describe('validateTimezone', () => {
            it('should pass for valid timezones', () => {
                expect(() => validateTimezone('America/New_York')).not.toThrow()
                expect(() => validateTimezone('Europe/London')).not.toThrow()
                expect(() => validateTimezone('UTC')).not.toThrow()
            })

            it('should throw for invalid timezones', () => {
                expect(() => validateTimezone('Invalid/Timezone')).toThrow(ValidationError)
                expect(() => validateTimezone('NotATimezone')).toThrow(ValidationError)
            })
        })
    })

    describe('composite validation functions', () => {
        describe('validateUserRegistration', () => {
            it('should pass for valid registration data', () => {
                expect(() => validateUserRegistration({
                    email: 'test@example.com',
                    password: 'Password123',
                    timezone: 'America/New_York'
                })).not.toThrow()
            })

            it('should throw for invalid email', () => {
                expect(() => validateUserRegistration({
                    email: 'invalid-email',
                    password: 'Password123'
                })).toThrow(ValidationError)
            })

            it('should throw for invalid password', () => {
                expect(() => validateUserRegistration({
                    email: 'test@example.com',
                    password: 'weak'
                })).toThrow(ValidationError)
            })
        })

        describe('validateMessageGeneration', () => {
            it('should pass for valid generation data', () => {
                expect(() => validateMessageGeneration({
                    category: 'motivational',
                    userId: '123e4567-e89b-12d3-a456-426614174000'
                })).not.toThrow()
            })

            it('should pass without userId', () => {
                expect(() => validateMessageGeneration({
                    category: 'motivational'
                })).not.toThrow()
            })

            it('should throw for invalid category', () => {
                expect(() => validateMessageGeneration({
                    category: 'invalid'
                })).toThrow(ValidationError)
            })
        })
    })

    describe('sanitization functions', () => {
        describe('sanitizeString', () => {
            it('should trim and normalize whitespace', () => {
                expect(sanitizeString('  hello   world  ')).toBe('hello world')
                expect(sanitizeString('test\n\tstring')).toBe('test string')
            })
        })

        describe('sanitizeEmail', () => {
            it('should lowercase and trim email', () => {
                expect(sanitizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com')
            })
        })

        describe('sanitizeMessageContent', () => {
            it('should clean message content', () => {
                expect(sanitizeMessageContent('  Hello,   world!  ')).toBe('Hello, world!')
                expect(sanitizeMessageContent('Test@#$%message')).toBe('Testmessage')
            })
        })
    })

    describe('validateFields', () => {
        it('should return valid result for passing validations', () => {
            const result = validateFields([
                () => isRequired('test', 'field1'),
                () => isEmail('test@example.com', 'field2')
            ])

            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should return invalid result with errors', () => {
            const result = validateFields([
                () => isRequired('', 'field1'),
                () => isEmail('invalid-email', 'field2')
            ])

            expect(result.isValid).toBe(false)
            expect(result.errors).toHaveLength(2)
            expect(result.errors[0]).toMatchObject({
                field: 'field1',
                message: 'field1 is required'
            })
            expect(result.errors[1]).toMatchObject({
                field: 'field2',
                message: 'field2 must be a valid email address'
            })
        })
    })
})