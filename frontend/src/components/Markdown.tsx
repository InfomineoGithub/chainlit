import { getDomainFromUrl, getFaviconUrl } from '@/lib/favicon';
import {
  GROUNDING_UNDERLINE_END,
  GROUNDING_UNDERLINE_START,
  GroundingResponse,
  stripInlineFormatting
} from '@/lib/grounding';
import { toTitle } from '@/lib/sources';
import { cn } from '@/lib/utils';
import { omit } from 'lodash';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { PluggableList } from 'react-markdown/lib';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

import { ChainlitContext, type IMessageElement } from '@chainlit/react-client';

import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

import {
  groundingSentencesState,
  relatedSourceIdsState,
  sourceIconsState,
  sourcesOpenState,
  sourcesState
} from '@/state/sources';

import BlinkingCursor from './BlinkingCursor';
import CodeSnippet from './CodeSnippet';
import { CustomTableActionBar } from './CustomTableActionBar';
import { ElementRef } from './Elements/ElementRef';
import {
  type AlertProps,
  MarkdownAlert,
  alertComponents,
  normalizeAlertType
} from './MarkdownAlert';

interface Props {
  allowHtml?: boolean;
  latex?: boolean;
  refElements?: IMessageElement[];
  children: string;
  className?: string;
}

const cursorPlugin = () => {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index, parent) => {
      const placeholderPattern = /\u200B/g;
      const matches = [...(node.value?.matchAll(placeholderPattern) || [])];

      if (matches.length > 0) {
        const newNodes: any[] = [];
        let lastIndex = 0;

        matches.forEach((match) => {
          const [fullMatch] = match;
          const startIndex = match.index!;
          const endIndex = startIndex + fullMatch.length;

          if (startIndex > lastIndex) {
            newNodes.push({
              type: 'text',
              value: node.value!.slice(lastIndex, startIndex)
            });
          }

          newNodes.push({
            type: 'blinkingCursor',
            data: {
              hName: 'blinkingCursor',
              hProperties: { text: 'Blinking Cursor' }
            }
          });

          lastIndex = endIndex;
        });

        if (lastIndex < node.value!.length) {
          newNodes.push({
            type: 'text',
            value: node.value!.slice(lastIndex)
          });
        }

        parent!.children.splice(index, 1, ...newNodes);
      }
    });
  };
};

// Remark plugin: wraps grounded spans with a custom node.
const groundingUnderlinePlugin = () => {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (!Array.isArray(node.children)) return;

      // Skip code blocks to avoid altering literals.
      if (node.type === 'code' || node.type === 'inlineCode') return;

      const newChildren: any[] = [];
      let buffer: any[] = [];
      let isBuffering = false;

      // Remove marker tokens while preserving visible text.
      const stripMarkers = (value: string) =>
        value
          .split(GROUNDING_UNDERLINE_START)
          .join('')
          .split(GROUNDING_UNDERLINE_END)
          .join('');

      // Flush buffered content into a custom underline node.
      const pushUnderline = () => {
        if (!isBuffering) return;

        newChildren.push({
          type: 'groundingUnderline',
          data: {
            hName: 'groundingUnderline',
            hProperties: { className: 'grounding-underline' }
          },
          children: buffer
        });
        buffer = [];
        isBuffering = false;
      };

      // Walk each child, grouping text between start/end markers.
      node.children.forEach((child: any) => {
        if (isBuffering) {
          // Continue collecting until we find an end marker.
          if (child.type === 'text') {
            let value = child.value as string;
            while (value.length) {
              const endIndex = value.indexOf(GROUNDING_UNDERLINE_END);
              if (endIndex === -1) {
                buffer.push({ type: 'text', value: stripMarkers(value) });
                value = '';
              } else {
                const beforeEnd = value.slice(0, endIndex);
                if (beforeEnd) {
                  buffer.push({ type: 'text', value: stripMarkers(beforeEnd) });
                }
                value = value.slice(endIndex + GROUNDING_UNDERLINE_END.length);
                pushUnderline();
              }
            }
          } else {
            // Preserve non-text nodes inside the underline span.
            buffer.push(child);
          }
          return;
        }

        if (child.type !== 'text') {
          // Pass through nodes that cannot carry markers.
          newChildren.push(child);
          return;
        }

        let value = child.value as string;
        while (value.length) {
          const startIndex = value.indexOf(GROUNDING_UNDERLINE_START);
          if (startIndex === -1) {
            // No start marker: emit plain text as-is.
            newChildren.push({ type: 'text', value: stripMarkers(value) });
            value = '';
            break;
          }

          const beforeStart = value.slice(0, startIndex);
          if (beforeStart) {
            newChildren.push({
              type: 'text',
              value: stripMarkers(beforeStart)
            });
          }

          value = value.slice(startIndex + GROUNDING_UNDERLINE_START.length);
          buffer = [];
          isBuffering = true;

          const endIndex = value.indexOf(GROUNDING_UNDERLINE_END);
          if (endIndex === -1) {
            // Start marker without end marker: keep buffering.
            if (value) {
              buffer.push({ type: 'text', value: stripMarkers(value) });
            }
            value = '';
            break;
          }

          const underlinedText = value.slice(0, endIndex);
          if (underlinedText) {
            buffer.push({ type: 'text', value: stripMarkers(underlinedText) });
          }
          value = value.slice(endIndex + GROUNDING_UNDERLINE_END.length);
          pushUnderline();
        }
      });

      if (isBuffering && buffer.length > 0) {
        newChildren.push(...buffer);
      }

      node.children = newChildren;
    });
  };
};

const getText = (value: React.ReactNode): string => {
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  if (Array.isArray(value)) return value.map(getText).join('');

  return '';
};

const normalizeSourceKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');

const getSourceKeys = (source: { id: string; title: string; link: string }) => {
  const keys = new Set<string>();
  [source.id, source.title, source.link, toTitle(source.link)].forEach(
    (value) => {
      if (!value) return;
      keys.add(normalizeSourceKey(value));
    }
  );
  return keys;
};

const matchesText = (candidate: string, target: string) => {
  const normalizedCandidate = stripInlineFormatting(candidate)
    .trim()
    .toLowerCase();
  const normalizedTarget = stripInlineFormatting(target).trim().toLowerCase();
  if (!normalizedCandidate || !normalizedTarget) return false;
  return (
    normalizedCandidate.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedCandidate)
  );
};

const getCitationsForText = (
  text: string,
  groundingSentences: GroundingResponse[]
) => {
  if (!text || groundingSentences.length === 0) return [];
  const citations = groundingSentences.flatMap((sentence) =>
    sentence.attribution.flatMap((attribution) => {
      if (
        attribution.supported === false ||
        !attribution.sentence_citations?.length
      ) {
        return [];
      }
      const hasMatch =
        (attribution.model_text && matchesText(attribution.model_text, text)) ||
        (attribution.original_text &&
          matchesText(attribution.original_text, text));
      return hasMatch ? attribution.sentence_citations ?? [] : [];
    })
  );
  return citations;
};

const Markdown = ({
  allowHtml,
  latex,
  refElements,
  className,
  children
}: Props) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const apiClient = useContext(ChainlitContext);
  const sources = useRecoilValue(sourcesState);
  const setSourcesOpen = useSetRecoilState(sourcesOpenState);
  const groundingSentences = useRecoilValue(groundingSentencesState);
  const setRelatedSourceIds = useSetRecoilState(relatedSourceIdsState);
  const setSourceIcons = useSetRecoilState(sourceIconsState);

  // Extract and cache source icons from grounding citations
  useEffect(() => {
    if (!groundingSentences || groundingSentences.length === 0) {
      return;
    }

    const newIcons: Record<string, string> = {};

    groundingSentences.forEach((sentence) => {
      sentence.attribution.forEach((attribution) => {
        if (
          attribution.supported === false ||
          !attribution.sentence_citations?.length
        )
          return;
        attribution.sentence_citations.forEach((citation) => {
          if (citation.source) {
            // Check if it's a URL
            if (
              citation.source.startsWith('http://') ||
              citation.source.startsWith('https://')
            ) {
              const domain = getDomainFromUrl(citation.source);
              const iconUrl = getFaviconUrl(citation.source);
              if (iconUrl && !newIcons[domain]) {
                newIcons[domain] = iconUrl;
              }
            }
          }
        });
      });
    });

    if (Object.keys(newIcons).length > 0) {
      setSourceIcons((prev) => ({ ...prev, ...newIcons }));
    }
  }, [groundingSentences, setSourceIcons]);

  // Also extract icons from sources list
  useEffect(() => {
    if (!sources || sources.length === 0) {
      return;
    }

    const newIcons: Record<string, string> = {};

    sources.forEach((source) => {
      const domain = getDomainFromUrl(source.link);
      const iconUrl = source.icon || getFaviconUrl(source.link);
      if (iconUrl && !newIcons[domain]) {
        newIcons[domain] = iconUrl;
      }
    });

    if (Object.keys(newIcons).length > 0) {
      setSourceIcons((prev) => ({ ...prev, ...newIcons }));
    }
  }, [sources, setSourceIcons]);

  const handleUnderlineClick = useCallback(
    (text: string) => {
      const citations = getCitationsForText(text, groundingSentences);
      const citationKeys = citations
        .flatMap((citation) => [citation.source, citation.title])
        .filter(Boolean)
        .map(normalizeSourceKey);
      const citationKeySet = new Set(citationKeys);
      const matchedIds = new Set(
        sources
          .filter((source) => {
            const sourceKeys = getSourceKeys(source);
            return [...sourceKeys].some((sourceKey) => {
              if (citationKeySet.has(sourceKey)) return true;
              return [...citationKeySet].some(
                (citationKey) =>
                  citationKey.includes(sourceKey) ||
                  sourceKey.includes(citationKey)
              );
            });
          })
          .map((source) => source.id)
      );

      setRelatedSourceIds([...matchedIds]);
      setSourcesOpen(true);
    },
    [groundingSentences, setRelatedSourceIds, setSourcesOpen, sources]
  );

  const rehypePlugins = useMemo(() => {
    let rehypePlugins: PluggableList = [];
    if (allowHtml) {
      rehypePlugins = [rehypeRaw as any, ...rehypePlugins];
    }
    if (latex) {
      rehypePlugins = [rehypeKatex as any, ...rehypePlugins];
    }
    return rehypePlugins;
  }, [allowHtml, latex]);

  const remarkPlugins = useMemo(() => {
    let remarkPlugins: PluggableList = [
      cursorPlugin,
      groundingUnderlinePlugin,
      remarkGfm as any,
      remarkDirective as any,
      MarkdownAlert
    ];

    if (latex) {
      remarkPlugins = [...remarkPlugins, remarkMath as any];
    }
    return remarkPlugins;
  }, [latex]);

  return (
    <ReactMarkdown
      className={cn('prose lg:prose-xl', className)}
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={{
        ...alertComponents, // add alert components
        code(props) {
          return (
            <code
              {...omit(props, ['node'])}
              className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
            />
          );
        },
        pre({ children, ...props }: any) {
          return <CodeSnippet {...props} />;
        },
        a({ children, ...props }) {
          const name = getText(children);
          const element = refElements?.find((e) => e.name === name);
          if (element) {
            return <ElementRef element={element} />;
          } else {
            const source = sources.find((item) => item.link === props.href);
            return (
              <a
                {...props}
                href={source?.link ?? props.href}
                className="text-primary hover:underline"
                target="_blank"
                onClick={() => {
                  if (!source) return;
                  setSourcesOpen(true);
                }}
                rel="noreferrer"
              >
                {children}
              </a>
            );
          }
        },
        img: (image: any) => {
          // Check if the image source is actually a video file
          const src = image.src.startsWith('/public')
            ? apiClient.buildEndpoint(image.src)
            : image.src;

          const videoExtensions = [
            '.mp4',
            '.webm',
            '.mov',
            '.avi',
            '.ogv',
            '.m4v'
          ];
          const isVideo = videoExtensions.some((ext) =>
            src.toLowerCase().split(/[?#]/)[0].endsWith(ext)
          );

          if (isVideo) {
            return (
              <div className="sm:max-w-sm md:max-w-md">
                <video
                  src={src}
                  controls
                  className="w-full h-auto rounded-md"
                  style={{ maxWidth: '100%' }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            );
          }

          return (
            <div className="sm:max-w-sm md:max-w-md">
              <AspectRatio
                ratio={16 / 9}
                className="bg-muted rounded-md overflow-hidden"
              >
                <img
                  src={src}
                  alt={image.alt}
                  className="h-full w-full object-contain"
                />
              </AspectRatio>
            </div>
          );
        },
        blockquote(props) {
          return (
            <blockquote
              {...omit(props, ['node'])}
              className="mt-6 border-l-2 pl-6 italic"
            />
          );
        },
        em(props) {
          return <span {...omit(props, ['node'])} className="italic" />;
        },
        strong(props) {
          return <span {...omit(props, ['node'])} className="font-bold" />;
        },
        hr() {
          return <Separator />;
        },
        ul(props) {
          return (
            <ul
              {...omit(props, ['node'])}
              className="my-3 ml-3 list-disc pl-2 [&>li]:mt-1"
            />
          );
        },
        ol(props) {
          return (
            <ol
              {...omit(props, ['node'])}
              className="my-3 ml-3 list-decimal pl-2 [&>li]:mt-1"
            />
          );
        },
        h1(props) {
          return (
            <h1
              {...omit(props, ['node'])}
              className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mt-8 first:mt-0"
            />
          );
        },
        h2(props) {
          return (
            <h2
              {...omit(props, ['node'])}
              className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mt-8 first:mt-0"
            />
          );
        },
        h3(props) {
          return (
            <h3
              {...omit(props, ['node'])}
              className="scroll-m-20 text-2xl font-semibold tracking-tight mt-6 first:mt-0"
            />
          );
        },
        h4(props) {
          return (
            <h4
              {...omit(props, ['node'])}
              className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 first:mt-0"
            />
          );
        },
        p(props) {
          return (
            <div
              {...omit(props, ['node'])}
              className="leading-7 [&:not(:first-child)]:mt-4 whitespace-pre-wrap break-words"
              role="article"
            />
          );
        },
        table({ children, ...props }) {
          return (
            <Card className="[&:not(:first-child)]:mt-2 [&:not(:last-child)]:mb-2 overflow-hidden">
              <div className="overflow-x-auto">
                <Table ref={tableRef} {...(props as any)}>
                  {children}
                </Table>
              </div>
              <CustomTableActionBar tableRef={tableRef} />
            </Card>
          );
        },
        thead({ children, ...props }) {
          return <TableHeader {...(props as any)}>{children}</TableHeader>;
        },
        tr({ children, ...props }) {
          return <TableRow {...(props as any)}>{children}</TableRow>;
        },
        th({ children, ...props }) {
          return <TableHead {...(props as any)}>{children}</TableHead>;
        },
        td({ children, ...props }) {
          return <TableCell {...(props as any)}>{children}</TableCell>;
        },
        tbody({ children, ...props }) {
          return <TableBody {...(props as any)}>{children}</TableBody>;
        },
        // @ts-expect-error custom plugin
        groundingUnderline({ children, ...props }: any) {
          return (
            <span
              {...omit(props, ['node'])}
              className={cn('grounding-underline', props.className)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const text = getText(children);
                if (!text) return;
                handleUnderlineClick(text);
              }}
            >
              {children}
            </span>
          );
        },
        blinkingCursor: () => <BlinkingCursor whitespace />,
        alert: ({
          type,
          children,
          ...props
        }: AlertProps & { type?: string }) => {
          const alertType = normalizeAlertType(type || props.variant || 'info');
          return alertComponents.Alert({ variant: alertType, children });
        }
      }}
    >
      {children}
    </ReactMarkdown>
  );
};

export { Markdown };
