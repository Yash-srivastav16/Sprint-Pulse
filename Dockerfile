# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for layer-cache efficiency
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all workspaces (dev deps needed for tsc + vite build)
RUN npm ci --workspace=packages/shared --workspace=apps/api --workspace=apps/web

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY apps/web/ ./apps/web/

# VITE_ vars are baked into the static bundle at build time. Values come
# from apps/web/.env.production (read automatically by Vite when building
# in production mode). The anon key and Supabase URL are public values, so
# committing them in .env.production is intentional. .dockerignore lets the
# file through despite blocking other .env.*.
#
# To override at build time without editing the file, pass build-args and
# expose them as env to the build step, e.g.:
#   docker build --build-arg VITE_API_URL=https://api.example.com .
# Then add `ENV VITE_API_URL=$VITE_API_URL` here and re-wire RUN.
# Currently we rely on the committed .env.production for consistency.

# Build order: shared types → React app → Express API
RUN npm run build -w packages/shared
RUN npm run build -w apps/web
RUN npm run build -w apps/api

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests for production install
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Production deps only — no devDeps
RUN npm ci --workspace=apps/api --omit=dev

# Copy compiled outputs from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Bake apps/api/.env.production into the image. config/env.ts auto-loads it
# when NODE_ENV=production. The glob keeps the build non-fatal if the file
# isn't checked in yet (local builds before the prod file is created).
# WARNING: this puts secrets in the image. Acceptable only because the
# SemicoLabs deploy platform builds from the pushed git repo and doesn't
# expose a runtime env-var injection UI. Rotate keys after teardown.
COPY apps/api/.env.production* ./apps/api/

EXPOSE 8000

# -T 4 = busybox wget timeout in seconds, aligns with HEALTHCHECK --timeout=5s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- -T 4 http://localhost:8000/api/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
