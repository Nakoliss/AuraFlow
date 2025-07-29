// AuraFlow API Worker Entry Point
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { MessageCategory } from '@aura-flow/common'
import authRoutes from './routes/auth'
import generateRoutes from './routes/generate'
import dailyDropRoutes from './routes/daily-drop'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
    origin: ['http://localhost:3000', 'http://localhost:4321'], // Add your frontend URLs
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}))

// Health check routes
app.get('/', (c) => {
    return c.json({
        message: 'AuraFlow API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    })
})

app.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime ? process.uptime() : 0
    })
})

// Mount auth routes
app.route('/auth', authRoutes)

// Mount message generation routes
app.route('/generate', generateRoutes)

// Mount daily drop routes
app.route('/daily-drop', dailyDropRoutes)

// 404 handler
app.notFound((c) => {
    return c.json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        path: c.req.path
    }, 404)
})

// Error handler
app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
    }, 500)
})

export default app