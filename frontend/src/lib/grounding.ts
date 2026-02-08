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

/**
 * Strips bold/strikethrough markers and collapses whitespace for matching.
 */
export const stripInlineFormatting = (text: string): string =>
  text.replace(/\*\*|__|~~/g, '').replace(/\s{2,}/g, ' ');

/**
 * Strips inline markdown markers from text and builds a position map so that
 * indices in the stripped string can be mapped back to the original text.
 * posMap[i] = original index of stripped char i.  Sentinel at posMap[stripped.length] = text.length.
 */
const buildTextMapping = (
  text: string
): { stripped: string; posMap: number[] } => {
  const markers = ['**', '__', '~~'];
  let stripped = '';
  const posMap: number[] = [];
  let i = 0;

  while (i < text.length) {
    let skipped = false;
    for (const m of markers) {
      if (text.startsWith(m, i)) {
        i += m.length;
        skipped = true;
        break;
      }
    }
    if (!skipped) {
      posMap.push(i);
      stripped += text[i];
      i++;
    }
  }

  posMap.push(text.length); // sentinel
  return { stripped, posMap };
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

// Fixes issue with certain header markdown
const adjustRangeForMarkdown = (
  text: string,
  start: number,
  end: number
): { start: number; end: number } => {
  // Check if the range starts at the beginning of a line (allowing for whitespace)
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const prefix = text.slice(lineStart, start);

  // If there's text before the match on the same line that isn't whitespace, it's not a block starter
  if (prefix.trim().length > 0) return { start, end };

  // Check if the content itself starts with a markdown marker
  const content = text.slice(start, end);
  // Match: headers, blockquotes, list items, code fences
  const match = content.match(
    /^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*|`{3,}|~{3,}))/
  );

  if (match) {
    const newStart = start + match[0].length;
    if (newStart < end) {
      return { start: newStart, end };
    }
  }

  return { start, end };
};

export const getUnderlineRangesFromGrounding = (
  text: string,
  groundingSentences: GroundingResponse[]
): UnderlineRange[] => {
  if (!text || groundingSentences.length === 0) {
    return [];
  }

  // Strip bold/strikethrough markers so grounding text can match markdown content
  const { stripped, posMap } = buildTextMapping(text);

  const ranges: UnderlineRange[] = [];

  groundingSentences.forEach((sentence) => {
    sentence.attribution.forEach((attribution) => {
      if (!attribution.supported || !attribution.sentence_citations?.length) {
        return;
      }

      const modelText = attribution.model_text;
      const originalText = attribution.original_text;
      const startIndex = attribution.start_index;
      const endIndex = attribution.end_index;

      const canUseOffsets =
        startIndex != null && endIndex != null && endIndex > startIndex;

      const addRangesForText = (candidateText: string): number => {
        // Strip formatting and collapse extra spaces from the candidate
        const cleanCandidate = stripInlineFormatting(candidateText);
        let count = 0;
        let searchFrom = 0;
        while (searchFrom < stripped.length) {
          const matchIndex = stripped.indexOf(cleanCandidate, searchFrom);
          if (matchIndex === -1) break;

          let start = posMap[matchIndex];
          const end = posMap[matchIndex + cleanCandidate.length];

          // Extend start backwards to include any leading ** / __ / ~~ so the
          // underline markers don't get nested inside bold/strikethrough nodes
          if (start >= 2) {
            const pre = text.slice(start - 2, start);
            if (pre === '**' || pre === '__' || pre === '~~') {
              start -= 2;
            }
          }

          const adjusted = adjustRangeForMarkdown(text, start, end);
          if (adjusted.end > adjusted.start) {
            ranges.push(adjusted);
            count++;
          }

          searchFrom = matchIndex + cleanCandidate.length;
        }
        return count;
      };

      const modelMatches =
        modelText && canUseOffsets
          ? addRangesForText(modelText)
          : modelText
          ? addRangesForText(modelText)
          : 0;

      if (modelMatches === 0 && originalText) {
        addRangesForText(originalText);
      }
    });
  });

  // Extend ranges that end right before a " [" so we don’t split citation brackets (e.g. ".[1]")
  for (const r of ranges) {
    if (
      r.end + 1 < text.length &&
      text[r.end] === ' ' &&
      text[r.end + 1] === '['
    ) {
      // Include the space and opening bracket inside the underline span
      r.end += 2;
    }
  }

  return normalizeRanges(ranges, text.length);
};
