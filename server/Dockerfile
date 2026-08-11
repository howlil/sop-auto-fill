# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS dev-deps
RUN pnpm install --frozen-lockfile

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod

FROM dev-deps AS builder
COPY . .
# Prisma generate tidak membutuhkan koneksi database. URL dummy hanya berlaku saat build.
RUN DATABASE_URL=mysql://prisma_generate:prisma_generate@127.0.0.1:3306/prisma_generate pnpm prisma generate
RUN pnpm build && test -f dist/src/main.js

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget \
  && corepack enable \
  && corepack prepare pnpm@10.28.2 --activate \
  && mkdir -p /app/storage/sop-pdf \
  && chown -R node:node /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
# Custom Prisma output berada di src/generated dan berisi JS/WASM runtime.
# Salin eksplisit agar tidak bergantung pada perilaku copy asset compiler Nest.
COPY --from=builder --chown=node:node /app/src/generated/prisma ./dist/src/generated/prisma
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3001
CMD ["pnpm", "start:prod"]
