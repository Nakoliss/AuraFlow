// Integration tests for authentication routes
import { describe, it, expect, beforeEach } from 'vitest'
import app from '../index'

describe('Authentication Routes', () => {
    // Helper function to make requests to the app
    const makeRequest = async (path: string, options: RequestInit = {}) => {
        const request = new Request(`http://localhost${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        })
        return await app.fetch(request)
    }

    // Generate unique email for each test to avoid conflicts
    const generateUniqueEmail = (prefix: string) => {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@example.com`
    }

    describe('POST /auth/register', () => {
        it('should register a new user successfully', async () => {
            const response = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'password123'
                })
            })

            expect(response.status).toBe(201)

            const data = await response.json()
            expect(data).toMatchObject({
                user: {
                    id: expect.any(String),
                    email: 'test@example.com',
                    subscriptionStatus: 'free'
                },
                tokens: {
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String),
                    expiresIn: expect.any(Number)
                }
            })
        })

        it('should reject registration with invalid email', async () => {
            const response = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'invalid-email',
                    password: 'password123'
                })
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                message: 'Invalid email format'
            })
        })

        it('should reject registration with weak password', async () => {
            const response = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'weak'
                })
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                message: expect.stringContaining('Password must be at least 8 characters')
            })
        })

        it('should reject registration with missing fields', async () => {
            const response = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com'
                    // missing password
                })
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                message: 'Email and password are required'
            })
        })

        it('should reject duplicate email registration', async () => {
            // First registration
            await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'duplicate@example.com',
                    password: 'password123'
                })
            })

            // Second registration with same email
            const response = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'duplicate@example.com',
                    password: 'password456'
                })
            })

            expect(response.status).toBe(409)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                message: 'User with this email already exists'
            })
        })
    })

    describe('POST /auth/login', () => {
        let testEmail: string

        beforeEach(async () => {
            // Generate unique email for this test
            testEmail = generateUniqueEmail('login-test')

            // Register a test user before each login test
            await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: testEmail,
                    password: 'password123'
                })
            })
        })

        it('should login successfully with valid credentials', async () => {
            const response = await makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: testEmail,
                    password: 'password123'
                })
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toMatchObject({
                user: {
                    id: expect.any(String),
                    email: testEmail,
                    subscriptionStatus: 'free'
                },
                tokens: {
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String),
                    expiresIn: expect.any(Number)
                }
            })
        })

        it('should reject login with invalid email', async () => {
            const response = await makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                })
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: 'Invalid email or password'
            })
        })

        it('should reject login with invalid password', async () => {
            const response = await makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: testEmail,
                    password: 'wrongpassword'
                })
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: 'Invalid email or password'
            })
        })

        it('should reject login with missing fields', async () => {
            const response = await makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: testEmail
                    // missing password
                })
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                message: 'Email and password are required'
            })
        })
    })

    describe('POST /auth/refresh', () => {
        let refreshToken: string

        beforeEach(async () => {
            // Register and login to get a refresh token
            const testEmail = generateUniqueEmail('refresh-test')
            const registerResponse = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: testEmail,
                    password: 'password123'
                })
            })

            const registerData = await registerResponse.json() as any
            refreshToken = registerData.tokens.refreshToken
        })

        it('should refresh tokens successfully with valid refresh token', async () => {
            const response = await makeRequest('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({
                    refreshToken
                })
            })

            expect(response.status).toBe(200)

            const data = await response.json() as any
            expect(data).toMatchObject({
                tokens: {
                    accessToken: expect.any(String),
                    refreshToken: expect.any(String),
                    expiresIn: expect.any(Number)
                }
            })

            // New tokens should be different from original
            expect(data.tokens.refreshToken).not.toBe(refreshToken)
        })

        it('should reject refresh with invalid token', async () => {
            const response = await makeRequest('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({
                    refreshToken: 'invalid-token'
                })
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: expect.any(String)
            })
        })

        it('should reject refresh with missing token', async () => {
            const response = await makeRequest('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Validation Error',
                message: 'Refresh token is required'
            })
        })

        it('should reject used refresh token (rotation)', async () => {
            // Use refresh token once
            await makeRequest('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({
                    refreshToken
                })
            })

            // Try to use the same refresh token again
            const response = await makeRequest('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({
                    refreshToken
                })
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: expect.any(String)
            })
        })
    })

    describe('GET /auth/me', () => {
        let accessToken: string
        let testEmail: string

        beforeEach(async () => {
            // Register and login to get an access token
            testEmail = generateUniqueEmail('me-test')
            const registerResponse = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: testEmail,
                    password: 'password123'
                })
            })

            const registerData = await registerResponse.json() as any
            accessToken = registerData.tokens.accessToken
        })

        it('should return user info with valid token', async () => {
            const response = await makeRequest('/auth/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toMatchObject({
                user: {
                    id: expect.any(String),
                    email: testEmail,
                    subscriptionStatus: 'free',
                    createdAt: expect.any(String)
                }
            })
        })

        it('should reject request without authorization header', async () => {
            const response = await makeRequest('/auth/me', {
                method: 'GET'
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: 'Authorization header is required'
            })
        })

        it('should reject request with invalid token', async () => {
            const response = await makeRequest('/auth/me', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer invalid-token'
                }
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: expect.any(String)
            })
        })
    })

    describe('POST /auth/logout', () => {
        let accessToken: string

        beforeEach(async () => {
            // Register and login to get an access token
            const testEmail = generateUniqueEmail('logout-test')
            const registerResponse = await makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: testEmail,
                    password: 'password123'
                })
            })

            const registerData = await registerResponse.json() as any
            accessToken = registerData.tokens.accessToken
        })

        it('should logout successfully with valid token', async () => {
            const response = await makeRequest('/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            expect(response.status).toBe(200)

            const data = await response.json()
            expect(data).toMatchObject({
                message: 'Logged out successfully'
            })
        })

        it('should reject logout without authorization header', async () => {
            const response = await makeRequest('/auth/logout', {
                method: 'POST'
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: 'Authorization header is required'
            })
        })

        it('should reject logout with invalid token', async () => {
            const response = await makeRequest('/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer invalid-token'
                }
            })

            expect(response.status).toBe(401)

            const data = await response.json()
            expect(data).toMatchObject({
                error: 'Authentication Error',
                message: expect.any(String)
            })
        })
    })
})