import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native'
import { ClayCard, ClayButton } from '@aura-flow/ui'
import { router } from 'expo-router'

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)
    
    try {
      // TODO: Replace with actual authentication service
      console.log('Register attempt:', { email, password })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      Alert.alert(
        'Success', 
        'Account created successfully!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      )
    } catch (error) {
      Alert.alert('Error', 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      <ClayCard title="Create Account">
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <ClayButton 
            onPress={handleRegister}
            loading={isLoading}
            style={styles.registerButton}
          >
            Create Account
          </ClayButton>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <ClayButton 
              variant="ghost"
              onPress={handleLogin}
            >
              Sign In
            </ClayButton>
          </View>
        </View>
      </ClayCard>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center'
  },
  form: {
    gap: 16
  },
  inputContainer: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B'
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white'
  },
  registerButton: {
    marginTop: 8
  },
  loginContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16
  },
  loginText: {
    fontSize: 14,
    color: '#64748B'
  }
})