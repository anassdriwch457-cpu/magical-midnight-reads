/**
 * Laravel data adapter — translates the supabase-style query builder used
 * across the UI into REST calls against the Laravel API.
 *
 * Endpoint contract (adjust on Laravel side to match):
 *   GET  /series                       ?type=&status=&genre=&q=&sort=&page=&per_page=&trending=&popular=
 *        -> { data: Series[], total: number } OR Series[]
 *   GET  /series/{slugOrId}            -> Series
 *   GET  /series/{seriesId}/chapters   -> Chapter[]
 *   GET  /chapters/{id}/pages          -> Page[]
 *   GET  /user/unlocks                 -> [{ chapter_id }]
 *   POST /chapters/{id}/unlock         -> { success, balance, error? }
 *   GET  /wallet/balance               -> { coins }
 *   GET  /user/roles                   -> [{ role }]
 *   GET  /site-settings                -> { site_name, seo_description, ... }
 *   POST /login    { email, password } -> { token, user }
 *   POST /register { name, email, password } -> { token, user }
 *   POST /logout                       -> 204
 *   GET  /user                         -> User
 */
import { api, ApiError } from "@/lib/api";
import { mockSeries, mockChapters, mockSiteSettings } from "@/lib/mock-data";

type Row = Record<string, unknown>;

/** Return mock rows for a table — used as graceful fallback when API is down. */
function mockFallback(table: string): Row[] {
  switch (table) {
    case "series": return mockSeries as unknown as Row[];
    case "chapters": return mockChapters as unknown as Row[];
    case "site_settings": return [mockSiteSettings] as unknown as Row[];
    default: return [];
  }
}

/** True if the error means the backend is unreachable / down (not a real app error). */
function isBackendDown(e: unknown): boolean {
  if (e instanceof ApiError) {
    // 0 = network error, 5xx = server down, 404 = endpoint missing on backend
    return e.status === 0 || e.status >= 500 || e.status === 404;
  }
  return true;
}

interface QueryState {
  table: string;
  filters: Array<{ kind: "eq" | "in" | "ilike" | "contains" | "neq"; col: string; val: unknown }>;
  order?: { col: string; ascending: boolean };
  limit?: number;
  rangeFrom?: number;
  rangeTo?: number;
  countMode?: boolean;
}

function getEq(state: QueryState, col: string): unknown {
  return state.filters.find((f) => f.kind === "eq" && f.col === col)?.val;
}

function buildSeriesQuery(state: QueryState): string {
  const params = new URLSearchParams();
  for (const f of state.filters) {
    if (f.kind === "eq") {
      if (f.col === "is_trending" && f.val) params.set("trending", "1");
      else if (f.col === "is_popular" && f.val) params.set("popular", "1");
      else if (f.col === "type") params.set("type", String(f.val));
      else if (f.col === "status") params.set("status", String(f.val));
      else if (f.col === "slug") params.set("slug", String(f.val));
      else if (f.col === "id") params.set("id", String(f.val));
    } else if (f.kind === "neq" && f.col === "id") {
      params.set("exclude_id", String(f.val));
    } else if (f.kind === "ilike" && f.col === "title") {
      params.set("q", String(f.val).replace(/%/g, ""));
    } else if (f.kind === "contains" && f.col === "genres" && Array.isArray(f.val)) {
      params.set("genre", String((f.val as unknown[])[0] ?? ""));
    } else if (f.kind === "in" && f.col === "id" && Array.isArray(f.val)) {
      params.set("ids", (f.val as unknown[]).join(","));
    }
  }
  if (state.order) {
    params.set("sort", state.order.col);
    params.set("dir", state.order.ascending ? "asc" : "desc");
  }
  if (state.rangeFrom != null && state.rangeTo != null) {
    const perPage = state.rangeTo - state.rangeFrom + 1;
    const page = Math.floor(state.rangeFrom / perPage) + 1;
    params.set("page", String(page));
    params.set("per_page", String(perPage));
  } else if (state.limit) {
    params.set("per_page", String(state.limit));
  }
  return params.toString();
}

async function fetchTable(state: QueryState): Promise<{ data: Row[]; count: number }> {
  switch (state.table) {
    case "series": {
      const qs = buildSeriesQuery(state);
      const res = await api.get<unknown>(`/series${qs ? `?${qs}` : ""}`, { silent: true });
      const { rows, total } = unwrapList(res);
      return { data: rows, count: total };
    }
    case "chapters": {
      const seriesId = getEq(state, "series_id");
      const inIds = state.filters.find((f) => f.kind === "in" && f.col === "series_id")?.val;
      if (seriesId) {
        const res = await api.get<unknown>(`/series/${seriesId}/chapters`, { silent: true });
        const { rows } = unwrapList(res);
        return { data: rows, count: rows.length };
      }
      if (Array.isArray(inIds)) {
        const all = await Promise.all(
          (inIds as unknown[]).map((id) =>
            api.get<unknown>(`/series/${id}/chapters`, { silent: true }).catch(() => [])
          ),
        );
        const flat = all.flatMap((r) => unwrapList(r).rows);
        return { data: flat, count: flat.length };
      }
      return { data: [], count: 0 };
    }
    case "chapter_pages": {
      const chapterId = getEq(state, "chapter_id");
      if (!chapterId) return { data: [], count: 0 };
      const res = await api.get<unknown>(`/chapters/${chapterId}/pages`, { silent: true });
      const { rows } = unwrapList(res);
      return { data: rows, count: rows.length };
    }
    case "chapter_unlocks": {
      const res = await api.get<unknown>(`/user/unlocks`, { silent: true }).catch(() => []);
      const { rows } = unwrapList(res);
      return { data: rows, count: rows.length };
    }
    case "wallets": {
      const res = await api.get<{ coins?: number }>(`/wallet/balance`, { silent: true }).catch(() => ({ coins: 0 }));
      return { data: [{ coins: res?.coins ?? 0 }], count: 1 };
    }
    case "user_roles": {
      const res = await api.get<unknown>(`/user/roles`, { silent: true }).catch(() => []);
      const { rows } = unwrapList(res);
      return { data: rows, count: rows.length };
    }
    case "site_settings": {
      const res = await api.get<Row>(`/site-settings`, { silent: true }).catch(() => null);
      return { data: res ? [res] : [], count: res ? 1 : 0 };
    }
    default:
      return { data: [], count: 0 };
  }
}

function unwrapList(res: unknown): { rows: Row[]; total: number } {
  if (Array.isArray(res)) return { rows: res as Row[], total: res.length };
  if (res && typeof res === "object" && "data" in res && Array.isArray((res as { data: unknown }).data)) {
    const obj = res as { data: Row[]; total?: number; meta?: { total?: number } };
    return { rows: obj.data, total: obj.total ?? obj.meta?.total ?? obj.data.length };
  }
  return { rows: [], total: 0 };
}

/** Build a query builder mimicking the supabase-js API surface used by the UI. */
export function makeLaravelQueryBuilder(table: string) {
  const state: QueryState = { table, filters: [] };

  let warned = false;
  const exec = async () => {
    try {
      const r = await fetchTable(state);
      // If backend returned empty for a table that has mock data, also fall back
      // so the UI never renders blank when the API is misconfigured.
      if (r.data.length === 0 && mockFallback(state.table).length > 0) {
        return { data: mockFallback(state.table), count: mockFallback(state.table).length };
      }
      return r;
    } catch (e) {
      if (isBackendDown(e)) {
        if (!warned && typeof console !== "undefined") {
          console.warn(`[DataClient] Laravel API unavailable for "${state.table}", using mock data.`, e);
          warned = true;
        }
        const rows = mockFallback(state.table);
        return { data: rows, count: rows.length };
      }
      if (e instanceof ApiError) {
        return { data: [] as Row[], count: 0, error: { message: e.message } };
      }
      throw e;
    }
  };

  const builder: Record<string, unknown> = {
    select: (_cols?: string, opts?: { count?: string }) => {
      if (opts?.count) state.countMode = true;
      return builder;
    },
    eq: (col: string, val: unknown) => { state.filters.push({ kind: "eq", col, val }); return builder; },
    neq: (col: string, val: unknown) => { state.filters.push({ kind: "neq", col, val }); return builder; },
    in: (col: string, val: unknown[]) => { state.filters.push({ kind: "in", col, val }); return builder; },
    ilike: (col: string, val: string) => { state.filters.push({ kind: "ilike", col, val }); return builder; },
    contains: (col: string, val: unknown) => { state.filters.push({ kind: "contains", col, val }); return builder; },
    order: (col: string, opts?: { ascending?: boolean }) => {
      state.order = { col, ascending: opts?.ascending !== false }; return builder;
    },
    limit: (n: number) => { state.limit = n; return builder; },
    range: (from: number, to: number) => { state.rangeFrom = from; state.rangeTo = to; return builder; },
    maybeSingle: async () => {
      const { data } = await exec();
      return { data: data[0] ?? null, error: null, count: null };
    },
    single: async () => {
      const { data } = await exec();
      return { data: data[0] ?? null, error: null, count: null };
    },
    then: (onF: (v: { data: Row[]; error: null | { message: string }; count: number }) => unknown,
           onR?: (e: unknown) => unknown) => exec().then((r) => onF({ data: r.data, error: (r as { error?: { message: string } }).error ?? null, count: r.count }), onR),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
  };
  return builder;
}

export async function laravelRpc(name: string, params: Record<string, unknown>) {
  if (name === "unlock_chapter") {
    const id = params._chapter_id;
    try {
      const r = await api.post<{ success: boolean; balance?: number; error?: string }>(
        `/chapters/${id}/unlock`,
      );
      return { data: r, error: null };
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Unlock failed";
      return { data: { success: false, error: msg }, error: null };
    }
  }
  return { data: null, error: { message: `Unknown RPC: ${name}` } };
}
