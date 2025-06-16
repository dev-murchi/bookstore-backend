#!/bin/sh

set -e

echo "Waiting for PostgreSQL and Redis..."

# Wait for PostgreSQL
until nc -z ${POSTGRES_HOST:-postgres_container} 5432; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done

# Wait for Redis
until nc -z ${REDIS_HOST:-redis_container} ${REDIS_PORT:-6379}; do
  echo "Waiting for Redis..."
  sleep 1
done

echo "PostgreSQL and Redis are ready."

# Run Prisma migrations or schema sync
echo "Running Prisma generate and db push..."
npx prisma generate
npx prisma db push

# Seed the database
echo "Running seed script..."
node dist/prisma/seed.js

# Start the application
echo "Starting NestJS app..."
exec node dist/src/main
