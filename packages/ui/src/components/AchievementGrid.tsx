import React from 'react'
import { AchievementDisplay, Achievement } from './AchievementDisplay'
import { ClayTokens } from '../tokens'

export interface AchievementGridProps {
    achievements: Achievement[]
    currentPoints?: number
    showProgress?: boolean
    columns?: number
    size?: 'small' | 'medium' | 'large'
    style?: React.CSSProperties
    className?: string
    onAchievementClick?: (achievement: Achievement) => void
}

export const AchievementGrid: React.FC<AchievementGridProps> = ({
    achievements,
    currentPoints = 0,
    showProgress = false,
    columns = 3,
    size = 'medium',
    style,
    className,
    onAchievementClick
}) => {
    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: ClayTokens.spacing.md,
        ...style
    }

    const achievementStyle: React.CSSProperties = {
        cursor: onAchievementClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    }

    const handleAchievementClick = (achievement: Achievement) => {
        if (onAchievementClick) {
            onAchievementClick(achievement)
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent, achievement: Achievement) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleAchievementClick(achievement)
        }
    }

    // Sort achievements: unlocked first, then by points required
    const sortedAchievements = [...achievements].sort((a, b) => {
        const aUnlocked = a.isUnlocked || !!a.earnedAt
        const bUnlocked = b.isUnlocked || !!b.earnedAt

        if (aUnlocked && !bUnlocked) return -1
        if (!aUnlocked && bUnlocked) return 1

        return a.pointsRequired - b.pointsRequired
    })

    return (
        <div className={className} style={gridStyle}>
            {sortedAchievements.map((achievement) => (
                <div
                    key={achievement.id}
                    style={achievementStyle}
                    onClick={() => handleAchievementClick(achievement)}
                    onKeyDown={(e) => handleKeyDown(e, achievement)}
                    tabIndex={onAchievementClick ? 0 : -1}
                    role={onAchievementClick ? 'button' : undefined}
                    aria-label={onAchievementClick ? `View ${achievement.name} achievement` : undefined}
                >
                    <AchievementDisplay
                        achievement={achievement}
                        currentPoints={currentPoints}
                        showProgress={showProgress}
                        size={size}
                    />
                </div>
            ))}
        </div>
    )
}