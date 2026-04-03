# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Frontend and backend are fully self-contained — no shared library packages.

## Pending: Email Notifications

Email notifications are planned but not yet implemented. The feature requires an API key from a transactional email service. When the user provides one, implement notifications for:
- Appraisal assigned → notify employee
- Employee submits self-review → notify reviewer (manager)
- Manager completes review → notify admin/approver
- Appraisal fully completed → notify employee
- New user account created → welcome email to new user
- Goal assigned → notify employee

**Recommended services:** Resend (resend.com) or SendGrid (sendgrid.com)
**When ready:** Store the key as `RESEND_API_KEY` or `SENDGRID_API_KEY` secret, then add `backend/src/lib/email.ts` and call it from the relevant route handlers (appraisals.ts, users.ts, goals.ts).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **Build**: esbuild (backend), Vite (frontend)

## Structure

```text
workspace/
├── frontend/               # PerformIQ — React + Vite web application (@workspace/performiq)
├── backend/                # PerformIQ — Express API server (@workspace/api-server)
├── artifacts/hira-crm/     # HiraCRM — React + Vite web application (@workspace/hira-crm)
├── crm-backend/            # HiraCRM — Express + Sequelize API server (@workspace/crm-backend)
├── pnpm-workspace.yaml     # pnpm workspace (frontend, backend, artifacts/*, crm-backend)
├── tsconfig.base.json      # Shared TS options
└── package.json            # Root package with hoisted devDeps
```

### PerformIQ (`frontend/` + `backend/`)

```text
frontend/src/
├── lib/            # API client (React Query hooks + fetch)
├── hooks/          # App-level React hooks (auth, etc.)
├── pages/          # Route-level page components
└── components/     # Shared UI components

backend/src/
├── db/             # Drizzle ORM + schema tables
└── routes/         # Express route handlers
```

### HiraCRM (`artifacts/hira-crm/` + `crm-backend/`)

```text
artifacts/hira-crm/src/
├── lib/
│   ├── api.ts          # JWT fetch wrapper, apiGet/apiPost/apiPut/apiDelete
│   ├── auth-context.tsx # AuthProvider + useAuth hook
│   └── mock-data.ts    # Type definitions + channel icon/color utilities
├── pages/
│   ├── login.tsx       # Login page (pre-filled demo credentials)
│   ├── dashboard.tsx   # KPI cards + charts from /api/dashboard
│   ├── inbox.tsx       # Conversation list + message thread + send reply
│   ├── customers.tsx   # Customer table + side sheet details
│   ├── campaigns.tsx   # Campaign table + create dialog
│   ├── analytics.tsx   # Charts + agent leaderboard from /api/analytics
│   └── settings.tsx    # Channels, AI config, team management
└── components/layout.tsx # Sidebar navigation

crm-backend/src/
├── models/         # Sequelize models (Agent, Customer, Conversation, Message, Campaign)
├── routes/         # auth, agents, customers, conversations, campaigns, dashboard, analytics
├── middlewares/    # JWT auth middleware
└── seeds.ts        # Seed data (5 agents, 5 customers, conversations, messages, campaigns)
```

## HiraCRM

### Ports
- Frontend dev server: port 3001 (preview path: `/crm/`)
- CRM API backend: port 3002 (internal only, proxied via Vite at `/crm/api`)

### API Routing
The Vite proxy rewrites `/crm/api/*` → `http://localhost:3002/api/*` at dev time. All API calls in the frontend use `${BASE_URL}api/...` (e.g. `/crm/api/auth/login`).

### Pages / Navigation
- **Dashboard** — overview metrics
- **Inbox** — unified multi-channel inbox with AI assist + bot reply
- **Customers** — customer list
- **Campaigns** — broadcast campaigns
- **Analytics** — charts
- **AI Chat** — test HiraBot AI with custom system prompt
- **Channels** — connect WhatsApp / Facebook / Instagram; simulate incoming messages
- **Settings** — agent/profile settings

### AI Features
- **Provider-agnostic**: Supports Gemini (built-in via Replit integration), Gemini (own key), OpenAI, Anthropic Claude, and Custom OpenAI-compatible endpoints
- `AiSettings` model (`crm_ai_settings`) stores: provider, model, apiKey (encrypted at rest), baseUrl, temperature, maxTokens
- `GET /api/ai/settings` — fetch current AI provider settings (returns `hasApiKey` not raw key)
- `PUT /api/ai/settings` — update provider/model/apiKey/baseUrl/temperature/maxTokens
- `POST /api/ai/settings/test` — test a provider config before saving (returns `{ok, message}`)
- `POST /api/ai/suggest-reply` — generates 3 AI reply suggestions for the active conversation
- `POST /api/ai/auto-respond` — CommsBot auto-replies as "bot" sender
- `POST /api/ai/chat` — SSE streaming AI chat for testing
- Provider helper: `crm-backend/src/lib/ai-provider.ts` — `generateText()` and `streamText()` route to the correct SDK based on settings
- AI Assistant page: 4-tab layout — AI Provider (provider selector + model/key/URL/temp), Knowledge Base, Test Chat, System Prompt
- Inbox: ⚡ button to get AI suggestions (click to insert); "Bot Reply" button for auto-respond

### Agent Clock-In (`/clock-in`)
- **Sidebar**: "Clock In" nav item (Clock icon)
- **Feature-parity with PerformIQ attendance.tsx** — same full feature set, adapted for CommsCRM
- **Clock-In Card**: live elapsed timer (HH:MM:SS), clock-in/out times, GPS coordinates with Google Maps links; green/red status indicator
- **Face Capture Modal**: webcam selfie with mirrored preview, guided face oval, skip option, retake button; captures base64 JPEG at clock-in and clock-out
- **Face Review**: admins/supervisors can verify/flag each record — opens side-by-side photo comparison modal (reference avatar vs clock-in/out selfies) with verify/flag/reset actions
- **GPS Location Pings**: auto-sends location every 30 minutes while clocked in; offline queue with `crm_attendance_ping_queue` localStorage key; batch-syncs on reconnect
- **Offline support**: network status badge, queued ping counter, auto-flush on online event
- **Logs table**: date, agent name (admin/supervisor view), clock in/out times, duration, face thumbnail cells with review badge, location cells with Google Maps links, expandable ping history
- **Agent filter** (admin/supervisor only): filter logs by agent and/or date
- **Backend models** (Sequelize `sync({ alter: true })`):
  - `AgentAttendance` → `crm_agent_attendance` table
  - `AgentAttendancePing` → `crm_agent_attendance_pings` table
- **Routes** in `crm-backend/src/routes/crm-attendance.ts`:
  - `GET /api/attendance/today` — current agent's today record
  - `POST /api/attendance/clock-in` — clock in (lat/lng/faceImage/photoTime)
  - `POST /api/attendance/clock-out` — clock out (lat/lng/faceImage/photoTime/notes)
  - `GET /api/attendance` — list (agents see own; admin/supervisor see all + filter by agentId/date)
  - `POST /api/attendance/location-ping` — single location ping
  - `POST /api/attendance/location-ping/batch` — flush offline queue
  - `PUT /api/attendance/:id/face-review` — set status: verified/flagged/pending (admin/supervisor only)
  - `GET /api/attendance/:id/pings` — get pings for a log entry

### Product Demand Intelligence (`/product-demand`)
- **Sidebar**: "Product Demand" nav item (PackageSearch icon) in Core nav section
- **4 KPI cards**: Total Product Searches, Unique Products in Demand, Not Available Rate (%), Search-to-Order Rate (%)
- **Two trend charts** (Area): Search Volume Trend + Not Available Trend — daily data points over selected period, auto-condensed for wider ranges
- **Top Products in Demand**: ranked list with horizontal progress bars coloured per product
- **Searches by Channel**: WhatsApp / Facebook / Instagram breakdown with colour-coded progress bars
- **Demand Health mini-card**: Stock Coverage % + Conversion Rate % at a glance
- **Product Search Frequency bar chart**: top 10 products in multi-colour bars
- **Date range selector**: 7, 14, 30, 60, 90 days
- **Backend route**: `GET /api/insights/product-demand?days=N` in `crm-backend/src/routes/insights.ts`
  - Detects search intent from customer messages via 26 trigger phrases ("do you have", "looking for", "want to buy", etc.)
  - Extracts product terms (up to 5 words after trigger)
  - Detects not-available responses from agent/bot messages via 18 patterns ("out of stock", "sold out", etc.)
  - Search-to-order rate = resolved conversations with a search / total search conversations
  - Returns: stats, topSearchedProducts, trendData (daily), channelBreakdown
- **Empty state**: shown when no search data is yet detected

### Transcripts & Agent KPIs (`/transcripts`)
- **Sidebar**: "Transcripts" nav item (ScrollText icon) added between Intelligence and Tools section
- **Two-tab layout**:
  - **Transcripts tab**: Searchable, paginated conversation list (by customer name/phone); filters for channel, status, agent (admin/supervisor only); click to open full transcript panel showing every message as chat bubbles (customer/agent/bot), metadata bar (response time, CSAT rating), date separators
  - **Agent KPIs tab**: Per-agent performance cards with weekly/monthly period toggle; shows Conversations handled, Resolution Rate, Avg Response Time, CSAT score — each with progress bar vs. set target; "Set Targets" button opens dialog for admins/supervisors to enter KPI goals
- **Backend routes** in `crm-backend/src/routes/transcripts.ts`:
  - `GET /api/transcripts` — paginated conversation list with customer + assignedAgent, message counts; filterable by agentId, channel, status, search
  - `GET /api/transcripts/:id/messages` — full message thread + feedback + avgResponseMs computed from consecutive customer→agent pairs
  - `GET /api/transcripts/agent-stats?period=weekly|monthly` — per-agent stats computed from DB (conversations, resolution rate, avg response time, CSAT)
  - `PUT /api/transcripts/kpi-targets/:agentId` — upsert KPI targets per agent per period
- **Model**: `AgentKpi` → `crm_agent_kpis` table (agentId, period, targetConversations, targetResponseTimeMins, targetResolutionRate, targetCsatScore)
- **Role-based**: Agents can view their own stats; Set Targets is hidden for agent role; agent filter only visible to admin/supervisor

### Mailgun Email Broadcasting
- **Model**: `EmailSettings` → `crm_email_settings` table (provider, apiKey, domain, region, fromEmail, fromName, isActive)
- **Routes** in `crm-backend/src/routes/email-settings.ts`:
  - `GET /api/settings/email` — get Mailgun config (returns `hasApiKey` not raw key)
  - `PUT /api/settings/email` — save API key, domain, region, fromEmail, fromName, isActive
  - `POST /api/settings/email/validate-domain` — verify the Mailgun domain is active
  - `POST /api/settings/email/test` — send a real test email to a given address
- **Mailgun helper**: `crm-backend/src/lib/mailgun.ts` — `sendEmail()`, `testMailgunConnection()`, `validateDomain()`, `buildMailgunConfig()`; uses Mailgun REST API directly (no SDK), supports US + EU regions
- **Campaigns integration** in `campaigns.ts`: When an email campaign is marked "sent", CommsCRM auto-sends to all customers with an email address via Mailgun in batches of 1000; new `POST /api/campaigns/:id/send` endpoint for explicit send-now
- **Settings page**: Mailgun card added between AI & Automation and Team Management — API key (show/hide), domain, region selector, from name/email, validate domain button, send test email button, active toggle
- **Settings page location**: `artifacts/hira-crm/src/pages/settings.tsx`

### Customer Intelligence (`/insights`)
- **Route**: `GET /api/insights/customer?days=30` — full analytics on customer messages
- **Keyword-based analysis** (no AI cost) extracts:
  - **Top customer questions**: messages containing `?`, grouped by bigram frequency into recurring topic clusters
  - **Top issues raised**: 7 categories (Shipping & Delivery, Returns & Refunds, Billing & Payment, Technical Support, Product Information, Account & Profile, Complaints) matched via keyword lists — counted per conversation
  - **Top products mentioned**: capitalised terms and bigrams that appear in product-related message context, with frequency ranking
  - **Compliance & risk flags**: 22 keywords across `high` (legal action, fraud, lawsuit, GDPR) and `medium` (data protection, discrimination, mis-sold) severity — deduplicated per conversation
- **AI Analysis button**: `POST /api/insights/ai-summary` — sends a sample of recent messages to the configured AI provider for sentiment, key themes, product detection, and recommendations
- **Period selector**: 7 / 14 / 30 / 60 / 90 days
- **Page**: `artifacts/hira-crm/src/pages/insights.tsx` — stat cards, horizontal bar chart (issues), ranked question list, product bubble chart, compliance flag feed
- **Backend**: `crm-backend/src/routes/insights.ts`
- **Sidebar entry**: "Intelligence" (Brain icon)

### Channel Integrations
- `crm_channels` table stores credentials (accessToken, phoneNumberId, pageAccessToken, etc.)
- `GET/POST/PUT/DELETE /api/channels` — CRUD for channel config
- Webhook endpoints (real Meta webhooks):
  - `GET/POST /api/webhooks/whatsapp` — WhatsApp Business API (verifies with `webhookVerifyToken`)
  - `GET/POST /api/webhooks/facebook` — Facebook Messenger
  - `GET/POST /api/webhooks/instagram` — Instagram Direct
- `POST /api/webhooks/simulate` — simulate an incoming message (creates customer + conversation + message in DB)
- When credentials are saved, `isConnected` is auto-set based on required fields being present
- Setup flow: Channels page → Add channel → Configure API Keys → copy Webhook URL + Verify Token into Meta Developer App

### CRM Demo Accounts (password: `password`)
- `sarah@hiracrm.com` — admin
- `james@hiracrm.com` — agent
- `priya@hiracrm.com` — agent
- `carlos@hiracrm.com` — agent
- `aisha@hiracrm.com` — agent

### CRM Backend Commands
- `pnpm --filter @workspace/crm-backend run dev` — build + start (port 3002)
- `pnpm --filter @workspace/crm-backend run build` — esbuild bundle to `dist/index.mjs`
- Database: shared PostgreSQL `DATABASE_URL` with Sequelize ORM (auto-sync on start)
- JWT secret: `CRM_JWT_SECRET` env var (falls back to a hardcoded dev secret)

---

## PerformIQ Packages

### `frontend` (`@workspace/performiq`)

React + Vite SPA. Fully self-contained — the API client lives at `frontend/src/lib/`.

- Entry: `src/main.tsx`
- App: `src/App.tsx` — sets up routing, QueryClient, auth context
- API client: `src/lib/` — custom fetch with auth token injection, React Query hooks for every endpoint
- `pnpm --filter @workspace/performiq run dev` — start dev server (port from `PORT`)

### `backend` (`@workspace/api-server`)

Express 5 API server. Fully self-contained — the DB layer lives at `backend/src/db/`.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — CORS, JSON parsing, routes mounted at `/api`
- Routes: `src/routes/` — auth, users, appraisals, cycles, criteria, goals, departments, reports, dashboard, hr-queries
- DB layer: `src/db/` — Drizzle ORM connection + all schema table definitions
- `pnpm --filter @workspace/api-server run dev` — build + start (port 8080)
- `pnpm --filter @workspace/api-server run build` — esbuild bundle to `dist/index.mjs`

## Database

- **Push schema changes**: `cd backend && pnpm exec drizzle-kit push` (or `push --force`)
- **Drizzle config**: `backend/drizzle.config.ts`
- `DATABASE_URL` is automatically provided by Replit

## Face Identity Review (Attendance Compliance)

Added to support audit and compliance requirements for shared-device attendance on sites.

**DB additions:**
- `users.profile_photo TEXT` — reference photo stored as base64 JPEG (~400×400px)
- `attendance_logs.face_review_status TEXT` — `pending` | `verified` | `flagged` (default: `pending`)
- `attendance_logs.face_reviewed_by INTEGER` — reviewer's user ID
- `attendance_logs.face_reviewed_at TIMESTAMP` — when reviewed

**New API endpoints:**
- `PUT /api/users/:id/profile-photo` — set reference photo (admin or self)
- `PUT /api/attendance/:id/face-review` — mark a record as verified/flagged/pending (manager+)

**Frontend:**
- Attendance table: each row shows a `FaceReviewBadge` (Pending/Verified/Flagged) + "Review" button for managers
- `FaceReviewModal`: 3-column side-by-side comparison — Reference Photo | Clock-In Selfie | Clock-Out Selfie — with Verify, Flag, and Reset actions and full audit trail
- Users page: "Photo" button on each user row opens a `SetPhotoModal` to take/upload a reference photo (compresses to ~400×400 JPEG)

## Auth

- JWT stored in `localStorage` as `"token"`
- All API calls attach `Authorization: Bearer <token>` via `frontend/src/lib/custom-fetch.ts`
- Role hierarchy: `super_admin`(4) > `admin`(3) > `manager`(2) > `employee`(1)

## Demo Accounts (password: `password`)

- `admin@performiq.com` — super_admin
- `Johnme@performiq.com` — manager
- `sarah@performiq.com` — manager
- `alice@performiq.com` — employee
