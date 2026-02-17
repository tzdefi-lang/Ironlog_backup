// Supabase Edge Function: Exchange Privy JWT for Supabase-compatible JWT
// Deploy: supabase functions deploy token-exchange --no-verify-jwt
// Secrets: supabase secrets set JWT_SECRET=<your-supabase-jwt-secret>

import { createRemoteJWKSet, jwtVerify, SignJWT } from 'npm:jose@5';

const PRIVY_APP_ID = Deno.env.get('PRIVY_APP_ID');
if (!PRIVY_APP_ID) {
  throw new Error('PRIVY_APP_ID not configured');
}
// App-scoped JWKS endpoint (well-known path returns 404 on current Privy auth domain).
const PRIVY_JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`;

// Cached JWKS for performance
const privyJWKS = createRemoteJWKSet(new URL(PRIVY_JWKS_URL));

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (ALLOWED_ORIGINS.length === 0) return '*';
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return ALLOWED_ORIGINS[0];
};

const createCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Vary': 'Origin',
});

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'));

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Verify the Privy access token using their JWKS (public key verification)
    const { payload } = await jwtVerify(token, privyJWKS, {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID,
    });

    const privyUserId = payload.sub;
    if (!privyUserId) {
      throw new Error('No sub claim in Privy token');
    }

    const email = extractEmail(payload);

    // 2. Convert Privy DID to a deterministic UUID
    //    (so user_id column can stay as uuid type in the database)
    const userId = await privyDidToUuid(privyUserId);

    // 3. Create a Supabase-compatible JWT signed with the project's JWT secret
    const jwtSecret =
      Deno.env.get('JWT_SECRET') ??
      Deno.env.get('SUPABASE_JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const expiresInSeconds = 3600; // 1 hour
    const now = Math.floor(Date.now() / 1000);

    const supabaseJwt = await new SignJWT({
      sub: userId,
      role: 'authenticated',
      iss: 'supabase',
      aud: 'authenticated',
      // Pass the original Privy DID as a custom claim for reference.
      privy_did: privyUserId,
      ...(email ? { email } : {}),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(now + expiresInSeconds)
      .sign(secret);

    return new Response(
      JSON.stringify({
        token: supabaseJwt,
        userId,
        expiresAt: (now + expiresInSeconds) * 1000, // ms for frontend
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Token exchange error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Token verification failed' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Convert a Privy DID (e.g. "did:privy:cmxxxxxxxxx") to a deterministic UUID.
 * Same input always produces the same UUID, so data stays consistent.
 */
async function privyDidToUuid(did: string): Promise<string> {
  const data = new TextEncoder().encode(did);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);

  // Set UUID version 4 and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

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

function extractEmail(payload: Record<string, unknown>): string | null {
  const directEmail = payload.email;
  if (typeof directEmail === 'string' && directEmail.trim()) {
    return directEmail.trim().toLowerCase();
  }

  const nestedUser = payload.user;
  if (nestedUser && typeof nestedUser === 'object') {
    const userEmail = (nestedUser as Record<string, unknown>).email;
    if (typeof userEmail === 'string' && userEmail.trim()) {
      return userEmail.trim().toLowerCase();
    }
  }

  const linkedAccountsRaw = payload.linked_accounts;
  if (linkedAccountsRaw) {
    const linkedAccounts = parseLinkedAccounts(linkedAccountsRaw);
    for (const account of linkedAccounts) {
      const type = typeof account.type === 'string' ? account.type : '';

      // Identity token "email" account shape.
      if (type === 'email' && typeof account.address === 'string' && account.address.trim()) {
        return account.address.trim().toLowerCase();
      }

      // OAuth account shape (Google/Github/etc.) often carries an email field.
      if (typeof account.email === 'string' && account.email.trim()) {
        return account.email.trim().toLowerCase();
      }

      // Fallback for providers that still use "address" for email-like identifiers.
      if (typeof account.address === 'string' && account.address.includes('@')) {
        return account.address.trim().toLowerCase();
      }
    }
  }

  return null;
}

function parseLinkedAccounts(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
      }
    } catch {
      return [];
    }
  }

  return [];
}
