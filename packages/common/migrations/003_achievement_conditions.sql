-- Migration: 003_achievement_conditions.sql
-- Description: Add achievement conditions table for flexible achievement requirements

-- Achievement conditions table
CREATE TABLE achievement_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    condition_type VARCHAR(30) NOT NULL CHECK (condition_type IN (
        'wisdom_points',
        'streak_days',
        'messages_generated',
        'challenges_completed',
        'shares_made'
    )),
    threshold INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_achievement_conditions_achievement_id ON achievement_conditions(achievement_id);
CREATE INDEX idx_achievement_conditions_type ON achievement_conditions(condition_type);