// User service for database operations
import { getSupabaseClient, executeQuery } from './database'
import { createLogger } from './logging'
import { DatabaseError, ValidationError } from './errors'
import type { User, SubscriptionTier } from './types'

const logger = createLogger('user-service')

export interface CreateUserRequest {
    email: string
    passwordHash: string
    timezone?: string
}

export interface UpdateUserRequest {
    subscriptionStatus?: SubscriptionTier
    premiumExpiresAt?: Date
    voicePackExpiresAt?: Date
    wisdomPoints?: number
    streakCount?: number
    lastActivityDate?: Date
    preferredCategories?: string[]
    notificationTime?: string
    voicePreference?: string
    timezone?: string
}

export class UserService {
    private supabase: ReturnType<typeof getSupabaseClient> | null = null

    private getSupabase() {
        if (!this.supabase) {
            this.supabase = getSupabaseClient()
        }
        return this.supabase
    }

    // Create a new user
    async createUser(userData: CreateUserRequest): Promise<User> {
        try {
            logger.debug('Creating new user', { email: userData.email })

            const { data, error } = await this.getSupabase()
                .from('users')
                .insert({
                    email: userData.email.toLowerCase(),
                    password_hash: userData.passwordHash,
                    timezone: userData.timezone || 'UTC',
                    subscription_status: 'free',
                    wisdom_points: 0,
                    streak_count: 0,
                    preferred_categories: []
                })
                .select()
                .single()

            if (error) {
                logger.error('Failed to create user', { email: userData.email, error: error.message })
                
                if (error.code === '23505') { // Unique constraint violation
                    throw new ValidationError('User with this email already exists')
                }
                
                throw new DatabaseError(`Failed to create user: ${error.message}`, 'create_user')
            }

            const user = this.mapDatabaseUserToUser(data)
            
            logger.info('User created successfully', { 
                userId: user.id, 
                email: user.email 
            })

            return user

        } catch (error) {
            if (error instanceof ValidationError || error instanceof DatabaseError) {
                throw error
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Unexpected error creating user', { email: userData.email, error: errorMessage })
            throw new DatabaseError(`Failed to create user: ${errorMessage}`, 'create_user')
        }
    }

    // Find user by email for authentication (includes password hash)
    async findUserByEmailForAuth(email: string): Promise<(User & { passwordHash: string }) | null> {
        try {
            logger.debug('Finding user by email for authentication', { email })

            const { data, error } = await this.getSupabase()
                .from('users')
                .select('*')
                .eq('email', email.toLowerCase())
                .single()

            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    logger.debug('User not found', { email })
                    return null
                }
                
                logger.error('Failed to find user by email', { email, error: error.message })
                throw new DatabaseError(`Failed to find user: ${error.message}`, 'find_user')
            }

            const user = this.mapDatabaseUserToUser(data)
            
            logger.debug('User found for authentication', { userId: user.id, email: user.email })
            return {
                ...user,
                passwordHash: data.password_hash
            }

        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Unexpected error finding user for auth', { email, error: errorMessage })
            throw new DatabaseError(`Failed to find user: ${errorMessage}`, 'find_user')
        }
    }

    // Find user by email
    async findUserByEmail(email: string): Promise<User | null> {
        try {
            logger.debug('Finding user by email', { email })

            const { data, error } = await this.getSupabase()
                .from('users')
                .select('*')
                .eq('email', email.toLowerCase())
                .single()

            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    logger.debug('User not found', { email })
                    return null
                }
                
                logger.error('Failed to find user by email', { email, error: error.message })
                throw new DatabaseError(`Failed to find user: ${error.message}`, 'find_user')
            }

            const user = this.mapDatabaseUserToUser(data)
            
            logger.debug('User found', { userId: user.id, email: user.email })
            return user

        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Unexpected error finding user', { email, error: errorMessage })
            throw new DatabaseError(`Failed to find user: ${errorMessage}`, 'find_user')
        }
    }

    // Find user by ID
    async findUserById(userId: string): Promise<User | null> {
        try {
            logger.debug('Finding user by ID', { userId })

            const { data, error } = await this.getSupabase()
                .from('users')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    logger.debug('User not found', { userId })
                    return null
                }
                
                logger.error('Failed to find user by ID', { userId, error: error.message })
                throw new DatabaseError(`Failed to find user: ${error.message}`, 'find_user')
            }

            const user = this.mapDatabaseUserToUser(data)
            
            logger.debug('User found', { userId: user.id, email: user.email })
            return user

        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Unexpected error finding user', { userId, error: errorMessage })
            throw new DatabaseError(`Failed to find user: ${errorMessage}`, 'find_user')
        }
    }

    // Update user
    async updateUser(userId: string, updates: UpdateUserRequest): Promise<User> {
        try {
            logger.debug('Updating user', { userId, updates })

            // Convert camelCase to snake_case for database
            const dbUpdates: any = {}
            if (updates.subscriptionStatus !== undefined) dbUpdates.subscription_status = updates.subscriptionStatus
            if (updates.premiumExpiresAt !== undefined) dbUpdates.premium_expires_at = updates.premiumExpiresAt
            if (updates.voicePackExpiresAt !== undefined) dbUpdates.voice_pack_expires_at = updates.voicePackExpiresAt
            if (updates.wisdomPoints !== undefined) dbUpdates.wisdom_points = updates.wisdomPoints
            if (updates.streakCount !== undefined) dbUpdates.streak_count = updates.streakCount
            if (updates.lastActivityDate !== undefined) dbUpdates.last_activity_date = updates.lastActivityDate
            if (updates.preferredCategories !== undefined) dbUpdates.preferred_categories = updates.preferredCategories
            if (updates.notificationTime !== undefined) dbUpdates.notification_time = updates.notificationTime
            if (updates.voicePreference !== undefined) dbUpdates.voice_preference = updates.voicePreference
            if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone

            // Add updated_at timestamp
            dbUpdates.updated_at = new Date().toISOString()

            const { data, error } = await this.getSupabase()
                .from('users')
                .update(dbUpdates)
                .eq('id', userId)
                .select()
                .single()

            if (error) {
                logger.error('Failed to update user', { userId, error: error.message })
                throw new DatabaseError(`Failed to update user: ${error.message}`, 'update_user')
            }

            const user = this.mapDatabaseUserToUser(data)
            
            logger.info('User updated successfully', { 
                userId: user.id, 
                email: user.email 
            })

            return user

        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Unexpected error updating user', { userId, error: errorMessage })
            throw new DatabaseError(`Failed to update user: ${errorMessage}`, 'update_user')
        }
    }

    // Update user subscription status
    async updateSubscriptionStatus(userId: string, subscriptionStatus: SubscriptionTier): Promise<User> {
        try {
            logger.debug('Updating user subscription status', { userId, subscriptionStatus })

            const { data, error } = await this.getSupabase()
                .from('users')
                .update({ 
                    subscription_status: subscriptionStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select()
                .single()

            if (error) {
                logger.error('Database error updating subscription status', { userId, error: error.message })
                throw new DatabaseError(`Database error: ${error.message}`, 'update_subscription')
            }

            if (!data) {
                logger.warn('User not found for subscription update', { userId })
                throw new ValidationError(`User with ID ${userId} not found`)
            }

            const updatedUser = this.mapDatabaseUserToUser(data)

            logger.info('User subscription status updated successfully', {
                userId: updatedUser.id,
                email: updatedUser.email,
                subscriptionStatus: updatedUser.subscriptionStatus
            })

            return updatedUser

        } catch (error) {
            if (error instanceof ValidationError || error instanceof DatabaseError) {
                throw error
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Unexpected error updating subscription status', { userId, error: errorMessage })
            throw new DatabaseError(`Failed to update subscription status: ${errorMessage}`, 'update_subscription')
        }
    }

    // Map database row to User type
    private mapDatabaseUserToUser(dbUser: any): User {
        return {
            id: dbUser.id,
            email: dbUser.email,
            createdAt: new Date(dbUser.created_at),
            updatedAt: new Date(dbUser.updated_at),
            subscriptionStatus: dbUser.subscription_status,
            premiumExpiresAt: dbUser.premium_expires_at ? new Date(dbUser.premium_expires_at) : undefined,
            voicePackExpiresAt: dbUser.voice_pack_expires_at ? new Date(dbUser.voice_pack_expires_at) : undefined,
            wisdomPoints: dbUser.wisdom_points,
            streakCount: dbUser.streak_count,
            lastActivityDate: dbUser.last_activity_date ? new Date(dbUser.last_activity_date) : undefined,
            preferredCategories: dbUser.preferred_categories || [],
            notificationTime: dbUser.notification_time,
            voicePreference: dbUser.voice_preference,
            timezone: dbUser.timezone
        }
    }
}

// Export singleton instance
export const userService = new UserService()