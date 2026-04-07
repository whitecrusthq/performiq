# CommsCRM

Unified multi-channel customer communication platform with AI-assisted responses, campaign management, and customer intelligence.

## Structure

- `frontend/` — React + Vite web application
- `backend/` — Express + Sequelize API server

## Setup

```bash
# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install

# Set environment variables
export DATABASE_URL=postgres://...
export JWT_SECRET=your-secret

# Start backend (port 8080)
cd backend && npm run dev

# Start frontend (port 3000, in a separate terminal)
cd frontend && npm run dev
```

## Credentials

- superadmin@commscrm.com / superadmin123
