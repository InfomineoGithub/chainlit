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

  const isValidHttpLink = (link: string) => {
    return link.startsWith('http://') || link.startsWith('https://');
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-2', className)}>
      {sources.map((source) => {
        const isClickable = isValidHttpLink(source.link);

        return (
          <a
            key={source.id}
            href={isClickable ? source.link : undefined}
            target={isClickable ? '_blank' : undefined}
            rel={isClickable ? 'noreferrer' : undefined}
            className="no-underline"
            onClick={(e) => {
              if (!isClickable) {
                e.preventDefault();
              }
            }}
          >
            <Badge
              variant="outline"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors',
                isClickable
                  ? 'hover:bg-accent/50 cursor-pointer'
                  : 'cursor-not-allowed opacity-60'
              )}
            >
              <SourceIcon source={source} />
              <span className="truncate max-w-[120px]">{source.title}</span>
            </Badge>
          </a>
        );
      })}
    </div>
  );
};
