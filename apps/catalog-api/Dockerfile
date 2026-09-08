# Build from the monorepo root:
# docker build -f apps/catalog-api/Dockerfile -t turnbased-catalog .
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/catalog-api/package.json ./apps/catalog-api/package.json
COPY apps/catalog-api/prisma ./apps/catalog-api/prisma
COPY apps/catalog-api/prisma.config.ts ./apps/catalog-api/prisma.config.ts
RUN npm ci --workspace @turnbased/catalog-api
COPY apps/catalog-api ./apps/catalog-api
RUN npm run build --workspace @turnbased/catalog-api

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/catalog-api/package.json ./apps/catalog-api/package.json
COPY --from=builder /app/apps/catalog-api/dist ./apps/catalog-api/dist
COPY --from=builder /app/apps/catalog-api/prisma ./apps/catalog-api/prisma
COPY --from=builder /app/apps/catalog-api/prisma.config.ts ./apps/catalog-api/prisma.config.ts
WORKDIR /app/apps/catalog-api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
EXPOSE 3100
CMD ["node", "dist/src/main.js"]
