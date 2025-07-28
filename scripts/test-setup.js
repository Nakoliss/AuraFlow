#!/usr/bin/env node

// Test script to verify monorepo setup
const { 
  generateId, 
  getWordCount, 
  MESSAGE_CATEGORIES,
  ValidationError,
  validateMessageCategory,
  createLogger
} = require('../packages/common/dist/index.js')
const { ClayTokens } = require('../packages/ui/dist/index.js')

console.log('🚀 Testing AuraFlow monorepo setup...\n')

// Test common package
console.log('📦 Testing @aura-flow/common:')
console.log(`- Generated ID: ${generateId()}`)
console.log(`- Word count for "Hello world": ${getWordCount('Hello world')}`)
console.log(`- Message categories: ${MESSAGE_CATEGORIES.join(', ')}`)

// Test new utilities
console.log('\n🔧 Testing new utilities:')
try {
  const category = validateMessageCategory('motivational')
  console.log(`- Validated category: ${category}`)
} catch (error) {
  console.log(`- Validation error: ${error.message}`)
}

const logger = createLogger('test-script')
logger.info('Testing structured logging')

// Test UI package
console.log('\n🎨 Testing @aura-flow/ui:')
console.log(`- Primary color: ${ClayTokens.colors.primary}`)
console.log(`- Standard border radius: ${ClayTokens.borderRadius.standard}px`)
console.log(`- Clay shadow: ${ClayTokens.shadows.clay}`)

console.log('\n✅ Monorepo setup test completed successfully!')
console.log('🎯 Ready to start implementing AuraFlow features!')