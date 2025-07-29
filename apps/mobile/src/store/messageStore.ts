import { create } from 'zustand'

export interface GeneratedMessage {
  id: string
  content: string
  category: 'motivational' | 'mindfulness' | 'fitness' | 'philosophy' | 'productivity'
  createdAt: Date
  tokens: number
  cost: number
}

export interface DailyDrop {
  id: string
  date: string
  content: string
  challenge?: {
    id: string
    task: string
    points: number
  }
}

interface MessageState {
  messages: GeneratedMessage[]
  dailyDrop: DailyDrop | null
  isGenerating: boolean
  lastGenerated: Date | null
  remainingMessages: number
  
  generateMessage: (category: string) => Promise<GeneratedMessage>
  getDailyDrop: () => Promise<DailyDrop>
  clearMessages: () => void
  canGenerateMessage: () => boolean
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  dailyDrop: null,
  isGenerating: false,
  lastGenerated: null,
  remainingMessages: 20, // Will be based on subscription status

  generateMessage: async (category: string) => {
    const { canGenerateMessage } = get()
    
    if (!canGenerateMessage()) {
      throw new Error('Message generation limit reached')
    }

    set({ isGenerating: true })
    
    try {
      // TODO: Replace with actual API call
      console.log('Generate message API call:', { category })
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const mockMessage: GeneratedMessage = {
        id: `msg-${Date.now()}`,
        content: `Here's your ${category} message: Every challenge you face is an opportunity to grow stronger and wiser.`,
        category: category as GeneratedMessage['category'],
        createdAt: new Date(),
        tokens: 18,
        cost: 0.000036
      }

      set(state => ({
        messages: [mockMessage, ...state.messages],
        isGenerating: false,
        lastGenerated: new Date(),
        remainingMessages: state.remainingMessages - 1
      }))

      return mockMessage
    } catch (error) {
      set({ isGenerating: false })
      throw error
    }
  },

  getDailyDrop: async () => {
    try {
      // TODO: Replace with actual API call
      console.log('Get daily drop API call')
      
      const mockDailyDrop: DailyDrop = {
        id: `drop-${new Date().toISOString().split('T')[0]}`,
        date: new Date().toISOString().split('T')[0],
        content: "Today is a new canvas. Paint it with intention, color it with kindness, and frame it with gratitude.",
        challenge: {
          id: `challenge-${Date.now()}`,
          task: "Write down three things you are grateful for today",
          points: 5
        }
      }

      set({ dailyDrop: mockDailyDrop })
      return mockDailyDrop
    } catch (error) {
      throw error
    }
  },

  clearMessages: () => {
    set({ messages: [], dailyDrop: null })
  },

  canGenerateMessage: () => {
    const { remainingMessages, lastGenerated } = get()
    
    // Check message limit
    if (remainingMessages <= 0) {
      return false
    }
    
    // Check cooldown (30 seconds for premium users)
    if (lastGenerated) {
      const timeSinceLastGeneration = Date.now() - lastGenerated.getTime()
      const cooldownMs = 30 * 1000 // 30 seconds
      
      if (timeSinceLastGeneration < cooldownMs) {
        return false
      }
    }
    
    return true
  }
}))