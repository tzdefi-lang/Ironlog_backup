import { getSupabase } from '@/services/supabase';
import { generateId } from '@/services/utils';
import type {
  ContentSource,
  ExerciseDef,
  ExerciseMediaItem,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '@/types';

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const readOptionalString = (value: unknown) => {
  const normalized = readString(value);
  return normalized || undefined;
};

const readBoolean = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const readNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const parseMediaItems = (value: unknown): ExerciseMediaItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = readString(row.id) || generateId();
      const kind = row.kind === 'youtube' ? 'youtube' : row.kind === 'upload' ? 'upload' : null;
      const contentType = row.contentType === 'video' ? 'video' : row.contentType === 'image' ? 'image' : null;
      const url = readString(row.url);
      const title = readOptionalString(row.title);
      if (!kind || !contentType || !url) return null;
      const normalized: ExerciseMediaItem = title
        ? { id, kind, contentType, url, title }
        : { id, kind, contentType, url };
      return normalized;
    })
    .filter((item): item is ExerciseMediaItem => item !== null);
};

export const sanitizeTemplateExercises = (value: unknown): WorkoutTemplateExercise[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const defId = readString(row.defId);
      if (!defId) return null;
      return {
        defId,
        defaultSets: Math.max(1, Math.round(readNumber(row.defaultSets, 1))),
      } satisfies WorkoutTemplateExercise;
    })
    .filter((item): item is WorkoutTemplateExercise => item !== null);
};

const normalizeMarkdown = (value: unknown) => readString(value);

const firstUploadMedia = (items: ExerciseMediaItem[]) => items.find((item) => item.kind === 'upload');

export const normalizeExerciseDefRow = (
  row: Record<string, any>,
  source: ContentSource
): ExerciseDef => {
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {};
  const mediaItems = parseMediaItems(data.mediaItems);
  const legacyMediaUrl = readOptionalString(row.media_url ?? data.media_url ?? row.mediaUrl);
  const legacyMediaTypeRaw = readString(row.media_type ?? data.media_type ?? row.mediaType).toLowerCase();
  const legacyMediaType =
    legacyMediaTypeRaw === 'video' ? 'video' : legacyMediaTypeRaw === 'image' ? 'image' : undefined;

  const mergedMediaItems = mediaItems.length
    ? mediaItems
    : legacyMediaUrl && legacyMediaType
      ? [
          {
            id: `legacy-${row.id}`,
            kind: 'upload',
            contentType: legacyMediaType,
            url: legacyMediaUrl,
          } satisfies ExerciseMediaItem,
        ]
      : [];

  const firstUpload = firstUploadMedia(mergedMediaItems);

  return {
    id: readString(row.id),
    name: readString(row.name),
    description: readString(row.description),
    source,
    readOnly: source === 'official',
    thumbnailUrl: readOptionalString(row.thumbnail_url ?? data.thumbnailUrl),
    markdown: normalizeMarkdown(data.markdown),
    mediaItems: mergedMediaItems,
    mediaUrl: firstUpload?.url,
    mediaType: firstUpload?.contentType,
    mediaId: readOptionalString(row.media_id ?? data.mediaId),
    category: readString(data.category) || 'Other',
    usesBarbell: readBoolean(data.usesBarbell, false),
    barbellWeight: readNumber(data.barbellWeight, 0),
  };
};

export const normalizeTemplateRow = (
  row: Record<string, any>,
  source: ContentSource
): WorkoutTemplate => {
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {};
  const exercises = sanitizeTemplateExercises(data.exercises);

  return {
    id: readString(row.id),
    name: readString(row.name),
    source,
    readOnly: source === 'official',
    description: readString(row.description ?? data.description),
    tagline: readString(row.tagline ?? data.tagline),
    exercises,
    createdAt: readString(row.created_at ?? row.createdAt) || new Date().toISOString(),
  };
};

export const toPersonalExerciseRow = (def: ExerciseDef, userId: string) => {
  const firstUpload = firstUploadMedia(def.mediaItems);

  return {
    id: def.id,
    user_id: userId,
    name: def.name,
    description: def.description,
    media_url: firstUpload?.url ?? def.mediaUrl ?? null,
    media_type: firstUpload?.contentType ?? def.mediaType ?? null,
    data: {
      category: def.category ?? 'Other',
      usesBarbell: !!def.usesBarbell,
      barbellWeight: def.barbellWeight,
      thumbnailUrl: def.thumbnailUrl ?? null,
      markdown: def.markdown ?? '',
      mediaItems: def.mediaItems,
      mediaId: def.mediaId ?? null,
    },
  };
};

export const toPersonalTemplateRow = (template: WorkoutTemplate, userId: string) => ({
  id: template.id,
  user_id: userId,
  name: template.name,
  description: template.description ?? '',
  tagline: template.tagline ?? '',
  data: {
    exercises: template.exercises,
    description: template.description ?? '',
    tagline: template.tagline ?? '',
  },
  created_at: template.createdAt,
});

const parseInvokeResponse = (data: any) => {
  if (!data || typeof data !== 'object') return null;
  if ('row' in data && data.row && typeof data.row === 'object') return data.row as Record<string, any>;
  return null;
};

const invokeOfficialAdmin = async (entity: 'official_exercise' | 'official_template', action: 'upsert' | 'delete', payload: Record<string, unknown>) => {
  const { data, error } = await getSupabase().functions.invoke('official-content-admin', {
    body: {
      entity,
      action,
      payload,
    },
  });

  if (error) {
    const context = (error as any)?.context as Response | undefined;
    if (context) {
      const status = context.status;
      let detail = '';

      try {
        const json = await context.clone().json();
        if (json && typeof json === 'object' && 'error' in (json as any)) {
          detail = String((json as any).error ?? '');
        } else {
          detail = JSON.stringify(json);
        }
      } catch {
        try {
          detail = (await context.clone().text())?.trim?.() ?? '';
        } catch {
          detail = '';
        }
      }

      throw new Error(
        detail
          ? `Official content request failed (${status}): ${detail}`
          : `Official content request failed (${status})`
      );
    }

    throw new Error(error.message || 'Official content request failed');
  }

  return data;
};

export const upsertOfficialExercise = async (def: ExerciseDef) => {
  const payload = {
    id: def.id,
    name: def.name,
    description: def.description,
    thumbnailUrl: def.thumbnailUrl,
    markdown: def.markdown,
    mediaItems: def.mediaItems,
    category: def.category,
    usesBarbell: def.usesBarbell,
    barbellWeight: def.barbellWeight,
  };

  const data = await invokeOfficialAdmin('official_exercise', 'upsert', payload);
  const row = parseInvokeResponse(data);
  if (!row) throw new Error('Invalid official exercise response');
  return normalizeExerciseDefRow(row, 'official');
};

export const deleteOfficialExercise = async (id: string) => {
  await invokeOfficialAdmin('official_exercise', 'delete', { id });
};

export const upsertOfficialTemplate = async (template: WorkoutTemplate) => {
  const payload = {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    tagline: template.tagline ?? '',
    exercises: template.exercises,
  };

  const data = await invokeOfficialAdmin('official_template', 'upsert', payload);
  const row = parseInvokeResponse(data);
  if (!row) throw new Error('Invalid official template response');
  return normalizeTemplateRow(row, 'official');
};

export const deleteOfficialTemplate = async (id: string) => {
  await invokeOfficialAdmin('official_template', 'delete', { id });
};

export const normalizeYouTubeUrl = (input: string): string | null => {
  let raw = input.trim();
  if (!raw) return null;

  // Common markdown/UX cases: <https://...>, trailing punctuation, scheme-less paste.
  if (raw.startsWith('<') && raw.endsWith('>')) {
    raw = raw.slice(1, -1).trim();
  }
  raw = raw.replace(/[\])}.,;!?]+$/g, '').trim();
  if (!raw) return null;

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    const embed = (id: string) => `https://www.youtube.com/embed/${id}?playsinline=1`;

    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0]?.trim();
      if (!id) return null;
      return embed(id);
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId) return embed(watchId);

      const shorts = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shorts?.[1]) return embed(shorts[1]);

      const embedPath = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedPath?.[1]) return embed(embedPath[1]);

      const livePath = url.pathname.match(/^\/live\/([a-zA-Z0-9_-]+)/);
      if (livePath?.[1]) return embed(livePath[1]);

      const legacyV = url.pathname.match(/^\/v\/([a-zA-Z0-9_-]+)/);
      if (legacyV?.[1]) return embed(legacyV[1]);
    }
  } catch {
    // not a URL
  }

  return null;
};
