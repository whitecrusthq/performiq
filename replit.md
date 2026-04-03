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
- `POST /api/ai/suggest-reply` — generates 3 AI reply suggestions for the active conversation (Claude Haiku)
- `POST /api/ai/auto-respond` — HiraBot auto-replies to the customer as "bot" sender (Claude Haiku)
- `POST /api/ai/chat` — SSE streaming AI chat for testing (Claude Haiku). Uses `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (auto-provisioned by Replit AI Integrations)
- Inbox: ⚡ button to get AI suggestions (click to insert); "Bot Reply" button for auto-respond

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
