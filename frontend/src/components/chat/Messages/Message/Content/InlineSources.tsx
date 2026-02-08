import { getFileType } from '@/lib/favicon';
import { cn } from '@/lib/utils';
import {
  ExternalLink,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';

import { Badge } from '@/components/ui/badge';

import { Source, sourceIconsState } from '@/state/sources';

interface InlineSourcesProps {
  sources: Source[];
  className?: string;
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getDocIcon = (source: Source) => {
  const fileType = getFileType(source.title || source.link);
  const className = 'size-2.5 text-muted-foreground';

  switch (fileType) {
    case 'pdf':
      return <File className={className} />;
    case 'doc':
      return <FileText className={className} />;
    case 'sheet':
      return <FileSpreadsheet className={className} />;
    case 'image':
      return <FileImage className={className} />;
    case 'code':
      return <FileCode className={className} />;
    case 'archive':
      return <FileArchive className={className} />;
    case 'text':
      return <FileText className={className} />;
    default:
      return <ExternalLink className={className} />;
  }
};

const SourceIcon = ({ source }: { source: Source }) => {
  const sourceIcons = useRecoilValue(sourceIconsState);
  const domain = getDomain(source.link);
  const iconUrl = source.icon || sourceIcons[domain];
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex items-center justify-center size-4 rounded-sm overflow-hidden bg-muted">
      {iconUrl && !imageError ? (
        <img
          src={iconUrl}
          alt={domain}
          className="size-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        getDocIcon(source)
      )}
    </div>
  );
};

export const InlineSources = ({ sources, className }: InlineSourcesProps) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-2', className)}>
      {sources.map((source) => (
        <a
          key={source.id}
          href={source.link}
          target="_blank"
          rel="noreferrer"
          className="no-underline"
        >
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <SourceIcon source={source} />
            <span className="truncate max-w-[120px]">{source.title}</span>
          </Badge>
        </a>
      ))}
    </div>
  );
};
