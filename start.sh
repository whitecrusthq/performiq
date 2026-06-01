#!/bin/bash

cd /home/runner/workspace/backend

export FRONTEND_PORT=5000
export DATABASE_URL="$DATABASE_URL"
export JWT_SECRET="${JWT_SECRET:-performiq-dev-jwt-secret-2024}"

if [ "$REPLIT_DEPLOYMENT" = "1" ]; then
  # Production (autoscale deployment): the frontend is built by the deployment
  # build step and served statically by Express. No Vite dev server runs here.
  # Express listens on the public port (5000 -> external 80) and serves both the
  # SPA and the API (including PUT /api/storage/proxy-upload).
  export NODE_ENV=production
  export PORT="${PORT:-5000}"
else
  # Development: build the backend, run it on 3001, and let it spawn the Vite dev
  # server on 5000 (with HMR) which proxies /api back to the backend.
  npm run build 2>&1
  export NODE_ENV=development
  export PORT=3001
fi

exec node --enable-source-maps ./dist/index.mjs
