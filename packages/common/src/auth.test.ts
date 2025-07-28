import { describe, it, expect, beforeEach } from 'vitest'
import {
    AuthService,
    extractTokenFromHeader,
    createAuthMiddleware,
    getAuthConfig,
    type TokenPair,
    type JWTPayload
} from './auth'
import { AuthenticationError } from './errors'
import type { User } from './types'

describe('auth', () => {
    let authService: AuthService
    let mockUser: Pick<User, 'id' | 'email' | 'subscriptionStatus'>

    beforeEach(() => {
        authService = new AuthService({
            jwtSecret: 'test-secret',
            jwtRefreshSecret: 'test-refresh-secret',
            accessTokenExpiresIn: '15m',
            refreshTokenExpiresIn: '7d',
            bcryptRounds: 4 // Lower for faster tests
        })

        mockUser = {
            id: 'user-123',
            email: 'test@example.com',
            subscriptionStatus: 'premium_core'
        }
    })

    describe('AuthService', () => {
        describe('password hashing', () => {
            it('should hash passwords', async () => {
                const password = 'testPassword123!'
                const hash = await authService.hashPassword(password)

                expect(hash).toBeDefined()
                expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/)
                expect(hash).not.toBe(password)
                expect(hash.length).toBeGreaterThan(50) // bcrypt hashes are typically 60 chars
            })

            it('should verify correct passwords', async () => {
                const password = 'testPassword123!'
                const hash = await authService.hashPassword(password)

                const isValid = await authService.verifyPassword(password, hash)
                expect(isValid).toBe(true)
            })

            it('should reject incorrect passwords', async () => {
                const password = 'testPassword123!'
                const wrongPassword = 'wrongPassword123!'
                const hash = await authService.hashPassword(password)

                const isValid = await authService.verifyPassword(wrongPassword, hash)
                expect(isValid).toBe(false)
            })

            it('should reject invalid hash formats', async () => {
                const password = 'testPassword123!'
                const invalidHash = 'invalid-hash'

                const isValid = await authService.verifyPassword(password, invalidHash)
                expect(isValid).toBe(false)
            })
        })

        describe('token generation', () => {
            it('should generate token pair', () => {
                const tokens = authService.generateTokens(mockUser)

                expect(tokens).toMatchObject({
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String),
                    expiresIn: expect.any(Number)
                })
                expect(tokens.expiresIn).toBe(15 * 60) // 15 minutes in seconds
                expect(tokens.accessToken).not.toBe(tokens.refreshToken)
            })

            it('should generate different tokens for different users', () => {
                const user1 = { ...mockUser, id: 'user-1' }
                const user2 = { ...mockUser, id: 'user-2' }

                const tokens1 = authService.generateTokens(user1)
                const tokens2 = authService.generateTokens(user2)

                expect(tokens1.accessToken).not.toBe(tokens2.accessToken)
                expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken)
            })
        })

        describe('token verification', () => {
            it('should verify valid access tokens', () => {
                const tokens = authService.generateTokens(mockUser)
                const payload = authService.verifyAccessToken(tokens.accessToken)

                expect(payload).toMatchObject({
                    userId: mockUser.id,
                    email: mockUser.email,
                    subscriptionStatus: mockUser.subscriptionStatus,
                    type: 'access'
                })
                expect(payload.iat).toBeTypeOf('number')
                expect(payload.exp).toBeTypeOf('number')
                expect(payload.exp).toBeGreaterThan(payload.iat)
            })

            it('should reject invalid tokens', () => {
                expect(() => {
                    authService.verifyAccessToken('invalid-token')
                }).toThrow(AuthenticationError)
            })

            it('should reject expired tokens', async () => {
                // Create service with very short expiration
                const shortAuthService = new AuthService({
                    accessTokenExpiresIn: '1s' // 1 second expiration
                })

                const tokens = shortAuthService.generateTokens(mockUser)

                // Wait for token to expire
                await new Promise(resolve => setTimeout(resolve, 1100))

                expect(() => {
                    shortAuthService.verifyAccessToken(tokens.accessToken)
                }).toThrow(AuthenticationError)
            })

            it('should reject wrong token type', () => {
                const tokens = authService.generateTokens(mockUser)

                expect(() => {
                    authService.verifyAccessToken(tokens.refreshToken)
                }).toThrow(AuthenticationError)
            })
        })

        describe('token refresh', () => {
            it('should refresh access token with valid refresh token', () => {
                const originalTokens = authService.generateTokens(mockUser)
                const newTokens = authService.refreshToken(originalTokens.refreshToken)

                expect(newTokens).toMatchObject({
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String),
                    expiresIn: expect.any(Number)
                })

                // New tokens should be different
                expect(newTokens.accessToken).not.toBe(originalTokens.accessToken)
                expect(newTokens.refreshToken).not.toBe(originalTokens.refreshToken)

                // New access token should be valid
                const payload = authService.verifyAccessToken(newTokens.accessToken)
                expect(payload.userId).toBe(mockUser.id)
            })

            it('should reject invalid refresh tokens', () => {
                expect(() => {
                    authService.refreshToken('invalid-refresh-token')
                }).toThrow(AuthenticationError)
            })

            it('should reject used refresh tokens (rotation)', () => {
                const originalTokens = authService.generateTokens(mockUser)

                // Use refresh token once
                authService.refreshToken(originalTokens.refreshToken)

                // Try to use it again
                expect(() => {
                    authService.refreshToken(originalTokens.refreshToken)
                }).toThrow(AuthenticationError)
            })
        })

        describe('token revocation', () => {
            it('should revoke tokens on logout', () => {
                const tokens = authService.generateTokens(mockUser)

                // Verify token works
                expect(() => {
                    authService.verifyAccessToken(tokens.accessToken)
                }).not.toThrow()

                // Revoke tokens
                authService.revokeTokens(tokens.accessToken)

                // Session should be removed
                const session = authService.getSession(mockUser.id)
                expect(session).toBeNull()
            })

            it('should handle revoking invalid tokens gracefully', () => {
                expect(() => {
                    authService.revokeTokens('invalid-token')
                }).not.toThrow()
            })
        })

        describe('session management', () => {
            it('should create and retrieve sessions', () => {
                const tokens = authService.generateTokens(mockUser)
                const session = authService.getSession(mockUser.id)

                expect(session).toMatchObject({
                    userId: mockUser.id,
                    email: mockUser.email,
                    subscriptionStatus: mockUser.subscriptionStatus,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresAt: expect.any(Date)
                })
            })

            it('should return null for non-existent sessions', () => {
                const session = authService.getSession('non-existent-user')
                expect(session).toBeNull()
            })
        })

        describe('subscription checking', () => {
            it('should allow access for matching subscription tier', () => {
                const tokens = authService.generateTokens(mockUser)
                const hasAccess = authService.checkSubscription(tokens.accessToken, 'premium_core')

                expect(hasAccess).toBe(true)
            })

            it('should allow access for higher subscription tier', () => {
                const voiceUser = { ...mockUser, subscriptionStatus: 'voice_pack' as const }
                const tokens = authService.generateTokens(voiceUser)
                const hasAccess = authService.checkSubscription(tokens.accessToken, 'premium_core')

                expect(hasAccess).toBe(true)
            })

            it('should deny access for lower subscription tier', () => {
                const freeUser = { ...mockUser, subscriptionStatus: 'free' as const }
                const tokens = authService.generateTokens(freeUser)
                const hasAccess = authService.checkSubscription(tokens.accessToken, 'premium_core')

                expect(hasAccess).toBe(false)
            })

            it('should deny access for invalid tokens', () => {
                const hasAccess = authService.checkSubscription('invalid-token', 'free')
                expect(hasAccess).toBe(false)
            })
        })

        describe('getUserIdFromToken', () => {
            it('should extract user ID from valid token', () => {
                const tokens = authService.generateTokens(mockUser)
                const userId = authService.getUserIdFromToken(tokens.accessToken)

                expect(userId).toBe(mockUser.id)
            })

            it('should throw for invalid token', () => {
                expect(() => {
                    authService.getUserIdFromToken('invalid-token')
                }).toThrow(AuthenticationError)
            })
        })
    })

    describe('utility functions', () => {
        describe('extractTokenFromHeader', () => {
            it('should extract token from Bearer header', () => {
                const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0In0.test'
                const header = `Bearer ${token}`

                const extracted = extractTokenFromHeader(header)
                expect(extracted).toBe(token)
            })

            it('should throw for missing header', () => {
                expect(() => {
                    extractTokenFromHeader('')
                }).toThrow(AuthenticationError)
            })

            it('should throw for invalid header format', () => {
                expect(() => {
                    extractTokenFromHeader('Invalid token123')
                }).toThrow(AuthenticationError)
            })
        })

        describe('createAuthMiddleware', () => {
            it('should create middleware that validates tokens', () => {
                const middleware = createAuthMiddleware(authService)
                const tokens = authService.generateTokens(mockUser)

                const req = {
                    headers: {
                        authorization: `Bearer ${tokens.accessToken}`
                    }
                }
                const res = {
                    status: (code: number) => ({
                        json: (data: any) => ({ statusCode: code, data })
                    })
                }
                const next = () => 'next-called'

                const result = middleware(req, res, next)

                expect(req.user).toMatchObject({
                    userId: mockUser.id,
                    email: mockUser.email,
                    subscriptionStatus: mockUser.subscriptionStatus
                })
                expect(result).toBe('next-called')
            })

            it('should return 401 for invalid tokens', () => {
                const middleware = createAuthMiddleware(authService)

                const req = {
                    headers: {
                        authorization: 'Bearer invalid-token'
                    }
                }
                let responseData: any
                const res = {
                    status: (code: number) => ({
                        json: (data: any) => {
                            responseData = { statusCode: code, ...data }
                            return responseData
                        }
                    })
                }
                const next = () => 'next-called'

                middleware(req, res, next)

                expect(responseData.statusCode).toBe(401)
                expect(responseData.error).toBe('Unauthorized')
            })
        })

        describe('getAuthConfig', () => {
            it('should return default configuration', () => {
                const config = getAuthConfig()

                expect(config).toMatchObject({
                    jwtSecret: expect.any(String),
                    jwtRefreshSecret: expect.any(String),
                    accessTokenExpiresIn: expect.any(String),
                    refreshTokenExpiresIn: expect.any(String),
                    bcryptRounds: expect.any(Number)
                })
            })

            it('should use environment variables when available', () => {
                const originalEnv = process.env

                process.env = {
                    ...originalEnv,
                    JWT_SECRET: 'custom-secret',
                    JWT_REFRESH_SECRET: 'custom-refresh-secret',
                    JWT_ACCESS_EXPIRES_IN: '30m',
                    JWT_REFRESH_EXPIRES_IN: '14d',
                    BCRYPT_ROUNDS: '10'
                }

                const config = getAuthConfig()

                expect(config).toMatchObject({
                    jwtSecret: 'custom-secret',
                    jwtRefreshSecret: 'custom-refresh-secret',
                    accessTokenExpiresIn: '30m',
                    refreshTokenExpiresIn: '14d',
                    bcryptRounds: 10
                })

                process.env = originalEnv
            })
        })
    })
})