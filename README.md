# PerformIQ

An employee performance appraisal system with role-based access, appraisal cycles, goal tracking, and reporting.

## Project Structure

```
performiq/
├── frontend/          # React + Vite web application
├── backend/           # Node.js + Express API server
├── lib/               # Shared libraries
│   ├── db/            # PostgreSQL schema + Drizzle ORM
│   ├── api-spec/      # OpenAPI spec + code generation
│   ├── api-client-react/  # Generated React Query hooks
│   └── api-zod/       # Generated Zod validation schemas
├── scripts/           # Utility scripts
└── artifacts/         # Dev tooling
    └── mockup-sandbox/
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js 24, Express 5, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT (JSON Web Tokens) |
| Validation | Zod |

## Roles

| Role | Access |
|---|---|
| `super_admin` | Full access to everything |
| `admin` | User management, reports, all appraisals |
| `manager` | Team appraisals, goal management |
| `employee` | Self-reviews, own goals |

## Demo Accounts

| Email | Role | Password |
|---|---|---|
| admin@performiq.com | super_admin | password |
| sarah@performiq.com | manager | password |
| Johnme@performiq.com | manager | password |
| alice@performiq.com | employee | password |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start frontend (port 23605)
pnpm --filter @workspace/performiq run dev

# Start backend API (port 8080)
pnpm --filter @workspace/api-server run dev

# Push database schema
cd lib/db && pnpm run push
```

## Features

- Role-aware dashboards
- Appraisal cycle management
- Self-review + manager review workflow
- Rating criteria and competency scoring
- Goal tracking with achievement percentage
- Department management
- Reports with PDF and Excel export
- Department-level filtering on all reports
