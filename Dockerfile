# Base Stage: install deps, copy package files, generate Prisma client (no build)
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl postgresql-client
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Build Stage: install deps, generate Prisma client, and compile TypeScript
FROM base AS build
RUN npm ci
COPY . .
# Ensure your package.json or schema.prisma specifies 'binaryTargets = ["native", "linux-musl"]'
RUN npx prisma generate
RUN npm run build && chmod +x ./docker-entrypoint.sh

# Development Stage: use full build output + dev tools
FROM build AS development
ENV NODE_ENV=development
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# Production Stage: minimal runtime environment with prod deps and compiled output
# Production Stage: minimal runtime with only prod deps and compiled output
FROM base AS production
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]

# Test Stage: based on build to ensure same environment and tools
FROM build AS test
ENV NODE_ENV=test
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "test"]
