// Notification settings component for AuraFlow mobile app
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native'
import { useNotifications } from '../hooks/useNotifications'

interface TimePickerProps {
  value: string
  onValueChange: (time: string) => void
  disabled?: boolean
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onValueChange, disabled = false }) => {
  const [hours, minutes] = value.split(':').map(Number)

  const showTimePicker = () => {
    if (disabled) return

    // For simplicity, we'll use a basic time selection
    // In a real app, you'd use a proper time picker component
    Alert.alert(
      'Set Daily Drop Time',
      'Choose your preferred time for daily notifications',
      [
        { text: '8:00 AM', onPress: () => onValueChange('08:00') },
        { text: '9:00 AM', onPress: () => onValueChange('09:00') },
        { text: '10:00 AM', onPress: () => onValueChange('10:00') },
        { text: '12:00 PM', onPress: () => onValueChange('12:00') },
        { text: '6:00 PM', onPress: () => onValueChange('18:00') },
        { text: '8:00 PM', onPress: () => onValueChange('20:00') },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`
  }

  return (
    <TouchableOpacity
      style={[styles.timePicker, disabled && styles.timePickerDisabled]}
      onPress={showTimePicker}
      disabled={disabled}
    >
      <Text style={[styles.timePickerText, disabled && styles.timePickerTextDisabled]}>
        {formatTime(value)}
      </Text>
    </TouchableOpacity>
  )
}

export const NotificationSettings: React.FC = () => {
  const {
    isInitialized,
    hasPermission,
    preferences,
    isLoading,
    error,
    requestPermissions,
    updatePreferences,
    sendTestNotification,
    getScheduledNotifications,
  } = useNotifications()

  const [scheduledCount, setScheduledCount] = useState(0)

  // Load scheduled notifications count
  useEffect(() => {
    const loadScheduledCount = async () => {
      const scheduled = await getScheduledNotifications()
      setScheduledCount(scheduled.length)
    }

    if (isInitialized) {
      loadScheduledCount()
    }
  }, [isInitialized, getScheduledNotifications, preferences])

  const handlePermissionRequest = async () => {
    const granted = await requestPermissions()
    if (granted) {
      Alert.alert('Success', 'Notification permissions granted!')
    } else {
      Alert.alert(
        'Permissions Required',
        'Please enable notifications in your device settings to receive daily drops and reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => {
            // In a real app, you'd open device settings
            console.log('Open device settings')
          }},
        ]
      )
    }
  }

  const handleTestNotification = async () => {
    const success = await sendTestNotification()
    if (success) {
      Alert.alert('Test Sent', 'Check your notifications!')
    } else {
      Alert.alert('Test Failed', 'Unable to send test notification. Please check your settings.')
    }
  }

  const handleToggleDailyDrop = async (enabled: boolean) => {
    await updatePreferences({ dailyDropEnabled: enabled })
    
    if (enabled) {
      Alert.alert(
        'Daily Drop Enabled',
        `You'll receive your daily motivation at ${preferences?.dailyDropTime || '9:00 AM'} every day.`
      )
    }
  }

  const handleTimeChange = async (time: string) => {
    await updatePreferences({ dailyDropTime: time })
    Alert.alert('Time Updated', `Daily drops will now be sent at ${formatTime(time)}.`)
  }

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`
  }

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing notifications...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Permissions</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Notifications Enabled</Text>
            <Text style={styles.settingDescription}>
              {hasPermission 
                ? 'You can receive push notifications' 
                : 'Enable notifications to get daily drops and reminders'
              }
            </Text>
          </View>
          
          {!hasPermission && (
            <TouchableOpacity style={styles.enableButton} onPress={handlePermissionRequest}>
              <Text style={styles.enableButtonText}>Enable</Text>
            </TouchableOpacity>
          )}
          
          {hasPermission && (
            <View style={styles.statusIndicator}>
              <Text style={styles.statusText}>✓ Enabled</Text>
            </View>
          )}
        </View>
      </View>

      {hasPermission && preferences && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Drop</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Daily Notifications</Text>
                <Text style={styles.settingDescription}>
                  Get your daily dose of motivation and wisdom
                </Text>
              </View>
              <Switch
                value={preferences.dailyDropEnabled}
                onValueChange={handleToggleDailyDrop}
                disabled={isLoading}
              />
            </View>

            {preferences.dailyDropEnabled && (
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Notification Time</Text>
                  <Text style={styles.settingDescription}>
                    When would you like to receive your daily drop?
                  </Text>
                </View>
                <TimePicker
                  value={preferences.dailyDropTime}
                  onValueChange={handleTimeChange}
                  disabled={isLoading}
                />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other Notifications</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Motivational Reminders</Text>
                <Text style={styles.settingDescription}>
                  Occasional motivational boosts throughout the day
                </Text>
              </View>
              <Switch
                value={preferences.motivationalEnabled}
                onValueChange={(enabled) => updatePreferences({ motivationalEnabled: enabled })}
                disabled={isLoading}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>General Reminders</Text>
                <Text style={styles.settingDescription}>
                  Reminders to check in with your goals and progress
                </Text>
              </View>
              <Switch
                value={preferences.reminderEnabled}
                onValueChange={(enabled) => updatePreferences({ reminderEnabled: enabled })}
                disabled={isLoading}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Testing & Debug</Text>
            
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestNotification}
              disabled={isLoading}
            >
              <Text style={styles.testButtonText}>Send Test Notification</Text>
            </TouchableOpacity>

            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>Scheduled Notifications: {scheduledCount}</Text>
              <Text style={styles.debugText}>
                Status: {hasPermission ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  enableButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enableButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#d1fae5',
    borderRadius: 6,
  },
  statusText: {
    color: '#065f46',
    fontWeight: '500',
    fontSize: 14,
  },
  timePicker: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
  },
  timePickerDisabled: {
    opacity: 0.5,
  },
  timePickerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
  },
  timePickerTextDisabled: {
    color: '#9ca3af',
  },
  testButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  testButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
  debugInfo: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  debugText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
})

export default NotificationSettings