import type { Token } from "marked";
import { MARKDOWN_LIMITS, type MarkdownFailure } from "./protocol";

export class MarkdownValidationError extends Error {
  constructor(readonly reason: MarkdownFailure) { super(reason); }
}

// Validate iteratively before either structured cloning or recursive rendering.
// This module deliberately has no runtime dependency on Marked in the UI bundle.
export function validateMarkdownTokens(value: unknown): asserts value is Token[] {
  const fail = (reason: MarkdownFailure = "invalid-tokens"): never => { throw new MarkdownValidationError(reason); };
  if (!Array.isArray(value)) fail();
  const stack: { tokens: unknown[]; depth: number; items?: boolean }[] = [{ tokens: value as unknown[], depth: 1 }];
  let count = 0;
  while (stack.length) {
    const { tokens, depth, items } = stack.pop()!;
    if (depth > MARKDOWN_LIMITS.depth) fail("depth-limit");
    for (const candidate of tokens) {
      if (++count > MARKDOWN_LIMITS.tokenCount) fail("token-limit");
      if (!candidate || typeof candidate !== "object") fail();
      const token = candidate as Record<string, unknown>;
      if (typeof token.type !== "string" || typeof token.raw !== "string") fail();
      if (items && token.type !== "list_item") fail();
      let children: unknown;
      switch (token.type) {
        case "heading":
          if (!Number.isInteger(token.depth) || Number(token.depth) < 1 || Number(token.depth) > 6) fail();
          children = token.tokens;
          break;
        case "paragraph": case "blockquote": case "strong": case "em": case "list_item": case "image":
          children = token.tokens;
          break;
        case "link":
          if (typeof token.href !== "string" || typeof token.text !== "string" || (token.title != null && typeof token.title !== "string")
            || (token.autolink !== undefined && typeof token.autolink !== "boolean")) fail();
          children = token.tokens;
          break;
        case "list":
          if (typeof token.ordered !== "boolean" || typeof token.loose !== "boolean"
            || (token.ordered && (!Number.isSafeInteger(token.start) || Number(token.start) < 0))) fail();
          children = token.items;
          break;
        case "text":
          if (typeof token.text !== "string") fail();
          if (token.tokens !== undefined) children = token.tokens;
          break;
        case "escape": case "code": case "codespan":
          if (typeof token.text !== "string") fail();
          break;
        case "def":
          if (typeof token.href !== "string" || typeof token.tag !== "string") fail();
          break;
        // Literal rendering does not remove child tokens from the worker message.
        // Count auxiliary token trees even when their content is shown from raw.
        default: children = token.tokens; break;
      }
      if (children !== undefined) {
        if (!Array.isArray(children)) throw new MarkdownValidationError("invalid-tokens");
        if (count + children.length > MARKDOWN_LIMITS.tokenCount) fail("token-limit");
        stack.push({ tokens: children, depth: depth + 1, items: token.type === "list" });
      } else if (["heading", "paragraph", "blockquote", "strong", "em", "list_item", "image", "link", "list"].includes(String(token.type))) {
        fail();
      }
    }
  }
}
