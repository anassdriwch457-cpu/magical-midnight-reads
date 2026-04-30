import { makeLaravelQueryBuilder, laravelRpc } from "./laravel-data";
import { getAuthToken } from "./api";

/**
 * Laravel data client compatibility layer.
 * 
 * Provides a query-builder interface that routes all calls 
 * to the Laravel REST API via Axios.
 */
export const supabase = {
  from: (table: string) => makeLaravelQueryBuilder(table),
  rpc: (name: string, params: Record<string, any>) => laravelRpc(name, params),
  auth: {
    getSession: async () => ({
      data: {
        session: getAuthToken() ? { access_token: getAuthToken() } : null,
      },
      error: null,
    }),
  },
};

export type { Tables } from "./supabase-types-compat";
