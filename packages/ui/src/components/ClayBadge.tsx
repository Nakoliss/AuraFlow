import React from 'react'
import { ClayTokens } from '../tokens'

export interface ClayBadgeProps {
    icon?: string
    label: string
    color?: 'gold' | 'silver' | 'bronze' | 'default'
    size?: 'small' | 'medium' | 'large'
    style?: React.CSSProperties
    className?: string
}

export const ClayBadge: React.FC<ClayBadgeProps> = ({
    icon,
    label,
    color = 'default',
    size = 'medium',
    style,
    className
}) => {
    const colorStyles = {
        gold: {
            backgroundColor: '#FFD700',
            color: '#8B4513'
        },
        silver: {
            backgroundColor: '#C0C0C0',
            color: '#4A4A4A'
        },
        bronze: {
            backgroundColor: '#CD7F32',
            color: '#FFFFFF'
        },
        default: {
            backgroundColor: ClayTokens.colors.primary,
            color: 'white'
        }
    }

    const sizeStyles = {
        small: {
            padding: `${ClayTokens.spacing.xs}px ${ClayTokens.spacing.sm}px`,
            fontSize: ClayTokens.typography.fontSize.xs
        },
        medium: {
            padding: `${ClayTokens.spacing.sm}px ${ClayTokens.spacing.md}px`,
            fontSize: ClayTokens.typography.fontSize.sm
        },
        large: {
            padding: `${ClayTokens.spacing.md}px ${ClayTokens.spacing.lg}px`,
            fontSize: ClayTokens.typography.fontSize.base
        }
    }

    const badgeStyle: React.CSSProperties = {
        ...sizeStyles[size],
        ...colorStyles[color],
        borderRadius: ClayTokens.borderRadius.small,
        boxShadow: ClayTokens.shadows.clay,
        fontWeight: ClayTokens.typography.fontWeight.medium,
        display: 'inline-flex',
        alignItems: 'center',
        gap: ClayTokens.spacing.xs,
        ...style
    }

    return (
        <span className={className} style={badgeStyle}>
            {icon && <span>{icon}</span>}
            {label}
        </span>
    )
}