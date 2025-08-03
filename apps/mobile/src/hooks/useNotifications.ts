// React hook for managing push notifications in AuraFlow
import { useState, useEffect, useCallback } from 'react'
import { notificationService, NotificationPreferences } from '../services/NotificationService'
import * as Notifications from 'expo-notifications'

export interface UseNotificationsReturn {
  // State
  isInitialized: boolean
  hasPermission: boolean
  pushToken: string | null
  preferences: NotificationPreferences | null
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<boolean>
  requestPermissions: () => Promise<boolean>
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>
  scheduleDailyDrop: (time: string, timezone?: string) => Promise<string | null>
  scheduleReminder: (title: string, body: string, scheduledTime: Date, data?: any) => Promise<string | null>
  sendTestNotification: () => Promise<boolean>
  cancelAllNotifications: () => Promise<void>
  getScheduledNotifications: () => Promise<Notifications.NotificationRequest[]>
}

export const useNotifications = (): UseNotificationsReturn => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [pushToken, setPushToken] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize notification service
  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      const success = await notificationService.initialize()
      
      if (success) {
        setIsInitialized(true)
        setPushToken(notificationService.getPushToken())
        
        // Check permission status
        const permissionStatus = await notificationService.getPermissionStatus()
        setHasPermission(permissionStatus === 'granted')
        
        // Load preferences
        const prefs = await notificationService.getNotificationPreferences()
        setPreferences(prefs)
        
        console.log('Notifications initialized successfully')
      } else {
        setError('Failed to initialize notifications')
      }

      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error initializing notifications:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Request notification permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      const granted = await notificationService.requestPermissions()
      setHasPermission(granted)

      if (!granted) {
        setError('Notification permissions denied')
      }

      return granted
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error requesting permissions:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update notification preferences
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      await notificationService.updateNotificationPreferences(newPreferences)
      
      // Reload preferences
      const updatedPrefs = await notificationService.getNotificationPreferences()
      setPreferences(updatedPrefs)
      
      console.log('Notification preferences updated')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error updating preferences:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Schedule daily drop notification
  const scheduleDailyDrop = useCallback(async (time: string, timezone: string = 'UTC'): Promise<string | null> => {
    try {
      setError(null)
      const notificationId = await notificationService.scheduleDailyDropNotification(time, timezone)
      
      if (!notificationId) {
        setError('Failed to schedule daily drop notification')
      }
      
      return notificationId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error scheduling daily drop:', err)
      return null
    }
  }, [])

  // Schedule reminder notification
  const scheduleReminder = useCallback(async (
    title: string,
    body: string,
    scheduledTime: Date,
    data?: any
  ): Promise<string | null> => {
    try {
      setError(null)
      const notificationId = await notificationService.scheduleReminderNotification(title, body, scheduledTime, data)
      
      if (!notificationId) {
        setError('Failed to schedule reminder notification')
      }
      
      return notificationId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error scheduling reminder:', err)
      return null
    }
  }, [])

  // Send test notification
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      const success = await notificationService.testNotification()
      
      if (!success) {
        setError('Failed to send test notification')
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error sending test notification:', err)
      return false
    }
  }, [])

  // Cancel all notifications
  const cancelAllNotifications = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      await notificationService.cancelAllNotifications()
      console.log('All notifications cancelled')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error cancelling notifications:', err)
    }
  }, [])

  // Get scheduled notifications
  const getScheduledNotifications = useCallback(async (): Promise<Notifications.NotificationRequest[]> => {
    try {
      setError(null)
      return await notificationService.getScheduledNotifications()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error getting scheduled notifications:', err)
      return []
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  return {
    // State
    isInitialized,
    hasPermission,
    pushToken,
    preferences,
    isLoading,
    error,

    // Actions
    initialize,
    requestPermissions,
    updatePreferences,
    scheduleDailyDrop,
    scheduleReminder,
    sendTestNotification,
    cancelAllNotifications,
    getScheduledNotifications,
  }
}