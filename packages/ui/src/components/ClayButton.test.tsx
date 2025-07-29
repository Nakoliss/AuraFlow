import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ClayButton } from './ClayButton'
import '@testing-library/jest-dom'

describe('ClayButton', () => {
    it('renders children correctly', () => {
        const handlePress = vi.fn()
        render(<ClayButton onPress={handlePress}>Click me</ClayButton>)

        expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('calls onPress when clicked', () => {
        const handlePress = vi.fn()
        render(<ClayButton onPress={handlePress}>Click me</ClayButton>)

        fireEvent.click(screen.getByRole('button'))
        expect(handlePress).toHaveBeenCalledTimes(1)
    })

    it('does not call onPress when disabled', () => {
        const handlePress = vi.fn()
        render(
            <ClayButton onPress={handlePress} disabled>
                Click me
            </ClayButton>
        )

        fireEvent.click(screen.getByRole('button'))
        expect(handlePress).not.toHaveBeenCalled()
    })

    it('does not call onPress when loading', () => {
        const handlePress = vi.fn()
        render(
            <ClayButton onPress={handlePress} loading>
                Click me
            </ClayButton>
        )

        fireEvent.click(screen.getByRole('button'))
        expect(handlePress).not.toHaveBeenCalled()
    })

    it('shows loading indicator when loading', () => {
        const handlePress = vi.fn()
        render(
            <ClayButton onPress={handlePress} loading>
                Click me
            </ClayButton>
        )

        expect(screen.getByRole('button')).toHaveTextContent('⏳')
    })

    it('applies custom className', () => {
        const handlePress = vi.fn()
        render(
            <ClayButton onPress={handlePress} className="custom-class">
                Click me
            </ClayButton>
        )

        expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('applies custom styles', () => {
        const handlePress = vi.fn()
        const customStyle = { backgroundColor: 'red' }
        render(
            <ClayButton onPress={handlePress} style={customStyle}>
                Click me
            </ClayButton>
        )

        expect(screen.getByRole('button')).toHaveStyle('background-color: red')
    })

    describe('variants', () => {
        it('applies primary variant styles by default', () => {
            const handlePress = vi.fn()
            render(<ClayButton onPress={handlePress}>Primary</ClayButton>)

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('background-color: #6366F1')
            expect(button).toHaveStyle('color: white')
        })

        it('applies secondary variant styles', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} variant="secondary">
                    Secondary
                </ClayButton>
            )

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('background-color: #F8FAFC')
            expect(button).toHaveStyle('color: #1E293B')
        })

        it('applies ghost variant styles', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} variant="ghost">
                    Ghost
                </ClayButton>
            )

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('background-color: transparent')
            expect(button).toHaveStyle('color: #6366F1')
            expect(button).toHaveStyle('box-shadow: none')
        })
    })

    describe('sizes', () => {
        it('applies medium size by default', () => {
            const handlePress = vi.fn()
            render(<ClayButton onPress={handlePress}>Medium</ClayButton>)

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('padding: 16px 24px')
            expect(button).toHaveStyle('font-size: 16px')
        })

        it('applies small size styles', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} size="small">
                    Small
                </ClayButton>
            )

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('padding: 8px 16px')
            expect(button).toHaveStyle('font-size: 14px')
        })

        it('applies large size styles', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} size="large">
                    Large
                </ClayButton>
            )

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('padding: 24px 32px')
            expect(button).toHaveStyle('font-size: 18px')
        })
    })

    describe('states', () => {
        it('applies disabled styles when disabled', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} disabled>
                    Disabled
                </ClayButton>
            )

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('opacity: 0.6')
            expect(button).toHaveStyle('cursor: not-allowed')
            expect(button).toBeDisabled()
        })

        it('applies loading styles when loading', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} loading>
                    Loading
                </ClayButton>
            )

            const button = screen.getByRole('button')
            expect(button).toHaveStyle('cursor: not-allowed')
            expect(button).toBeDisabled()
        })
    })

    describe('hover effects', () => {
        it('applies hover effects on non-ghost variants', () => {
            const handlePress = vi.fn()
            render(<ClayButton onPress={handlePress}>Hover me</ClayButton>)

            const button = screen.getByRole('button')
            
            fireEvent.mouseEnter(button)
            expect(button).toHaveStyle('transform: translateY(-1px)')
            
            fireEvent.mouseLeave(button)
            expect(button).toHaveStyle('transform: translateY(0)')
        })

        it('does not apply hover effects on ghost variant', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} variant="ghost">
                    Ghost hover
                </ClayButton>
            )

            const button = screen.getByRole('button')
            
            fireEvent.mouseEnter(button)
            expect(button).not.toHaveStyle('transform: translateY(-1px)')
        })

        it('does not apply hover effects when disabled', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} disabled>
                    Disabled hover
                </ClayButton>
            )

            const button = screen.getByRole('button')
            
            fireEvent.mouseEnter(button)
            expect(button).not.toHaveStyle('transform: translateY(-1px)')
        })

        it('does not apply hover effects when loading', () => {
            const handlePress = vi.fn()
            render(
                <ClayButton onPress={handlePress} loading>
                    Loading hover
                </ClayButton>
            )

            const button = screen.getByRole('button')
            
            fireEvent.mouseEnter(button)
            expect(button).not.toHaveStyle('transform: translateY(-1px)')
        })
    })
})