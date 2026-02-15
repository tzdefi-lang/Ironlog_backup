export type InferredMediaType = 'image' | 'video' | undefined;

const stripQueryAndHash = (value: string) => value.split('#')[0].split('?')[0];

export const inferMediaTypeFromUrl = (url?: string | null): InferredMediaType => {
  if (!url) return undefined;
  const clean = stripQueryAndHash(url.trim()).toLowerCase();
  if (!clean) return undefined;

  const extension = clean.split('.').pop();
  if (!extension || extension === clean) return undefined;

  if (['mp4', 'webm', 'mov', 'm4v', 'avi'].includes(extension)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(extension)) return 'image';

  return undefined;
};

