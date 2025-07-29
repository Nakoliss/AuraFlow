import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native'
import { ClayCard, ClayButton } from '@aura-flow/ui'
import { router } from 'expo-router'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    setIsLoading(true)
    
    try {
      // TODO: Replace with actual authentication service
      console.log('Login attempt:', { email, password })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Navigate back to main app
      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert('Error', 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = () => {
    router.push('/auth/register')
  }

  return (
    <View style={styles.container}>
      <ClayCard title="Welcome Back">
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
              autoComplete="password"
            />
          </View>

          <ClayButton 
            onPress={handleLogin}
            loading={isLoading}
            style={styles.loginButton}
          >
            Sign In
          </ClayButton>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account?</Text>
            <ClayButton 
              variant="ghost"
              onPress={handleRegister}
            >
              Create Account
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
  loginButton: {
    marginTop: 8
  },
  registerContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16
  },
  registerText: {
    fontSize: 14,
    color: '#64748B'
  }
})