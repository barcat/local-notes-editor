import type { ComponentChildren } from "preact";

// A small link-only subset: labels on one line and URLs with balanced parentheses.
export function renderLinks(content: string): ComponentChildren {
  const parts: ComponentChildren[] = [];
  const start = /\[([^\]\r\n]+)\]\(/g;
  let offset = 0;
  let match: RegExpExecArray | null;

  while ((match = start.exec(content))) {
    const urlStart = start.lastIndex;
    let end = urlStart;
    let depth = 1;
    for (; end < content.length; end++) {
      const character = content[end];
      if (/\s/.test(character)) break;
      if (character === "(") depth++;
      if (character === ")" && --depth === 0) break;
    }
    if (depth !== 0) continue;

    const href = content.slice(urlStart, end);
    if (!/^https?:\/\//i.test(href) || /[\u0000-\u001f\u007f]/.test(href)) continue;
    try {
      new URL(href);
    } catch {
      continue;
    }

    parts.push(content.slice(offset, match.index));
    parts.push(<a key={match.index} href={href} target="_blank" rel="noopener noreferrer">{match[1]}</a>);
    offset = end + 1;
    start.lastIndex = offset;
  }
  parts.push(content.slice(offset));
  return parts;
}
