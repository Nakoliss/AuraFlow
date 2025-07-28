# AuraFlow Technical Stack

## Architecture
Turbo monorepo with TypeScript across all packages and applications.

## Tech Stack
- **Mobile**: Expo React Native
- **Web**: Astro islands architecture (PWA)
- **API**: Cloudflare Workers with edge functions
- **Database**: Supabase (PostgreSQL with pgvector for embeddings)
- **Payments**: RevenueCat (mobile IAP) + Stripe (web)
- **AI/LLM**: OpenAI + Anthropic with semantic caching
- **TTS**: ElevenLabs for voice generation
- **Storage**: S3 for assets, CloudFront CDN
- **Infrastructure**: Terraform for IaC

## Project Structure
```
repo-root/
  apps/mobile/      # Expo RN
  apps/web/         # Astro islands
  workers/api/      # CF Worker routes
  workers/cron/     # Scheduled jobs
  packages/common/  # Shared utilities
  packages/ui/      # Component library
  infra/terraform/  # Infrastructure code
```

## Key Dependencies
- Turbo for monorepo management
- Vitest for unit testing
- Playwright (web E2E) + Detox (mobile E2E)
- pgvector for semantic similarity
- RevenueCat SDK for subscription management

## Common Commands
- `pnpm install` - Install dependencies
- `pnpm build` - Build all packages
- `pnpm test` - Run test suite
- `pnpm dev` - Start development servers
- `pnpm ts-node scripts/seed.ts` - Seed database with demo data

## Environment Variables
Key variables include: OPENAI_API_KEY, ANTHROPIC_API_KEY, SUPABASE_URL, ELEVENLABS_TTS_KEY, STRIPE_SECRET_KEY, REVENUCAT_API_KEY

## Performance Requirements
- <150ms perceived latency for message generation
- Semantic deduplication within 90-day windows
- Predictive pre-loading for next messages
- Cost regression CI checks (fail if tokens/msg increases >10%)