// Auth service: Exchange Privy access token for Supabase JWT via Edge Function

const DEFAULT_SUPABASE_URL = 'https://gyiqdkmvlixwgedjhycc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_psIWS8xZmx4aCqVnzUFkyg_vjM1kPiz';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const TOKEN_EXCHANGE_URL = `${SUPABASE_URL}/functions/v1/token-exchange`;

interface TokenExchangeResult {
  token: string;
  userId: string;    // Deterministic UUID derived from Privy DID
  expiresAt: number; // Expiry timestamp in ms
}

let cachedResult: TokenExchangeResult | null = null;
let cachedSourceToken: string | null = null;

/**
 * Exchange a Privy access token for a Supabase-compatible JWT.
 * Caches the result and reuses it until 5 minutes before expiry.
 */
export async function exchangePrivyToken(privyAccessToken: string): Promise<TokenExchangeResult> {
  // Return cached token if still valid (with 5-minute buffer)
  if (
    cachedResult &&
    cachedSourceToken === privyAccessToken &&
    Date.now() < cachedResult.expiresAt - 5 * 60 * 1000
  ) {
    return cachedResult;
  }

  const response = await fetch(TOKEN_EXCHANGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase Edge Functions require the anon key for unauthenticated calls
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ token: privyAccessToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Token exchange failed: ${error.error || 'Unknown error'}`);
  }

  const result: TokenExchangeResult = await response.json();
  cachedResult = result;
  cachedSourceToken = privyAccessToken;
  return result;
}

/**
 * Clear the cached token (call on logout).
 */
export function clearTokenCache() {
  cachedResult = null;
  cachedSourceToken = null;
}

/**
 * Convert a Privy DID to a deterministic UUID (matching the Edge Function logic).
 * Used to derive user.id on the frontend without calling the Edge Function.
 */
export async function privyDidToUuid(did: string): Promise<string> {
  const data = new TextEncoder().encode(did);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes.slice(0, 16)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
