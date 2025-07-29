import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ClayCard, ClayButton } from '@aura-flow/ui'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <ClayCard title="Daily Drop">
        <Text style={styles.content}>
          Welcome to AuraFlow! Your daily motivation is coming soon.
        </Text>
        <ClayButton onPress={() => console.log('Generate message')}>
          Generate Message
        </ClayButton>
      </ClayCard>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8FAFC'
  },
  content: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 24
  }
})