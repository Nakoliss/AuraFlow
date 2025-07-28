// Shared utility functions
export function generateId(): string {
    return crypto.randomUUID()
}

export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
}

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength).trim() + '...'
}

export function getWordCount(text: string): number {
    const trimmed = text.trim()
    if (trimmed === '') return 0
    return trimmed.split(/\s+/).length
}

export function isValidMessageContent(content: string): boolean {
    const wordCount = getWordCount(content)
    return wordCount > 0 && wordCount <= 40
}