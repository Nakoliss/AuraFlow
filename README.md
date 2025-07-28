# AuraFlow

AuraFlow is a freemium mobile and web application that delivers AI-generated motivational content to help users build positive daily habits.

## Architecture

This project uses a Turbo monorepo structure with TypeScript throughout:

```
repo-root/
├── apps/
│   ├── mobile/          # Expo React Native application
│   └── web/             # Astro islands PWA
├── workers/
│   ├── api/             # Cloudflare Worker API routes
│   └── cron/            # Scheduled background jobs
├── packages/
│   ├── common/          # Shared utilities and types
│   └── ui/              # Claymorphism component library
└── infra/
    └── terraform/       # Infrastructure as Code
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

### Development Scripts

- `pnpm dev` - Start all development servers concurrently
- `pnpm build` - Build all packages and applications
- `pnpm test` - Run tests across all packages
- `pnpm lint` - Lint all packages
- `pnpm type-check` - Type check all packages
- `pnpm format` - Format code with Prettier

## Tech Stack

- **Mobile**: Expo React Native
- **Web**: Astro islands architecture (PWA)
- **API**: Cloudflare Workers with edge functions
- **Database**: Supabase (PostgreSQL with pgvector)
- **Payments**: RevenueCat (mobile) + Stripe (web)
- **AI/LLM**: OpenAI + Anthropic
- **TTS**: ElevenLabs
- **Storage**: S3 + CloudFront CDN
- **Infrastructure**: Terraform

## Design System

AuraFlow uses a **Claymorphism** design language with:
- Clay-like soft shadows and rounded corners
- Component prefix: `Clay*` (ClayCard, ClayButton, ClayBadge)
- 16px border radius standard
- Hover lift effects on interactive elements

## Business Model

- **Free Tier**: 1 message/24h, motivational/philosophical categories only
- **Premium Core** ($4.99/mo): 20 daily messages, all categories, no ads
- **Voice Pack** (+$0.99/mo): Text-to-speech with 5 voice options

## Performance Requirements

- <150ms perceived latency for message generation
- Semantic deduplication within 90-day windows
- Predictive pre-loading for next messages
- Cost regression CI checks (fail if tokens/msg increases >10%)