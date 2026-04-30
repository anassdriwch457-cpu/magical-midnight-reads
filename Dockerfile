# Production Dockerfile for Coolify / any Docker-based host.
# Uses Bun (matches bun.lockb). Do NOT switch to npm — there is no package-lock.json.
# Builds in STANDALONE mode so the output is a Node-runnable server (dist/server/index.js
# + dist/client) instead of a Cloudflare Worker bundle.

FROM oven/bun:1.1 AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1 AS build
WORKDIR /app
ENV STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build:standalone

# Runtime stage uses Node (the server.mjs wrapper is plain Node, no Bun-only APIs).
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.mjs ./server.mjs

EXPOSE 3000
CMD ["node", "server.mjs"]
