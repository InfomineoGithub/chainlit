export const GROUNDING_UNDERLINE_START = '@@@gs-underline-start@@@';
export const GROUNDING_UNDERLINE_END = '@@@gs-underline-end@@@';

export type Citation = {
  source: string;
  confidence: number;
  similarity_score: number;
  snippets: string[];
  title: string;
  passed_similarity_only: boolean;
};

export type Attribution = {
  sentence_index: number;
  original_text: string;
  model_text: string;
  start_index: number;
  end_index: number;
  is_table: boolean;
  claims: never[]; // never seen probably string[]
  sentence_citations: Citation[];
  supported: boolean;
};

export type GroundingResponse = {
  attribution: Attribution[];
  source: string;
};

export type UnderlineRange = {
  start: number;
  end: number;
};

const normalizeRanges = (
  ranges: UnderlineRange[],
  maxLength: number
): UnderlineRange[] => {
  const cleaned = ranges
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, maxLength)),
      end: Math.max(0, Math.min(range.end, maxLength))
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const merged: UnderlineRange[] = [];
  for (const range of cleaned) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    last.end = Math.max(last.end, range.end);
  }

  return merged;
};

export const applyUnderlineRanges = (
  text: string,
  ranges: UnderlineRange[]
) => {
  if (!text || ranges.length === 0) {
    return text;
  }

  const normalizedRanges = normalizeRanges(ranges, text.length);
  if (normalizedRanges.length === 0) {
    return text;
  }

  let result = '';
  let lastIndex = 0;

  for (const range of normalizedRanges) {
    if (range.start > lastIndex) {
      result += text.slice(lastIndex, range.start);
    }
    result +=
      GROUNDING_UNDERLINE_START +
      text.slice(range.start, range.end) +
      GROUNDING_UNDERLINE_END;
    lastIndex = range.end;
  }

  if (lastIndex < text.length) {
    result += text.slice(lastIndex);
  }

  return result;
};

export const getUnderlineRangesFromGrounding = (
  text: string,
  groundingSentences: GroundingResponse[]
): UnderlineRange[] => {
  if (!text || groundingSentences.length === 0) {
    return [];
  }

  const ranges: UnderlineRange[] = [];

  groundingSentences.forEach((sentence) => {
    sentence.attribution.forEach((attribution) => {
      if (!attribution.sentence_citations?.length) {
        return;
      }

      const modelText = attribution.model_text;
      const originalText = attribution.original_text;
      const startIndex = attribution.start_index;
      const endIndex = attribution.end_index;

      const canUseOffsets =
        startIndex != null && endIndex != null && endIndex > startIndex;

      const addRangesForText = (candidateText: string, useOffsets: boolean) => {
        let added = 0;
        let searchFrom = 0;
        while (searchFrom < text.length) {
          const matchIndex = text.indexOf(candidateText, searchFrom);
          if (matchIndex === -1) {
            break;
          }

          if (
            useOffsets &&
            endIndex != null &&
            endIndex <= candidateText.length &&
            startIndex != null
          ) {
            const rangeStart = matchIndex + startIndex;
            const rangeEnd = matchIndex + endIndex;
            if (
              rangeStart >= matchIndex &&
              rangeEnd <= matchIndex + candidateText.length
            ) {
              ranges.push({ start: rangeStart, end: rangeEnd });
              added += 1;
            }
          } else {
            ranges.push({
              start: matchIndex,
              end: matchIndex + candidateText.length
            });
            added += 1;
          }

          searchFrom = matchIndex + candidateText.length;
        }

        return added;
      };

      const modelMatches =
        modelText && canUseOffsets
          ? addRangesForText(modelText, true)
          : modelText
          ? addRangesForText(modelText, false)
          : 0;

      if (modelMatches === 0 && originalText) {
        addRangesForText(originalText, false);
      }
    });
  });

  return normalizeRanges(ranges, text.length);
};
