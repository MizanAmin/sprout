# API server image — Bun runtime, built from the MONOREPO ROOT context.
# Railway: set the build context to the repo root and dockerfilePath to
# apps/api/Dockerfile (see railway.toml). The API runs TypeScript directly under
# Bun (no compile step). pnpm (via corepack) installs the workspace deps; we
# filter to @sprout/api + its workspace deps so the Expo/React-Native tree from
# apps/parent is never installed into this image.
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:/root/.bun/bin:${PATH}" \
    NODE_ENV=production
RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://bun.sh/install | bash
WORKDIR /app

# --- deps layer: copy lockfile + every workspace manifest (needed for
#     --frozen-lockfile validation), then install only the API's subtree. ---
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/ui/package.json ./packages/ui/
COPY apps/api/package.json ./apps/api/
COPY apps/staff/package.json ./apps/staff/
COPY apps/parent/package.json ./apps/parent/
RUN pnpm install --frozen-lockfile --filter @sprout/api...

# --- source: the API + the workspace packages it imports. ---
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS "http://localhost:${PORT:-3000}/health" || exit 1
CMD ["bun", "run", "src/index.ts"]
