import { Marked } from "marked";
import { MARKDOWN_LIMITS, type MarkdownResult } from "./protocol";
import { MarkdownValidationError, validateMarkdownTokens } from "./validateMarkdownTokens";

const marked = new Marked({ gfm: false, pedantic: false, breaks: false, async: false });

export function parseMarkdown(content: string): MarkdownResult {
  if (content.length > MARKDOWN_LIMITS.contentLength) return { ok: false, reason: "content-limit" };
  try {
    // Reference definitions have already been resolved by the lexer. Drop the
    // array's auxiliary links map; send the actual, serializable tokens only.
    const tokens = Array.from(marked.lexer(content));
    validateMarkdownTokens(tokens);
    return { ok: true, tokens };
  } catch (error) {
    return { ok: false, reason: error instanceof MarkdownValidationError ? error.reason : "parse-error" };
  }
}
