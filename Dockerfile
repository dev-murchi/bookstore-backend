FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build


FROM node:22-alpine AS production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY docker-entrypoint.sh .

# Optional cleanup of Prisma binaries to reduce size
RUN rm -rf node_modules/.prisma/client/libquery_engine* \
           node_modules/.prisma/client/query_engine-* \
           node_modules/.prisma/client/schema-engine* || true

RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["./docker-entrypoint.sh"]
