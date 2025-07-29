import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BloomFilter, LexicalDeduplicationService } from './bloom-filter'

// Mock logger
vi.mock('../logging', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}))

describe('BloomFilter', () => {
    let bloomFilter: BloomFilter

    beforeEach(() => {
        bloomFilter = new BloomFilter({
            expectedElements: 1000,
            falsePositiveRate: 0.01
        })
    })

    describe('basic operations', () => {
        it('should initialize with correct parameters', () => {
            const stats = bloomFilter.getStats()

            expect(stats.size).toBeGreaterThan(0)
            expect(stats.hashFunctions).toBeGreaterThan(0)
            expect(stats.elementCount).toBe(0)
            expect(stats.bitsSet).toBe(0)
            expect(stats.fillRatio).toBe(0)
        })

        it('should add elements and detect them', () => {
            const element = 'test-element'

            expect(bloomFilter.contains(element)).toBe(false)

            bloomFilter.add(element)

            expect(bloomFilter.contains(element)).toBe(true)

            const stats = bloomFilter.getStats()
            expect(stats.elementCount).toBe(1)
            expect(stats.bitsSet).toBeGreaterThan(0)
        })

        it('should handle multiple elements', () => {
            const elements = ['element1', 'element2', 'element3', 'element4', 'element5']

            // Add all elements
            elements.forEach(element => {
                bloomFilter.add(element)
            })

            // Check all elements are detected
            elements.forEach(element => {
                expect(bloomFilter.contains(element)).toBe(true)
            })

            // Check non-existent element
            expect(bloomFilter.contains('non-existent')).toBe(false)

            const stats = bloomFilter.getStats()
            expect(stats.elementCount).toBe(elements.length)
        })

        it('should clear the filter', () => {
            bloomFilter.add('test')
            expect(bloomFilter.contains('test')).toBe(true)

            bloomFilter.clear()

            expect(bloomFilter.contains('test')).toBe(false)
            const stats = bloomFilter.getStats()
            expect(stats.elementCount).toBe(0)
            expect(stats.bitsSet).toBe(0)
        })
    })

    describe('export and import', () => {
        it('should export and import state correctly', () => {
            const elements = ['test1', 'test2', 'test3']

            elements.forEach(element => bloomFilter.add(element))

            const exportedState = bloomFilter.export()
            const newFilter = new BloomFilter({ expectedElements: 1000, falsePositiveRate: 0.01 })

            newFilter.import(exportedState)

            // Check all elements are still detected
            elements.forEach(element => {
                expect(newFilter.contains(element)).toBe(true)
            })

            const stats = newFilter.getStats()
            expect(stats.elementCount).toBe(elements.length)
        })
    })

    describe('false positive rate', () => {
        it('should maintain reasonable false positive rate', () => {
            // Add many elements
            for (let i = 0; i < 500; i++) {
                bloomFilter.add(`element-${i}`)
            }

            const stats = bloomFilter.getStats()
            expect(stats.estimatedFalsePositiveRate).toBeLessThan(0.1) // Should be less than 10%
        })
    })
})

describe('LexicalDeduplicationService', () => {
    let service: LexicalDeduplicationService

    beforeEach(() => {
        service = new LexicalDeduplicationService({
            expectedElements: 10000,
            falsePositiveRate: 0.01,
            maxCacheSize: 100,
            similarityThreshold: 0.8
        })
    })

    describe('trigram extraction', () => {
        it('should detect identical text as duplicate', () => {
            const text = 'This is a test message'

            service.addText(text)

            expect(service.isPotentialDuplicate(text)).toBe(true)
        })

        it('should detect very similar text as duplicate', () => {
            const originalText = 'This is a test message for deduplication'
            const similarText = 'This is a test message for deduplication!'

            service.addText(originalText)

            expect(service.isPotentialDuplicate(similarText)).toBe(true)
        })

        it('should not detect different text as duplicate', () => {
            const text1 = 'This is a completely different message'
            const text2 = 'Another totally unrelated piece of content'

            service.addText(text1)

            expect(service.isPotentialDuplicate(text2)).toBe(false)
        })

        it('should handle case insensitive comparison', () => {
            const originalText = 'This Is A Test Message'
            const lowerCaseText = 'this is a test message'

            service.addText(originalText)

            expect(service.isPotentialDuplicate(lowerCaseText)).toBe(true)
        })

        it('should handle punctuation differences', () => {
            const originalText = 'Hello, world! How are you?'
            const noPunctuationText = 'Hello world How are you'

            service.addText(originalText)

            expect(service.isPotentialDuplicate(noPunctuationText)).toBe(true)
        })
    })

    describe('threshold sensitivity', () => {
        it('should respect similarity threshold', () => {
            const originalText = 'This is a long test message with many words'
            const partialText = 'This is a test'

            service.addText(originalText)

            // With high threshold (0.9), partial match should not be duplicate
            expect(service.isPotentialDuplicate(partialText, 0.9)).toBe(false)

            // With low threshold (0.3), partial match should be duplicate
            expect(service.isPotentialDuplicate(partialText, 0.3)).toBe(true)
        })
    })

    describe('performance and caching', () => {
        it('should handle many texts efficiently', () => {
            const startTime = Date.now()

            // Add many texts
            for (let i = 0; i < 100; i++) {
                service.addText(`Test message number ${i} with unique content`)
            }

            // Check duplicates
            for (let i = 0; i < 50; i++) {
                service.isPotentialDuplicate(`Test message number ${i} with unique content`)
            }

            const duration = Date.now() - startTime
            expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
        })

        it('should provide meaningful statistics', () => {
            service.addText('Test message 1')
            service.addText('Test message 2')
            service.addText('Test message 3')

            const stats = service.getStats()

            expect(stats.bloomFilter.elementCount).toBeGreaterThan(0)
            expect(stats.cacheSize).toBeGreaterThan(0)
            expect(stats.cacheSize).toBeLessThanOrEqual(stats.maxCacheSize)
        })
    })

    describe('state management', () => {
        it('should export and import state correctly', () => {
            const texts = ['Message 1', 'Message 2', 'Message 3']

            texts.forEach(text => service.addText(text))

            const exportedState = service.export()
            const newService = new LexicalDeduplicationService()

            newService.import(exportedState)

            // Check all texts are still detected as duplicates
            texts.forEach(text => {
                expect(newService.isPotentialDuplicate(text)).toBe(true)
            })
        })

        it('should clear all data', () => {
            service.addText('Test message')
            expect(service.isPotentialDuplicate('Test message')).toBe(true)

            service.clear()

            expect(service.isPotentialDuplicate('Test message')).toBe(false)

            const stats = service.getStats()
            expect(stats.cacheSize).toBeLessThanOrEqual(1) // Cache may have one entry from the duplicate check
            expect(stats.bloomFilter.elementCount).toBe(0)
        })
    })
})