# Laravel Backend Integration

The frontend automatically switches data source based on env vars:

| `VITE_API_URL` set | `VITE_SUPABASE_URL` set | Mode |
|---|---|---|
| ✅ | — | **Laravel** (live API) |
| — | ✅ | Supabase (legacy) |
| — | — | **Mock** (offline preview) |

Set on Coolify / VPS:
```env
VITE_API_URL=https://api.your-domain.com/api
```

## Required Laravel endpoints

All authenticated endpoints expect `Authorization: Bearer <sanctum_token>`.

### Auth
- `POST /login`     `{ email, password }` → `{ token, user: { id, name, email } }`
- `POST /register`  `{ name, email, password, password_confirmation }` → `{ token, user }`
- `POST /logout`    → 204
- `GET  /user`      → `{ id, name, email, ... }`

### Content (public)
- `GET /series`
  Query params: `type`, `status`, `genre`, `q`, `sort`, `dir`, `page`, `per_page`, `trending`, `popular`, `exclude_id`, `ids`, `slug`
  Returns: `{ data: Series[], total: number }` or `Series[]`
- `GET /series/{seriesId}/chapters` → `Chapter[]`
- `GET /chapters/{id}/pages` → `Page[]` (manga pages)
- `GET /site-settings` → `{ site_name, seo_description }`

### Wallet & unlocks (authenticated)
- `GET  /wallet/balance`        → `{ coins: number }`
- `GET  /user/unlocks`          → `[{ chapter_id }]`
- `GET  /user/roles`            → `[{ role }]`
- `POST /chapters/{id}/unlock`  → `{ success, balance, error? }`

## Field shapes (Series / Chapter)

The frontend reads these fields directly — keep names identical:

```ts
Series  { id, slug, title, type:'manga'|'novel', status:'ongoing'|'completed'|'hiatus',
          author?, artist?, description, cover_url, banner_url?, genres: string[],
          is_trending, is_popular, views, rating, created_at, updated_at }

Chapter { id, series_id, number, title?, content?, price, created_at, updated_at }

Page    { id, chapter_id, page_number, image_url }
```

## Error handling

- Non-2xx and network failures throw `ApiError` (see `src/lib/api.ts`).
- 5xx + network errors trigger a global toast ("Service temporarily unavailable").
- 401 auto-clears the bearer token.
- Query builder calls (`supabase.from(...)`) return `{ data: [], error: { message } }` on failure — UI degrades to empty states instead of crashing.
