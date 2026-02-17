import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://gyiqdkmvlixwgedjhycc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_psIWS8xZmx4aCqVnzUFkyg_vjM1kPiz';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? (
  import.meta.env.DEV
    ? DEFAULT_SUPABASE_URL
    : (() => {
      throw new Error('[IronLog] VITE_SUPABASE_URL is required in production');
    })()
);
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? (
  import.meta.env.DEV
    ? DEFAULT_SUPABASE_ANON_KEY
    : (() => {
      throw new Error('[IronLog] VITE_SUPABASE_ANON_KEY is required in production');
    })()
);

// Module-level client — starts as unauthenticated, swapped on login/logout
let _client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Get the current Supabase client.
 * After setAuthToken() is called, this returns an authenticated client.
 */
export function getSupabase(): SupabaseClient {
  return _client;
}

/**
 * Set the Supabase JWT obtained from the token-exchange Edge Function.
 * Recreates the client with the JWT as Authorization header.
 */
export function setAuthToken(jwt: string) {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Clear the auth token (on logout). Resets to anon-key-only client.
 */
export function clearAuthToken() {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const uploadMediaToSupabase = async (blob: Blob, path: string) => {
  const { error } = await _client.storage
    .from('media')
    .upload(path, blob, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = _client.storage.from('media').getPublicUrl(path);
  return publicUrl;
};
