# Deployment Guide — Project Nuvia / Paradise

This project is a TanStack Start v1 app (React 19 + Vite 7) with a Supabase-compatible backend. It deploys cleanly to any VPS, Cloudflare Workers, Node host, or any other provider that supports Node-compatible runtimes.

## 1. Environment Variables

All secrets are loaded from `import.meta.env` (browser/build-time) or `process.env` (server). **Nothing is hardcoded.**

Create a `.env` (or set them in your host's dashboard):

```bash
# Public (safe to ship to browser)
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...   # anon / publishable key
VITE_SUPABASE_PROJECT_ID=your-project-ref

# Server-only (NEVER expose to browser)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...        # admin operations
STRIPE_SECRET_KEY=sk_live_...                   # Stripe payments
```

## 2. Database Setup

The full production schema (tables, enums, RLS policies, functions, triggers, storage buckets) is exported to:

```
supabase/schema/full_schema.sql
```

To replicate on a fresh Supabase project:

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema/full_schema.sql
```

Or via the Supabase SQL editor: paste the file contents and run.

### Bootstrap the first super-admin

After signing up your admin user, run **once** (replace with the actual UUID from `auth.users`):

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<YOUR-AUTH-USER-UUID>', 'super_admin')
ON CONFLICT DO NOTHING;
```

The Admin page (`/admin`) will display this exact snippet pre-filled with your live `auth.uid()` if you visit it without a role — no hardcoded IDs anywhere in the codebase.

### Storage bucket

Create a public bucket named `chapter-images` (Storage → New bucket → public).

## 3. Build & Run

```bash
bun install
bun run build
bun run preview        # local production preview
```

Deploy the build output to any Node host or Cloudflare Workers (see `wrangler.jsonc`).

## 4. Caching & Performance

- **TanStack Query** (`@tanstack/react-query`) is wired through the router context — every page fetches via server functions and cached client-side.
- **Reader image optimization** uses native `loading="lazy"`, `decoding="async"`, `fetchPriority` priority hints, and CSS `content-visibility: auto` so off-screen pages don't paint.
- Updating a series in the database is reflected on the frontend on next route load (or call `router.invalidate()` for an immediate refresh) — no rebuild required.

## 5. Stripe

Add `STRIPE_SECRET_KEY` to your env. Webhooks live under `src/routes/api/public/` and verify signatures.
