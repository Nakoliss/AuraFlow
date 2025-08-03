// Push notification service for AuraFlow mobile app
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface NotificationPreferences {
  dailyDropEnabled: boolean
  dailyDropTime: string // HH:MM format
  motivationalEnabled: boolean
  reminderEnabled: boolean
  timezone: string
}

export interface ScheduledNotification {
  id: string
  type: 'daily_drop' | 'reminder' | 'motivational'
  title: string
  body: string
  scheduledTime: Date
  data?: any
}

class NotificationService {
  private expoPushToken: string | null = null
  private isInitialized = false

  // Configure notification behavior
  constructor() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    })
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true
      }

      // Check if device supports notifications
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices')
        return false
      }

      // Request permissions
      const hasPermission = await this.requestPermissions()
      if (!hasPermission) {
        console.warn('Notification permissions not granted')
        return false
      }

      // Get push token
      this.expoPushToken = await this.registerForPushNotifications()
      if (!this.expoPushToken) {
        console.warn('Failed to get push token')
        return false
      }

      // Set up notification listeners
      this.setupNotificationListeners()

      this.isInitialized = true
      console.log('NotificationService initialized successfully')
      return true

    } catch (error) {
      console.error('Failed to initialize NotificationService:', error)
      return false
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permissions denied')
        return false
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'AuraFlow Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        })

        await Notifications.setNotificationChannelAsync('daily-drop', {
          name: 'Daily Drop',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4F46E5',
          sound: 'default',
        })
      }

      return true
    } catch (error) {
      console.error('Error requesting notification permissions:', error)
      return false
    }
  }

  /**
   * Register for push notifications and get token
   */
  private async registerForPushNotifications(): Promise<string | null> {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

      if (!projectId) {
        console.error('Project ID not found')
        return null
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      })

      console.log('Expo push token:', token.data)
      
      // Store token locally
      await AsyncStorage.setItem('expoPushToken', token.data)
      
      return token.data
    } catch (error) {
      console.error('Error getting push token:', error)
      return null
    }
  }

  /**
   * Set up notification event listeners
   */
  private setupNotificationListeners(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification)
      // You can customize foreground notification behavior here
    })

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response)
      
      const data = response.notification.request.content.data
      
      // Handle different notification types
      if (data?.type === 'daily_drop') {
        // Navigate to daily drop screen
        console.log('Navigate to daily drop')
      } else if (data?.type === 'reminder') {
        // Navigate to main screen
        console.log('Navigate to main screen')
      }
    })
  }

  /**
   * Get the current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken
  }

  /**
   * Schedule a daily drop notification
   */
  async scheduleDailyDropNotification(time: string, timezone: string = 'UTC'): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        console.warn('NotificationService not initialized')
        return null
      }

      // Parse time (HH:MM format)
      const [hours, minutes] = time.split(':').map(Number)
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('Invalid time format. Use HH:MM')
      }

      // Cancel existing daily drop notifications
      await this.cancelNotificationsByType('daily_drop')

      // Schedule daily repeating notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌟 Your Daily Drop is Ready!',
          body: 'Start your day with a burst of motivation and wisdom.',
          data: {
            type: 'daily_drop',
            scheduledTime: time,
            timezone,
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
          channelId: 'daily-drop',
        },
      })

      console.log('Daily drop notification scheduled:', notificationId)
      
      // Store notification info
      await this.storeScheduledNotification({
        id: notificationId,
        type: 'daily_drop',
        title: '🌟 Your Daily Drop is Ready!',
        body: 'Start your day with a burst of motivation and wisdom.',
        scheduledTime: new Date(),
        data: { type: 'daily_drop', scheduledTime: time, timezone },
      })

      return notificationId
    } catch (error) {
      console.error('Error scheduling daily drop notification:', error)
      return null
    }
  }

  /**
   * Schedule a reminder notification
   */
  async scheduleReminderNotification(
    title: string,
    body: string,
    scheduledTime: Date,
    data?: any
  ): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        console.warn('NotificationService not initialized')
        return null
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'reminder',
            ...data,
          },
          sound: 'default',
        },
        trigger: {
          date: scheduledTime,
        },
      })

      console.log('Reminder notification scheduled:', notificationId)
      
      // Store notification info
      await this.storeScheduledNotification({
        id: notificationId,
        type: 'reminder',
        title,
        body,
        scheduledTime,
        data,
      })

      return notificationId
    } catch (error) {
      console.error('Error scheduling reminder notification:', error)
      return null
    }
  }

  /**
   * Send immediate notification (for testing)
   */
  async sendImmediateNotification(title: string, body: string, data?: any): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        console.warn('NotificationService not initialized')
        return null
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'immediate',
            ...data,
          },
          sound: 'default',
        },
        trigger: null, // Send immediately
      })

      console.log('Immediate notification sent:', notificationId)
      return notificationId
    } catch (error) {
      console.error('Error sending immediate notification:', error)
      return null
    }
  }

  /**
   * Cancel a specific notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId)
      await this.removeStoredNotification(notificationId)
      console.log('Notification cancelled:', notificationId)
    } catch (error) {
      console.error('Error cancelling notification:', error)
    }
  }

  /**
   * Cancel all notifications of a specific type
   */
  async cancelNotificationsByType(type: string): Promise<void> {
    try {
      const storedNotifications = await this.getStoredNotifications()
      const notificationsToCancel = storedNotifications.filter(n => n.type === type)

      for (const notification of notificationsToCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.id)
        await this.removeStoredNotification(notification.id)
      }

      console.log(`Cancelled ${notificationsToCancel.length} notifications of type: ${type}`)
    } catch (error) {
      console.error('Error cancelling notifications by type:', error)
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync()
      await AsyncStorage.removeItem('scheduledNotifications')
      console.log('All notifications cancelled')
    } catch (error) {
      console.error('Error cancelling all notifications:', error)
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync()
    } catch (error) {
      console.error('Error getting scheduled notifications:', error)
      return []
    }
  }

  /**
   * Store notification info locally
   */
  private async storeScheduledNotification(notification: ScheduledNotification): Promise<void> {
    try {
      const stored = await this.getStoredNotifications()
      const updated = [...stored.filter(n => n.id !== notification.id), notification]
      await AsyncStorage.setItem('scheduledNotifications', JSON.stringify(updated))
    } catch (error) {
      console.error('Error storing notification:', error)
    }
  }

  /**
   * Remove stored notification info
   */
  private async removeStoredNotification(notificationId: string): Promise<void> {
    try {
      const stored = await this.getStoredNotifications()
      const updated = stored.filter(n => n.id !== notificationId)
      await AsyncStorage.setItem('scheduledNotifications', JSON.stringify(updated))
    } catch (error) {
      console.error('Error removing stored notification:', error)
    }
  }

  /**
   * Get stored notification info
   */
  private async getStoredNotifications(): Promise<ScheduledNotification[]> {
    try {
      const stored = await AsyncStorage.getItem('scheduledNotifications')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error getting stored notifications:', error)
      return []
    }
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const stored = await AsyncStorage.getItem('notificationPreferences')
      return stored ? JSON.parse(stored) : {
        dailyDropEnabled: true,
        dailyDropTime: '09:00',
        motivationalEnabled: true,
        reminderEnabled: true,
        timezone: 'UTC',
      }
    } catch (error) {
      console.error('Error getting notification preferences:', error)
      return {
        dailyDropEnabled: true,
        dailyDropTime: '09:00',
        motivationalEnabled: true,
        reminderEnabled: true,
        timezone: 'UTC',
      }
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const current = await this.getNotificationPreferences()
      const updated = { ...current, ...preferences }
      
      await AsyncStorage.setItem('notificationPreferences', JSON.stringify(updated))
      
      // Reschedule daily drop if settings changed
      if (preferences.dailyDropEnabled !== undefined || preferences.dailyDropTime) {
        if (updated.dailyDropEnabled && updated.dailyDropTime) {
          await this.scheduleDailyDropNotification(updated.dailyDropTime, updated.timezone)
        } else {
          await this.cancelNotificationsByType('daily_drop')
        }
      }
      
      console.log('Notification preferences updated:', updated)
    } catch (error) {
      console.error('Error updating notification preferences:', error)
    }
  }

  /**
   * Check notification permission status
   */
  async getPermissionStatus(): Promise<Notifications.PermissionStatus> {
    try {
      const { status } = await Notifications.getPermissionsAsync()
      return status
    } catch (error) {
      console.error('Error getting permission status:', error)
      return 'undetermined'
    }
  }

  /**
   * Test notification functionality
   */
  async testNotification(): Promise<boolean> {
    try {
      const notificationId = await this.sendImmediateNotification(
        '🧪 Test Notification',
        'AuraFlow notifications are working correctly!',
        { test: true }
      )
      
      return notificationId !== null
    } catch (error) {
      console.error('Error testing notification:', error)
      return false
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
export default NotificationService