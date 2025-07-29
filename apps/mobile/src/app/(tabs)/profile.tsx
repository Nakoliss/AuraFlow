import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { ClayCard, ClayButton, ClayBadge } from '@aura-flow/ui'

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ClayCard title="Your Progress">
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>125</Text>
              <Text style={styles.statLabel}>Wisdom Points</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>7</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>23</Text>
              <Text style={styles.statLabel}>Messages</Text>
            </View>
          </View>
        </ClayCard>

        <ClayCard title="Subscription">
          <View style={styles.subscriptionContainer}>
            <ClayBadge label="Free Plan" color="default" />
            <Text style={styles.subscriptionText}>
              Upgrade to unlock unlimited messages and voice features
            </Text>
            <ClayButton onPress={() => console.log('Upgrade pressed')}>
              Upgrade to Premium
            </ClayButton>
          </View>
        </ClayCard>

        <ClayCard title="Settings">
          <View style={styles.settingsContainer}>
            <ClayButton 
              variant="ghost" 
              onPress={() => console.log('Notifications')}
            >
              Notification Settings
            </ClayButton>
            <ClayButton 
              variant="ghost" 
              onPress={() => console.log('Categories')}
            >
              Preferred Categories
            </ClayButton>
            <ClayButton 
              variant="ghost" 
              onPress={() => console.log('Account')}
            >
              Account Settings
            </ClayButton>
          </View>
        </ClayCard>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8FAFC'
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B'
  },
  subscriptionContainer: {
    alignItems: 'center',
    gap: 12
  },
  subscriptionText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20
  },
  settingsContainer: {
    gap: 8
  }
})