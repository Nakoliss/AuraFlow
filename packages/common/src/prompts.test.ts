import { describe, it, expect } from 'vitest'
import { PromptTemplateService, promptTemplateService } from './prompts'
import { MessageCategory } from './types'

describe('PromptTemplateService', () => {
    describe('getTemplate', () => {
        it('should return template for valid category', () => {
            const template = promptTemplateService.getTemplate('motivational')

            expect(template).toMatchObject({
                category: 'motivational',
                systemPrompt: expect.stringContaining('wise, encouraging mentor'),
                userPrompt: expect.stringContaining('motivational message'),
                maxTokens: 60,
                temperature: 0.8
            })
        })

        it('should return different templates for different categories', () => {
            const motivationalTemplate = promptTemplateService.getTemplate('motivational')
            const mindfulnessTemplate = promptTemplateService.getTemplate('mindfulness')

            expect(motivationalTemplate.systemPrompt).not.toBe(mindfulnessTemplate.systemPrompt)
            expect(motivationalTemplate.userPrompt).not.toBe(mindfulnessTemplate.userPrompt)
        })

        it('should return templates for all categories', () => {
            const categories: MessageCategory[] = ['motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity']

            categories.forEach(category => {
                const template = promptTemplateService.getTemplate(category)
                expect(template.category).toBe(category)
                expect(template.systemPrompt).toBeTruthy()
                expect(template.userPrompt).toBeTruthy()
                expect(template.maxTokens).toBeGreaterThan(0)
                expect(template.temperature).toBeGreaterThan(0)
            })
        })
    })

    describe('buildContextualPrompt', () => {
        it('should return base prompt without context', () => {
            const result = promptTemplateService.buildContextualPrompt('motivational')

            expect(result.systemPrompt).toContain('wise, encouraging mentor')
            expect(result.userPrompt).toContain('motivational message')
            expect(result.userPrompt).not.toContain('morning')
            expect(result.userPrompt).not.toContain('sunny')
        })

        it('should add time context to user prompt', () => {
            const result = promptTemplateService.buildContextualPrompt('motivational', 'morning')

            expect(result.userPrompt).toContain('starting their morning')
            expect(result.userPrompt).toContain('energizing')
        })

        it('should add weather context to user prompt', () => {
            const result = promptTemplateService.buildContextualPrompt('motivational', undefined, 'sunny')

            expect(result.userPrompt).toContain('sunny day')
            expect(result.userPrompt).toContain('brightness')
        })

        it('should add both time and weather context', () => {
            const result = promptTemplateService.buildContextualPrompt('motivational', 'evening', 'rain')

            expect(result.userPrompt).toContain('ending their day')
            expect(result.userPrompt).toContain('rainy day')
        })

        it('should handle different time contexts', () => {
            const morningResult = promptTemplateService.buildContextualPrompt('motivational', 'morning')
            const eveningResult = promptTemplateService.buildContextualPrompt('motivational', 'evening')

            expect(morningResult.userPrompt).toContain('starting their morning')
            expect(eveningResult.userPrompt).toContain('ending their day')
        })

        it('should handle different weather contexts', () => {
            const sunnyResult = promptTemplateService.buildContextualPrompt('motivational', undefined, 'sunny')
            const rainyResult = promptTemplateService.buildContextualPrompt('motivational', undefined, 'rain')
            const coldResult = promptTemplateService.buildContextualPrompt('motivational', undefined, 'cold')
            const hotResult = promptTemplateService.buildContextualPrompt('motivational', undefined, 'hot')

            expect(sunnyResult.userPrompt).toContain('sunny')
            expect(rainyResult.userPrompt).toContain('rainy')
            expect(coldResult.userPrompt).toContain('cold')
            expect(hotResult.userPrompt).toContain('hot')
        })
    })

    describe('getAvailableCategories', () => {
        it('should return all available categories', () => {
            const categories = promptTemplateService.getAvailableCategories()

            expect(categories).toHaveLength(5)
            expect(categories).toContain('motivational')
            expect(categories).toContain('mindfulness')
            expect(categories).toContain('fitness')
            expect(categories).toContain('philosophy')
            expect(categories).toContain('productivity')
        })
    })

    describe('isValidCategory', () => {
        it('should return true for valid categories', () => {
            expect(promptTemplateService.isValidCategory('motivational')).toBe(true)
            expect(promptTemplateService.isValidCategory('mindfulness')).toBe(true)
            expect(promptTemplateService.isValidCategory('fitness')).toBe(true)
            expect(promptTemplateService.isValidCategory('philosophy')).toBe(true)
            expect(promptTemplateService.isValidCategory('productivity')).toBe(true)
        })

        it('should return false for invalid categories', () => {
            expect(promptTemplateService.isValidCategory('invalid')).toBe(false)
            expect(promptTemplateService.isValidCategory('')).toBe(false)
            expect(promptTemplateService.isValidCategory('MOTIVATIONAL')).toBe(false)
        })
    })

    describe('template consistency', () => {
        it('should have consistent word limits in all templates', () => {
            const categories = promptTemplateService.getAvailableCategories()

            categories.forEach(category => {
                const template = promptTemplateService.getTemplate(category)
                expect(template.userPrompt).toContain('40 words or fewer')
            })
        })

        it('should have reasonable token limits for all templates', () => {
            const categories = promptTemplateService.getAvailableCategories()

            categories.forEach(category => {
                const template = promptTemplateService.getTemplate(category)
                expect(template.maxTokens).toBeGreaterThanOrEqual(50)
                expect(template.maxTokens).toBeLessThanOrEqual(100)
            })
        })

        it('should have reasonable temperature values for all templates', () => {
            const categories = promptTemplateService.getAvailableCategories()

            categories.forEach(category => {
                const template = promptTemplateService.getTemplate(category)
                expect(template.temperature).toBeGreaterThanOrEqual(0.5)
                expect(template.temperature).toBeLessThanOrEqual(1.0)
            })
        })
    })
})