// Authentication utilities for AuraFlow
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { createLogger } from './logging'
import { AuthenticationError } from './errors'
import type { User, SubscriptionTier } from './types'

const logger = createLogger('auth')

// JWT payload interface
export interface JWTPayload {
    userId: string
    email: string
    subscriptionStatus: SubscriptionTier
    iat: number
    exp: number
    type: 'access' | 'refresh'
}

// Authentication configuration
export interface AuthConfig {
    jwtSecret: string
    jwtRefreshSecret: string
    accessTokenExpiresIn: string // e.g., '15m'
    refreshTokenExpiresIn: string // e.g., '7d'
    bcryptRounds: number
}

// Token pair interface
export interface TokenPair {
    accessToken: string
    refreshToken: string
    expiresIn: number
}

// User session interface
export interface UserSession {
    userId: string
    email: string
    subscriptionStatus: SubscriptionTier
    accessToken: string
    refreshToken: string
    expiresAt: Date
}

// JWT service using real jsonwebtoken library
class JWTService {
    private config: AuthConfig
    private activeSessions: Map<string, UserSession> = new Map()
    private refreshTokens: Map<string, string> = new Map() // refreshToken -> userId

    constructor(config: AuthConfig) {
        this.config = config
    }

    // Generate access token
    generateAccessToken(user: Pick<User, 'id' | 'email' | 'subscriptionStatus'>): string {
        const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
            userId: user.id,
            email: user.email,
            subscriptionStatus: user.subscriptionStatus,
            type: 'access'
        }

        const token = jwt.sign(payload, this.config.jwtSecret, {
            expiresIn: this.config.accessTokenExpiresIn,
            issuer: 'auraflow',
            audience: 'auraflow-users',
            jwtid: this.generateJwtId() // Add unique JWT ID
        })

        logger.debug('Generated access token', {
            userId: user.id,
            email: user.email,
            expiresIn: this.config.accessTokenExpiresIn
        })

        return token
    }

    // Generate refresh token
    generateRefreshToken(user: Pick<User, 'id' | 'email' | 'subscriptionStatus'>): string {
        const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
            userId: user.id,
            email: user.email,
            subscriptionStatus: user.subscriptionStatus,
            type: 'refresh'
        }

        const token = jwt.sign(payload, this.config.jwtRefreshSecret, {
            expiresIn: this.config.refreshTokenExpiresIn,
            issuer: 'auraflow',
            audience: 'auraflow-users',
            jwtid: this.generateJwtId() // Add unique JWT ID
        })

        // Store refresh token mapping
        this.refreshTokens.set(token, user.id)

        logger.debug('Generated refresh token', {
            userId: user.id,
            email: user.email,
            expiresIn: this.config.refreshTokenExpiresIn
        })

        return token
    }

    // Generate token pair
    generateTokenPair(user: Pick<User, 'id' | 'email' | 'subscriptionStatus'>): TokenPair {
        const accessToken = this.generateAccessToken(user)
        const refreshToken = this.generateRefreshToken(user)
        const expiresIn = this.parseExpiresIn(this.config.accessTokenExpiresIn)

        // Store session
        const session: UserSession = {
            userId: user.id,
            email: user.email,
            subscriptionStatus: user.subscriptionStatus,
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000)
        }

        this.activeSessions.set(user.id, session)

        logger.info('Generated token pair', {
            userId: user.id,
            email: user.email,
            accessTokenExpiresIn: this.config.accessTokenExpiresIn,
            refreshTokenExpiresIn: this.config.refreshTokenExpiresIn
        })

        return {
            accessToken,
            refreshToken,
            expiresIn
        }
    }

    // Verify and decode token
    verifyToken(token: string, type: 'access' | 'refresh' = 'access'): JWTPayload {
        try {
            const secret = type === 'access' ? this.config.jwtSecret : this.config.jwtRefreshSecret

            const payload = jwt.verify(token, secret, {
                issuer: 'auraflow',
                audience: 'auraflow-users'
            }) as JWTPayload

            // Check token type
            if (payload.type !== type) {
                throw new AuthenticationError('Invalid token type')
            }

            logger.debug('Token verified successfully', {
                userId: payload.userId,
                type: payload.type,
                expiresAt: new Date(payload.exp * 1000)
            })

            return payload
        } catch (error) {
            logger.warn('Token verification failed', { token: token.substring(0, 20) + '...' })

            if (error instanceof jwt.JsonWebTokenError) {
                throw new AuthenticationError('Invalid token')
            } else if (error instanceof jwt.TokenExpiredError) {
                throw new AuthenticationError('Token expired')
            } else if (error instanceof jwt.NotBeforeError) {
                throw new AuthenticationError('Token not active')
            } else {
                throw new AuthenticationError('Token verification failed')
            }
        }
    }

    // Refresh access token using refresh token
    refreshAccessToken(refreshToken: string): TokenPair {
        try {
            // Verify refresh token
            const payload = this.verifyToken(refreshToken, 'refresh')

            // Check if refresh token is still valid in our store
            const storedUserId = this.refreshTokens.get(refreshToken)
            if (!storedUserId || storedUserId !== payload.userId) {
                throw new AuthenticationError('Refresh token not found or invalid')
            }

            // Revoke old refresh token immediately (refresh token rotation)
            this.refreshTokens.delete(refreshToken)

            // Generate new token pair
            const user = {
                id: payload.userId,
                email: payload.email,
                subscriptionStatus: payload.subscriptionStatus
            }

            const newTokenPair = this.generateTokenPair(user)

            logger.info('Access token refreshed', {
                userId: payload.userId,
                email: payload.email
            })

            return newTokenPair
        } catch (error) {
            logger.warn('Token refresh failed')
            throw new AuthenticationError('Failed to refresh token')
        }
    }

    // Revoke token (logout)
    revokeToken(token: string): void {
        try {
            const payload = this.verifyToken(token, 'access')

            // Remove session
            this.activeSessions.delete(payload.userId)

            // Remove any refresh tokens for this user
            for (const [refreshToken, userId] of this.refreshTokens.entries()) {
                if (userId === payload.userId) {
                    this.refreshTokens.delete(refreshToken)
                }
            }

            logger.info('Token revoked', {
                userId: payload.userId,
                email: payload.email
            })
        } catch (error) {
            // Token might already be invalid, which is fine for logout
            logger.debug('Token revocation attempted on invalid token')
        }
    }

    // Get active session
    getSession(userId: string): UserSession | null {
        return this.activeSessions.get(userId) || null
    }

    // Parse expires in string to seconds
    private parseExpiresIn(expiresIn: string): number {
        const match = expiresIn.match(/^(\d+)([smhd])$/)
        if (!match) {
            throw new Error(`Invalid expiresIn format: ${expiresIn}`)
        }

        const value = parseInt(match[1])
        const unit = match[2]

        switch (unit) {
            case 's': return value
            case 'm': return value * 60
            case 'h': return value * 60 * 60
            case 'd': return value * 60 * 60 * 24
            default: throw new Error(`Invalid time unit: ${unit}`)
        }
    }

    // Generate unique JWT ID
    private generateJwtId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }
}

// Password hashing utilities using bcrypt
class PasswordService {
    private rounds: number

    constructor(rounds: number = 12) {
        this.rounds = rounds
    }

    // Hash password
    async hashPassword(password: string): Promise<string> {
        try {
            const hash = await bcrypt.hash(password, this.rounds)

            logger.debug('Password hashed', { rounds: this.rounds })

            return hash
        } catch (error) {
            logger.error('Password hashing failed')
            throw new Error('Failed to hash password')
        }
    }

    // Verify password
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        try {
            const isValid = await bcrypt.compare(password, hash)

            logger.debug('Password verification', {
                isValid
            })

            return isValid
        } catch (error) {
            logger.warn('Password verification failed')
            return false
        }
    }
}

// Authentication service class
export class AuthService {
    private jwtService: JWTService
    private passwordService: PasswordService
    private config: AuthConfig

    constructor(config?: Partial<AuthConfig>) {
        this.config = {
            jwtSecret: config?.jwtSecret || process.env.JWT_SECRET || 'dev-secret-key',
            jwtRefreshSecret: config?.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
            accessTokenExpiresIn: config?.accessTokenExpiresIn || '15m',
            refreshTokenExpiresIn: config?.refreshTokenExpiresIn || '7d',
            bcryptRounds: config?.bcryptRounds || 12
        }

        this.jwtService = new JWTService(this.config)
        this.passwordService = new PasswordService(this.config.bcryptRounds)

        logger.info('AuthService initialized', {
            accessTokenExpiresIn: this.config.accessTokenExpiresIn,
            refreshTokenExpiresIn: this.config.refreshTokenExpiresIn,
            bcryptRounds: this.config.bcryptRounds
        })
    }

    // Hash password
    async hashPassword(password: string): Promise<string> {
        return await this.passwordService.hashPassword(password)
    }

    // Verify password
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return await this.passwordService.verifyPassword(password, hash)
    }

    // Generate authentication tokens
    generateTokens(user: Pick<User, 'id' | 'email' | 'subscriptionStatus'>): TokenPair {
        return this.jwtService.generateTokenPair(user)
    }

    // Verify access token
    verifyAccessToken(token: string): JWTPayload {
        return this.jwtService.verifyToken(token, 'access')
    }

    // Refresh access token
    refreshToken(refreshToken: string): TokenPair {
        return this.jwtService.refreshAccessToken(refreshToken)
    }

    // Revoke tokens (logout)
    revokeTokens(accessToken: string): void {
        this.jwtService.revokeToken(accessToken)
    }

    // Get user session
    getSession(userId: string): UserSession | null {
        return this.jwtService.getSession(userId)
    }

    // Extract user ID from token
    getUserIdFromToken(token: string): string {
        const payload = this.verifyAccessToken(token)
        return payload.userId
    }

    // Check if user has required subscription
    checkSubscription(token: string, requiredTier: SubscriptionTier): boolean {
        try {
            const payload = this.verifyAccessToken(token)

            // Define subscription hierarchy
            const tierHierarchy: Record<SubscriptionTier, number> = {
                free: 0,
                premium_core: 1,
                voice_pack: 2
            }

            const userTier = tierHierarchy[payload.subscriptionStatus]
            const requiredTierLevel = tierHierarchy[requiredTier]

            return userTier >= requiredTierLevel
        } catch (error) {
            return false
        }
    }
}

// Default auth service instance
export const authService = new AuthService()

// Utility functions
export function extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Invalid authorization header')
    }
    return authHeader.substring(7)
}

export function createAuthMiddleware(authService: AuthService) {
    return (req: any, res: any, next: any) => {
        try {
            const authHeader = req.headers.authorization
            const token = extractTokenFromHeader(authHeader)
            const payload = authService.verifyAccessToken(token)

            // Add user info to request
            req.user = {
                userId: payload.userId,
                email: payload.email,
                subscriptionStatus: payload.subscriptionStatus
            }

            return next()
        } catch (error) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: (error as Error).message
            })
        }
    }
}

// Get auth configuration from environment
export function getAuthConfig(): AuthConfig {
    return {
        jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
        accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
    }
}