// Utility to get favicon URL for a domain
export const getFaviconUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Use Google's favicon service as a reliable fallback
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
};

export const getDomainFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const getFileExtension = (filename: string): string | null => {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : null;
};

export type FileType =
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'image'
  | 'code'
  | 'archive'
  | 'text'
  | 'other';

export const getFileType = (filename: string): FileType => {
  const ext = getFileExtension(filename);
  if (!ext) return 'doc';

  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx', 'odt'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext))
    return 'image';
  if (
    [
      'js',
      'ts',
      'py',
      'java',
      'cpp',
      'c',
      'h',
      'css',
      'html',
      'json',
      'xml'
    ].includes(ext)
  )
    return 'code';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['txt', 'md', 'log'].includes(ext)) return 'text';

  return 'other';
};
