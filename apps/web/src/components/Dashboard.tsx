import React, { useState, useEffect } from 'react'

// Inline components for now to avoid import issues
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

const ClayButton: React.FC<{ children: React.ReactNode; onPress: () => void; variant?: string; size?: string; loading?: boolean; style?: React.CSSProperties }> = ({ children, onPress, variant = 'primary', loading, style }) => (
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
      ...style
    }}
  >
    {loading ? 'Loading...' : children}
  </button>
)

const ClayBadge: React.FC<{ label: string; color?: string; size?: string }> = ({ label, color = 'default' }) => (
  <span style={{
    backgroundColor: color === 'gold' ? '#FFD700' : '#6366F1',
    color: color === 'gold' ? '#8B4513' : 'white',
    padding: '4px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '500'
  }}>
    {label}
  </span>
)

const AchievementGrid: React.FC<{ achievements: any[]; currentPoints: number; showProgress: boolean; columns: number; size: string; onAchievementClick: (a: any) => void }> = ({ achievements }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
    {achievements.map(achievement => (
      <div key={achievement.id} style={{
        backgroundColor: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '16px',
        textAlign: 'center',
        opacity: achievement.isUnlocked ? 1 : 0.6
      }}>
        <div style={{ fontSize: '24px', marginBottom: '8px', filter: achievement.isUnlocked ? 'none' : 'grayscale(100%)' }}>
          {achievement.icon}
        </div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0', color: '#1E293B' }}>
          {achievement.name}
        </h4>
        <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
          {achievement.description}
        </p>
        {achievement.isUnlocked && (
          <ClayBadge label="Unlocked" color="gold" />
        )}
      </div>
    ))}
  </div>
)

interface User {
  id: string
  email: string
  wisdomPoints: number
  streakCount: number
  subscriptionStatus: 'free' | 'premium_core' | 'voice_pack'
}

interface GeneratedMessage {
  id: string
  content: string
  category: string
  createdAt: Date
}

interface DailyDrop {
  id: string
  date: string
  content: string
  challenge?: {
    id: string
    task: string
    points: number
  }
}

const mockUser: User = {
  id: 'demo-user',
  email: 'demo@auraflow.com',
  wisdomPoints: 125,
  streakCount: 7,
  subscriptionStatus: 'free'
}

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
    isUnlocked: true,
    earnedAt: new Date('2024-01-15')
  }
]

const Dashboard: React.FC = () => {
  const [user] = useState<User>(mockUser)
  const [messages, setMessages] = useState<GeneratedMessage[]>([])
  const [dailyDrop, setDailyDrop] = useState<DailyDrop | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('motivational')

  const categories = [
    { id: 'motivational', name: 'Motivational', emoji: '💪' },
    { id: 'mindfulness', name: 'Mindfulness', emoji: '🧘' },
    { id: 'fitness', name: 'Fitness', emoji: '🏋️' },
    { id: 'philosophy', name: 'Philosophy', emoji: '🤔' },
    { id: 'productivity', name: 'Productivity', emoji: '⚡' }
  ]

  useEffect(() => {
    // Load daily drop
    setDailyDrop({
      id: 'daily-drop-today',
      date: new Date().toISOString().split('T')[0],
      content: "Today is a new canvas. Paint it with intention, color it with kindness, and frame it with gratitude.",
      challenge: {
        id: 'challenge-today',
        task: "Write down three things you are grateful for today",
        points: 5
      }
    })
  }, [])

  const generateMessage = async () => {
    setIsGenerating(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const mockMessage: GeneratedMessage = {
        id: `msg-${Date.now()}`,
        content: `Here's your ${selectedCategory} message: Every challenge you face is an opportunity to grow stronger and wiser. Remember, progress is not about perfection—it's about persistence.`,
        category: selectedCategory,
        createdAt: new Date()
      }

      setMessages(prev => [mockMessage, ...prev])
    } catch (error) {
      console.error('Failed to generate message:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLogin = () => {
    window.location.href = '/auth/login'
  }

  const handleUpgrade = () => {
    window.location.href = '/subscription'
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1E293B',
            margin: 0
          }}>
            Welcome to AuraFlow
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#64748B',
            margin: '8px 0 0 0'
          }}>
            Your daily dose of AI-powered motivation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <ClayButton variant="ghost" onPress={handleLogin}>
            Sign In
          </ClayButton>
          <ClayButton onPress={handleUpgrade}>
            Upgrade
          </ClayButton>
        </div>
      </div>

      {/* Stats Bar */}
      <ClayCard style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#1E293B'
              }}>
                {user.wisdomPoints}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#64748B'
              }}>
                Wisdom Points
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#1E293B'
              }}>
                {user.streakCount}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#64748B'
              }}>
                Day Streak
              </div>
            </div>
          </div>
          <ClayBadge 
            label={user.subscriptionStatus === 'free' ? 'Free Plan' : 'Premium'} 
            color={user.subscriptionStatus === 'free' ? 'default' : 'gold'}
          />
        </div>
      </ClayCard>

      {/* Daily Drop */}
      {dailyDrop && (
        <ClayCard title="✨ Daily Drop" style={{ marginBottom: '24px' }}>
          <p style={{
            fontSize: '18px',
            color: '#1E293B',
            lineHeight: '1.6',
            marginBottom: '16px'
          }}>
            {dailyDrop.content}
          </p>
          {dailyDrop.challenge && (
            <div style={{
              backgroundColor: '#F1F5F9',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #E2E8F0'
            }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1E293B',
                margin: '0 0 8px 0'
              }}>
                🎯 Today's Challenge (+{dailyDrop.challenge.points} points)
              </h4>
              <p style={{
                fontSize: '14px',
                color: '#64748B',
                margin: 0
              }}>
                {dailyDrop.challenge.task}
              </p>
            </div>
          )}
        </ClayCard>
      )}

      {/* Message Generation */}
      <ClayCard title="Generate Your Message" style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}>
            {categories.slice(0, user.subscriptionStatus === 'free' ? 2 : 5).map(category => (
              <ClayButton
                key={category.id}
                variant={selectedCategory === category.id ? 'primary' : 'secondary'}
                size="small"
                onPress={() => setSelectedCategory(category.id)}
              >
                {category.emoji} {category.name}
              </ClayButton>
            ))}
          </div>
          
          {user.subscriptionStatus === 'free' && (
            <p style={{
              fontSize: '14px',
              color: '#F59E0B',
              margin: '0 0 16px 0'
            }}>
              💡 Upgrade to Premium to unlock all 5 categories and 20 daily messages!
            </p>
          )}
          
          <ClayButton
            onPress={generateMessage}
            loading={isGenerating}
            style={{ width: '100%' }}
          >
            {isGenerating ? 'Generating...' : 'Generate Message'}
          </ClayButton>
        </div>
      </ClayCard>

      {/* Generated Messages */}
      {messages.length > 0 && (
        <ClayCard title="Your Messages" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map(message => (
              <div
                key={message.id}
                style={{
                  padding: '16px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <ClayBadge 
                    label={message.category} 
                    size="small" 
                    color="default" 
                  />
                  <span style={{
                    fontSize: '12px',
                    color: '#94A3B8'
                  }}>
                    {message.createdAt.toLocaleTimeString()}
                  </span>
                </div>
                <p style={{
                  fontSize: '16px',
                  color: '#1E293B',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  {message.content}
                </p>
              </div>
            ))}
          </div>
        </ClayCard>
      )}

      {/* Achievements */}
      <ClayCard title="🏆 Your Achievements" style={{ marginBottom: '24px' }}>
        <AchievementGrid
          achievements={mockAchievements}
          currentPoints={user.wisdomPoints}
          showProgress={true}
          columns={3}
          size="small"
          onAchievementClick={(achievement) => {
            console.log('Achievement clicked:', achievement.name)
          }}
        />
      </ClayCard>
    </div>
  )
}

export default Dashboard