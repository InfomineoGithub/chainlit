import { cn } from '@/lib/utils';
import capitalize from 'lodash/capitalize';

import { Source } from '@/state/sources';

import { SourceIcon } from './SourcesPanel';

const urlDomain = (url: string) => {
  const urlMaxLength = 50;
  if (url.length <= urlMaxLength) {
    return url.replace(/^https?:\/\//, '');
  }
  return new URL(url).hostname;
};

export const SourceComponent = ({ source }: { source: Source }) => {
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
