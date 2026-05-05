# syntax=docker/dockerfile:1
# Build from repository root: docker build -f apps/worker/Dockerfile .
FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api/prisma apps/api/prisma
COPY apps/worker apps/worker
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @protect/shared build
# Prisma resolves the API package root from the schema path; without this file,
# prisma generate can try npx auto-install against /repo/apps and fail in Docker.
RUN printf '%s\n' '{"name":"@protect/api","private":true,"version":"0.0.0"}' > apps/api/package.json
RUN pnpm --filter @protect/worker run build

FROM base AS runner
RUN useradd -r -u 1001 -m protect
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/worker ./apps/worker
USER protect
WORKDIR /repo/apps/worker
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
