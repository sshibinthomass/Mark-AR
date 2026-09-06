/**
 * Shared source-level CSS lookups for the stylesheet tests.
 *
 * `selectorBody` returns every rule whose selector list contains the selector,
 * not just the first one. The single Arvenilo stylesheet groups selectors that
 * share a declaration, so a lookup that stopped at the first match would report
 * a rule as missing purely because it is expressed alongside its siblings.
 */

/** Strips comments so they cannot be read as part of a selector list. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Bodies of every rule declaring this exact selector, joined. */
export function selectorBody(selector: string, source: string): string {
  const wanted = normalize(selector);
  const bodies: string[] = [];
  /* `[^{}]` on both sides makes this match innermost rules only, so rules
     nested inside @media blocks are found without special handling. */
  const pattern = /([^{}]+)\{([^{}]*)\}/g;

  const text = stripComments(source);
  let match = pattern.exec(text);
  while (match) {
    const selectors = splitSelectors(match[1]).map(normalize);
    if (selectors.includes(wanted)) {
      bodies.push(match[2]);
    }
    match = pattern.exec(text);
  }

  return bodies.join('\n');
}

/** Contents of every `@media <query>` block, joined. */
export function mediaBlock(query: string, rawSource: string): string {
  const source = stripComments(rawSource);
  const blocks: string[] = [];
  const needle = `@media ${query}`;
  let from = source.indexOf(needle);

  while (from >= 0) {
    const open = source.indexOf('{', from);
    if (open < 0) {
      break;
    }

    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === '{') {
        depth += 1;
      } else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(open + 1, index));
          from = source.indexOf(needle, index);
          break;
        }
      }

      if (index === source.length - 1) {
        from = -1;
      }
    }

    if (depth !== 0) {
      break;
    }
  }

  return blocks.join('\n');
}

/** Source with every `@media` block removed, for base-rule-only assertions. */
export function withoutMedia(source: string): string {
  const text = stripComments(source);
  let out = '';
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf('@media', index);
    if (start < 0) {
      out += text.slice(index);
      break;
    }

    out += text.slice(index, start);
    const open = text.indexOf('{', start);
    let depth = 0;
    let cursor = open;
    for (; cursor < text.length; cursor += 1) {
      if (text[cursor] === '{') depth += 1;
      else if (text[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    index = cursor + 1;
  }

  return out;
}

/** True when the rule declares the property at all, whatever the value. */
export function declares(body: string, property: string): boolean {
  return new RegExp(`(?:^|;|\\n)\\s*${property}\\s*:`, 'm').test(body);
}

/** Splits a selector list on commas that are not inside `:not(...)` and kin. */
function splitSelectors(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of list) {
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;

    if (character === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  parts.push(current);
  return parts;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
