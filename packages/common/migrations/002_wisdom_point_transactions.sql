-- Migration: 002_wisdom_point_transactions.sql
-- Description: Add wisdom point transactions table for tracking point awards

-- Wisdom point transactions table
CREATE TABLE wisdom_point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'app_open',
        'daily_challenge_complete', 
        'content_share',
        'daily_streak',
        'achievement_unlock',
        'referral_success'
    )),
    points INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_wisdom_point_transactions_user_id ON wisdom_point_transactions(user_id);
CREATE INDEX idx_wisdom_point_transactions_created_at ON wisdom_point_transactions(created_at);
CREATE INDEX idx_wisdom_point_transactions_action ON wisdom_point_transactions(action);