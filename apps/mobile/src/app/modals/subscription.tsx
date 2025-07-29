import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { ClayCard, ClayButton, ClayBadge } from '@aura-flow/ui'
import { router } from 'expo-router'

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
      'Priority support'
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
      '5 voice options',
      'Audio download',
      'Hands-free experience'
    ],
    color: 'silver' as const,
    popular: false
  }
]

export default function SubscriptionModal() {
  const handlePurchase = (planId: string) => {
    console.log('Purchase plan:', planId)
    // TODO: Implement RevenueCat/Stripe purchase flow
    router.back()
  }

  const handleClose = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Unlock Premium Features</Text>
          <Text style={styles.subtitle}>
            Get unlimited access to AI-powered motivation
          </Text>
        </View>

        <View style={styles.plansContainer}>
          {subscriptionPlans.map((plan) => (
            <ClayCard 
              key={plan.id}
              style={[
                styles.planCard,
                plan.popular && styles.popularPlan
              ]}
            >
              {plan.popular && (
                <View style={styles.popularBadgeContainer}>
                  <ClayBadge 
                    label="Most Popular" 
                    color="gold" 
                    size="small"
                  />
                </View>
              )}
              
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>{plan.price}</Text>
                  <Text style={styles.period}>{plan.period}</Text>
                </View>
              </View>

              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.feature}>
                    <Text style={styles.checkmark}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <ClayButton
                onPress={() => handlePurchase(plan.id)}
                style={styles.purchaseButton}
              >
                {plan.id === 'voice_pack' ? 'Add Voice Pack' : 'Start Free Trial'}
              </ClayButton>
            </ClayCard>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            7-day free trial • Cancel anytime • Terms apply
          </Text>
          <ClayButton 
            variant="ghost" 
            onPress={handleClose}
            style={styles.closeButton}
          >
            Maybe Later
          </ClayButton>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  header: {
    padding: 24,
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24
  },
  plansContainer: {
    padding: 16,
    gap: 16
  },
  planCard: {
    position: 'relative'
  },
  popularPlan: {
    borderWidth: 2,
    borderColor: '#FFD700'
  },
  popularBadgeContainer: {
    position: 'absolute',
    top: -8,
    right: 16,
    zIndex: 1
  },
  planHeader: {
    marginBottom: 16
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366F1'
  },
  period: {
    fontSize: 16,
    color: '#64748B',
    marginLeft: 4
  },
  featuresContainer: {
    marginBottom: 20,
    gap: 8
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkmark: {
    fontSize: 16,
    color: '#10B981',
    marginRight: 12,
    fontWeight: 'bold'
  },
  featureText: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1
  },
  purchaseButton: {
    marginTop: 8
  },
  footer: {
    padding: 24,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18
  },
  closeButton: {
    marginTop: 8
  }
})