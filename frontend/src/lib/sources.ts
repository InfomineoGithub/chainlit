import { getFaviconUrl } from '@/lib/favicon';

import { Source } from '@/state/sources';

export const toTitle = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
};

export const getSourcesFromText = (content: string): Source[] => {
  if (!content) return [];
  content = content.trim();
  const matches = content.matchAll(
    /^\[(\d+)\]:\s*(https?:\/\/\S+)(?:\s+"([^"]+)")?/gm
  );
  return [...matches].map((match) => {
    const [, id, link, description] = match;
    const icon = getFaviconUrl(link);
    return new Source(
      id,
      toTitle(link),
      link,
      description || '',
      undefined,
      icon || undefined
    );
  });
};
