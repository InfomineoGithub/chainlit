import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { Button } from '@/components/ui/button';

import { sourcesOpenState, sourcesState } from '@/state/sources';

export default function SourcesToggle() {
  const [sourcesOpen, setSourcesOpen] = useRecoilState(sourcesOpenState);
  const sources = useRecoilValue(sourcesState);
  const hasSources = sources.length > 0;
  if (!hasSources) return null;
  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={!hasSources}
      className={cn(
        'text-muted-foreground hover:text-muted-foreground',
        hasSources && sourcesOpen && 'text-primary',
        !hasSources && 'opacity-40 cursor-not-allowed'
      )}
      onClick={() => {
        if (!hasSources) return;
        setSourcesOpen((prev) => !prev);
      }}
      aria-label="Toggle sources"
    >
      <BookOpen className="!size-4" />
    </Button>
  );
}
