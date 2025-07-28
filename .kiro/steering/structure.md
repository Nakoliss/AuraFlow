# AuraFlow Project Structure & Conventions

## Monorepo Organization
The project follows a Turbo monorepo structure with clear separation of concerns:

### Applications (`apps/`)
- `apps/mobile/` - Expo React Native mobile app
- `apps/web/` - Astro-based PWA with islands architecture

### Workers (`workers/`)
- `workers/api/` - Cloudflare Worker API routes and edge functions
- `workers/cron/` - Scheduled background jobs (Daily Drop generation, cleanup)

### Packages (`packages/`)
- `packages/common/` - Shared utilities, types, and business logic
- `packages/ui/` - Reusable UI component library (Claymorphism design system)

### Infrastructure (`infra/`)
- `infra/terraform/` - Infrastructure as Code definitions

## Design System
**Claymorphism** design language with:
- Clay-like soft shadows and rounded corners
- Component prefix: `Clay*` (ClayCard, ClayButton, ClayBadge)
- 16px border radius standard
- Hover lift effects on interactive elements

## API Structure
RESTful API with consistent patterns:
- `/generate` - On-demand message generation
- `/daily-drop` - Broadcast message retrieval
- `/daily-challenge` - Challenge content
- `/tts` - Text-to-speech conversion
- `/share-card` - Visual quote card generation
- `/auth/*` - Authentication endpoints

## Database Conventions
- PostgreSQL with pgvector extension for embeddings
- Semantic similarity checks using cosine distance (<0.20 threshold)
- 90-day deduplication window for content
- Indexed embedding vectors for performance

## Content Categories
Five distinct message categories:
1. Motivational
2. Mindfulness  
3. Fitness
4. Philosophy
5. Productivity

## File Naming
- TypeScript throughout
- Component files: PascalCase
- Utility files: camelCase
- API routes: kebab-case
- Database migrations: timestamp prefixed

## Testing Structure
- Unit tests: Vitest
- Integration: SuperTest
- E2E Web: Playwright
- E2E Mobile: Detox
- CI includes cost regression testing