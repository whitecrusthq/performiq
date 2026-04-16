#!/bin/bash

cd /home/runner/workspace/backend
npm run build 2>&1

export NODE_ENV=development
export PORT=3001
export FRONTEND_PORT=5000
export DATABASE_URL="$DATABASE_URL"
export JWT_SECRET="${JWT_SECRET:-performiq-dev-jwt-secret-2024}"

node --enable-source-maps ./dist/index.mjs
