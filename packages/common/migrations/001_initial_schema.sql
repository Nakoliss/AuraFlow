-- AuraFlow Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Description: Create core tables for users, messages, daily drops, and achievements

-- Enable pgvector extension for semantic similarity
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_status VARCHAR(20) DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium_core', 'voice_pack')),
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    voice_pack_expires_at TIMESTAMP WITH TIME ZONE,
    wisdom_points INTEGER DEFAULT 0,
    streak_count INTEGER DEFAULT 0,
    last_activity_date DATE,
    preferred_categories TEXT[] DEFAULT '{}',
    notification_time TIME,
    voice_preference VARCHAR(50),
    timezone VARCHAR(100) DEFAULT 'UTC'
);

-- Generated messages table
CREATE TABLE generated_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('motivational', 'mindfulness', 'fitness', 'philosophy', 'productivity')),
    embedding vector(1536), -- OpenAI ada-002 embedding dimension
    tokens INTEGER NOT NULL,
    cost DECIMAL(10, 6) NOT NULL,
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    model VARCHAR(50) NOT NULL,
    time_of_day VARCHAR(10) CHECK (time_of_day IN ('morning', 'evening')),
    weather_context VARCHAR(10) CHECK (weather_context IN ('sunny', 'rain', 'cold', 'hot')),
    locale VARCHAR(10) DEFAULT 'en-US',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily drops table (broadcast messages)
CREATE TABLE daily_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    content TEXT NOT NULL,
    locale VARCHAR(10) DEFAULT 'en-US',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily challenges table
CREATE TABLE daily_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    task TEXT NOT NULL,
    points INTEGER DEFAULT 5,
    locale VARCHAR(10) DEFAULT 'en-US',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, locale)
);

-- Achievements table
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL,
    points_required INTEGER NOT NULL,
    badge_color VARCHAR(20) DEFAULT 'gold',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements table (many-to-many)
CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- Audio cache table for TTS
CREATE TABLE audio_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES generated_messages(id) ON DELETE CASCADE,
    voice VARCHAR(50) NOT NULL,
    audio_url TEXT NOT NULL,
    duration INTEGER NOT NULL, -- in seconds
    file_size INTEGER NOT NULL, -- in bytes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, voice)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_users_last_activity ON users(last_activity_date);

CREATE INDEX idx_generated_messages_user_id ON generated_messages(user_id);
CREATE INDEX idx_generated_messages_category ON generated_messages(category);
CREATE INDEX idx_generated_messages_created_at ON generated_messages(created_at);
CREATE INDEX idx_generated_messages_embedding ON generated_messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_daily_drops_date ON daily_drops(date);
CREATE INDEX idx_daily_drops_locale ON daily_drops(locale);
CREATE INDEX idx_daily_drops_embedding ON daily_drops USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_daily_challenges_date ON daily_challenges(date);
CREATE INDEX idx_daily_challenges_locale ON daily_challenges(locale);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_earned_at ON user_achievements(earned_at);

CREATE INDEX idx_audio_cache_message_id ON audio_cache(message_id);
CREATE INDEX idx_audio_cache_voice ON audio_cache(voice);

-- Functions for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate cosine similarity for semantic deduplication
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS FLOAT AS $$
BEGIN
    RETURN 1 - (a <=> b);
END;
$$ LANGUAGE plpgsql;

-- Function to find similar messages within time window
CREATE OR REPLACE FUNCTION find_similar_messages(
    input_embedding vector,
    category_filter text,
    similarity_threshold float DEFAULT 0.80,
    days_back integer DEFAULT 90
)
RETURNS TABLE(id uuid, content text, similarity float) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gm.id,
        gm.content,
        cosine_similarity(gm.embedding, input_embedding) as similarity
    FROM generated_messages gm
    WHERE gm.category = category_filter
        AND gm.created_at >= NOW() - INTERVAL '%s days' % days_back
        AND cosine_similarity(gm.embedding, input_embedding) >= similarity_threshold
    ORDER BY similarity DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;