# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Optional build-time arg — bakes the backend URL into the JS bundle.
# Pass via: docker build --build-arg NEXT_PUBLIC_BACKEND_URL=https://...
# If omitted, the app falls back to window.location.hostname:4000 (Docker Compose / LAN).
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

RUN npm run build

# ── Stage 2: run ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Bind to all interfaces inside the container
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output bundles only what's needed (no full node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
# public/ may be empty; create it first so COPY never fails
RUN mkdir -p ./public
COPY --from=builder /app/public           ./public

EXPOSE 3000

CMD ["node", "server.js"]
