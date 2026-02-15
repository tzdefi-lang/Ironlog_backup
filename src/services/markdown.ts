export const mergeMarkdownWithUrls = (markdown: string, urls: string[]) => {
  const trimmed = markdown.trim();
  const existing = new Set(
    trimmed
      ? trimmed
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : []
  );

  const deduped = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean))).filter(
    (url) => !existing.has(url)
  );

  if (deduped.length === 0) return markdown;

  const suffix = deduped.join('\n');
  if (!trimmed) return `${suffix}\n`;
  return `${trimmed}\n\n${suffix}\n`;
};

