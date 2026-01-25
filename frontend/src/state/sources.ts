import { GroundingResponse } from '@/lib/grounding';
import { RecoilState, atom } from 'recoil';

export class Source {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly link: string,
    public readonly description?: string,
    public readonly images?: string[]
  ) {}
}

export const sourcesOpenState: RecoilState<boolean> = atom({
  key: 'sourcesOpen',
  default: true
});

export const sourcesState: RecoilState<Source[]> = atom({
  key: 'sourcesList',
  default: [] as Source[]
});

export const relatedSourceIdsState: RecoilState<string[]> = atom({
  key: 'relatedSourceIds',
  default: [] as string[]
});

export const groundingSentencesState: RecoilState<GroundingResponse[]> = atom({
  key: 'groundingSentences',
  default: [] as GroundingResponse[]
});
