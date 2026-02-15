// Supabase Edge Function: Exchange Privy JWT for Supabase-compatible JWT
// Deploy: supabase functions deploy token-exchange --no-verify-jwt
// Secrets: supabase secrets set JWT_SECRET=<your-supabase-jwt-secret>

import { createRemoteJWKSet, jwtVerify, SignJWT } from 'npm:jose@5';

const PRIVY_APP_ID = Deno.env.get('PRIVY_APP_ID');
const PRIVY_APP_SECRET = Deno.env.get('PRIVY_APP_SECRET'); // Optional: enables server-side user lookup when token lacks user data.
if (!PRIVY_APP_ID) {
  throw new Error('PRIVY_APP_ID not configured');
}
// App-scoped JWKS endpoint (well-known path returns 404 on current Privy auth domain).
const PRIVY_JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`;

// Cached JWKS for performance
const privyJWKS = createRemoteJWKSet(new URL(PRIVY_JWKS_URL));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {
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

    // Access tokens do not include user data (email). Identity tokens do.
    // If an email isn't present in the token, optionally fetch it from Privy using the app secret.
    let email = extractEmail(payload);
    if (!email && PRIVY_APP_SECRET) {
      const fetchedUser = await fetchPrivyUser(privyUserId);
      email = fetchedUser ? extractEmail(fetchedUser) : null;
    }

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

async function fetchPrivyUser(userId: string): Promise<Record<string, unknown> | null> {
  if (!PRIVY_APP_SECRET) return null;

  try {
    // Privy REST API uses Basic Auth (appId:appSecret) + privy-app-id header.
    const basic = btoa(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`);
    const response = await fetch(`https://api.privy.io/v1/users/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basic}`,
        'privy-app-id': PRIVY_APP_ID,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Don't throw: we can still mint a JWT without email (admin functions will reject it).
      console.warn('Privy user lookup failed:', response.status);
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    return data as Record<string, unknown>;
  } catch (error) {
    console.warn('Privy user lookup error:', error);
    return null;
  }
}

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
  const directEmail = readEmailLike(payload.email);
  if (directEmail) return directEmail;

  const nestedUser = payload.user;
  if (nestedUser && typeof nestedUser === 'object') {
    const userEmail = readEmailLike((nestedUser as Record<string, unknown>).email);
    if (userEmail) return userEmail;

    // Some token shapes use "emailAddress" or an object with { address }.
    const altUserEmail = readEmailLike((nestedUser as Record<string, unknown>).emailAddress);
    if (altUserEmail) return altUserEmail;
  }

  const userMetadata = payload.user_metadata;
  if (userMetadata && typeof userMetadata === 'object') {
    const metaEmail = readEmailLike((userMetadata as Record<string, unknown>).email);
    if (metaEmail) return metaEmail;
  }

  // Privy tokens have used both snake_case and camelCase names here.
  const linkedAccountsCandidates = [
    (payload as Record<string, unknown>).linked_accounts,
    (payload as Record<string, unknown>).linkedAccounts,
  ].filter((value): value is unknown => value !== undefined && value !== null);

  for (const candidate of linkedAccountsCandidates) {
    const linkedAccounts = parseLinkedAccounts(candidate);
    for (const account of linkedAccounts) {
      const type = typeof account.type === 'string' ? account.type : '';

      // Identity token "email" account shape.
      if (type === 'email') {
        const addressEmail = readEmailLike(account.address);
        if (addressEmail) return addressEmail;
        const emailEmail = readEmailLike(account.email);
        if (emailEmail) return emailEmail;
      }

      // OAuth account shape (Google/Github/etc.) often carries an email field.
      const oauthEmail = readEmailLike(account.email);
      if (oauthEmail) return oauthEmail;

      // Fallback for providers that still use "address" for email-like identifiers.
      const addressFallback = readEmailLike(account.address);
      if (addressFallback) return addressFallback;
    }
  }

  return null;
}

function readEmailLike(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && trimmed.includes('@')) return trimmed.toLowerCase();
    return null;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const address = obj.address;
    if (typeof address === 'string') {
      const trimmed = address.trim();
      if (trimmed && trimmed.includes('@')) return trimmed.toLowerCase();
    }
    const email = obj.email;
    if (typeof email === 'string') {
      const trimmed = email.trim();
      if (trimmed && trimmed.includes('@')) return trimmed.toLowerCase();
    }
  }

  return null;
}

function parseLinkedAccounts(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  }

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const nested =
      (Array.isArray(obj.linked_accounts) && obj.linked_accounts) ||
      (Array.isArray(obj.linkedAccounts) && obj.linkedAccounts);
    if (nested) {
      return nested.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
    }
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
