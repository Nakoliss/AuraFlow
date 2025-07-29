import React from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { AchievementGrid } from '@aura-flow/ui'

// Mock achievements data - will be replaced with real data from API
const mockAchievements = [
  {
    id: '1',
    name: 'First Steps',
    description: 'Open the app for the first time',
    icon: '🌟',
    pointsRequired: 1,
    badgeColor: 'gold' as const,
    isUnlocked: true,
    earnedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    pointsRequired: 50,
    badgeColor: 'silver' as const,
    isUnlocked: false
  },
  {
    id: '3',
    name: 'Wisdom Seeker',
    description: 'Accumulate 100 wisdom points',
    icon: '🧠',
    pointsRequired: 100,
    badgeColor: 'gold' as const,
    isUnlocked: false
  }
]

export default function AchievementsScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AchievementGrid
          achievements={mockAchievements}
          currentPoints={25}
          showProgress={true}
          columns={2}
          size="medium"
          onAchievementClick={(achievement) => {
            console.log('Achievement clicked:', achievement.name)
          }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8FAFC'
  }
})