import React from 'react'
import { ClayBadge } from './ClayBadge'
import { ClayCard } from './ClayCard'
import { ClayTokens } from '../tokens'

export interface Achievement {
    id: string
    name: string
    description: string
    icon: string
    pointsRequired: number
    badgeColor: 'gold' | 'silver' | 'bronze' | 'default'
    earnedAt?: Date
    isUnlocked?: boolean
}

export interface AchievementDisplayProps {
    achievement: Achievement
    showProgress?: boolean
    currentPoints?: number
    size?: 'small' | 'medium' | 'large'
    style?: React.CSSProperties
    className?: string
}

export const AchievementDisplay: React.FC<AchievementDisplayProps> = ({
    achievement,
    showProgress = false,
    currentPoints = 0,
    size = 'medium',
    style,
    className
}) => {
    const isUnlocked = achievement.isUnlocked || !!achievement.earnedAt
    const progress = Math.min((currentPoints / achievement.pointsRequired) * 100, 100)

    const sizeStyles = {
        small: {
            padding: ClayTokens.spacing.sm,
            iconSize: 24,
            titleSize: ClayTokens.typography.fontSize.sm,
            descriptionSize: ClayTokens.typography.fontSize.xs
        },
        medium: {
            padding: ClayTokens.spacing.md,
            iconSize: 32,
            titleSize: ClayTokens.typography.fontSize.base,
            descriptionSize: ClayTokens.typography.fontSize.sm
        },
        large: {
            padding: ClayTokens.spacing.lg,
            iconSize: 48,
            titleSize: ClayTokens.typography.fontSize.lg,
            descriptionSize: ClayTokens.typography.fontSize.base
        }
    }

    const currentSize = sizeStyles[size]

    const cardStyle: React.CSSProperties = {
        padding: currentSize.padding,
        opacity: isUnlocked ? 1 : 0.6,
        position: 'relative',
        overflow: 'hidden',
        ...style
    }

    const iconStyle: React.CSSProperties = {
        fontSize: currentSize.iconSize,
        marginBottom: ClayTokens.spacing.sm,
        filter: isUnlocked ? 'none' : 'grayscale(100%)'
    }

    const titleStyle: React.CSSProperties = {
        fontSize: currentSize.titleSize,
        fontWeight: ClayTokens.typography.fontWeight.semibold,
        color: isUnlocked ? ClayTokens.colors.text : ClayTokens.colors.textMuted,
        marginBottom: ClayTokens.spacing.xs
    }

    const descriptionStyle: React.CSSProperties = {
        fontSize: currentSize.descriptionSize,
        color: isUnlocked ? ClayTokens.colors.textSecondary : ClayTokens.colors.textMuted,
        marginBottom: showProgress ? ClayTokens.spacing.sm : 0
    }

    const progressBarStyle: React.CSSProperties = {
        width: '100%',
        height: 4,
        backgroundColor: ClayTokens.colors.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: ClayTokens.spacing.xs
    }

    const progressFillStyle: React.CSSProperties = {
        height: '100%',
        backgroundColor: isUnlocked ? ClayTokens.colors.success : ClayTokens.colors.primary,
        width: `${progress}%`,
        transition: 'width 0.3s ease'
    }

    const progressTextStyle: React.CSSProperties = {
        fontSize: ClayTokens.typography.fontSize.xs,
        color: ClayTokens.colors.textMuted,
        textAlign: 'center'
    }

    const badgeContainerStyle: React.CSSProperties = {
        position: 'absolute',
        top: ClayTokens.spacing.sm,
        right: ClayTokens.spacing.sm
    }

    const earnedDateStyle: React.CSSProperties = {
        fontSize: ClayTokens.typography.fontSize.xs,
        color: ClayTokens.colors.textMuted,
        marginTop: ClayTokens.spacing.xs,
        fontStyle: 'italic'
    }

    return (
        <ClayCard className={className} style={cardStyle}>
            {isUnlocked && (
                <div style={badgeContainerStyle}>
                    <ClayBadge
                        icon="✓"
                        label="Unlocked"
                        color={achievement.badgeColor}
                        size="small"
                    />
                </div>
            )}

            <div style={{ textAlign: 'center' }}>
                <div style={iconStyle}>
                    {achievement.icon}
                </div>

                <div style={titleStyle}>
                    {achievement.name}
                </div>

                <div style={descriptionStyle}>
                    {achievement.description}
                </div>

                {showProgress && !isUnlocked && (
                    <>
                        <div style={progressBarStyle}>
                            <div style={progressFillStyle} />
                        </div>
                        <div style={progressTextStyle}>
                            {currentPoints} / {achievement.pointsRequired} points
                        </div>
                    </>
                )}

                {achievement.earnedAt && (
                    <div style={earnedDateStyle}>
                        Earned {achievement.earnedAt.toLocaleDateString()}
                    </div>
                )}
            </div>
        </ClayCard>
    )
}