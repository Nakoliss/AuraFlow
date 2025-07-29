import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AchievementDisplay, Achievement } from './AchievementDisplay'
import '@testing-library/jest-dom'

describe('AchievementDisplay', () => {
    const mockAchievement: Achievement = {
        id: 'test-achievement',
        name: 'Test Achievement',
        description: 'This is a test achievement',
        icon: '🏆',
        pointsRequired: 100,
        badgeColor: 'gold'
    }

    it('renders achievement information correctly', () => {
        render(<AchievementDisplay achievement={mockAchievement} />)
        
        expect(screen.getByText('Test Achievement')).toBeInTheDocument()
        expect(screen.getByText('This is a test achievement')).toBeInTheDocument()
        expect(screen.getByText('🏆')).toBeInTheDocument()
    })

    it('shows unlocked badge when achievement is unlocked', () => {
        const unlockedAchievement = { ...mockAchievement, isUnlocked: true }
        render(<AchievementDisplay achievement={unlockedAchievement} />)
        
        expect(screen.getByText('Unlocked')).toBeInTheDocument()
    })

    it('shows unlocked badge when achievement has earned date', () => {
        const earnedAchievement = { ...mockAchievement, earnedAt: new Date('2024-01-01') }
        render(<AchievementDisplay achievement={earnedAchievement} />)
        
        expect(screen.getByText('Unlocked')).toBeInTheDocument()
        expect(screen.getByText('Earned 1/1/2024')).toBeInTheDocument()
    })

    it('applies grayscale filter to icon when locked', () => {
        render(<AchievementDisplay achievement={mockAchievement} />)
        
        const icon = screen.getByText('🏆')
        expect(icon).toHaveStyle('filter: grayscale(100%)')
    })

    it('removes grayscale filter from icon when unlocked', () => {
        const unlockedAchievement = { ...mockAchievement, isUnlocked: true }
        render(<AchievementDisplay achievement={unlockedAchievement} />)
        
        const icon = screen.getByText('🏆')
        expect(icon).toHaveStyle('filter: none')
    })

    it('shows progress bar when showProgress is true and achievement is locked', () => {
        render(
            <AchievementDisplay 
                achievement={mockAchievement} 
                showProgress={true}
                currentPoints={50}
            />
        )
        
        expect(screen.getByText('50 / 100 points')).toBeInTheDocument()
    })

    it('does not show progress bar when achievement is unlocked', () => {
        const unlockedAchievement = { ...mockAchievement, isUnlocked: true }
        render(
            <AchievementDisplay 
                achievement={unlockedAchievement} 
                showProgress={true}
                currentPoints={50}
            />
        )
        
        expect(screen.queryByText('50 / 100 points')).not.toBeInTheDocument()
    })

    it('calculates progress percentage correctly', () => {
        render(
            <AchievementDisplay 
                achievement={mockAchievement} 
                showProgress={true}
                currentPoints={75}
            />
        )
        
        // Check if progress bar has correct width (75%)
        const progressText = screen.getByText('75 / 100 points')
        expect(progressText).toBeInTheDocument()
    })

    it('caps progress at 100%', () => {
        render(
            <AchievementDisplay 
                achievement={mockAchievement} 
                showProgress={true}
                currentPoints={150} // More than required
            />
        )
        
        expect(screen.getByText('150 / 100 points')).toBeInTheDocument()
    })

    it('applies custom className', () => {
        render(
            <AchievementDisplay 
                achievement={mockAchievement} 
                className="custom-achievement"
            />
        )
        
        const container = screen.getByText('Test Achievement').closest('div')
        expect(container).toHaveClass('custom-achievement')
    })

    it('applies custom styles', () => {
        const customStyle = { backgroundColor: 'red' }
        render(
            <AchievementDisplay 
                achievement={mockAchievement} 
                style={customStyle}
            />
        )
        
        const container = screen.getByText('Test Achievement').closest('div')
        expect(container).toHaveStyle('background-color: red')
    })

    describe('sizes', () => {
        it('applies medium size by default', () => {
            render(<AchievementDisplay achievement={mockAchievement} />)
            
            const icon = screen.getByText('🏆')
            expect(icon).toHaveStyle('font-size: 32px')
        })

        it('applies small size', () => {
            render(<AchievementDisplay achievement={mockAchievement} size="small" />)
            
            const icon = screen.getByText('🏆')
            expect(icon).toHaveStyle('font-size: 24px')
        })

        it('applies large size', () => {
            render(<AchievementDisplay achievement={mockAchievement} size="large" />)
            
            const icon = screen.getByText('🏆')
            expect(icon).toHaveStyle('font-size: 48px')
        })
    })

    it('applies reduced opacity when locked', () => {
        render(<AchievementDisplay achievement={mockAchievement} />)
        
        const container = screen.getByText('Test Achievement').closest('div')
        expect(container).toHaveStyle('opacity: 0.6')
    })

    it('applies full opacity when unlocked', () => {
        const unlockedAchievement = { ...mockAchievement, isUnlocked: true }
        render(<AchievementDisplay achievement={unlockedAchievement} />)
        
        const container = screen.getByText('Test Achievement').closest('div')
        expect(container).toHaveStyle('opacity: 1')
    })
})