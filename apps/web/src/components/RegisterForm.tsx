import React, { useState } from 'react'

// Inline components
const ClayCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    padding: '24px'
  }}>
    {children}
  </div>
)

const ClayButton: React.FC<{ children: React.ReactNode; onPress: () => void; variant?: string; loading?: boolean; style?: React.CSSProperties }> = ({ children, onPress, variant = 'primary', loading, style }) => (
  <button
    onClick={onPress}
    disabled={loading}
    style={{
      backgroundColor: variant === 'primary' ? '#6366F1' : variant === 'secondary' ? '#F8FAFC' : 'transparent',
      color: variant === 'primary' ? 'white' : '#1E293B',
      border: variant === 'secondary' ? '1px solid #E2E8F0' : 'none',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: '500',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.6 : 1,
      width: '100%',
      ...style
    }}
  >
    {loading ? 'Loading...' : children}
  </button>
)

const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)
    
    try {
      // TODO: Replace with actual authentication service
      console.log('Register attempt:', { email, password })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Show success message and redirect
      alert('Account created successfully! Redirecting to dashboard...')
      window.location.href = '/'
    } catch (error) {
      setError('Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = () => {
    window.location.href = '/auth/login'
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1E293B',
            margin: '0 0 8px 0'
          }}>
            Create Account
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#64748B',
            margin: 0
          }}>
            Start your journey with AuraFlow
          </p>
        </div>

        <ClayCard>
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {error && (
              <div style={{
                padding: '12px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#1E293B',
                marginBottom: '6px'
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366F1'
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#1E293B',
                marginBottom: '6px'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="new-password"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366F1'
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <p style={{
                fontSize: '12px',
                color: '#94A3B8',
                margin: '4px 0 0 0'
              }}>
                Must be at least 8 characters long
              </p>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#1E293B',
                marginBottom: '6px'
              }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366F1'
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                color: '#64748B',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  required
                  style={{ marginRight: '8px' }}
                />
                I agree to the Terms of Service and Privacy Policy
              </label>
            </div>

            <ClayButton
              onPress={() => {}} // Form handles submission
              loading={isLoading}
              style={{ width: '100%' }}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </ClayButton>
          </form>

          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            paddingTop: '20px',
            borderTop: '1px solid #E2E8F0'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              marginBottom: '12px'
            }}>
              Already have an account?
            </p>
            <ClayButton
              variant="secondary"
              onPress={handleLogin}
              style={{ width: '100%' }}
            >
              Sign In
            </ClayButton>
          </div>
        </ClayCard>
      </div>
    </div>
  )
}

export default RegisterForm