import { decodeHTMLStrict } from "entities/decode";
import { createElement, Fragment, type ComponentChildren } from "preact";
import type { Token, Tokens } from "marked";
import { safeLink } from "../markdown/safeLink";
import { validateMarkdownTokens } from "../markdown/validateMarkdownTokens";

function renderTokens(tokens: Token[]): ComponentChildren {
  return tokens.map((token, index) => <Fragment key={index}>{renderToken(token)}</Fragment>);
}

function literal(raw: string, block = false) {
  return block ? <div class="markdown-literal">{raw}</div> : <span class="markdown-literal">{raw}</span>;
}

function renderToken(token: Token): ComponentChildren {
  switch (token.type) {
    case "space": case "def": return null; // Block spacing and reference metadata.
    case "heading": {
      const heading = token as Tokens.Heading;
      return createElement(`h${heading.depth}`, null, renderTokens(heading.tokens));
    }
    case "paragraph": return <p>{renderTokens((token as Tokens.Paragraph).tokens)}</p>;
    case "blockquote": return <blockquote>{renderTokens((token as Tokens.Blockquote).tokens)}</blockquote>;
    case "strong": return <strong>{renderTokens((token as Tokens.Strong).tokens)}</strong>;
    case "em": return <em>{renderTokens((token as Tokens.Em).tokens)}</em>;
    case "code": return <pre><code>{(token as Tokens.Code).text}</code></pre>;
    case "codespan": return <code>{(token as Tokens.Codespan).text}</code>;
    case "hr": return <hr />;
    case "br": return <br />;
    case "list": {
      const list = token as Tokens.List;
      const items = renderTokens(list.items);
      return list.ordered ? <ol start={Number(list.start)}>{items}</ol> : <ul>{items}</ul>;
    }
    case "list_item": return <li>{renderTokens((token as Tokens.ListItem).tokens)}</li>;
    case "link": {
      const link = token as Tokens.Link;
      const href = safeLink(link.href, link.autolink);
      return href ? <a href={href} title={link.title ? decodeHTMLStrict(link.title) : undefined}
        target="_blank" rel="noopener noreferrer">{link.autolink
          ? <span class="markdown-text">{link.text}</span> : renderTokens(link.tokens)}</a> : literal(link.raw);
    }
    case "text": {
      const text = token as Tokens.Text;
      return text.tokens ? renderTokens(text.tokens) : <span class="markdown-text">{decodeHTMLStrict(text.text)}</span>;
    }
    case "escape": return <span class="markdown-text">{(token as Tokens.Escape).text}</span>;
    case "html": return literal(token.raw, Boolean((token as Tokens.HTML).block));
    default: return literal(token.raw);
  }
}

export function renderMarkdownTokens(tokens: unknown): ComponentChildren {
  validateMarkdownTokens(tokens);
  return renderTokens(tokens);
}
