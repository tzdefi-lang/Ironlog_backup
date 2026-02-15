const parseEmailList = (raw: string) =>
  raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const ADMIN_EMAILS = new Set(parseEmailList(import.meta.env.VITE_ADMIN_EMAILS ?? ''));

export const isAdminUser = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
};

export const getAdminEmails = () => Array.from(ADMIN_EMAILS);

export const isDesktopViewport = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(min-width: 1024px)').matches;
};
