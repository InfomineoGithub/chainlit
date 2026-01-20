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

export const selectedSourceIdState: RecoilState<string | null> = atom<
  string | null
>({
  key: 'selectedSourceId',
  default: '2'
});

export const sourcesState: RecoilState<Source[]> = atom({
  key: 'sourcesList',
  default: [] as Source[]
});
