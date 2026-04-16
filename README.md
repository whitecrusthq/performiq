# PerformIQ

An HR and performance management platform for employee appraisals, goal tracking, recruitment, attendance, and leave management.

## Project Structure

```
frontend/   - React + Vite frontend
backend/    - Express + Drizzle API
```

## Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, TanStack Query, Wouter, Radix UI
- **Backend**: Node.js ESM, Express 5, TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: JWT + bcryptjs

## Development

```bash
cd backend
npm install
npm run dev
```

The backend automatically spawns the Vite frontend dev server in development mode.

## Environment Variables

See `backend/.env.example` for required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Backend port (default 3001)
- `FRONTEND_PORT` - Frontend port (default 5000)
- `JWT_SECRET` - JWT signing secret
- `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_FROM` - Email configuration (optional)
