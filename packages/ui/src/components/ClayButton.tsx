import React from 'react'
import { ClayTokens } from '../tokens'

export interface ClayButtonProps {
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'small' | 'medium' | 'large'
    disabled?: boolean
    loading?: boolean
    children: React.ReactNode
    style?: React.CSSProperties
    className?: string
    onPress: () => void
}

export const ClayButton: React.FC<ClayButtonProps> = ({
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    children,
    style,
    className,
    onPress
}) => {
    const sizeStyles = {
        small: {
            padding: `${ClayTokens.spacing.sm}px ${ClayTokens.spacing.md}px`,
            fontSize: ClayTokens.typography.fontSize.sm
        },
        medium: {
            padding: `${ClayTokens.spacing.md}px ${ClayTokens.spacing.lg}px`,
            fontSize: ClayTokens.typography.fontSize.base
        },
        large: {
            padding: `${ClayTokens.spacing.lg}px ${ClayTokens.spacing.xl}px`,
            fontSize: ClayTokens.typography.fontSize.lg
        }
    }

    const variantStyles = {
        primary: {
            backgroundColor: ClayTokens.colors.primary,
            color: 'white',
            border: 'none'
        },
        secondary: {
            backgroundColor: ClayTokens.colors.surface,
            color: ClayTokens.colors.text,
            border: `1px solid ${ClayTokens.colors.border}`
        },
        ghost: {
            backgroundColor: 'transparent',
            color: ClayTokens.colors.primary,
            border: 'none'
        }
    }

    const buttonStyle: React.CSSProperties = {
        ...sizeStyles[size],
        ...variantStyles[variant],
        borderRadius: ClayTokens.borderRadius.standard,
        boxShadow: variant !== 'ghost' ? ClayTokens.shadows.clay : 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontWeight: ClayTokens.typography.fontWeight.medium,
        transition: 'all 0.2s ease-in-out',
        opacity: disabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ClayTokens.spacing.sm,
        ...style
    }

    const handleClick = () => {
        if (!disabled && !loading) {
            onPress()
        }
    }

    return (
        <button
            className={className}
            style={buttonStyle}
            onClick={handleClick}
            disabled={disabled || loading}
            onMouseEnter={(e) => {
                if (!disabled && !loading && variant !== 'ghost') {
                    e.currentTarget.style.boxShadow = ClayTokens.shadows.hover
                    e.currentTarget.style.transform = 'translateY(-1px)'
                }
            }}
            onMouseLeave={(e) => {
                if (!disabled && !loading && variant !== 'ghost') {
                    e.currentTarget.style.boxShadow = ClayTokens.shadows.clay
                    e.currentTarget.style.transform = 'translateY(0)'
                }
            }}
        >
            {loading && <span>⏳</span>}
            {children}
        </button>
    )
}