import { prepareContent } from '@/lib/message';
import { getSourcesFromText } from '@/lib/sources';
import { isEqual } from 'lodash';
import { forwardRef, memo, useEffect, useMemo } from 'react';
import { useSetRecoilState } from 'recoil';

import type { IMessageElement, IStep } from '@chainlit/react-client';

import { CURSOR_PLACEHOLDER } from '@/components/BlinkingCursor';
import { Markdown } from '@/components/Markdown';

import { sourcesState } from '@/state/sources';

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

const MessageContent = memo(
  forwardRef<HTMLDivElement, Props>(
    ({ message, elements, allowHtml, latex, sections }, ref) => {
      const setSources = useSetRecoilState(sourcesState);
      const outputContent =
        message.streaming && message.output
          ? message.output + CURSOR_PLACEHOLDER
          : message.output;
      useEffect(() => {
        setSources(getSourcesFromText(outputContent));
      }, [message.id, outputContent]);

      const {
        preparedContent: output,
        inlinedElements: outputInlinedElements,
        refElements: outputRefElements
      } = prepareContent({
        elements,
        id: message.id,
        content: outputContent,
        language: message.language
      });

      const selectedSections = sections ?? ['input', 'output'];
      const sectionsSet = useMemo(
        () => new Set(selectedSections),
        [selectedSections]
      );

      const displayInput =
        sectionsSet.has('input') && message.input && message.showInput;
      const displayOutput = sectionsSet.has('output');

      const isMessage = message.type.includes('message');

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
