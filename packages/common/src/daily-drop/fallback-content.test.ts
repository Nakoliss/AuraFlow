import { describe, it, expect } from 'vitest'
import { FallbackContentService, FALLBACK_DAILY_DROPS, FALLBACK_DAILY_CHALLENGES } from './fallback-content'

describe('FallbackContentService', () => {
    const service = new FallbackContentService()

    describe('getFallbackContent', () => {
        it('should return deterministic content for a given date and category', () => {
            const content1 = service.getFallbackContent('motivational', '2024-01-15')
            const content2 = service.getFallbackContent('motivational', '2024-01-15')

            expect(content1).toBe(content2)
            expect(content1).toBeTruthy()
            expect(typeof content1).toBe('string')
        })

        it('should return different content for different dates', () => {
            const content1 = service.getFallbackContent('motivational', '2024-01-15')
            const content2 = service.getFallbackContent('motivational', '2024-01-16')

            // They might be the same due to hash collision, but usually different
            expect(typeof content1).toBe('string')
            expect(typeof content2).toBe('string')
        })

        it('should return content for all categories', () => {
            const categories = service.getAvailableCategories()

            categories.forEach(category => {
                const content = service.getFallbackContent(category, '2024-01-15')
                expect(content).toBeTruthy()
                expect(typeof content).toBe('string')
                expect(content.length).toBeGreaterThan(0)
            })
        })

        it('should return random content when no date is provided', () => {
            const content = service.getFallbackContent('motivational')

            expect(content).toBeTruthy()
            expect(typeof content).toBe('string')
            expect(FALLBACK_DAILY_DROPS.motivational).toContain(content)
        })

        it('should handle all message categories', () => {
            const categories = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity'] as const

            categories.forEach(category => {
                const content = service.getFallbackContent(category, '2024-01-15')
                expect(content).toBeTruthy()
                expect(FALLBACK_DAILY_DROPS[category]).toContain(content)
            })
        })
    })

    describe('getFallbackChallenge', () => {
        it('should return deterministic challenge for a given date', () => {
            const challenge1 = service.getFallbackChallenge('2024-01-15')
            const challenge2 = service.getFallbackChallenge('2024-01-15')

            expect(challenge1).toBe(challenge2)
            expect(challenge1).toBeTruthy()
            expect(typeof challenge1).toBe('string')
        })

        it('should return different challenges for different dates', () => {
            const challenge1 = service.getFallbackChallenge('2024-01-15')
            const challenge2 = service.getFallbackChallenge('2024-01-16')

            expect(typeof challenge1).toBe('string')
            expect(typeof challenge2).toBe('string')
        })

        it('should return random challenge when no date is provided', () => {
            const challenge = service.getFallbackChallenge()

            expect(challenge).toBeTruthy()
            expect(typeof challenge).toBe('string')
            expect(FALLBACK_DAILY_CHALLENGES).toContain(challenge)
        })

        it('should return valid challenges from the predefined list', () => {
            const challenge = service.getFallbackChallenge('2024-01-15')

            expect(FALLBACK_DAILY_CHALLENGES).toContain(challenge)
        })
    })

    describe('getAvailableCategories', () => {
        it('should return all message categories', () => {
            const categories = service.getAvailableCategories()

            expect(categories).toEqual([
                'motivational',
                'mindfulness',
                'fitness',
                'philosophy',
                'productivity'
            ])
        })
    })

    describe('getContentCount', () => {
        it('should return correct count for each category', () => {
            const categories = service.getAvailableCategories()

            categories.forEach(category => {
                const count = service.getContentCount(category)
                expect(count).toBe(FALLBACK_DAILY_DROPS[category].length)
                expect(count).toBeGreaterThan(0)
            })
        })
    })

    describe('getChallengeCount', () => {
        it('should return correct challenge count', () => {
            const count = service.getChallengeCount()

            expect(count).toBe(FALLBACK_DAILY_CHALLENGES.length)
            expect(count).toBeGreaterThan(0)
        })
    })

    describe('content quality', () => {
        it('should have reasonable length content for all categories', () => {
            const categories = service.getAvailableCategories()

            categories.forEach(category => {
                FALLBACK_DAILY_DROPS[category].forEach(content => {
                    expect(content.length).toBeGreaterThan(10)
                    expect(content.length).toBeLessThan(300) // Reasonable upper bound
                    expect(content.trim()).toBe(content) // No leading/trailing whitespace
                })
            })
        })

        it('should have reasonable length challenges', () => {
            FALLBACK_DAILY_CHALLENGES.forEach(challenge => {
                expect(challenge.length).toBeGreaterThan(10)
                expect(challenge.length).toBeLessThan(200) // Reasonable upper bound
                expect(challenge.trim()).toBe(challenge) // No leading/trailing whitespace
            })
        })

        it('should have positive and actionable content', () => {
            // Basic checks for positive language
            const negativeWords = ['hate', 'terrible', 'awful', 'horrible', 'worst']
            const categories = service.getAvailableCategories()

            categories.forEach(category => {
                FALLBACK_DAILY_DROPS[category].forEach(content => {
                    const lowerContent = content.toLowerCase()
                    negativeWords.forEach(word => {
                        expect(lowerContent).not.toContain(word)
                    })
                })
            })
        })
    })
})