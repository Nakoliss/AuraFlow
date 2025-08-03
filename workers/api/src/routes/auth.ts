// Authentication routes for AuraFlow API
import { Hono } from 'hono'
import {
    AuthService,
    authService,
    extractTokenFromHeader,
    type TokenPair,
    UserService,
    userService,
    initializeDatabase
} from '@aura-flow/common'
import {
    AuthenticationError,
    ValidationError,
    createLogger
} from '@aura-flow/common'

const logger = createLogger('auth-routes')
const auth = new Hono()

// Request/Response interfaces
interface LoginRequest {
    email: string
    password: string
}

interface RegisterRequest {
    email: string
    password: string
    confirmPassword?: string
}

interface RefreshRequest {
    refreshToken: string
}

interface AuthResponse {
    user: {
        id: string
        email: string
        subscriptionStatus: string
    }
    tokens: TokenPair
}

interface ErrorResponse {
    error: string
    message: string
    code?: string
}

// Initialize database connection
let dbInitialized = false
async function ensureDbInitialized() {
    if (!dbInitialized) {
        await initializeDatabase()
        dbInitialized = true
        logger.info('Database initialized for auth routes')
    }
}

// Helper function to validate email format
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

// Helper function to validate password strength
function isValidPassword(password: string): boolean {
    // At least 8 characters, contains letter and number
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

// POST /auth/login - User login
auth.post('/login', async (c) => {
    try {
        await ensureDbInitialized()
        
        const body = await c.req.json() as LoginRequest

        // Validate request body
        if (!body.email || !body.password) {
            logger.warn('Login attempt with missing credentials', { email: body.email })
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: 'Email and password are required'
            }, 400)
        }

        if (!isValidEmail(body.email)) {
            logger.warn('Login attempt with invalid email format', { email: body.email })
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: 'Invalid email format'
            }, 400)
        }

        // Find user in database with password hash
        const userWithPassword = await userService.findUserByEmailForAuth(body.email)
        if (!userWithPassword) {
            logger.warn('Login attempt for non-existent user', { email: body.email })
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: 'Invalid email or password'
            }, 401)
        }

        // Verify password
        const isPasswordValid = await authService.verifyPassword(body.password, userWithPassword.passwordHash)
        if (!isPasswordValid) {
            logger.warn('Login attempt with invalid password', {
                email: body.email,
                userId: userWithPassword.id
            })
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: 'Invalid email or password'
            }, 401)
        }

        // Generate tokens
        const tokens = authService.generateTokens({
            id: userWithPassword.id,
            email: userWithPassword.email,
            subscriptionStatus: userWithPassword.subscriptionStatus
        })

        logger.info('User logged in successfully', {
            userId: userWithPassword.id,
            email: userWithPassword.email,
            subscriptionStatus: userWithPassword.subscriptionStatus
        })

        return c.json<AuthResponse>({
            user: {
                id: userWithPassword.id,
                email: userWithPassword.email,
                subscriptionStatus: userWithPassword.subscriptionStatus
            },
            tokens
        })

    } catch (error) {
        logger.error('Login error', {}, error as Error)
        return c.json<ErrorResponse>({
            error: 'Internal Server Error',
            message: 'An error occurred during login'
        }, 500)
    }
})

// POST /auth/register - User registration
auth.post('/register', async (c) => {
    try {
        await ensureDbInitialized()
        
        const body = await c.req.json() as RegisterRequest

        // Validate request body
        if (!body.email || !body.password) {
            logger.warn('Registration attempt with missing credentials')
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: 'Email and password are required'
            }, 400)
        }

        if (!isValidEmail(body.email)) {
            logger.warn('Registration attempt with invalid email format', { email: body.email })
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: 'Invalid email format'
            }, 400)
        }

        if (!isValidPassword(body.password)) {
            logger.warn('Registration attempt with weak password', { email: body.email })
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: 'Password must be at least 8 characters long and contain both letters and numbers'
            }, 400)
        }

        // Check if password confirmation matches (if provided)
        if (body.confirmPassword && body.password !== body.confirmPassword) {
            logger.warn('Registration attempt with password mismatch', { email: body.email })
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: 'Password confirmation does not match'
            }, 400)
        }

        // Hash password
        const passwordHash = await authService.hashPassword(body.password)

        // Create new user in database
        const newUser = await userService.createUser({
            email: body.email,
            passwordHash,
            timezone: 'UTC' // Default timezone, could be extracted from request
        })

        // Generate tokens
        const tokens = authService.generateTokens({
            id: newUser.id,
            email: newUser.email,
            subscriptionStatus: newUser.subscriptionStatus
        })

        logger.info('User registered successfully', {
            userId: newUser.id,
            email: newUser.email,
            subscriptionStatus: newUser.subscriptionStatus
        })

        return c.json<AuthResponse>({
            user: {
                id: newUser.id,
                email: newUser.email,
                subscriptionStatus: newUser.subscriptionStatus
            },
            tokens
        }, 201)

    } catch (error) {
        if (error instanceof ValidationError) {
            logger.warn('Registration validation error', { message: error.message })
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: error.message
            }, 400)
        }

        logger.error('Registration error', {}, error as Error)
        return c.json<ErrorResponse>({
            error: 'Internal Server Error',
            message: 'An error occurred during registration'
        }, 500)
    }
})

// POST /auth/refresh - Refresh access token
auth.post('/refresh', async (c) => {
    try {
        const body = await c.req.json() as RefreshRequest

        // Validate request body
        if (!body.refreshToken) {
            logger.warn('Token refresh attempt without refresh token')
            return c.json<ErrorResponse>({
                error: 'Validation Error',
                message: 'Refresh token is required'
            }, 400)
        }

        // Refresh tokens
        const newTokens = authService.refreshAccessToken(body.refreshToken)

        // Get user info from the new access token
        const payload = authService.verifyAccessToken(newTokens.accessToken)

        logger.info('Tokens refreshed successfully', {
            userId: payload.userId,
            email: payload.email
        })

        return c.json<{ tokens: TokenPair }>({
            tokens: newTokens
        })

    } catch (error) {
        if (error instanceof AuthenticationError) {
            logger.warn('Token refresh failed', { message: error.message })
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: error.message
            }, 401)
        }

        logger.error('Token refresh error', {}, error as Error)
        return c.json<ErrorResponse>({
            error: 'Internal Server Error',
            message: 'An error occurred during token refresh'
        }, 500)
    }
})

// POST /auth/logout - Logout user (revoke tokens)
auth.post('/logout', async (c) => {
    try {
        await ensureDbInitialized()
        
        const authHeader = c.req.header('Authorization')

        if (!authHeader) {
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: 'Authorization header is required'
            }, 401)
        }

        const token = extractTokenFromHeader(authHeader)
        const payload = authService.verifyAccessToken(token)

        // Revoke tokens
        authService.revokeToken(token)

        logger.info('User logged out successfully', {
            userId: payload.userId,
            email: payload.email
        })

        return c.json({ message: 'Logged out successfully' })

    } catch (error) {
        if (error instanceof AuthenticationError) {
            logger.warn('Logout failed', { message: error.message })
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: error.message
            }, 401)
        }

        logger.error('Logout error', {}, error as Error)
        return c.json<ErrorResponse>({
            error: 'Internal Server Error',
            message: 'An error occurred during logout'
        }, 500)
    }
})

// GET /auth/me - Get current user info
auth.get('/me', async (c) => {
    try {
        const authHeader = c.req.header('Authorization')

        if (!authHeader) {
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: 'Authorization header is required'
            }, 401)
        }

        const token = extractTokenFromHeader(authHeader)
        const payload = authService.verifyAccessToken(token)

        // Find user details
        const user = await userService.findUserById(payload.userId)
        if (!user) {
            logger.warn('Token valid but user not found', { userId: payload.userId })
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: 'User not found'
            }, 401)
        }

        return c.json({
            user: {
                id: user.id,
                email: user.email,
                subscriptionStatus: user.subscriptionStatus,
                createdAt: user.createdAt
            }
        })

    } catch (error) {
        if (error instanceof AuthenticationError) {
            logger.warn('Get user info failed', { message: error.message })
            return c.json<ErrorResponse>({
                error: 'Authentication Error',
                message: error.message
            }, 401)
        }

        logger.error('Get user info error', {}, error as Error)
        return c.json<ErrorResponse>({
            error: 'Internal Server Error',
            message: 'An error occurred while fetching user info'
        }, 500)
    }
})

export default auth