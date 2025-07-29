import { MessageCategory, PromptTemplate, TimeOfDay, WeatherBucket } from './types'

// Base prompt templates for each category
const PROMPT_TEMPLATES: Record<MessageCategory, PromptTemplate> = {
    motivational: {
        category: 'motivational',
        systemPrompt: `You are a wise, encouraging mentor who helps people overcome challenges and achieve their goals. Your responses should be uplifting, actionable, and inspiring. Focus on inner strength, resilience, and personal growth.`,
        userPrompt: `Generate a motivational message that is exactly 40 words or fewer. The message should be encouraging, actionable, and help someone push through challenges. Make it personal and relatable.`,
        maxTokens: 60,
        temperature: 0.8
    },
    mindfulness: {
        category: 'mindfulness',
        systemPrompt: `You are a mindfulness teacher who helps people find peace, presence, and awareness in their daily lives. Your responses should be calming, grounding, and focused on the present moment.`,
        userPrompt: `Generate a mindfulness message that is exactly 40 words or fewer. The message should help someone become more present, aware, and peaceful. Focus on breathing, observation, or gentle awareness.`,
        maxTokens: 60,
        temperature: 0.7
    },
    fitness: {
        category: 'fitness',
        systemPrompt: `You are an encouraging fitness coach who motivates people to move their bodies and prioritize their physical health. Your responses should be energizing, practical, and focused on movement and wellness.`,
        userPrompt: `Generate a fitness message that is exactly 40 words or fewer. The message should motivate someone to move their body, exercise, or prioritize their physical health. Make it encouraging and actionable.`,
        maxTokens: 60,
        temperature: 0.8
    },
    philosophy: {
        category: 'philosophy',
        systemPrompt: `You are a thoughtful philosopher who helps people reflect on life's deeper meanings and find wisdom in everyday experiences. Your responses should be contemplative, insightful, and thought-provoking.`,
        userPrompt: `Generate a philosophical message that is exactly 40 words or fewer. The message should offer wisdom, provoke thoughtful reflection, or provide insight into life's deeper meanings. Make it contemplative and meaningful.`,
        maxTokens: 60,
        temperature: 0.9
    },
    productivity: {
        category: 'productivity',
        systemPrompt: `You are a productivity expert who helps people focus, organize, and accomplish their goals efficiently. Your responses should be practical, actionable, and focused on getting things done.`,
        userPrompt: `Generate a productivity message that is exactly 40 words or fewer. The message should help someone focus, organize their tasks, or work more efficiently. Make it practical and immediately actionable.`,
        maxTokens: 60,
        temperature: 0.7
    }
}

// Context modifiers for time of day
const TIME_MODIFIERS: Record<TimeOfDay, string> = {
    morning: "This is for someone starting their morning. Make it energizing and set a positive tone for the day ahead.",
    evening: "This is for someone ending their day. Make it reflective, calming, and help them wind down or reflect on their day."
}

// Context modifiers for weather
const WEATHER_MODIFIERS: Record<WeatherBucket, string> = {
    sunny: "It's a beautiful sunny day. Reference the brightness, energy, and positivity that comes with sunshine.",
    rain: "It's a rainy day. Reference the cozy, reflective, or cleansing aspects of rain while maintaining positivity.",
    cold: "It's cold outside. Reference warmth, comfort, or the invigorating aspects of crisp weather.",
    hot: "It's hot outside. Reference staying cool, finding shade, or the energy that comes with warm weather."
}

export class PromptTemplateService {
    /**
     * Get the base prompt template for a category
     */
    getTemplate(category: MessageCategory): PromptTemplate {
        return { ...PROMPT_TEMPLATES[category] }
    }

    /**
     * Build a contextualized prompt with time and weather context
     */
    buildContextualPrompt(
        category: MessageCategory,
        timeOfDay?: TimeOfDay,
        weatherContext?: WeatherBucket
    ): { systemPrompt: string; userPrompt: string } {
        const template = this.getTemplate(category)
        let contextualUserPrompt = template.userPrompt

        // Add time context
        if (timeOfDay) {
            contextualUserPrompt += ` ${TIME_MODIFIERS[timeOfDay]}`
        }

        // Add weather context
        if (weatherContext) {
            contextualUserPrompt += ` ${WEATHER_MODIFIERS[weatherContext]}`
        }

        return {
            systemPrompt: template.systemPrompt,
            userPrompt: contextualUserPrompt
        }
    }

    /**
     * Get all available categories
     */
    getAvailableCategories(): MessageCategory[] {
        return Object.keys(PROMPT_TEMPLATES) as MessageCategory[]
    }

    /**
     * Validate if a category exists
     */
    isValidCategory(category: string): category is MessageCategory {
        return category in PROMPT_TEMPLATES
    }
}

export const promptTemplateService = new PromptTemplateService()