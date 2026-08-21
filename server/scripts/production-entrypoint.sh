#!/bin/sh
set -eu

echo "Applying production database migrations..."
pnpm prisma migrate deploy

echo "Seeding system SOP templates..."
node prisma/seed-runtime.cjs

exec "$@"
