# Production Dockerfile for Coolify / any Docker-based host.
# Uses Bun (matches bun.lockb). Do NOT switch to npm — there is no package-lock.json.

FROM oven/bun:1.1 AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["bun", "run", "dist/server/index.mjs"]
