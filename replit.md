# Overview

PerformIQ is a standalone HR performance management system built with a separated frontend and backend architecture. It streamlines employee performance appraisals, goal setting, feedback, and attendance tracking.

# User Preferences

I prefer iterative development with clear, concise communication. Please ask before making significant architectural changes or adding new external dependencies. I value detailed explanations for complex features and design decisions.

# System Architecture

The project uses a standalone architecture with separate frontend and backend directories, each with its own dependencies managed by npm.

## Core Technologies:
- **Node.js**: 24
- **Package Manager**: npm (per-directory)
- **TypeScript**: 5.9
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod
- **Build Tools**: esbuild (backend), Vite (frontend)

## Application Structure:
- `frontend/`: React + Vite web application
- `backend/`: Express 5 API server (port 8080)

### Frontend (`frontend/`):
- React + Vite SPA with TailwindCSS 4
- UI components: Radix UI primitives + shadcn/ui pattern
- Routing: wouter
- State: TanStack React Query
- Auth: JWT stored in localStorage, useAuth hook
- Pages: login, dashboard, profile, employees, appraisals, goals, attendance, appearance settings
- Charting: Recharts
- PDF export: jsPDF + jsPDF-AutoTable
- Excel export: xlsx

### Backend (`backend/`):
- Express 5 API server with esbuild bundling
- Database: Drizzle ORM with PostgreSQL
- Auth: JWT + bcryptjs, role-based (super_admin > admin > manager > employee)
- Logging: pino + pino-http
- Email: Mailgun integration
- Dev mode: spawns Vite dev server on port 3000 and proxies non-API requests to it
- Prod mode: serves static frontend from `frontend/dist/public/`
- Seeder: `npm run db:seed` seeds demo users, cycles, criteria, appraisals, goals

## Proxy Architecture (Development):
```
Port 80 (Replit proxy) → Port 8080 (PerformIQ backend)
  /api/*     → PerformIQ Express routes
  /*         → Port 3000 (PerformIQ Vite dev server)
```

## Authentication:
- JWTs stored in `localStorage` as "token"
- All API calls include `Authorization: Bearer <token>`
- Role hierarchy: `super_admin`(4) > `admin`(3) > `manager`(2) > `employee`(1)

## Login credentials (seeded via `npm run db:seed` in backend/):
- admin@performiq.com / password — Admin
- sarah@performiq.com / password — Manager (Engineering)
- james@performiq.com / password — Manager (Product)
- alice@performiq.com / password — Employee (Engineering)
- bob@performiq.com / password — Employee (Engineering)
- carol@performiq.com / password — Employee (Product)
- david@performiq.com / password — Employee (Product)
- Legacy: admin@performiq.com / Admin@2024, hruser@performiq.com / HrUser@2024

## Sales Target & Budget Features:
- Criteria support target periods: monthly, quarterly, half_year, yearly
- Appraisal scores have optional budget values (admin-prefilled per employee/criterion)
- Budget assignment modes: "Individual" (one employee) or "By Category" (group by job title)
- By Category: bulk-create appraisals for multiple employees with per-category budget targets
- Backend: POST /api/appraisals/bulk accepts employeeIds array + budgetsByCategory keyed by job title
- Employees see their budget target when filling appraisals; system auto-calculates % achieved vs weight
- Resend for Review: admins/managers can send completed/in-progress appraisals back to self_review
- Access control: managers can only resend/update budgets for their team members or assigned reviews

## UI/UX:
- Sidebar navigation with bold/semibold black text on white background, active items use primary highlight
- Profile page with clickable avatar for photo upload (camera overlay, file picker, 5MB limit, base64)
- Login page customization from Appearance settings (headline, subtext, gradient colors)
- App settings stored in database: company name, logo letter, primary color, theme, login customization

## Ports:
- Frontend (Vite dev): 3000
- Backend (Express): 8080

## External Dependencies:
- **PostgreSQL**: Primary database via Drizzle ORM
- **Mailgun**: For email notifications
- **JWT_SECRET**: Environment variable for JWT signing

## GitHub:
- Repos: SunnyAgaga/performiq, whitecrusthq/performiq
