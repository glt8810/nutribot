# 🥗 NutriBot — AI-Powered Nutritionist

An enterprise-grade AI nutritionist consultation app that guides users through a personalized intake questionnaire and generates a complete, tailored nutrition plan using Claude AI. Built with Next.js 14 and Node.js/Express.

---

## Features

- **12 Nutrition Goals** — Fat loss, muscle gain, body recomp, energy boost, gut health, sports performance, plant-based transition, ED recovery, pregnancy/postpartum, medical nutrition, family meal planning, and longevity
- **Adaptive Intake Wizard** — 4-section questionnaire with goal-specific fields that dynamically adjust based on the selected goal
- **Localized Measurements** — Store standard metric data and dynamically convert to imperial units for display based on user preferences
- **10 AI-Generated Plan Modules** — Calorie breakdown, macro targets, 7-day meal plan, snack swaps, personal rules, timeline, hydration, supplements, grocery list, and progress tracking
- **Multilingual Support** — Generate plans in English, Português, Español, Français, or Deutsch with JSON schema integrity preserved
- **Regional Cuisine Deep-Dive** — Specify regional dishes and culinary traditions for culturally authentic meal plans
- **Enterprise Security** — AES-256-GCM field-level PII encryption, Argon2id password hashing, RS256 JWTs, TOTP MFA with backup codes
- **GDPR Compliance** — Data export, account deletion (30-day soft delete), consent tracking

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Cache | In-memory (dev) / Redis (prod) |
| AI | Anthropic Claude API |
| Auth | RS256 JWT, Argon2id, TOTP MFA |
| Encryption | AES-256-GCM for PII at rest |

---

## Project Structure

```
nutribot/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.ts              # Express server entry
│   │   ├── lib/                   # Core utilities (Prisma, Redis, JWT, constants)
│   │   ├── middleware/            # Auth, rate limiting, security headers, validation
│   │   ├── routes/                # API endpoints (auth, goals, plans)
│   │   ├── services/              # Business logic (auth, AI, crypto, email, plans, calculations)
│   │   └── validators/            # Zod schemas
│   └── keys/                      # Auto-generated RS256 key pair (gitignored)
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── auth/                  # Register, login, verify email, password reset
│   │   ├── profiles/              # Profile selection and creation
│   │   ├── intake/                # 4-section adaptive wizard
│   │   ├── goals/                 # Goal selection and conditional extras
│   │   ├── generating/            # Plan generation progress
│   │   └── dashboard/             # Plan view, settings, history
│   └── lib/                       # API client, auth context
├── .env.example                   # Environment variable template
└── docker-compose.yml             # PostgreSQL + Redis for production
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### 1. Clone & Install

```bash
git clone https://github.com/glt8810/nutribot.git
cd nutribot

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# From the project root
cp .env.example backend/.env
```

Edit `backend/.env` and set at minimum:

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_KEY` | ✅ | AES-256 key — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | For plan generation | Your Claude API key |
| `DATABASE_URL` | Auto-configured | Defaults to SQLite for development |

### 3. Initialize Database

```bash
cd backend
npx prisma db push
```

### 4. Run

```bash
# Terminal 1 — Backend (http://localhost:4000)
cd backend && npm run dev

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend && npm run dev
```

---

## API Overview

### Auth Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login (returns JWT) |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Invalidate session |
| `GET` | `/auth/profile` | Get user profile (decrypts PII) |
| `PATCH` | `/auth/profile` | Update user profile preferences |
| `POST` | `/auth/verify-email` | Verify email with token |
| `POST` | `/auth/forgot-password` | Request password reset |
| `POST` | `/auth/reset-password` | Reset password with token |
| `POST` | `/auth/change-password` | Change password (authenticated) |
| `POST` | `/auth/mfa/setup` | Generate TOTP secret + QR |
| `POST` | `/auth/mfa/verify` | Enable MFA with TOTP code |
| `DELETE` | `/auth/mfa` | Disable MFA |
| `GET` | `/auth/sessions` | List active sessions |
| `DELETE` | `/auth/sessions/:id` | Revoke a session |
| `GET` | `/auth/export` | GDPR data export |
| `DELETE` | `/auth/account` | Soft-delete account |

### Profile, Goal & Intake Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/profiles` | List user's profiles |
| `POST` | `/profiles` | Create a new profile |
| `GET` | `/profiles/:id/intake` | Get saved profile intake responses |
| `POST` | `/profiles/:id/intake` | Save profile intake section |
| `POST` | `/goals` | Create a new goal linked to a profile |
| `GET` | `/goals` | List user's goals |
| `POST` | `/goals/:id/extras` | Save goal-specific conditional data |
| `DELETE` | `/goals/:id` | Delete a goal |

### Plan Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/plans/generate` | Generate full AI plan |
| `GET` | `/plans` | List user's plans |
| `GET` | `/plans/:id` | Get a specific plan |
| `POST` | `/plans/:id/regenerate` | Regenerate a single module |
| `POST` | `/plans/:id/replace-meal` | Replace a single meal |
| `POST` | `/plans/:id/feedback` | Submit meal feedback |

---

## Security

| Feature | Implementation |
|---|---|
| Password Hashing | Argon2id (64MB / 3 iterations / parallelism 4 in production) |
| Password Strength | zxcvbn real-time meter, min 12 chars |
| Breach Check | HaveIBeenPwned k-anonymity API |
| JWT | RS256 with auto-generated key pair, 15-minute access tokens |
| Refresh Token | SHA-256 hashed in DB, HttpOnly/Secure/SameSite cookie |
| PII Encryption | AES-256-GCM field-level encryption (name, DOB, intake data) |
| MFA | TOTP with Argon2-hashed backup codes |
| Brute Force | 5-fail lock (15 min), 20-fail permanent lock |
| Rate Limiting | Tiered per endpoint (3/hr registration, 10/15min login, 5/hr AI) |
| Input Sanitization | Zod validation + AI prompt injection filtering |
| Content Filtering | Calorie stripping for ED recovery goals |

---

## Production Deployment

For production, switch from SQLite to PostgreSQL and enable Redis:

1. Update `prisma/schema.prisma` datasource provider to `postgresql`
2. Set `DATABASE_URL` to your PostgreSQL connection string
3. Set `REDIS_URL` to your Redis connection string
4. Set `NODE_ENV=production`
5. Set up a real email provider by configuring `SENDGRID_API_KEY` or equivalent
6. Run `npx prisma migrate deploy`

The included `docker-compose.yml` provides a PostgreSQL + Redis stack for local production testing.

---

## License

Private — All rights reserved.
