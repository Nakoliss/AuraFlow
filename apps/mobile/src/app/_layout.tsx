import React from 'react'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="auth/login" 
          options={{ 
            title: 'Sign In',
            presentation: 'modal'
          }} 
        />
        <Stack.Screen 
          name="auth/register" 
          options={{ 
            title: 'Create Account',
            presentation: 'modal'
          }} 
        />
        <Stack.Screen 
          name="modals/achievement-detail" 
          options={{ 
            title: 'Achievement',
            presentation: 'modal'
          }} 
        />
        <Stack.Screen 
          name="modals/subscription" 
          options={{ 
            title: 'Premium Features',
            presentation: 'modal'
          }} 
        />
      </Stack>
    </SafeAreaProvider>
  )
}