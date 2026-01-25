import { cn } from '@/lib/utils';
import { capitalize } from 'lodash';
import { X } from 'lucide-react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { Button } from '@/components/ui/button';

import {
  Source,
  relatedSourceIdsState,
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

const SourceComponent = ({ source }: { source: Source }) => {
  return (
    <div
      key={source.id}
      className="border-b rounded-xs px-3 py-2 transition-colors duration-200 ease-out hover:bg-sidebar-accent/60"
    >
      <a href={source.link} target="_blank" rel="noreferrer">
        <div className="text-sm font-semibold text-foreground truncate">
          {capitalize(source.title)}
        </div>
      </a>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {source.description}
      </div>
      <a
        className="text-xs text-muted-foreground mt-1 inline-block"
        href={source.link}
        target="_blank"
        rel="noreferrer"
      >
        {urlDomain(source.link)}
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
        'absolute inset-y-0 right-0 z-20 h-full w-[320px] overflow-hidden transition-[transform,opacity] duration-300 ease-in-out shadow-xl hover:shadow-lg',
        sourcesOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
      aria-hidden={!sourcesOpen}
    >
      <aside
        className={cn(
          'h-full w-[320px] bg-sidebar text-foreground rounded-ss-2xl flex flex-col',
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
