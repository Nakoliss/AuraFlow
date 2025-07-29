import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ClayCard } from './ClayCard'
import '@testing-library/jest-dom'

describe('ClayCard', () => {
    it('renders children correctly', () => {
        render(
            <ClayCard>
                <p>Test content</p>
            </ClayCard>
        )

        expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('renders title when provided', () => {
        render(
            <ClayCard title="Test Title">
                <p>Content</p>
            </ClayCard>
        )

        expect(screen.getByText('Test Title')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    })

    it('applies custom className', () => {
        render(
            <ClayCard className="custom-class">
                <p>Content</p>
            </ClayCard>
        )

        const card = screen.getByText('Content').parentElement
        expect(card).toHaveClass('custom-class')
    })

    it('applies custom styles', () => {
        const customStyle = { backgroundColor: 'red' }
        render(
            <ClayCard style={customStyle}>
                <p>Content</p>
            </ClayCard>
        )

        const card = screen.getByText('Content').parentElement
        expect(card).toHaveStyle('background-color: red')
    })

    it('handles click events when interactive', () => {
        const handleClick = vi.fn()
        render(
            <ClayCard interactive onClick={handleClick}>
                <p>Clickable content</p>
            </ClayCard>
        )

        const card = screen.getByText('Clickable content').parentElement
        fireEvent.click(card!)
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not handle clicks when not interactive', () => {
        const handleClick = vi.fn()
        render(
            <ClayCard onClick={handleClick}>
                <p>Non-clickable content</p>
            </ClayCard>
        )

        const card = screen.getByText('Non-clickable content').parentElement
        fireEvent.click(card!)
        expect(handleClick).toHaveBeenCalledTimes(1) // onClick still works but cursor is default
    })

    it('applies correct elevation styles', () => {
        const { rerender } = render(
            <ClayCard elevation="low">
                <p>Content</p>
            </ClayCard>
        )

        let card = screen.getByText('Content').parentElement
        expect(card).toHaveStyle('box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)')

        rerender(
            <ClayCard elevation="high">
                <p>Content</p>
            </ClayCard>
        )

        card = screen.getByText('Content').parentElement
        expect(card).toHaveStyle('box-shadow: 0 12px 48px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)')
    })

    it('applies interactive cursor style when interactive', () => {
        render(
            <ClayCard interactive>
                <p>Interactive content</p>
            </ClayCard>
        )

        const card = screen.getByText('Interactive content').parentElement
        expect(card).toHaveStyle('cursor: pointer')
    })

    it('applies default cursor style when not interactive', () => {
        render(
            <ClayCard>
                <p>Static content</p>
            </ClayCard>
        )

        const card = screen.getByText('Static content').parentElement
        expect(card).toHaveStyle('cursor: default')
    })

    it('handles hover effects on interactive cards', () => {
        render(
            <ClayCard interactive>
                <p>Hoverable content</p>
            </ClayCard>
        )

        const card = screen.getByText('Hoverable content').parentElement!
        
        // Test mouse enter
        fireEvent.mouseEnter(card)
        expect(card).toHaveStyle('transform: translateY(-2px)')
        
        // Test mouse leave
        fireEvent.mouseLeave(card)
        expect(card).toHaveStyle('transform: translateY(0)')
    })

    it('does not apply hover effects on non-interactive cards', () => {
        render(
            <ClayCard>
                <p>Static content</p>
            </ClayCard>
        )

        const card = screen.getByText('Static content').parentElement!
        
        fireEvent.mouseEnter(card)
        expect(card).not.toHaveStyle('transform: translateY(-2px)')
    })
})