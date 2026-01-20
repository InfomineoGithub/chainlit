import { cn } from '@/lib/utils';
import { capitalize } from 'lodash';
import { X } from 'lucide-react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { Button } from '@/components/ui/button';

import {
  Source,
  selectedSourceIdState,
  sourcesOpenState,
  sourcesState
} from 'state/sources';

const SourceComponent = ({
  source,
  isSelected,
  onHighlightEnd
}: {
  source: Source;
  isSelected: boolean;
  onHighlightEnd: () => void;
}) => {
  return (
    <div
      key={source.id}
      className={cn(
        'border-b px-4 py-3 hover:bg-sidebar-accent transition-colors duration-200 ease-out',
        isSelected && 'source-highlight'
      )}
      // className={cn(
      //   'rounded-md border p-3 hover:bg-sidebar-accent transition-colors duration-200 ease-out',
      //   isSelected && 'source-highlight'
      // )}
      onAnimationEnd={isSelected ? onHighlightEnd : undefined}
    >
      <a href={source.link} target="_blank" rel="noreferrer">
        <div className="text-sm font-medium">{capitalize(source.title)}</div>
      </a>
      <div className="text-xs text-muted-foreground mt-1">
        {source.description}
      </div>
      <a
        className="text-xs text-primary mt-2 inline-block"
        href={source.link}
        target="_blank"
        rel="noreferrer"
      >
        {source.link}
      </a>
    </div>
  );
};

export default function SourcesPanel() {
  const [sourcesOpen, setSourcesOpen] = useRecoilState(sourcesOpenState);
  const sources = useRecoilValue(sourcesState);
  const selectedSourceId = useRecoilValue(selectedSourceIdState);
  const setSelectedSourceId = useSetRecoilState(selectedSourceIdState);

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
              setSelectedSourceId(null);
            }}
            aria-label="Close sources"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-3 py-2 overflow-y-auto">
          {sources.length ? (
            [...sources, ...sources, ...sources].map((source) => (
              <SourceComponent
                key={source.id}
                source={source}
                isSelected={source.id === selectedSourceId}
                onHighlightEnd={() => setSelectedSourceId(null)}
              />
            ))
          ) : (
            <div className="text-sm text-muted-foreground px-4 py-3">
              No sources yet.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
