#!/usr/bin/env ts-node

// Test script to verify monorepo setup
import { generateId, getWordCount, MESSAGE_CATEGORIES } from '@aura-flow/common'
import { ClayTokens } from '@aura-flow/ui'

console.log('🚀 Testing AuraFlow monorepo setup...\n')

// Test common package
console.log('📦 Testing @aura-flow/common:')
console.log(`- Generated ID: ${generateId()}`)
console.log(`- Word count for "Hello world": ${getWordCount('Hello world')}`)
console.log(`- Message categories: ${MESSAGE_CATEGORIES.join(', ')}`)

// Test UI package
console.log('\n🎨 Testing @aura-flow/ui:')
console.log(`- Primary color: ${ClayTokens.colors.primary}`)
console.log(`- Standard border radius: ${ClayTokens.borderRadius.standard}px`)
console.log(`- Clay shadow: ${ClayTokens.shadows.clay}`)

console.log('\n✅ Monorepo setup test completed successfully!')
console.log('🎯 Ready to start implementing AuraFlow features!')