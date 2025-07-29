import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ClayBadge } from './ClayBadge'
import '@testing-library/jest-dom'

describe('ClayBadge', () => {
    it('renders label correctly', () => {
        render(<ClayBadge label="Test Badge" />)
        
        expect(screen.getByText('Test Badge')).toBeInTheDocument()
    })

    it('renders icon when provided', () => {
        render(<ClayBadge label="Badge with icon" icon="🏆" />)
        
        expect(screen.getByText('🏆')).toBeInTheDocument()
        expect(screen.getByText('Badge with icon')).toBeInTheDocument()
    })

    it('applies custom className', () => {
        render(<ClayBadge label="Custom class" className="custom-badge" />)
        
        const badge = screen.getByText('Custom class')
        expect(badge).toHaveClass('custom-badge')
    })

    it('applies custom styles', () => {
        const customStyle = { backgroundColor: 'red' }
        render(<ClayBadge label="Custom style" style={customStyle} />)
        
        const badge = screen.getByText('Custom style')
        expect(badge).toHaveStyle('background-color: red')
    })

    describe('colors', () => {
        it('applies default color by default', () => {
            render(<ClayBadge label="Default" />)
            
            const badge = screen.getByText('Default')
            expect(badge).toHaveStyle('background-color: #6366F1')
            expect(badge).toHaveStyle('color: white')
        })

        it('applies gold color', () => {
            render(<ClayBadge label="Gold" color="gold" />)
            
            const badge = screen.getByText('Gold')
            expect(badge).toHaveStyle('background-color: #FFD700')
            expect(badge).toHaveStyle('color: #8B4513')
        })

        it('applies silver color', () => {
            render(<ClayBadge label="Silver" color="silver" />)
            
            const badge = screen.getByText('Silver')
            expect(badge).toHaveStyle('background-color: #C0C0C0')
            expect(badge).toHaveStyle('color: #4A4A4A')
        })

        it('applies bronze color', () => {
            render(<ClayBadge label="Bronze" color="bronze" />)
            
            const badge = screen.getByText('Bronze')
            expect(badge).toHaveStyle('background-color: #CD7F32')
            expect(badge).toHaveStyle('color: #FFFFFF')
        })
    })

    describe('sizes', () => {
        it('applies medium size by default', () => {
            render(<ClayBadge label="Medium" />)
            
            const badge = screen.getByText('Medium')
            expect(badge).toHaveStyle('padding: 8px 16px')
            expect(badge).toHaveStyle('font-size: 14px')
        })

        it('applies small size', () => {
            render(<ClayBadge label="Small" size="small" />)
            
            const badge = screen.getByText('Small')
            expect(badge).toHaveStyle('padding: 4px 8px')
            expect(badge).toHaveStyle('font-size: 12px')
        })

        it('applies large size', () => {
            render(<ClayBadge label="Large" size="large" />)
            
            const badge = screen.getByText('Large')
            expect(badge).toHaveStyle('padding: 16px 24px')
            expect(badge).toHaveStyle('font-size: 16px')
        })
    })

    it('applies clay shadow and border radius', () => {
        render(<ClayBadge label="Styled badge" />)
        
        const badge = screen.getByText('Styled badge')
        expect(badge).toHaveStyle('border-radius: 8px')
        expect(badge).toHaveStyle('box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)')
    })

    it('applies correct font weight and flex layout', () => {
        render(<ClayBadge label="Layout test" icon="⭐" />)
        
        const badge = screen.getByText('Layout test')
        expect(badge).toHaveStyle('font-weight: 500')
        expect(badge).toHaveStyle('display: inline-flex')
        expect(badge).toHaveStyle('align-items: center')
    })
})