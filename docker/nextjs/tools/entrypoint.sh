#!/bin/sh

set -eu

POSTGRES_PASSWORD="$(cat /run/secrets/db_password)"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
export BETTER_AUTH_SECRET="$(cat /run/secrets/better_auth_secret)"

if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm ci
fi

npx prisma generate
npx prisma migrate deploy
exec "$@"
