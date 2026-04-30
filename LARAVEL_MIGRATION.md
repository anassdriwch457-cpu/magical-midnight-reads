# Laravel Backend Migration

Project is being migrated from Supabase to a Laravel 11 + MySQL backend with Sanctum bearer-token auth. Migration is **incremental** — Supabase code still powers existing features until you swap them feature-by-feature.

## What's in place

- `src/lib/api.ts` — fetch wrapper. Reads `VITE_API_URL`, attaches `Authorization: Bearer <token>` from `localStorage`, throws typed `ApiError` on non-2xx.
- `src/lib/laravel-auth.tsx` — reference `LaravelAuthProvider` / `useLaravelAuth()` hitting `/login`, `/register`, `/logout`, `/user`.

## Configure

Set the API base URL (Coolify env var or `.env.local`):

```
VITE_API_URL=https://api.yourdomain.com/api
```

Defaults to `http://localhost:8000/api` if unset.

## Required Laravel endpoints (Sanctum)

```
POST /api/login            { email, password }                  -> { token, user }
POST /api/register         { name, email, password, password_confirmation } -> { token, user }
POST /api/logout           (auth:sanctum)                       -> 204
GET  /api/user             (auth:sanctum)                       -> user object
```

In your Laravel `routes/api.php`:

```php
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', fn (Request $r) => $r->user());
});
```

Make sure `config/cors.php` allows your frontend origin and the `Authorization` header.

## Migration pattern (per feature)

1. Build the Laravel endpoint(s).
2. In the React component, replace the `supabase.from(...)` call with `api.get/post/...`.
3. Replace `useAuth()` (Supabase) with `useLaravelAuth()` once `/login` works.
4. Delete the corresponding Supabase code only after the feature is fully migrated.

Example:

```ts
// Before
const { data } = await supabase.from("series").select("*").eq("slug", slug).single();

// After
const data = await api.get<Series>(`/series/${slug}`);
```

## Don't yet remove

These still depend on Supabase and will break if env vars are stripped:
- `src/lib/auth.tsx`, `src/integrations/supabase/*`
- `src/server/*.functions.ts`, `src/routes/api/public/stripe-webhook.ts`
- `src/routes/auth.tsx`, `src/routes/admin.tsx`, `src/routes/topup.tsx`, `src/routes/success.tsx`
- `src/routes/series.*`, `src/routes/browse.tsx`, `src/routes/index.tsx` (all read from Supabase)

Migrate them one at a time, then remove the Supabase client + `.env` entries last.
