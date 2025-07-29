import { createLogger } from '../logging'

const logger = createLogger('bloom-filter')

export interface BloomFilterConfig {
    expectedElements: number
    falsePositiveRate: number
}

export class BloomFilter {
    private bitArray: boolean[]
    private size: number
    private hashFunctions: number
    private elementCount: number

    constructor(config: BloomFilterConfig) {
        // Calculate optimal bit array size and number of hash functions
        this.size = this.calculateOptimalSize(config.expectedElements, config.falsePositiveRate)
        this.hashFunctions = this.calculateOptimalHashFunctions(this.size, config.expectedElements)
        this.bitArray = new Array(this.size).fill(false)
        this.elementCount = 0

        logger.info('Bloom filter initialized', {
            size: this.size,
            hashFunctions: this.hashFunctions,
            expectedElements: config.expectedElements,
            falsePositiveRate: config.falsePositiveRate
        })
    }

    /**
     * Add an element to the Bloom filter
     */
    add(element: string): void {
        const hashes = this.getHashes(element)

        for (const hash of hashes) {
            this.bitArray[hash] = true
        }

        this.elementCount++
    }

    /**
     * Check if an element might be in the set
     * Returns true if element might be present (could be false positive)
     * Returns false if element is definitely not present
     */
    contains(element: string): boolean {
        const hashes = this.getHashes(element)

        for (const hash of hashes) {
            if (!this.bitArray[hash]) {
                return false
            }
        }

        return true
    }

    /**
     * Get current false positive probability
     */
    getCurrentFalsePositiveRate(): number {
        const ratio = this.elementCount / this.size
        return Math.pow(1 - Math.exp(-this.hashFunctions * ratio), this.hashFunctions)
    }

    /**
     * Get filter statistics
     */
    getStats(): {
        size: number
        hashFunctions: number
        elementCount: number
        bitsSet: number
        fillRatio: number
        estimatedFalsePositiveRate: number
    } {
        const bitsSet = this.bitArray.filter(bit => bit).length

        return {
            size: this.size,
            hashFunctions: this.hashFunctions,
            elementCount: this.elementCount,
            bitsSet,
            fillRatio: bitsSet / this.size,
            estimatedFalsePositiveRate: this.getCurrentFalsePositiveRate()
        }
    }

    /**
     * Clear the filter
     */
    clear(): void {
        this.bitArray.fill(false)
        this.elementCount = 0

        logger.info('Bloom filter cleared')
    }

    /**
     * Export filter state for persistence
     */
    export(): {
        bitArray: boolean[]
        size: number
        hashFunctions: number
        elementCount: number
    } {
        return {
            bitArray: [...this.bitArray],
            size: this.size,
            hashFunctions: this.hashFunctions,
            elementCount: this.elementCount
        }
    }

    /**
     * Import filter state from persistence
     */
    import(state: {
        bitArray: boolean[]
        size: number
        hashFunctions: number
        elementCount: number
    }): void {
        this.bitArray = [...state.bitArray]
        this.size = state.size
        this.hashFunctions = state.hashFunctions
        this.elementCount = state.elementCount

        logger.info('Bloom filter state imported', {
            size: this.size,
            elementCount: this.elementCount
        })
    }

    /**
     * Calculate optimal bit array size
     */
    private calculateOptimalSize(expectedElements: number, falsePositiveRate: number): number {
        return Math.ceil(-(expectedElements * Math.log(falsePositiveRate)) / (Math.log(2) ** 2))
    }

    /**
     * Calculate optimal number of hash functions
     */
    private calculateOptimalHashFunctions(size: number, expectedElements: number): number {
        return Math.max(1, Math.round((size / expectedElements) * Math.log(2)))
    }

    /**
     * Generate hash values for an element
     */
    private getHashes(element: string): number[] {
        const hashes: number[] = []

        // Use two hash functions and combine them to generate multiple hashes
        const hash1 = this.djb2Hash(element)
        const hash2 = this.sdbmHash(element)

        for (let i = 0; i < this.hashFunctions; i++) {
            const combinedHash = (hash1 + i * hash2) % this.size
            hashes.push(Math.abs(combinedHash))
        }

        return hashes
    }

    /**
     * DJB2 hash function
     */
    private djb2Hash(str: string): number {
        let hash = 5381
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i)
        }
        return hash
    }

    /**
     * SDBM hash function
     */
    private sdbmHash(str: string): number {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash
        }
        return hash
    }
}

/**
 * Lexical deduplication service using Bloom filter for trigrams
 */
export class LexicalDeduplicationService {
    private bloomFilter: BloomFilter
    private trigramCache: Map<string, Set<string>>
    private maxCacheSize: number

    constructor(config?: BloomFilterConfig & { maxCacheSize?: number }) {
        const defaultConfig = {
            expectedElements: 100000, // Expected number of trigrams
            falsePositiveRate: 0.01,  // 1% false positive rate
            maxCacheSize: 1000        // Maximum cached trigram sets
        }

        const finalConfig = { ...defaultConfig, ...config }

        this.bloomFilter = new BloomFilter(finalConfig)
        this.trigramCache = new Map()
        this.maxCacheSize = finalConfig.maxCacheSize

        logger.info('Lexical deduplication service initialized', {
            maxCacheSize: this.maxCacheSize
        })
    }

    /**
     * Extract trigrams from text
     */
    private extractTrigrams(text: string): Set<string> {
        // Check cache first
        if (this.trigramCache.has(text)) {
            return this.trigramCache.get(text)!
        }

        const trigrams = new Set<string>()
        const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()

        // Add word boundary markers
        const paddedText = `  ${normalizedText}  `

        // Extract character trigrams
        for (let i = 0; i <= paddedText.length - 3; i++) {
            const trigram = paddedText.substring(i, i + 3)
            if (trigram.trim().length > 0) {
                trigrams.add(trigram)
            }
        }

        // Cache the result (with LRU eviction)
        if (this.trigramCache.size >= this.maxCacheSize) {
            const firstKey = this.trigramCache.keys().next().value
            this.trigramCache.delete(firstKey)
        }
        this.trigramCache.set(text, trigrams)

        return trigrams
    }

    /**
     * Add text to the lexical deduplication filter
     */
    addText(text: string): void {
        const trigrams = this.extractTrigrams(text)

        for (const trigram of trigrams) {
            this.bloomFilter.add(trigram)
        }

        logger.debug('Text added to lexical deduplication filter', {
            textLength: text.length,
            trigramCount: trigrams.size
        })
    }

    /**
     * Check if text is potentially duplicate based on trigram overlap
     */
    isPotentialDuplicate(text: string, threshold: number = 0.8): boolean {
        const trigrams = this.extractTrigrams(text)
        let matchingTrigrams = 0

        for (const trigram of trigrams) {
            if (this.bloomFilter.contains(trigram)) {
                matchingTrigrams++
            }
        }

        const similarity = trigrams.size > 0 ? matchingTrigrams / trigrams.size : 0
        const isDuplicate = similarity >= threshold

        logger.debug('Lexical duplicate check completed', {
            textLength: text.length,
            trigramCount: trigrams.size,
            matchingTrigrams,
            similarity,
            threshold,
            isDuplicate
        })

        return isDuplicate
    }

    /**
     * Get service statistics
     */
    getStats(): {
        bloomFilter: ReturnType<BloomFilter['getStats']>
        cacheSize: number
        maxCacheSize: number
    } {
        return {
            bloomFilter: this.bloomFilter.getStats(),
            cacheSize: this.trigramCache.size,
            maxCacheSize: this.maxCacheSize
        }
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.bloomFilter.clear()
        this.trigramCache.clear()

        logger.info('Lexical deduplication service cleared')
    }

    /**
     * Export state for persistence
     */
    export(): {
        bloomFilter: ReturnType<BloomFilter['export']>
        trigramCache: Array<[string, string[]]>
    } {
        return {
            bloomFilter: this.bloomFilter.export(),
            trigramCache: Array.from(this.trigramCache.entries()).map(([key, value]) => [key, Array.from(value)])
        }
    }

    /**
     * Import state from persistence
     */
    import(state: {
        bloomFilter: Parameters<BloomFilter['import']>[0]
        trigramCache: Array<[string, string[]]>
    }): void {
        this.bloomFilter.import(state.bloomFilter)
        this.trigramCache.clear()

        for (const [key, value] of state.trigramCache) {
            this.trigramCache.set(key, new Set(value))
        }

        logger.info('Lexical deduplication service state imported')
    }
}