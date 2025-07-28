import React from 'react'
import { ClayTokens } from '../tokens'

export interface ClayCardProps {
    title?: string
    children: React.ReactNode
    elevation?: 'low' | 'medium' | 'high'
    interactive?: boolean
    style?: React.CSSProperties
    className?: string
    onClick?: () => void
}

export const ClayCard: React.FC<ClayCardProps> = ({
    title,
    children,
    elevation = 'medium',
    interactive = false,
    style,
    className,
    onClick
}) => {
    const elevationStyles = {
        low: ClayTokens.shadows.clay,
        medium: ClayTokens.shadows.clay,
        high: ClayTokens.shadows.hover
    }

    const cardStyle: React.CSSProperties = {
        backgroundColor: ClayTokens.colors.surfaceElevated,
        borderRadius: ClayTokens.borderRadius.standard,
        boxShadow: elevationStyles[elevation],
        padding: ClayTokens.spacing.lg,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        ...style
    }

    const hoverStyle: React.CSSProperties = interactive ? {
        boxShadow: ClayTokens.shadows.hover,
        transform: 'translateY(-2px)'
    } : {}

    return (
        <div
            className={className}
            style={cardStyle}
            onClick={onClick}
            onMouseEnter={(e) => {
                if (interactive) {
                    Object.assign(e.currentTarget.style, hoverStyle)
                }
            }}
            onMouseLeave={(e) => {
                if (interactive) {
                    e.currentTarget.style.boxShadow = elevationStyles[elevation]
                    e.currentTarget.style.transform = 'translateY(0)'
                }
            }}
        >
            {title && (
                <h3 style={{
                    margin: 0,
                    marginBottom: ClayTokens.spacing.md,
                    fontSize: ClayTokens.typography.fontSize.lg,
                    fontWeight: ClayTokens.typography.fontWeight.semibold,
                    color: ClayTokens.colors.text
                }}>
                    {title}
                </h3>
            )}
            {children}
        </div>
    )
}