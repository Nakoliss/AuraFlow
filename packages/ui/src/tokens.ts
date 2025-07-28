// Design tokens for Claymorphism design system
export const ClayTokens = {
    borderRadius: {
        standard: 16,
        large: 24,
        small: 8
    },
    shadows: {
        clay: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)',
        hover: '0 12px 48px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)',
        pressed: '0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)'
    },
    colors: {
        primary: '#6366F1',
        secondary: '#8B5CF6',
        surface: '#F8FAFC',
        surfaceElevated: '#FFFFFF',
        text: '#1E293B',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        border: '#E2E8F0',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444'
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48
    },
    typography: {
        fontFamily: {
            primary: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            mono: 'JetBrains Mono, Consolas, monospace'
        },
        fontSize: {
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
            '2xl': 24,
            '3xl': 30,
            '4xl': 36
        },
        fontWeight: {
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700
        },
        lineHeight: {
            tight: 1.25,
            normal: 1.5,
            relaxed: 1.75
        }
    },
    breakpoints: {
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280,
        '2xl': 1536
    }
}