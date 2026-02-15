import { createClient } from 'npm:@supabase/supabase-js@2';
import { jwtVerify } from 'npm:jose@5';

type EntityType = 'official_exercise' | 'official_template';
type ActionType = 'upsert' | 'delete';

type ExerciseMediaItem = {
  id: string;
  kind: 'upload' | 'youtube';
  contentType: 'image' | 'video';
  url: string;
  title?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET');
const ADMIN_EMAILS = new Set(
  (Deno.env.get('ADMIN_EMAILS') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required');
}
if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET (or SUPABASE_JWT_SECRET) is required');
}
if (ADMIN_EMAILS.size === 0) {
  throw new Error('ADMIN_EMAILS is required');
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

  try {
    const email = await verifyAdmin(req);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request payload', 400);
    }

    const entity = body.entity as EntityType;
    const action = body.action as ActionType;
    const payload = body.payload;

    if (!isEntity(entity)) return jsonError('Invalid entity', 400);
    if (!isAction(action)) return jsonError('Invalid action', 400);
    if (!payload || typeof payload !== 'object') return jsonError('Invalid payload', 400);

    if (entity === 'official_exercise') {
      if (action === 'delete') {
        const id = readString(payload.id);
        if (!id) return jsonError('Exercise id is required', 400);
        const { error } = await adminClient.from('official_exercise_defs').delete().eq('id', id);
        if (error) return jsonError(error.message, 500);
        return jsonOk({ entity, action, id, by: email });
      }

      const row = buildOfficialExerciseRow(payload);
      const { data, error } = await adminClient
        .from('official_exercise_defs')
        .upsert(row)
        .select('*')
        .single();

      if (error) return jsonError(error.message, 500);
      return jsonOk({ entity, action, row: normalizeExerciseRow(data), by: email });
    }

    if (action === 'delete') {
      const id = readString(payload.id);
      if (!id) return jsonError('Template id is required', 400);
      const { error } = await adminClient.from('official_workout_templates').delete().eq('id', id);
      if (error) return jsonError(error.message, 500);
      return jsonOk({ entity, action, id, by: email });
    }

    const row = await buildOfficialTemplateRow(payload);
    const { data, error } = await adminClient
      .from('official_workout_templates')
      .upsert(row)
      .select('*')
      .single();

    if (error) return jsonError(error.message, 500);
    return jsonOk({ entity, action, row: normalizeTemplateRow(data), by: email });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return jsonError(error.message, error.status);
    }
    console.error('official-content-admin error:', error);
    return jsonError(error instanceof Error ? error.message : 'Unexpected server error', 500);
  }
});

class AdminAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const verifyAdmin = async (req: Request) => {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AdminAccessError('Missing bearer token', 401);
  }

  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) throw new AdminAccessError('Missing bearer token', 401);

  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jwtVerify(jwt, secret, {
    issuer: 'supabase',
    audience: 'authenticated',
  });

  const email = readEmail(payload);
  if (!email) {
    throw new AdminAccessError(
      'Email not present in token. Enable Privy Identity Tokens (User management > Authentication > Advanced > Return user data in an identity token), then sign out and sign back in.',
      403
    );
  }
  if (!ADMIN_EMAILS.has(email)) throw new AdminAccessError('Admin access denied', 403);

  return email;
};

const readEmail = (payload: Record<string, unknown>) => {
  const direct = readString(payload.email);
  if (direct) return direct.toLowerCase();

  const userMetadata = payload.user_metadata;
  if (userMetadata && typeof userMetadata === 'object') {
    const nested = readString((userMetadata as Record<string, unknown>).email);
    if (nested) return nested.toLowerCase();
  }

  return null;
};

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const readOptionalString = (value: unknown) => {
  const normalized = readString(value);
  return normalized || null;
};

const readBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

const readNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const sanitizeMediaItems = (value: unknown): ExerciseMediaItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = readString(row.id) || crypto.randomUUID();
      const kind = row.kind === 'youtube' ? 'youtube' : row.kind === 'upload' ? 'upload' : null;
      const contentType = row.contentType === 'video' ? 'video' : row.contentType === 'image' ? 'image' : null;
      const url = readString(row.url);
      const title = readOptionalString(row.title) ?? undefined;
      if (!kind || !contentType || !url) return null;
      return { id, kind, contentType, url, title } satisfies ExerciseMediaItem;
    })
    .filter((item): item is ExerciseMediaItem => item !== null);
};

const sanitizeTemplateExercises = (value: unknown): Array<{ defId: string; defaultSets: number }> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const defId = readString(row.defId);
      if (!defId) return null;
      const defaultSets = Math.max(1, Math.round(readNumber(row.defaultSets, 1)));
      return { defId, defaultSets };
    })
    .filter((item): item is { defId: string; defaultSets: number } => item !== null);
};

const buildOfficialExerciseRow = (payload: Record<string, unknown>) => {
  const id = readString(payload.id) || crypto.randomUUID();
  const name = readString(payload.name);
  if (!name) throw new AdminAccessError('Exercise name is required', 400);

  const description = readString(payload.description);
  const thumbnailUrl = readOptionalString(payload.thumbnailUrl);
  const markdown = readString(payload.markdown);
  const mediaItems = sanitizeMediaItems(payload.mediaItems);

  const firstUpload = mediaItems.find((item) => item.kind === 'upload');
  const category = readString(payload.category) || 'Other';
  const usesBarbell = readBoolean(payload.usesBarbell, false);
  const barbellWeight = readNumber(payload.barbellWeight, 0);

  return {
    id,
    name,
    description,
    thumbnail_url: thumbnailUrl,
    published_at: new Date().toISOString(),
    data: {
      category,
      usesBarbell,
      barbellWeight,
      markdown,
      mediaItems,
      media_url: firstUpload?.url ?? null,
      media_type: firstUpload?.contentType ?? null,
    },
  };
};

const buildOfficialTemplateRow = async (payload: Record<string, unknown>) => {
  const id = readString(payload.id) || crypto.randomUUID();
  const name = readString(payload.name);
  if (!name) throw new AdminAccessError('Template name is required', 400);

  const description = readString(payload.description);
  const tagline = readString(payload.tagline);
  const exercises = sanitizeTemplateExercises(payload.exercises);

  if (exercises.length === 0) {
    throw new AdminAccessError('Template must include at least one exercise', 400);
  }

  const officialExerciseIds = Array.from(new Set(exercises.map((exercise) => exercise.defId)));
  const { data: officialRows, error: officialError } = await adminClient
    .from('official_exercise_defs')
    .select('id')
    .in('id', officialExerciseIds);

  if (officialError) {
    throw new AdminAccessError(`Failed to validate official exercises: ${officialError.message}`, 500);
  }

  const foundIds = new Set((officialRows ?? []).map((row) => readString((row as Record<string, unknown>).id)));
  const hasNonOfficial = officialExerciseIds.some((defId) => !foundIds.has(defId));
  if (hasNonOfficial) {
    throw new AdminAccessError('Official templates can include official exercises only', 400);
  }

  return {
    id,
    name,
    description,
    tagline,
    published_at: new Date().toISOString(),
    data: {
      description,
      tagline,
      exercises,
    },
  };
};

const normalizeExerciseRow = (row: Record<string, unknown>) => {
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {};
  return {
    id: readString(row.id),
    name: readString(row.name),
    description: readString(row.description),
    thumbnailUrl: readOptionalString(row.thumbnail_url),
    data: {
      ...data,
      mediaItems: sanitizeMediaItems(data.mediaItems),
      markdown: readString(data.markdown),
      category: readString(data.category) || 'Other',
      usesBarbell: readBoolean(data.usesBarbell, false),
      barbellWeight: readNumber(data.barbellWeight, 0),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
};

const normalizeTemplateRow = (row: Record<string, unknown>) => {
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {};
  return {
    id: readString(row.id),
    name: readString(row.name),
    description: readString(row.description),
    tagline: readString(row.tagline),
    data: {
      ...data,
      exercises: sanitizeTemplateExercises(data.exercises),
      description: readString(data.description),
      tagline: readString(data.tagline),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
};

const isEntity = (value: unknown): value is EntityType =>
  value === 'official_exercise' || value === 'official_template';

const isAction = (value: unknown): value is ActionType => value === 'upsert' || value === 'delete';

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
