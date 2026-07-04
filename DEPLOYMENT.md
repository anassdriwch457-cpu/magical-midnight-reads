# Deployment Guide — Project Nuvia / Paradise

This is a **TanStack Start v1** app (React 19 + Vite 7) with full SSR and server functions. It is **not** a static SPA — there is no plain `dist/` folder you can serve from a static host. The build produces a server bundle plus client assets.

## 1. Supported Deploy Targets

| Target | Status | Notes |
|---|---|---|
| **Cloudflare Workers** | ✅ Default | Wired via `wrangler.jsonc` + `@cloudflare/vite-plugin`. Run `bun run build` then `wrangler deploy`. |
| **Vercel** | ✅ Supported | Use TanStack Start's Vercel preset. See section 6. |
| **Netlify (with Functions)** | ✅ Supported | Wired via `@netlify/vite-plugin-tanstack-start` + `netlify.toml`. See section 7. |
| **Any Node host (VPS, Fly, Render)** | ✅ Supported | Build with the Node preset and run the server entry. |
| **Static-only (Netlify/GitHub Pages serving `dist/`)** | ❌ Not supported | SSR + server functions + Stripe webhooks require a server runtime. |

## 2. Environment Variables — naming rules

**This split is a security boundary. Do NOT rename server secrets to `VITE_*` — Vite would inline them into the browser bundle and leak them to every visitor.**

### Public — `VITE_` prefix (safe to ship to browser)
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...     # anon / publishable key
VITE_SUPABASE_PROJECT_ID=your-project-ref
```

### Server-only — NO prefix (never sent to browser)
```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...          # bypasses RLS
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...                  # required for live webhook
```

All code already follows this convention — `import.meta.env.VITE_*` for client, `process.env.*` inside `createServerFn` and server routes.

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

There is no separate `dist/` output to upload — the deploy preset (Cloudflare/Vercel/Node) decides the output layout.

## 4. Database Setup

Full schema lives in `supabase/schema/full_schema.sql`. Apply it once on a fresh project:

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema/full_schema.sql
```

Bootstrap the first super-admin (after signing up):

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<YOUR-AUTH-USER-UUID>', 'super_admin')
ON CONFLICT DO NOTHING;
```

Create a public storage bucket named `chapter-images`.

## 5. Stripe — Live Webhook

The production webhook route lives at:

```
src/routes/api/public/stripe-webhook.ts   →   POST /api/public/stripe-webhook
```

It verifies signatures with `stripe.webhooks.constructEventAsync` (Web-Crypto-based, works on Workers / Edge / Node), then credits coins idempotently into `wallets` via `coin_purchase_sessions`.

### Configure the webhook in Stripe (Live mode)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://<your-production-domain>/api/public/stripe-webhook`
3. Listen to events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
4. Copy the **Signing secret** (`whsec_...`) and add it as `STRIPE_WEBHOOK_SECRET` in your host's env vars.
5. Switch from Test → **Live** mode in the dashboard and repeat for the live endpoint.

### Local testing

```bash
stripe listen --forward-to localhost:8080/api/public/stripe-webhook
# Copy the printed whsec_... into STRIPE_WEBHOOK_SECRET in .env
stripe trigger checkout.session.completed
```

## 6. Vercel Deployment

Vercel does not serve a static `dist/` — it runs the SSR server as a Node/Edge function via TanStack Start's Vercel preset.

1. Remove `@cloudflare/vite-plugin` from your `vite.config.ts` flow (or use the Vercel preset alongside).
2. In the Vercel dashboard → **Project → Settings → Environment Variables**, add **all** the env vars from section 2.
3. Build command: `bun run build`
4. Install command: `bun install`
5. Output directory: leave **blank** — TanStack Start's adapter manages the output layout. Do not set it to `dist`.
6. After first deploy, point the Stripe live webhook at `https://<project>.vercel.app/api/public/stripe-webhook`.

## 7. Netlify Deployment (SSR via Functions)

This project ships with a `netlify.toml` and the official `@netlify/vite-plugin-tanstack-start` adapter. SSR, server functions, and the Stripe webhook all run as Netlify serverless functions — there is no static-only fallback.

### ⚠️ Do NOT add `public/_redirects`

Do **not** create a `_redirects` file with `/* /index.html 200`. This project has no `index.html` shell; routing is handled by the SSR function. A SPA-style catch-all redirect would intercept every request (including `/api/public/stripe-webhook`) and break the site.

### Steps

1. The Netlify plugin is already wired in `vite.config.ts` and only activates when `NETLIFY=true` (set by Netlify's build environment, also set in `netlify.toml`). Local Cloudflare/Lovable builds are unaffected.
2. In the Netlify dashboard → **Site settings → Environment variables**, add every variable from section 2 (both the `VITE_*` public ones AND the unprefixed server secrets including `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`).
3. Build command: `vite build`  ·  Publish directory: `dist/client`  ·  Functions are auto-detected by the plugin.
4. Deploy: `npx netlify deploy --build --prod` (or push to a branch connected to the site).
5. After first deploy, point the Stripe live webhook at `https://<your-site>.netlify.app/api/public/stripe-webhook`.

### Automatic deploys from git

The repo includes `.github/workflows/auto-deploy.yml`:
- runs on pushes to `main`
- installs with Node 20 + `npm ci`
- builds the app
- deploys to Netlify when both secrets are present:
  - `NETLIFY_AUTH_TOKEN`
  - `NETLIFY_SITE_ID`

If those secrets are missing, the workflow still builds and skips the deploy step.

### Verify routing works

After deploy, hard-refresh `/series/<slug>`, `/topup`, and any other deep link. They should all render correctly. If a route 404s, the route file under `src/routes/` is missing — fix the route file, do not add a `_redirects` rewrite.

## 8. Caching & Performance

- `@tanstack/react-query` is wired through router context — DB updates show on next route load (or `router.invalidate()` for instant refresh). No rebuild needed.
- Reader uses `loading="lazy"`, `decoding="async"`, `fetchPriority`, and CSS `content-visibility: auto`.

## Coolify / VPS / Standalone Docker Deployment

This project uses **bun** (see `bun.lockb`). There is no `package-lock.json`, so `npm ci` will fail.

For VPS / Coolify / any non-Cloudflare host the build runs in **standalone** mode:
- `STANDALONE=true` is set during the build → the bundled Cloudflare plugin is disabled.
- Output is a Node-runnable bundle: `dist/server/server.js` (SSR fetch handler, ESM default export) + `dist/client/` (static assets).
- A small Node wrapper (`server.mjs`, committed at the repo root) imports that handler, serves `dist/client/*` as static files, and forwards everything else to SSR.
- The wrapper listens on `HOST`:`PORT` (defaults `0.0.0.0:3000`) and accepts **any** `Host` header, so reverse-proxy hostnames like `*.sslip.io`, custom domains, and Coolify ingress all work without configuration.

Two ready-to-use configs are included:

1. **Nixpacks** (Coolify default): `nixpacks.toml` sets `STANDALONE=true`, runs `bun install --frozen-lockfile` + `bun run build:standalone`, and starts with `node server.mjs`.
2. **Dockerfile**: multi-stage build (Bun for install/build, slim Node 20 for runtime). In Coolify set Build Pack = `Dockerfile`. Exposes port `3000`.

### Build & start scripts

```jsonc
"build": "vite build",                              // default (Cloudflare-compatible)
"build:standalone": "STANDALONE=true vite build",   // Node/Bun output for VPS
"start": "HOST=0.0.0.0 PORT=3000 node server.mjs"
```

### Required env vars (Coolify dashboard)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- any other `VITE_*` keys used by the app
- (optional) `PORT`, `HOST` — override the defaults above

### Allowed hosts

`vite.config.ts` sets `server.allowedHosts: true` and `preview.allowedHosts: true`, so `vite dev` and `vite preview` also accept arbitrary host headers. The production server (`server.mjs`) does not enforce host checks at all — Coolify's reverse proxy hostname (`*.sslip.io`, custom domains) will not be blocked.

> Do **not** add `package-lock.json` — keep `bun.lockb` as the single source of truth.
> Do **not** move or rename `server.mjs` — both `nixpacks.toml` and the `Dockerfile` reference it at the repo root.
