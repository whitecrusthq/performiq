# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Projects

### Main Project (API Server)
- **Path**: `artifacts/api-server`
- **Stack**: Express 5, PostgreSQL + Drizzle ORM, Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- **Port**: 8080

### CommsCRM (Independent Project)
- **Frontend**: `artifacts/commscrm` — React + Vite, Tailwind CSS, wouter, TanStack Query
- **Backend**: `artifacts/commscrm-api` — Express 5, Sequelize ORM, PostgreSQL, JWT auth
- **Backend Port**: 8081
- **Frontend proxies** `/api` to backend at `localhost:8081`
- **Completely independent** from the main project — no shared dependencies with `api-server`, `api-spec`, `api-zod`, or `db` packages

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Build**: esbuild (CJS bundle)

## Key Commands

### Main Project
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

### CommsCRM
- `pnpm --filter @workspace/commscrm run dev` — run CommsCRM frontend
- `PORT=8081 pnpm --filter @workspace/commscrm-api run dev` — run CommsCRM backend
- `pnpm --filter @workspace/commscrm-api run build` — build CommsCRM backend

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
