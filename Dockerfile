# Base Stage: install deps, copy package files, generate Prisma client (no build)
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl postgresql-client
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Development Stage: install all dependencies + copy all source + generate Prisma client
FROM base AS development
RUN npm ci
COPY . .
RUN chmod +x ./docker-entrypoint.sh
RUN npx prisma generate
ENV NODE_ENV=development
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# Build Stage: build the application based on development stage
FROM development AS build
RUN npm run build
# Ensure your package.json or schema.prisma specifies 'binaryTargets = ["native", "linux-musl"]'
RUN npx prisma generate

# Production Stage: minimal runtime environment with prod deps and compiled output
FROM base AS production
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh
# Ensure scripts are executable in the final image
RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]

# Test Stage: full dev deps, build app, run tests (unit + e2e)
FROM development AS test
ENV NODE_ENV=test
RUN npm run build
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "test"]
