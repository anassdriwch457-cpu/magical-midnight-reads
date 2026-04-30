# Deployment Guide — Project Nuvia / Paradise

This is a **TanStack Start v1** app (React 19 + Vite 7) with full SSR and server functions. It connects to a **Laravel REST API** backend.

## 1. Supported Deploy Targets

| Target | Status | Notes |
|---|---|---|
| **Cloudflare Workers** | ✅ Default | Wired via `wrangler.jsonc` + `@cloudflare/vite-plugin`. Run `bun run build` then `wrangler deploy`. |
| **Vercel** | ✅ Supported | Use TanStack Start's Vercel preset. |
| **Netlify (with Functions)** | ✅ Supported | Wired via `@netlify/vite-plugin-tanstack-start` + `netlify.toml`. |
| **Any Node host (VPS, Fly, Render)** | ✅ Supported | Build with the Node preset and run the server entry. |

## 2. Environment Variables

### Public — `VITE_` prefix (safe to ship to browser)
```
VITE_API_URL=http://31.172.87.75:8000/api
```

## 3. Build Scripts

```jsonc
// package.json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",       // produces both server bundle and client assets
  "build:dev": "vite build --mode development",
  "preview": "vite preview"
}
```

## 4. Backend Setup

This application expects a Laravel backend at the configured `VITE_API_URL` with the following endpoints:

- `POST /api/login` - Authenticate user and return Bearer token.
- `POST /api/register` - Register new user and return Bearer token.
- `GET /api/user` - Get current authenticated user details (including `coin_balance` and `roles`).
- `GET /api/series` - List manga/novel series.
- `GET /api/series/{slug}` - Get series details.
- `POST /api/unlock-chapter` - Unlock a premium chapter using coins.
