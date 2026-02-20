import { createClient } from 'npm:@supabase/supabase-js@2';
import { jwtVerify } from 'npm:jose@5';

type SupportedTable = 'workouts' | 'exercise_defs' | 'workout_templates';
type SupportedAction = 'upsert' | 'delete';

type SyncOperationRequest = {
  idempotencyKey: string;
  table: SupportedTable;
  action: SupportedAction;
  payload: Record<string, unknown>;
};

type SyncReceiptRow = {
  user_id: string;
  idempotency_key: string;
  table_name: string;
  action: string;
  payload_hash: string;
  applied: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET');

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required');
}
if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET (or SUPABASE_JWT_SECRET) is required');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  let userId = '';
  let idempotencyKey = '';

  try {
    userId = await verifyUser(req);
    const body = await req.json().catch(() => null);
    const parsed = parseRequest(body);
    idempotencyKey = parsed.idempotencyKey;

    const payloadHash = await hashPayload(parsed.payload);
    const existing = await fetchReceipt(userId, parsed.idempotencyKey);

    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        throw new RequestError('idempotencyKey already used with a different payload', 409);
      }
      if (existing.applied) {
        return jsonOk({
          applied: false,
          deduped: true,
          idempotencyKey: parsed.idempotencyKey,
          table: parsed.table,
          action: parsed.action,
        });
      }
    } else {
      const inserted = await insertPendingReceipt(userId, parsed, payloadHash);
      if (!inserted) {
        const afterConflict = await fetchReceipt(userId, parsed.idempotencyKey);
        if (afterConflict && afterConflict.payload_hash !== payloadHash) {
          throw new RequestError('idempotencyKey already used with a different payload', 409);
        }
        if (afterConflict?.applied) {
          return jsonOk({
            applied: false,
            deduped: true,
            idempotencyKey: parsed.idempotencyKey,
            table: parsed.table,
            action: parsed.action,
          });
        }
      }
    }

    await applyOperation(userId, parsed);
    await markReceiptApplied(userId, parsed.idempotencyKey);

    return jsonOk({
      applied: true,
      deduped: false,
      idempotencyKey: parsed.idempotencyKey,
      table: parsed.table,
      action: parsed.action,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    if (userId && idempotencyKey) {
      await markReceiptFailed(userId, idempotencyKey, message);
    }

    if (error instanceof RequestError) {
      return jsonError(message, error.status);
    }

    console.error('sync-operation error:', error);
    return jsonError(message, 500);
  }
});

class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const verifyUser = async (req: Request) => {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new RequestError('Missing bearer token', 401);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new RequestError('Missing bearer token', 401);
  }

  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jwtVerify(token, secret, {
    issuer: 'supabase',
    audience: 'authenticated',
  });

  const userId = readString(payload.sub);
  if (!userId) {
    throw new RequestError('Invalid auth token subject', 401);
  }

  return userId;
};

const parseRequest = (raw: unknown): SyncOperationRequest => {
  if (!raw || typeof raw !== 'object') {
    throw new RequestError('Invalid request payload', 400);
  }

  const request = raw as Record<string, unknown>;
  const idempotencyKey = readString(request.idempotencyKey);
  if (!idempotencyKey) {
    throw new RequestError('idempotencyKey is required', 400);
  }

  const table = request.table;
  if (!isSupportedTable(table)) {
    throw new RequestError('Unsupported table', 400);
  }

  const action = request.action;
  if (!isSupportedAction(action)) {
    throw new RequestError('Unsupported action', 400);
  }

  const payload = request.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RequestError('payload must be an object', 400);
  }

  return {
    idempotencyKey,
    table,
    action,
    payload: payload as Record<string, unknown>,
  };
};

const fetchReceipt = async (userId: string, idempotencyKey: string) => {
  const { data, error } = await adminClient
    .from('sync_operation_receipts')
    .select('user_id,idempotency_key,table_name,action,payload_hash,applied')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RequestError(`Failed to read sync receipt: ${error.message}`, 500);
  }

  return data as SyncReceiptRow | null;
};

const insertPendingReceipt = async (userId: string, request: SyncOperationRequest, payloadHash: string) => {
  const { error } = await adminClient
    .from('sync_operation_receipts')
    .insert({
      user_id: userId,
      idempotency_key: request.idempotencyKey,
      table_name: request.table,
      action: request.action,
      payload_hash: payloadHash,
      applied: false,
      last_error: null,
    });

  if (error) {
    if (error.code === '23505') {
      return false;
    }
    throw new RequestError(`Failed to insert sync receipt: ${error.message}`, 500);
  }

  return true;
};

const markReceiptApplied = async (userId: string, idempotencyKey: string) => {
  const { error } = await adminClient
    .from('sync_operation_receipts')
    .update({
      applied: true,
      applied_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey);

  if (error) {
    throw new RequestError(`Failed to mark sync receipt as applied: ${error.message}`, 500);
  }
};

const markReceiptFailed = async (userId: string, idempotencyKey: string, message: string) => {
  const { error } = await adminClient
    .from('sync_operation_receipts')
    .update({
      applied: false,
      last_error: message.slice(0, 2000),
    })
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey);

  if (error) {
    console.error('failed to mark receipt error:', error.message);
  }
};

const applyOperation = async (userId: string, request: SyncOperationRequest) => {
  if (request.action === 'delete') {
    const id = readString(request.payload.id);
    if (!id) {
      throw new RequestError('id is required for delete', 400);
    }

    const { error } = await adminClient
      .from(request.table)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new RequestError(error.message, 500);
    }

    return;
  }

  const id = readString(request.payload.id);
  if (!id) {
    throw new RequestError('id is required for upsert', 400);
  }

  const upsertRow = {
    ...request.payload,
    id,
    user_id: userId,
  };

  const { error } = await adminClient
    .from(request.table)
    .upsert(upsertRow);

  if (error) {
    throw new RequestError(error.message, 500);
  }
};

const isSupportedTable = (value: unknown): value is SupportedTable =>
  value === 'workouts' || value === 'exercise_defs' || value === 'workout_templates';

const isSupportedAction = (value: unknown): value is SupportedAction =>
  value === 'upsert' || value === 'delete';

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const hashPayload = async (payload: Record<string, unknown>) => {
  const canonical = JSON.stringify(canonicalize(payload));
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const target: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      target[key] = canonicalize(source[key]);
    }
    return target;
  }

  return value;
};

const jsonOk = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
