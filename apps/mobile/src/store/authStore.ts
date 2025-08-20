import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface User {
  id: string
  email: string
  wisdomPoints: number
  streakCount: number
  subscriptionStatus: 'free' | 'premium_core' | 'voice_pack'
  achievements: string[]
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    
    try {
      // TODO: Replace with actual API call
      console.log('Login API call:', { email, password })
      
      // Simulate API response
      const mockUser: User = {
        id: 'user-123',
        email,
        wisdomPoints: 125,
        streakCount: 7,
        subscriptionStatus: 'free',
        achievements: ['first-steps', 'daily-visitor']
      }

      set({ 
        user: mockUser, 
        isAuthenticated: true, 
        isLoading: false 
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true })
    
    try {
      // TODO: Replace with actual API call
      console.log('Register API call:', { email, password })
      
      // Simulate API response
      const mockUser: User = {
        id: 'user-new',
        email,
        wisdomPoints: 1,
        streakCount: 1,
        subscriptionStatus: 'free',
        achievements: ['first-steps']
      }

      set({ 
        user: mockUser, 
        isAuthenticated: true, 
        isLoading: false 
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true })
    
    try {
      // TODO: Implement Google Sign-In with @react-native-google-signin/google-signin
      console.log('Google Sign-In initiated')
      
      // Simulate Google auth response
      const mockUser: User = {
        id: 'google-user-123',
        email: 'user@gmail.com',
        wisdomPoints: 1,
        streakCount: 1,
        subscriptionStatus: 'free',
        achievements: ['first-steps']
      }

      set({ 
        user: mockUser, 
        isAuthenticated: true, 
        isLoading: false 
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    set({ 
      user: null, 
      isAuthenticated: false, 
      isLoading: false 
    })
  },

  updateUser: (updates: Partial<User>) => {
    const { user } = get()
    if (user) {
      set({ user: { ...user, ...updates } })
    }
  }
}))

// Add persistence (optional)
export const usePersistedAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        
        try {
          const mockUser: User = {
            id: 'user-123',
            email,
            wisdomPoints: 125,
            streakCount: 7,
            subscriptionStatus: 'free',
            achievements: ['first-steps', 'daily-visitor']
          }

          set({ 
            user: mockUser, 
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true })
        
        try {
          const mockUser: User = {
            id: 'user-new',
            email,
            wisdomPoints: 1,
            streakCount: 1,
            subscriptionStatus: 'free',
            achievements: ['first-steps']
          }

          set({ 
            user: mockUser, 
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false 
        })
      },

      updateUser: (updates: Partial<User>) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...updates } })
        }
      }
    }),
    {
      name: 'aura-flow-auth',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
)