import type { Token } from "marked";

export const MARKDOWN_LIMITS = {
  contentLength: 250_000,
  tokenCount: 10_000,
  depth: 32,
  timeoutMs: 1_000,
} as const;

export type MarkdownFailure = "content-limit" | "token-limit" | "depth-limit" | "invalid-tokens" | "parse-error";
export type MarkdownResult = { ok: true; tokens: Token[] } | { ok: false; reason: MarkdownFailure };
export interface MarkdownRequest { id: number; content: string }
export type MarkdownResponse = { id: number } & MarkdownResult;
