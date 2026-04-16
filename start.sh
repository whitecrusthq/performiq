#!/bin/bash
set -e

# Start CommsCRM backend on port 3001
cd /home/runner/workspace/backend
export $(cat .env | xargs) 2>/dev/null || true
node --enable-source-maps ./dist/index.mjs &
CRM_BACKEND_PID=$!

# Start PerformIQ backend on port 8080
cd /home/runner/workspace/performiq-backend
export $(cat .env | xargs) 2>/dev/null || true
node --enable-source-maps ./dist/index.mjs &
PERFORMIQ_BACKEND_PID=$!

# Give backends a moment to start
sleep 2

# Start CommsCRM frontend on port 5000
cd /home/runner/workspace/frontend
PORT=5000 npx vite --config vite.config.ts --host 0.0.0.0 --port 5000

# If frontend exits, kill backends
kill $CRM_BACKEND_PID $PERFORMIQ_BACKEND_PID 2>/dev/null || true
