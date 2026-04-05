# Overview

This project is a pnpm workspace monorepo utilizing TypeScript for both frontend and backend development. It comprises two main applications: PerformIQ, a performance management system, and CommsCRM, a customer relationship management system. Both applications are designed to be fully self-contained, without shared library packages.

PerformIQ aims to streamline employee performance appraisals, goal setting, and attendance tracking. CommsCRM focuses on unified multi-channel customer communication, AI-assisted responses, campaign management, and customer intelligence.

The overarching goal is to provide robust, scalable solutions for enterprise resource planning and customer engagement, leveraging modern web technologies and a modular architecture.

# User Preferences

I prefer iterative development with clear, concise communication. Please ask before making significant architectural changes or adding new external dependencies. I value detailed explanations for complex features and design decisions.

# System Architecture

The project is structured as a pnpm monorepo.

## Core Technologies:
- **Monorepo Tool**: pnpm workspaces
- **Node.js**: 24
- **Package Manager**: pnpm
- **TypeScript**: 5.9
- **Database**: PostgreSQL with Drizzle ORM (PerformIQ) and Sequelize (CommsCRM)
- **Validation**: Zod
- **Build Tools**: esbuild (backend), Vite (frontend)

## Application Structure:
The monorepo contains:
- `frontend/`: PerformIQ - React + Vite web application (`@workspace/performiq`)
- `backend/`: PerformIQ - Express API server (`@workspace/api-server`)
- `artifacts/hira-crm/`: CommsCRM - React + Vite web application (`@workspace/hira-crm`)
- `crm-backend/`: CommsCRM - Express + Sequelize API server (`@workspace/crm-backend`)

### PerformIQ Architecture:
- **Frontend (`frontend/`):** React + Vite SPA. Contains API client (`src/lib/`), React hooks (`src/hooks/`), page components (`src/pages/`), and shared UI components (`src/components/`).
- **Backend (`backend/`):** Express 5 API server. Includes Drizzle ORM for database interactions (`src/db/`) and route handlers (`src/routes/`).

### CommsCRM Architecture:
- **Frontend (`artifacts/hira-crm/`):** React + Vite SPA. Features include JWT fetch wrapper, auth context, page components for dashboard, inbox, customers, campaigns, analytics, AI chat, channels, and settings.
- **Backend (`crm-backend/`):** Express + Sequelize API server. Contains Sequelize models, route handlers, JWT authentication middleware, and seed data.
- **API Routing**: Vite proxies `/crm/api/*` to `http://localhost:3002/api/*` during development.
- **AI Features**: Provider-agnostic AI integration supporting Gemini, OpenAI, Anthropic Claude, and custom OpenAI-compatible endpoints. AI settings are stored in `crm_ai_settings` with encrypted API keys.
- **Attendance Tracking**: Features agent clock-in/out with face capture and GPS location pings, mirroring PerformIQ's attendance functionality. Admins can review face captures for compliance.
- **Product Demand Intelligence**: Analyzes customer messages for product searches, demand trends, and "not available" responses.
- **Transcripts & Agent KPIs**: Provides searchable conversation transcripts and agent performance metrics with role-based access for setting KPI targets.
- **Mailgun Email Broadcasting**: Integration for sending email campaigns to customers, with configurable Mailgun settings and domain validation.
- **Customer Intelligence**: Keyword-based analysis of customer messages for top questions, issues, products mentioned, and compliance flags.
- **Channel Integrations**: Supports WhatsApp, Facebook, Instagram, Twitter/X, and Web Chat Widget. Multiple accounts per channel type are now supported (multi-account). Channels stored in `crm_channels` with optional `site_id` FK.
- **Payment Gateway Integration**: Settings → Payments supports Stripe, Paystack, Flutterwave, PayPal, and Square. Each provider stores public key, secret key (masked), webhook token, test/live mode toggle, and enabled state in `crm_payment_configs`. Backend provides test connection validation for each provider.
- **Multi-Site Support**: `crm_sites` table stores branches/regions. Channels can be assigned to a site (`siteId`). Agents can be assigned to multiple sites (`siteIds` JSON array). Settings → Sites section provides full CRUD for sites; Settings → Channels section shows multi-account management grouped by platform type with site assignment.

## Authentication:
- JWTs stored in `localStorage` as "token".
- All API calls include `Authorization: Bearer <token>`.
- Role hierarchy: `super_admin`(4) > `admin`(3) > `manager`(2) > `employee`(1).

## UI/UX Decisions:
- Both applications use React and Vite for a modern, responsive user experience.
- CommsCRM includes a sidebar navigation, KPI cards, charts, data tables with filtering, and modal dialogs for interactive features.
- Face capture for attendance uses webcam selfies with guided face oval and review mechanisms for compliance.
- CommsCRM Appearance/Branding: Admin-only Settings section for customizing app name, primary color, sidebar color, logo, and background image. BrandingSettings Sequelize model stores config in `crm_branding_settings`. BrandingContext applies CSS variables (--primary, --sidebar) to `document.documentElement` and exposes `setBrandingData()` for live sidebar updates without page reload. Logo and background are stored as base64 data URLs (max 8MB per upload).
- CommsCRM Super Admin & Menu Access: Role hierarchy is `super_admin` > `admin` > `supervisor` > `agent`. Agent model has `allowedMenus: string[] | null` column — `null` means full access; an array limits sidebar menus. Super admin account seeded as superadmin@commscrm.com / superadmin123. Admin page shows locked rows for super_admin/admin accounts; admins can assign per-user menu access via a modal with 14 checkboxes (Agent Tasks + Back Office categories). The sidebar filters nav items per `allowedMenus`. Menu slugs: dashboard, inbox, follow-ups, feedback, customers, clock-in, ai-chat, campaigns, analytics, intelligence, transcripts, product-demand, channels, settings.

# External Dependencies

- **PostgreSQL**: Primary database for both PerformIQ (via Drizzle ORM) and CommsCRM (via Sequelize).
- **Transactional Email Service**: Planned integration with services like Resend or SendGrid for email notifications. API key to be stored as a secret (e.g., `RESEND_API_KEY`).
- **AI Providers**: Gemini, OpenAI, Anthropic Claude, and custom OpenAI-compatible endpoints for CommsCRM's AI features.
- **Mailgun**: Used by CommsCRM for email broadcasting and campaign management.
- **Meta Webhooks**: For WhatsApp Business API, Facebook Messenger, and Instagram Direct integration within CommsCRM.
- **Google Maps**: For displaying GPS coordinates in attendance logs in CommsCRM.