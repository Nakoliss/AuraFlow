import React from 'react'

// Inline components
const ClayCard: React.FC<{ title?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, children, style }) => (
  <div style={{
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    padding: '24px',
    ...style
  }}>
    {title && <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#1E293B' }}>{title}</h3>}
    {children}
  </div>
)

const ClayButton: React.FC<{ children: React.ReactNode; onPress: () => void; variant?: string; style?: React.CSSProperties }> = ({ children, onPress, variant = 'primary', style }) => (
  <button
    onClick={onPress}
    style={{
      backgroundColor: variant === 'primary' ? '#6366F1' : variant === 'ghost' ? 'transparent' : '#F8FAFC',
      color: variant === 'primary' ? 'white' : '#1E293B',
      border: variant === 'ghost' ? 'none' : '1px solid #E2E8F0',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: '500',
      cursor: 'pointer',
      ...style
    }}
  >
    {children}
  </button>
)

const ClayBadge: React.FC<{ label: string; color?: string; size?: string }> = ({ label, color = 'default', size = 'medium' }) => (
  <span style={{
    backgroundColor: color === 'gold' ? '#FFD700' : '#6366F1',
    color: color === 'gold' ? '#8B4513' : 'white',
    padding: size === 'medium' ? '8px 16px' : '4px 12px',
    borderRadius: '8px',
    fontSize: size === 'medium' ? '14px' : '12px',
    fontWeight: '500'
  }}>
    {label}
  </span>
)

const subscriptionPlans = [
  {
    id: 'premium_core',
    name: 'Premium Core',
    price: '$4.99',
    period: '/month',
    features: [
      '20 daily messages',
      'All 5 content categories',
      '30-second cooldown',
      'Priority support',
      'Advanced achievements',
      'Usage analytics'
    ],
    color: 'gold' as const,
    popular: true
  },
  {
    id: 'voice_pack',
    name: 'Voice Pack Add-on',
    price: '+$0.99',
    period: '/month',
    features: [
      'Text-to-speech for all messages',
      '5 premium voice options',
      'Audio download & sharing',
      'Hands-free experience',
      'Background playback',
      'Speed controls'
    ],
    color: 'silver' as const,
    popular: false
  }
]

const SubscriptionPage: React.FC = () => {
  const handlePurchase = (planId: string) => {
    console.log('Purchase plan:', planId)
    // TODO: Implement Stripe Checkout flow
    alert(`Redirecting to payment for ${planId} plan...`)
  }

  const handleBackToDashboard = () => {
    window.location.href = '/'
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '48px'
      }}>
        <h1 style={{
          fontSize: '48px',
          fontWeight: 'bold',
          color: '#1E293B',
          margin: '0 0 16px 0'
        }}>
          Unlock Premium Features
        </h1>
        <p style={{
          fontSize: '20px',
          color: '#64748B',
          lineHeight: '1.6',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          Get unlimited access to AI-powered motivation, advanced features, and exclusive content to accelerate your personal growth journey.
        </p>
      </div>

      {/* Plans */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '32px',
        marginBottom: '48px'
      }}>
        {subscriptionPlans.map((plan) => (
          <ClayCard 
            key={plan.id}
            style={{
              position: 'relative',
              border: plan.popular ? '3px solid #FFD700' : undefined,
              transform: plan.popular ? 'scale(1.05)' : undefined
            }}
          >
            {plan.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)'
              }}>
                <ClayBadge 
                  label="Most Popular" 
                  color="gold" 
                  size="medium"
                />
              </div>
            )}
            
            <div style={{
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#1E293B',
                margin: '0 0 8px 0'
              }}>
                {plan.name}
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <span style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: '#6366F1'
                }}>
                  {plan.price}
                </span>
                <span style={{
                  fontSize: '18px',
                  color: '#64748B',
                  marginLeft: '4px'
                }}>
                  {plan.period}
                </span>
              </div>
            </div>

            <div style={{
              marginBottom: '32px'
            }}>
              {plan.features.map((feature, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}
                >
                  <span style={{
                    fontSize: '20px',
                    color: '#10B981',
                    marginRight: '12px',
                    fontWeight: 'bold'
                  }}>
                    ✓
                  </span>
                  <span style={{
                    fontSize: '16px',
                    color: '#1E293B'
                  }}>
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <ClayButton
              onPress={() => handlePurchase(plan.id)}
              style={{ 
                width: '100%',
                padding: '16px'
              }}
            >
              {plan.id === 'voice_pack' ? 'Add Voice Pack' : 'Start 7-Day Free Trial'}
            </ClayButton>
          </ClayCard>
        ))}
      </div>

      {/* Features Comparison */}
      <ClayCard title="Why Choose AuraFlow Premium?" style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              🚀
            </div>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1E293B',
              marginBottom: '8px'
            }}>
              Unlimited Messages
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: '1.5'
            }}>
              Generate up to 20 messages daily with just a 30-second cooldown between requests
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              🎯
            </div>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1E293B',
              marginBottom: '8px'
            }}>
              All Categories
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: '1.5'
            }}>
              Access motivational, mindfulness, fitness, philosophy, and productivity content
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              🎵
            </div>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1E293B',
              marginBottom: '8px'
            }}>
              Voice Features
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: '1.5'
            }}>
              Add the Voice Pack for premium text-to-speech with 5 different voice options
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              📊
            </div>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1E293B',
              marginBottom: '8px'
            }}>
              Advanced Analytics
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: '1.5'
            }}>
              Track your progress with detailed insights and achievement unlocks
            </p>
          </div>
        </div>
      </ClayCard>

      {/* FAQ */}
      <ClayCard title="Frequently Asked Questions" style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E293B',
              marginBottom: '8px'
            }}>
              Can I cancel anytime?
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: '1.5',
              margin: 0
            }}>
              Yes! You can cancel your subscription at any time. No long-term commitments or cancellation fees.
            </p>
          </div>

          <div>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E293B',
              marginBottom: '8px'
            }}>
              What happens after the free trial?
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: '1.5',
              margin: 0
            }}>
              After your 7-day free trial, you'll automatically be charged the monthly fee. Cancel anytime during the trial period at no cost.
            </p>
          </div>

          <div>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E293B',
              marginBottom: '8px'
            }}>
              Do I need both Premium Core and Voice Pack?
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: '1.5',
              margin: 0
            }}>
              No, the Voice Pack is an optional add-on. Premium Core gives you all the essential features, and you can add the Voice Pack later if you want audio features.
            </p>
          </div>
        </div>
      </ClayCard>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        marginTop: '48px'
      }}>
        <p style={{
          fontSize: '14px',
          color: '#94A3B8',
          marginBottom: '16px'
        }}>
          7-day free trial • Cancel anytime • Secure payments by Stripe
        </p>
        <ClayButton 
          variant="ghost" 
          onPress={handleBackToDashboard}
        >
          ← Back to Dashboard
        </ClayButton>
      </div>
    </div>
  )
}

export default SubscriptionPage