import {
  type Citation,
  GROUNDING_UNDERLINE_END,
  GROUNDING_UNDERLINE_START,
  applyUnderlineRanges,
  getUnderlineRangesFromGrounding
} from '@/lib/grounding';
import { prepareContent } from '@/lib/message';
import { isEqual } from 'lodash';
import { forwardRef, memo, useMemo } from 'react';
import { useRecoilValue } from 'recoil';

import type { IMessageElement, IStep } from '@chainlit/react-client';

import { CURSOR_PLACEHOLDER } from '@/components/BlinkingCursor';
import { Markdown } from '@/components/Markdown';

import { Source, groundingSentencesState, sourcesState } from '@/state/sources';

import { InlineSources } from './InlineSources';
import { InlinedElements } from './InlinedElements';

type ContentSection = 'input' | 'output';

export interface Props {
  elements: IMessageElement[];
  message: IStep;
  allowHtml?: boolean;
  latex?: boolean;
  sections?: ContentSection[];
}

const getMessageRenderProps = (message: IStep) => ({
  id: message.id,
  output: message.output,
  input: message.input,
  language: message.language,
  streaming: message.streaming,
  showInput: message.showInput,
  type: message.type
});

const textMatches = (candidate: string, target: string) => {
  if (!candidate || !target) return false;
  const c = candidate.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  return c.includes(t) || t.includes(c);
};

// Helper to extract citations from message text
const getCitationsForMessage = (
  messageText: string,
  groundingSentences: any[]
): Citation[] => {
  if (!messageText || groundingSentences.length === 0) return [];

  const citations: Citation[] = [];
  const messageTextClean = messageText
    .replace(GROUNDING_UNDERLINE_START, '')
    .replace(GROUNDING_UNDERLINE_END, '')
    .trim();

  groundingSentences.forEach((sentence) => {
    sentence.attribution?.forEach((attribution: any) => {
      if (
        attribution.supported === false ||
        !attribution.sentence_citations?.length
      )
        return;
      // Check if this attribution's text appears in the message
      const hasMatch =
        (attribution.model_text &&
          textMatches(messageTextClean, attribution.model_text)) ||
        (attribution.original_text &&
          textMatches(messageTextClean, attribution.original_text));

      if (hasMatch && attribution.sentence_citations?.length > 0) {
        citations.push(...attribution.sentence_citations);
      }
    });
  });

  return citations;
};

// Helper to normalize keys for matching
const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');

// Helper to match sources to citations
const matchSourcesToCitations = (
  citations: Citation[],
  sources: Source[]
): Source[] => {
  if (citations.length === 0 || sources.length === 0) return [];

  const citationKeys = new Set(
    citations
      .flatMap((c) => [c.source, c.title])
      .filter(Boolean)
      .map(normalizeKey)
  );

  const matched = sources.filter((source) => {
    const sourceKeys = [
      source.id,
      source.title,
      source.link,
      source.link.replace(/^https?:\/\/(www\.)?/, '')
    ]
      .filter(Boolean)
      .map(normalizeKey);

    return sourceKeys.some((sk) => {
      return [...citationKeys].some(
        (ck) => ck.includes(sk) || sk.includes(ck) || ck === sk
      );
    });
  });

  return matched;
};

const MessageContent = memo(
  forwardRef<HTMLDivElement, Props>(
    ({ message, elements, allowHtml, latex, sections }, ref) => {
      const groundingSentences = useRecoilValue(groundingSentencesState);
      const sources = useRecoilValue(sourcesState);
      const outputContent =
        message.streaming && message.output
          ? message.output + CURSOR_PLACEHOLDER
          : message.output;

      const {
        preparedContent: outputPrepared,
        inlinedElements: outputInlinedElements,
        refElements: outputRefElements
      } = prepareContent({
        elements,
        id: message.id,
        content: outputContent,
        language: message.language,
        stripCitations: message.type !== 'user_message'
      });

      const output = useMemo(() => {
        if (!outputPrepared) {
          return outputPrepared;
        }
        if (message.type === 'user_message') {
          return outputPrepared;
        }
        const ranges = getUnderlineRangesFromGrounding(
          outputPrepared,
          groundingSentences
        );
        if (ranges.length === 0) {
          return outputPrepared;
        }
        return applyUnderlineRanges(outputPrepared, ranges);
      }, [groundingSentences, message.type, outputPrepared]);

      const selectedSections = sections ?? ['input', 'output'];
      const sectionsSet = useMemo(
        () => new Set(selectedSections),
        [selectedSections]
      );

      const displayInput =
        sectionsSet.has('input') && message.input && message.showInput;
      const displayOutput = sectionsSet.has('output');

      const isMessage = message.type.includes('message');

      // Get related sources for THIS specific message by extracting citations from its content
      const messageSources = useMemo(() => {
        if (!isMessage || message.type === 'user_message' || !outputPrepared) {
          return [];
        }

        // Extract citations from the grounding sentences
        const citations = getCitationsForMessage(
          outputPrepared,
          groundingSentences
        );

        // Match sources to citations
        return matchSourcesToCitations(citations, sources);
      }, [
        sources,
        groundingSentences,
        isMessage,
        message.type,
        outputPrepared
      ]);

      const outputMarkdown = displayOutput ? (
        <>
          {!isMessage && displayInput && message.output ? (
            <div className="font-medium">Output</div>
          ) : null}
          <Markdown
            allowHtml={allowHtml}
            latex={latex}
            refElements={outputRefElements}
          >
            {output}
          </Markdown>
        </>
      ) : null;

      let inputMarkdown;

      if (displayInput) {
        const inputContent =
          message.streaming && message.input
            ? message.input + CURSOR_PLACEHOLDER
            : message.input;
        const { preparedContent: input, refElements: inputRefElements } =
          prepareContent({
            elements,
            id: message.id,
            content: inputContent,
            language:
              typeof message.showInput === 'string'
                ? message.showInput
                : undefined
          });

        inputMarkdown = (
          <>
            <Markdown
              allowHtml={allowHtml}
              latex={latex}
              refElements={inputRefElements}
            >
              {input}
            </Markdown>
          </>
        );
      }

      const markdownContent = (
        <div className="flex flex-col gap-4">
          {inputMarkdown}
          {outputMarkdown}
        </div>
      );

      return (
        <div ref={ref} className="message-content w-full flex flex-col gap-2">
          {displayInput || (displayOutput && output) ? markdownContent : null}
          {displayOutput ? (
            <InlinedElements elements={outputInlinedElements} />
          ) : null}
          {displayOutput && messageSources.length > 0 ? (
            <InlineSources sources={messageSources} />
          ) : null}
        </div>
      );
    }
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.allowHtml === nextProps.allowHtml &&
      prevProps.latex === nextProps.latex &&
      prevProps.elements === nextProps.elements &&
      isEqual(
        prevProps.sections ?? ['input', 'output'],
        nextProps.sections ?? ['input', 'output']
      ) &&
      isEqual(
        getMessageRenderProps(prevProps.message),
        getMessageRenderProps(nextProps.message)
      )
    );
  }
);

export { MessageContent };
