import { getFileType } from '@/lib/favicon';
import { cn } from '@/lib/utils';
import { capitalize } from 'lodash';
import {
  ExternalLink,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  X
} from 'lucide-react';
import { useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { Button } from '@/components/ui/button';

import {
  Source,
  relatedSourceIdsState,
  sourceIconsState,
  sourcesOpenState,
  sourcesState
} from 'state/sources';

const urlDomain = (url: string) => {
  const urlMaxLength = 50;
  if (url.length <= urlMaxLength) {
    return url.replace(/^https?:\/\//, '');
  }
  return new URL(url).hostname;
};

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getDocIcon = (source: Source) => {
  const fileType = getFileType(source.title || source.link);
  const className = 'size-4 text-muted-foreground';

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
    <div className="flex items-center justify-center size-8 rounded-md overflow-hidden bg-muted border shrink-0">
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

const SourceComponent = ({ source }: { source: Source }) => {
  const isValidHttpLink = (link: string) => {
    return link.startsWith('http://') || link.startsWith('https://');
  };

  const isClickable = isValidHttpLink(source.link);

  return (
    <div
      key={source.id}
      className={cn(
        'border-b rounded-xs py-2 transition-colors duration-200 ease-out',
        isClickable
          ? 'hover:bg-sidebar-accent/40'
          : 'opacity-60 cursor-not-allowed'
      )}
    >
      <a
        href={isClickable ? source.link : undefined}
        target={isClickable ? '_blank' : undefined}
        rel={isClickable ? 'noreferrer' : undefined}
        className={cn(
          'flex gap-3 items-start',
          isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
        )}
        onClick={(e) => {
          if (!isClickable) {
            e.preventDefault();
          }
        }}
      >
        <SourceIcon source={source} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {capitalize(source.title)}
          </div>
          {source.description && (
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {source.description}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {urlDomain(source.link)}
          </div>
        </div>
      </a>
    </div>
  );
};

export default function SourcesPanel() {
  const [sourcesOpen, setSourcesOpen] = useRecoilState(sourcesOpenState);
  const sources = useRecoilValue(sourcesState);
  const relatedSourceIds = useRecoilValue(relatedSourceIdsState);
  const relatedSources = sources.filter((source) =>
    relatedSourceIds.includes(source.id)
  );
  const relatedSourceIdSet = new Set(relatedSourceIds);
  const otherSources = sources.filter(
    (source) => !relatedSourceIdSet.has(source.id)
  );

  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 h-full w-full overflow-hidden transition-[transform,opacity] duration-300 ease-in-out shadow-xl hover:shadow-lg md:inset-y-0 md:right-0 md:left-auto md:w-[320px]',
        sourcesOpen
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 md:translate-x-full'
      )}
      aria-hidden={!sourcesOpen}
    >
      <aside
        className={cn(
          'h-full w-full bg-sidebar text-foreground flex flex-col md:w-[320px] md:rounded-ss-2xl',
          !sourcesOpen && 'pointer-events-none'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Sources</h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setSourcesOpen(false);
            }}
            aria-label="Close sources"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-4 py-3 overflow-y-auto">
          {sources.length === 0 && (
            <div className="text-sm text-muted-foreground px-4 py-3">
              No sources yet.
            </div>
          )}
          {relatedSources.length > 0 && (
            <div className="px-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Related sources
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {relatedSources.map((source) => (
                  <SourceComponent key={source.id} source={source} />
                ))}
              </div>
            </div>
          )}
          {otherSources.length > 0 && (
            <div className="px-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                All sources
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {otherSources.map((source) => (
                  <SourceComponent key={`${source.id}-all`} source={source} />
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
