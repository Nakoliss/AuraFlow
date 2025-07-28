import { describe, it, expect } from 'vitest'
import { generateId, formatDate, isValidEmail, getWordCount, isValidMessageContent } from './utils'

describe('utils', () => {
    describe('generateId', () => {
        it('should generate a valid UUID', () => {
            const id = generateId()
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        })
    })

    describe('formatDate', () => {
        it('should format date as YYYY-MM-DD', () => {
            const date = new Date('2023-12-25T10:30:00Z')
            expect(formatDate(date)).toBe('2023-12-25')
        })
    })

    describe('isValidEmail', () => {
        it('should validate correct email addresses', () => {
            expect(isValidEmail('test@example.com')).toBe(true)
            expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true)
        })

        it('should reject invalid email addresses', () => {
            expect(isValidEmail('invalid-email')).toBe(false)
            expect(isValidEmail('@domain.com')).toBe(false)
            expect(isValidEmail('user@')).toBe(false)
        })
    })

    describe('getWordCount', () => {
        it('should count words correctly', () => {
            expect(getWordCount('Hello world')).toBe(2)
            expect(getWordCount('  Multiple   spaces   between  words  ')).toBe(4)
            expect(getWordCount('')).toBe(0)
        })
    })

    describe('isValidMessageContent', () => {
        it('should validate messages within word limit', () => {
            const validMessage = 'This is a short motivational message'
            expect(isValidMessageContent(validMessage)).toBe(true)
        })

        it('should reject messages exceeding word limit', () => {
            const longMessage = 'This is a very long message that exceeds the forty word limit for AuraFlow messages and should be rejected by the validation function because it contains too many words for optimal mobile consumption and user experience which makes it unsuitable for the platform and its design goals and requirements'
            expect(isValidMessageContent(longMessage)).toBe(false)
        })

        it('should reject empty messages', () => {
            expect(isValidMessageContent('')).toBe(false)
            expect(isValidMessageContent('   ')).toBe(false)
        })
    })
})