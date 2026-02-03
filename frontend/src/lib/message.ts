import type { IMessageElement } from 'client-types/';

const toSafeLinkTarget = (name: string) =>
  encodeURIComponent(name.replace(/\s+/g, '_'))
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29'); // Encode parentheses to avoid issues in URLs

const isForIdMatch = (id: string | number | undefined, forId: string) => {
  if (!forId || !id) {
    return false;
  }

  return forId === id.toString();
};

const escapeRegExp = (string: string) => {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const cleanModelOutput = (input: string) => {
  const before = input ?? '';
  let text = before;

  // Drop leading sources block (: lines or [n]: lines) if followed by empty line
  text = text.replace(
    /^(?:(?:\s*:[^\r\n]*|\s*\[\s*\d+\s*\]\s*:[^\r\n]*)\r?\n)+\s*\r?\n/,
    ''
  );

  // Strip citation brackets: [1], [[1]], [1](url)
  text = text
    .replace(/\s*\[\[\s*\d+\s*\]\]/g, '')
    .replace(/\s*\[\s*\d+\s*\]\([^)]+\)/g, '')
    .replace(/\s*\[\s*\d+\s*\]/g, '');

  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1');

  return { content: text, changed: text !== before };
};

export const prepareContent = ({
  elements,
  content,
  id,
  language,
  stripCitations
}: {
  elements: IMessageElement[];
  content?: string;
  id: string;
  language?: string;
  stripCitations?: boolean;
}) => {
  const elementNames = elements.map((e) => escapeRegExp(e.name));

  // Sort by descending length to avoid matching substrings
  elementNames.sort((a, b) => b.length - a.length);

  const elementRegexp = elementNames.length
    ? new RegExp(`(${elementNames.join('|')})`, 'g')
    : undefined;

  let preparedContent = content ? content.trim() : '';
  if (stripCitations && preparedContent) {
    const cleaned = cleanModelOutput(preparedContent);
    preparedContent = cleaned.content;
  }
  const inlinedElements = elements.filter(
    (e) => isForIdMatch(id, e?.forId) && e.display === 'inline'
  );
  const refElements: IMessageElement[] = [];

  if (elementRegexp) {
    preparedContent = preparedContent.replaceAll(elementRegexp, (match) => {
      const element = elements.find((e) => {
        const nameMatch = e.name === match;
        const scopeMatch = isForIdMatch(id, e?.forId);
        return nameMatch && scopeMatch;
      });
      const foundElement = !!element;

      const inlined = element?.display === 'inline';
      if (!foundElement) {
        // Element reference does not exist, return plain text
        return match;
      } else if (inlined) {
        // If element is inlined, add it to the list and return plain text
        if (inlinedElements.indexOf(element) === -1) {
          inlinedElements.push(element);
        }
        return match;
      } else {
        // Element is a reference, add it to the list and return link
        refElements.push(element);
        // Build a Markdown-safe link: escape text, and encode () in the slug
        // The address in the link is not used anyway
        return `[${match}](${toSafeLinkTarget(match)})`;
      }
    });
  }

  if (language && preparedContent) {
    const prefix = `\`\`\`${language}`;
    const suffix = '```';
    if (!preparedContent.startsWith('```')) {
      preparedContent = `${prefix}\n${preparedContent}\n${suffix}`;
    }
  }
  return {
    preparedContent,
    inlinedElements,
    refElements
  };
};
