import React, { useEffect, useState } from 'react'
import { ClayBadge } from './ClayBadge'
import { ClayButton } from './ClayButton'
import { ClayTokens } from '../tokens'
import { Achievement } from './AchievementDisplay'

export interface AchievementNotificationProps {
    achievement: Achievement
    isVisible: boolean
    onClose: () => void
    onViewAchievements?: () => void
    autoCloseDelay?: number
    style?: React.CSSProperties
    className?: string
}

export const AchievementNotification: React.FC<AchievementNotificationProps> = ({
    achievement,
    isVisible,
    onClose,
    onViewAchievements,
    autoCloseDelay = 5000,
    style,
    className
}) => {
    const [isAnimating, setIsAnimating] = useState(false)

    useEffect(() => {
        if (isVisible) {
            setIsAnimating(true)

            if (autoCloseDelay > 0) {
                const timer = setTimeout(() => {
                    onClose()
                }, autoCloseDelay)

                return () => clearTimeout(timer)
            }
        } else {
            setIsAnimating(false)
        }
    }, [isVisible, autoCloseDelay, onClose])

    if (!isVisible && !isAnimating) {
        return null
    }

    const notificationStyle: React.CSSProperties = {
        position: 'fixed',
        top: ClayTokens.spacing.lg,
        right: ClayTokens.spacing.lg,
        zIndex: 1000,
        backgroundColor: ClayTokens.colors.surfaceElevated,
        borderRadius: ClayTokens.borderRadius.standard,
        boxShadow: ClayTokens.shadows.hover,
        padding: ClayTokens.spacing.lg,
        minWidth: 320,
        maxWidth: 400,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s ease-in-out',
        border: `2px solid ${achievement.badgeColor === 'gold' ? '#FFD700' :
            achievement.badgeColor === 'silver' ? '#C0C0C0' :
                achievement.badgeColor === 'bronze' ? '#CD7F32' :
                    ClayTokens.colors.primary}`,
        ...style
    }

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ClayTokens.spacing.sm
    }

    const titleStyle: React.CSSProperties = {
        fontSize: ClayTokens.typography.fontSize.sm,
        fontWeight: ClayTokens.typography.fontWeight.semibold,
        color: ClayTokens.colors.textSecondary,
        margin: 0
    }

    const closeButtonStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        fontSize: ClayTokens.typography.fontSize.lg,
        cursor: 'pointer',
        color: ClayTokens.colors.textMuted,
        padding: 0,
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }

    const contentStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: ClayTokens.spacing.md,
        marginBottom: ClayTokens.spacing.md
    }

    const iconStyle: React.CSSProperties = {
        fontSize: 48,
        flexShrink: 0
    }

    const textContentStyle: React.CSSProperties = {
        flex: 1
    }

    const achievementNameStyle: React.CSSProperties = {
        fontSize: ClayTokens.typography.fontSize.lg,
        fontWeight: ClayTokens.typography.fontWeight.bold,
        color: ClayTokens.colors.text,
        margin: 0,
        marginBottom: ClayTokens.spacing.xs
    }

    const achievementDescriptionStyle: React.CSSProperties = {
        fontSize: ClayTokens.typography.fontSize.sm,
        color: ClayTokens.colors.textSecondary,
        margin: 0,
        marginBottom: ClayTokens.spacing.sm
    }

    const badgeContainerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: ClayTokens.spacing.md
    }

    const actionsStyle: React.CSSProperties = {
        display: 'flex',
        gap: ClayTokens.spacing.sm,
        justifyContent: 'flex-end'
    }

    return (
        <div className={className} style={notificationStyle}>
            <div style={headerStyle}>
                <h3 style={titleStyle}>🎉 Achievement Unlocked!</h3>
                <button
                    style={closeButtonStyle}
                    onClick={onClose}
                    aria-label="Close notification"
                >
                    ×
                </button>
            </div>

            <div style={contentStyle}>
                <div style={iconStyle}>
                    {achievement.icon}
                </div>

                <div style={textContentStyle}>
                    <h4 style={achievementNameStyle}>
                        {achievement.name}
                    </h4>
                    <p style={achievementDescriptionStyle}>
                        {achievement.description}
                    </p>
                </div>
            </div>

            <div style={badgeContainerStyle}>
                <ClayBadge
                    icon="🏆"
                    label={`${achievement.pointsRequired} Points`}
                    color={achievement.badgeColor}
                    size="medium"
                />
            </div>

            <div style={actionsStyle}>
                <ClayButton
                    variant="ghost"
                    size="small"
                    onPress={onClose}
                >
                    Dismiss
                </ClayButton>
                {onViewAchievements && (
                    <ClayButton
                        variant="primary"
                        size="small"
                        onPress={onViewAchievements}
                    >
                        View All
                    </ClayButton>
                )}
            </div>
        </div>
    )
}