// AuraFlow Mobile App Entry Point
// This file is required for the workspace but the actual app entry is through expo-router
export * from '@aura-flow/common'
export * from '@aura-flow/ui'

// Re-export stores for external access if needed
export * from './store/authStore'
export * from './store/messageStore'

console.log('AuraFlow Mobile App workspace initialized')