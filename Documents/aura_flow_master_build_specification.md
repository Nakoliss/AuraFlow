\| Auto‑Read Voice Pack                     | 10    | +5 % ARPU                         | | Micro‑Meditations                         | 10    | upsell new mindfulness segment  || Premium Visual Quote share‑cards + referral links | 7 | +30 % shares, +7 % new installs |# AuraFlow – Master Build Specification (2025‑07‑28) **v2.1**

> **One‑liner:** *AuraFlow delivers perfectly‑timed bursts of AI‑generated motivation, mindfulness, fitness, philosophy, or productivity insight – helping users build positive daily habits one short message at a time.*

---

## Table of Contents

1. Project Overview & Objectives
2. Business Model (Freemium v2)
3. Technical Architecture
4. Design System (Claymorphism)
5. Screen‑by‑Screen Specifications
6. Core Feature Definitions
7. Message Prompts, Caching & Fallbacks
8. Environment Setup & Dependencies
9. Security & Privacy
10. Performance & Accessibility
11. Growth, Gamification & Social Loops
12. Phased Roadmap & Timeline
13. Success Metrics & KPIs
14. Deliverables Checklist
15. Appendices (Color, Cost, Diagrams)

---

## 1 · Project Overview & Objectives

*UNCHANGED from v2 – see previous version.*

---

## 2 · Business Model (Freemium **v2.1**)

### 2.1 Price Matrix

| Tier / Add‑on                       | Price                  | Daily On‑Demand    | Categories                  | Ads             | Extras                                                              |
| ----------------------------------- | ---------------------- | ------------------ | --------------------------- | --------------- | ------------------------------------------------------------------- |
| **Free**                            | \$0                    | 1 / 24 h           | Motivational, Philosophical | Sponsored quote | Favorites ≤ 10, History ≤ 7 days, **Basic text share only**         |
| **Premium Core**                    | \$4.99 mo / \$39.99 yr | 20 (30 s cooldown) | All 5                       | ❌               | Custom notif time, unlimited history/favorites, Visual Quote styles |
| **Auto‑Read Voice Pack** *(add‑on)* | +\$0.99 mo / \$9.99 yr | —                  | —                           | ❌               | Text‑to‑speech playback for every message, pick from 5 voices       |

> Voice Pack requires Premium Core. Users can trial it free for 7 days.

### 2.2 Payments & Experiments

- Mobile IAP via RevenueCat *entitlements:* `premium_core`, `voice_pack`.
- Web via Stripe Checkout & Billing (Metered price IDs).
- **Dynamic geo pricing** handled by RevenueCat price experiments (Phase 11).

### 2.3 Unit‑Economics Snapshot (500 users example)

- Assume 5 % convert to Premium Core (25 users) and 40 % of them buy Voice Pack (10 users).
- **Monthly revenue:** (25 × \$4.99) + (10 × \$0.99) ≈ **\$144**.
- **Voice Pack cost:** ElevenLabs ≈ \$0.0004 / 1 000 chars → <\$3/mo at current volume.
- Gross margin remains > 45 %.

---

## 3 · Technical Architecture

*UNCHANGED.*

---

## 4 · Design System (Claymorphism)

*UNCHANGED.*

---

## 5 · Screen‑by‑Screen Specifications

*UNCHANGED (note: new tabs or modals referenced in §6 will reuse existing component library).* 

---

## 6 · Core Feature Definitions

### 6.1 Message Generation & Personalisation

Identical to v2 *plus*:

- **Time‑of‑Day Templates:** request pipeline passes `timeOfDay` ("morning" / "evening") param; system prompt selects matching style tokens.
- **Weather Context (Phase 9):** optional `weatherBucket` param (sunny, rain, cold, hot) sourced from cached API; adds flavour sentence.

### 6.2 Daily Drop (Broadcast)

*UNCHANGED.*

### 6.3 Daily Challenge (Phase 7)

- Generated alongside Daily Drop (`/daily‑challenge` table).
- Client shows “Complete challenge” CTA → awards +5 **Wisdom Points**.

### 6.4 Wisdom Points & Achievements (Phase 8)

- `users.points int` and `achievements` join table.
- Triggers: open app +1, complete challenge +5, share card +3.
- Badges rendered via `ClayBadge`.

### 6.5 Visual Quote Share‑Cards (Phase 7 – **Premium‑only**)

- **Premium users only:** Server generates 1080×1350 PNG (gradient bg + AI quote text + watermark).
- Free tier can still share a **plain text card** (HTML/CSS) with watermark—no image generation cost.
- Assets cached in S3; native share sheet provides link attribution.

### 6.6 Micro‑Meditations (Phase 10)

 Micro‑Meditations (Phase 10)

- 60‑second audio / timer view.
- MP3 TTS cached; UI shows progress ring.

### 6.7 Social & Referral

- **Referral Links:** Firebase Dynamic Links → attribute to inviter, grant 3 premium days both sides.
- **Accountability Partner (Phase 10):** simple pairing code → shared streak dashboard.

### 6.8 Slack / Teams Bot (Phase 12)

- Webhook posts Daily Drop to channel; OAuth2 install flow.
- Admin panel for corp packages.

### 6.9 Auto‑Read Voice Pack (Phase 10)

- **Playback toggle** on message card; streams pre‑generated MP3 via CloudFront.
- **Voice selector** (5 ElevenLabs voices) stored in `users.voice_pref`.
- TTS pipeline piggy‑backs on Micro‑Meditations infra; MP3 cached per message+voice.

### 6.11 Semantic & Lexical De‑duplication Guard‑Rail & Lexical De‑duplication Guard‑Rail

(To prevent near‑duplicate content within a 90‑day window… *unchanged, moved down one number*) Semantic & Lexical De‑duplication Guard‑Rail

To prevent near‑duplicate content within a 90‑day window (for both Daily Drop and on‑demand messages):

1. **Embedding similarity check** – after generation we query
   ```sql
   SELECT id FROM messages
   WHERE user_id = $user_id
     AND created_at > now() - interval '90 days'
     AND embedding <-> $newEmbedding < 0.20
   LIMIT 1;
   ```
   If a row is returned we regenerate with a higher `temperature`.
2. **Lexical Bloom filter** – we maintain an in‑memory Bloom filter of trigram hashes for the last 5 000 messages; >25 % overlap ⇒ regenerate.
3. **Daily prompt seed** – inject `[SEED:<YYYY‑MM‑DD‑rand>]` token into the system prompt to encourage variation.
4. **CI test** – pipeline repros yesterday’s message with today’s seed and asserts cosine distance ≥ 0.20; build fails if not.

Implementation lives in `MessageService.dedupeGuard()` and adds <5 % extra token spend.

---

## 7 · Message Prompts, Caching & Fallbacks

*UNCHANGED (semantic cache already covers new template params).* 

---

## 8 · Environment Setup & Dependencies

Add: `ELEVENLABS_TTS_KEY` (for micro‑meditations audio).

---

## 9 · Security & Privacy

Add: `weatherBucket` and calendar scopes are *opt‑in*; data stored locally only.

---

## 10 · Performance & Accessibility

Add: predictive pre‑loading (Phase 8) – pre‑fetch next likely message when cooldown \~90 % elapsed.

---

## 11 · Growth, Gamification & Social Loops

### 11.1 Retention‑Gate A/B (Phase 8)

- **Test idea:** Free users must complete *three* Daily Challenges in a 7‑day span to unlock further on‑demand messages for that day.
- **Variant B (gentler):** Completing a challenge awards +1 bonus on‑demand message (stackable to max 3). No hard block.
- KPI: conversion uplift vs. churn; stop test if bounce >5 %.



| Feature                                   | Phase | Metric Lift                     |
| ----------------------------------------- | ----- | ------------------------------- |
| Visual Quote share‑cards + referral links | 7     | +30 % shares, +7 % new installs |
| Daily Challenge                           | 7     | +8 % D1 retention               |
| Wisdom Points & Achievements              | 8     | +10 % D7 retention              |
| Time‑of‑Day templates                     | 8     | +12 % push open rate            |
| Predictive pre‑loading                    | 8     | −150 ms perceived latency       |
| Weather personalisation                   | 9     | +5 % share rate                 |
| Seasonal events                           | 9     | spike engagement holidays       |
| Accountability Partner                    | 10    | +5 % D30 retention              |
| Micro‑Meditations                         | 10    | upsell new mindfulness segment  |
| Creator Packs marketplace                 | 11    | +15 % ARPU                      |
| Corporate Slack/Teams bot                 | 12    | +B2B revenue                    |

---

## 12 · Phased Roadmap & Timeline (12 weeks)

| Week    | Deliverables                                                                               |
| ------- | ------------------------------------------------------------------------------------------ |
| **0‑1** | Turbo monorepo, design tokens, CI/CD                                                       |
| **2**   | **Web PWA soft‑beta:** manual Daily Drop only                                              |
| **3**   | Semantic caching + AI adapter; switch Daily Drop to LLM                                    |
| **4**   | Mobile (Expo) alpha, Paywall (Stripe + RevenueCat)                                         |
| **5**   | Closed beta (50 users) – measure cost & retention                                          |
| **6**   | On‑demand flow, push notifications live                                                    |
| **7**   | **Public soft‑launch CA/US** + Visual Quote share‑cards, referral rewards, Daily Challenge |
| **8**   | Wisdom Points + Achievements, time‑of‑day templates, predictive pre‑loading                |
| **9**   | Weather personalisation, first Seasonal Event (Thanksgiving)                               |
| **10**  | Social: Accountability Partner, micro‑meditations library, **Auto‑Read Voice Pack**        |
| **11**  | Creator Packs marketplace, dynamic pricing experiments                                     |
| **12**  | **B2B pilot:** Slack/Teams bot, corporate wellness pack                                    |

> *Post‑Month 3*: Calendar integration & white‑label branding (pending B2B adoption).

---

## 13 · Success Metrics & KPIs

*UNCHANGED (Wisdom Points tracked in analytics).* 

---

## 14 · Deliverables Checklist

Add: Slack bot code, ElevenLabs TTS script, challenge & badge assets, visual quote templates.

---

## 15 · Appendices

*Color tokens, cost table, diagrams, DB schema* updated to include:

- `users.points`, `achievements`, `daily_challenge` tables.
- `weather_cache` (bucketed by city‑day).
- MP3 storage path spec.

---

## Appendix X – Code & API Details

### X.1 REST/Edge API Contracts

| # | Verb | Path                            | Payload                                            | 200 OK                                                          | 4xx/5xx                               |
| - | ---- | ------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| 1 | POST | `/generate`                     | `{ "userId": "uuid", "category": "motivational" }` | `{ "id":"uuid","content":"string","tokens":113,"cost":0.0063 }` | 402 quota · 429 rate · 500 llm\_error |
| 2 | GET  | `/daily-drop?locale=en-US`      | —                                                  | `{ "date":"2025-07-28","content":"string" }`                    | 404 not\_ready                        |
| 3 | GET  | `/daily-challenge?locale=en-US` | —                                                  | `{ "id":"uuid","task":"Take 2‑min walk" }`                      | 404 not\_ready                        |
| 4 | POST | `/tts`                          | `{ "messageId":"uuid","voice":"emma" }`            | `{ "url":"https://cdn…/abc.mp3" }`                              | 402 not\_subscribed                   |
| 5 | POST | `/share-card`                   | `{ "messageId":"uuid","style":"sunset" }`          | `{ "url":"https://cdn…/abc.png" }`                              | 402 premium\_only                     |
| 6 | POST | `/auth/login`                   | `{ "email":"","password":"" }`                     | `{ "token":"jwt","refresh":"jwt" }`                             | 401 invalid                           |
| 7 | POST | `/analytics/cost`               | `{ "provider":"openai","tokens":113 }`             | `204`                                                           | —                                     |

### X.2 Prompt Templates

```json5
// Motivational
{
  "system": "You are AuraFlow, a concise motivational coach...",
  "user": "Generate a {tone} motivational message (max 40 words) for a {audience}. TimeOfDay={timeOfDay}. Seed={seed}"
}
```

*(repeat for other categories)*

### X.3 Database Schema (excerpt)

```sql
create table users (...);
create table messages (...);
create index on messages using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

(See full DDL in repo)

### X.4 Monorepo File Tree Scaffold

```
repo-root/
  apps/mobile/      # Expo RN
  apps/web/         # Astro islands
  workers/api/      # CF Worker routes
  workers/cron/
  packages/common/
  packages/ui/
  infra/terraform/
```

### X.5 Component Catalogue (excerpt)

| Component    | Props                            | Notes        |
| ------------ | -------------------------------- | ------------ |
| `ClayCard`   | `title`, `children`, `elevation` | Hover‑lift   |
| `ClayBadge`  | `icon`, `label`                  | Achievements |
| `ClayButton` | `variant`,`size`                 | radius 16px  |

### X.6 CI / Cost‑Regression Workflow

See `.github/workflows/ci.yml` – fails build if average tokens/msg ↑ >10 %.

### X.7 Testing Plan

Unit with Vitest, Integration with SuperTest, E2E Web: Playwright, Mobile: Detox.

### X.8 Environment Variables Sample (`.env.example`)

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
SUPABASE_URL=
...etc
```

### X.9 Seed Script

`pnpm ts-node scripts/seed.ts` inserts demo user + five messages for QA.

### X.10 Design References

*Figma & Storybook URLs to be inserted when available.*

---

**End of Master Specification – v2.1 (with Appendix X)**

