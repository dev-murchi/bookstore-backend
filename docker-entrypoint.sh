#!/bin/sh
set -e

echo "Starting Docker entrypoint..."
echo "Waiting for PostgreSQL and Redis..."

# Wait for PostgreSQL
until nc -z ${DB_HOST:-postgres_container} 5432; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done

# Wait for Redis
until nc -z ${REDIS_HOST:-redis_container} ${REDIS_PORT:-6379}; do
  echo "Waiting for Redis..."
  sleep 1
done

echo "PostgreSQL and Redis are ready."

# Conditional Prisma operations based on NODE_ENV
if [ "$NODE_ENV" = "development" ] || [ "$NODE_ENV" = "test" ]; then
  echo "Running Prisma db push and seed for $NODE_ENV environment..."
  # For development and test, db push is often used for quick schema sync.
  # --force-reset can be added if you want to ensure a clean state on every start (use with caution).
  npx prisma migrate dev --name init
  npx ts-node prisma/seed.ts
elif [ "$NODE_ENV" = "production" ]; then
  echo "Running Prisma migrations for production environment..."
  # In production, always use migrate deploy to apply version-controlled migrations.
  npx prisma migrate deploy
fi

echo "Prisma operations complete. Executing main command..."
# Execute the main command passed to CMD (e.g., npm run start:dev, node dist/main.js, npm run test)
exec "$@"