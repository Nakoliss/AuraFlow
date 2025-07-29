import { MessageCategory } from '../types'

// Curated fallback content for when AI generation fails
export const FALLBACK_DAILY_DROPS: Record<MessageCategory, string[]> = {
    motivational: [
        "Today is a new beginning. Every moment offers a fresh start and endless possibilities.",
        "Your potential is limitless. Trust in your ability to overcome challenges and grow stronger.",
        "Small steps forward are still progress. Celebrate every victory, no matter how small.",
        "You have the power to choose your response to any situation. Choose growth and positivity.",
        "Believe in yourself. You are capable of amazing things when you put your mind to it.",
        "Today's challenges are tomorrow's strengths. Embrace the journey of becoming your best self.",
        "Your mindset shapes your reality. Choose thoughts that empower and inspire you forward.",
        "Every day is an opportunity to learn, grow, and become a better version of yourself.",
        "Success is not final, failure is not fatal. It's the courage to continue that counts.",
        "The only impossible journey is the one you never begin. Take that first step today.",
        "Your dreams are valid. Work toward them with patience, persistence, and unwavering faith.",
        "Difficult roads often lead to beautiful destinations. Trust the process and keep moving forward.",
        "You are stronger than you think, braver than you feel, and more capable than you imagine.",
        "Progress, not perfection, is the goal. Every small step counts toward your bigger vision.",
        "Today's struggles are building tomorrow's strength. Embrace the challenge and grow through it."
    ],
    mindfulness: [
        "Take a deep breath. In this moment, you have everything you need to find peace.",
        "Notice the present moment without judgment. Simply observe and let yourself just be.",
        "Your breath is always with you, a constant anchor to the here and now.",
        "Pause and listen. What sounds, sensations, and feelings are present right now?",
        "This moment is the only one that truly exists. Find gratitude in its simple presence.",
        "Let go of what was and what might be. Rest in the gentle awareness of now.",
        "Your thoughts are like clouds passing through the sky of your consciousness. Simply observe.",
        "Feel your feet on the ground. You are here, you are present, you are enough.",
        "Breathe in calm, breathe out tension. Let each breath bring you closer to peace.",
        "Notice five things you can see, four you can hear, three you can touch. Ground yourself.",
        "The present moment is a gift. Unwrap it slowly with gentle, loving attention.",
        "Your mind may wander, and that's okay. Gently return to this breath, this moment.",
        "Find stillness within movement, peace within chaos. Your center is always available to you.",
        "Observe your thoughts with curiosity, not judgment. You are the witness, not the thought.",
        "In this breath, in this heartbeat, in this moment, you are exactly where you need to be."
    ],
    fitness: [
        "Your body is capable of amazing things. Move it with love and appreciation today.",
        "Every step counts. Whether it's one or one thousand, movement is a gift to yourself.",
        "Listen to your body. It knows what it needs to feel strong and energized.",
        "Exercise is not punishment for what you ate. It's celebration of what your body can do.",
        "Start where you are, use what you have, do what you can. Progress begins with action.",
        "Your strongest muscle is your heart. Strengthen it with movement and self-compassion.",
        "Movement is medicine for both body and mind. Prescribe yourself some today.",
        "You don't have to be perfect, just consistent. Small daily actions create lasting change.",
        "Your body carried you through yesterday. Honor it with movement and care today.",
        "Fitness is not about being better than someone else. It's about being better than yesterday.",
        "Dance, walk, stretch, play. Find joy in the simple act of moving your body.",
        "Your energy increases with movement. Give yourself the gift of feeling alive and strong.",
        "Rest is part of fitness too. Listen to your body and honor what it needs.",
        "Every workout is a victory. Celebrate showing up for yourself and your health.",
        "Your body is your home for life. Treat it with the love and care it deserves."
    ],
    philosophy: [
        "The unexamined life is not worth living. Take time today to reflect on your journey.",
        "We are what we repeatedly do. Excellence is not an act, but a habit worth cultivating.",
        "The only true wisdom is knowing that you know nothing. Stay curious and keep learning.",
        "Life is not about finding yourself. It's about creating yourself through your choices.",
        "The meaning of life is to give life meaning. What will you contribute to the world today?",
        "We suffer more in imagination than reality. Focus on what is, not what might be.",
        "The best time to plant a tree was 20 years ago. The second best time is now.",
        "You cannot step into the same river twice. Embrace change as life's only constant.",
        "The cave you fear to enter holds the treasure you seek. Face your fears with courage.",
        "We are not human beings having a spiritual experience, but spiritual beings having a human experience.",
        "The quality of your life is determined by the quality of questions you ask yourself.",
        "Happiness is not a destination, but a way of traveling through life's journey.",
        "The greatest revolution of our generation is the discovery that we can alter our lives by altering our attitudes.",
        "We become what we think about most. Choose your thoughts as carefully as your actions.",
        "The purpose of life is not to be happy, but to matter, to be productive, to be useful."
    ],
    productivity: [
        "Focus on progress, not perfection. Small consistent actions lead to extraordinary results.",
        "Your most important task deserves your best energy. Tackle it when you're at your peak.",
        "Clarity comes from action, not thought. Start before you feel ready and adjust as you go.",
        "The secret to getting ahead is getting started. Take one small step toward your goal today.",
        "Time is your most valuable resource. Invest it wisely in what truly matters to you.",
        "Done is better than perfect. Ship your work and improve it through iteration and feedback.",
        "Your future self will thank you for the focused work you do today. Make it count.",
        "Eliminate the non-essential to make room for what's truly important. Less but better.",
        "Energy management beats time management. Work with your natural rhythms, not against them.",
        "The compound effect of small daily improvements creates remarkable long-term results.",
        "Single-tasking is a superpower in a multitasking world. Give your full attention to one thing.",
        "Your environment shapes your behavior. Design your space to support your most important work.",
        "Procrastination is often perfectionism in disguise. Start messy and refine as you go.",
        "The best productivity system is the one you actually use. Keep it simple and sustainable.",
        "Rest is not a reward for work completed, but a requirement for work to be done well."
    ]
}

export const FALLBACK_DAILY_CHALLENGES: string[] = [
    "Write down three things you're grateful for today and why they matter to you.",
    "Take a 5-minute walk and notice five beautiful things around you.",
    "Send a genuine compliment or thank you message to someone who made your day better.",
    "Practice deep breathing for 2 minutes when you feel stressed or overwhelmed.",
    "Do one small act of kindness for a stranger, friend, or family member.",
    "Spend 5 minutes organizing one small area of your living or work space.",
    "Listen to your favorite song and let yourself fully enjoy the moment.",
    "Write down one thing you learned today, no matter how small.",
    "Take a photo of something that brings you joy and reflect on why.",
    "Reach out to someone you haven't spoken to in a while just to say hello.",
    "Practice saying 'no' to something that doesn't align with your priorities today.",
    "Spend 5 minutes in silence, just observing your thoughts without judgment.",
    "Do something creative for 10 minutes - draw, write, sing, or build something.",
    "Help someone else with a task or problem, even if it's just offering encouragement.",
    "Take three conscious, deep breaths before starting your most important task today.",
    "Write down one goal for tomorrow and one small step you can take toward it.",
    "Practice good posture for 10 minutes and notice how it affects your energy.",
    "Drink an extra glass of water and pay attention to how your body feels.",
    "Spend 5 minutes decluttering your digital space - delete old files or organize photos.",
    "Give yourself permission to rest for 10 minutes without feeling guilty about it."
]

export class FallbackContentService {
    /**
     * Get fallback content for a specific category
     */
    getFallbackContent(category: MessageCategory, date?: string): string {
        const categoryContent = FALLBACK_DAILY_DROPS[category]

        if (date) {
            // Use date to deterministically select content
            const dateHash = date.split('-').reduce((acc, part) => acc + parseInt(part), 0)
            const index = dateHash % categoryContent.length
            return categoryContent[index]
        }

        // Random selection if no date provided
        const randomIndex = Math.floor(Math.random() * categoryContent.length)
        return categoryContent[randomIndex]
    }

    /**
     * Get fallback daily challenge
     */
    getFallbackChallenge(date?: string): string {
        if (date) {
            // Use date to deterministically select challenge
            const dateHash = date.split('-').reduce((acc, part) => acc + parseInt(part), 0)
            const index = dateHash % FALLBACK_DAILY_CHALLENGES.length
            return FALLBACK_DAILY_CHALLENGES[index]
        }

        // Random selection if no date provided
        const randomIndex = Math.floor(Math.random() * FALLBACK_DAILY_CHALLENGES.length)
        return FALLBACK_DAILY_CHALLENGES[randomIndex]
    }

    /**
     * Get all available categories
     */
    getAvailableCategories(): MessageCategory[] {
        return Object.keys(FALLBACK_DAILY_DROPS) as MessageCategory[]
    }

    /**
     * Get content count for a category
     */
    getContentCount(category: MessageCategory): number {
        return FALLBACK_DAILY_DROPS[category].length
    }

    /**
     * Get total challenge count
     */
    getChallengeCount(): number {
        return FALLBACK_DAILY_CHALLENGES.length
    }
}

export const fallbackContentService = new FallbackContentService()