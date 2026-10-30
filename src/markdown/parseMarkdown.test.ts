import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parseMarkdown";
import { MARKDOWN_LIMITS } from "./protocol";
import { validateMarkdownTokens } from "./validateMarkdownTokens";

describe("Markdown tokenization and budgets", () => {
  it("uses CommonMark tokens, resolves references and survives structured cloning", () => {
    const result = parseMarkdown("# Tytuł\n\n**mocne** *kursywa* [link][id]\n\n[id]: https://example.com\n\n- [x] zadanie\n\n~~tekst~~\n\n| a | b |\n| - | - |");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(() => validateMarkdownTokens(structuredClone(result.tokens))).not.toThrow();
    const serialized = JSON.stringify(result.tokens);
    for (const type of ["heading", "strong", "em", "link", "list", "def"]) expect(serialized).toContain(`"type":"${type}"`);
    for (const type of ["table", "del", "checkbox"]) expect(serialized).not.toContain(`"type":"${type}"`);
    expect(result.tokens).not.toHaveProperty("links");
  });

  it("handles empty notes and rejects length before tokenization", () => {
    expect(parseMarkdown("")).toEqual({ ok: true, tokens: [] });
    expect(parseMarkdown("a".repeat(MARKDOWN_LIMITS.contentLength + 1))).toEqual({ ok: false, reason: "content-limit" });
    expect(parseMarkdown("a".repeat(MARKDOWN_LIMITS.contentLength)).ok).toBe(true);
  });

  it("limits real token count and nesting", () => {
    expect(parseMarkdown("*x* ".repeat(5_001))).toEqual({ ok: false, reason: "token-limit" });
    expect(parseMarkdown("> ".repeat(40) + "tekst")).toEqual({ ok: false, reason: "depth-limit" });
  });

  it("counts image label tokens before transferring even though images render literally", () => {
    const content = "![" + "*x* ".repeat(5_001) + "](https://example.com/image.png)";
    expect(parseMarkdown(content)).toEqual({ ok: false, reason: "token-limit" });
  });

  it("limits nesting inside image labels", () => {
    let label = "x";
    for (let i = 0; i < 40; i++) {
      const marker = i % 2 ? "**" : "*";
      label = marker + "a " + label + " b" + marker;
    }
    const content = "![" + label + "](https://example.com/image.png)";
    expect(parseMarkdown(content)).toEqual({ ok: false, reason: "depth-limit" });
  });

  it("checks auxiliary children on future literal tokens", () => {
    const tokens = Array(MARKDOWN_LIMITS.tokenCount).fill({ type: "text", raw: "x", text: "x" });
    expect(() => validateMarkdownTokens([{ type: "future", raw: "literal", tokens }])).toThrow("token-limit");
    expect(() => validateMarkdownTokens([{ type: "future", raw: "literal", tokens: [{ type: "text", text: "missing raw" }] }])).toThrow("invalid-tokens");
  });

  it("validates the exact count and depth boundaries iteratively", () => {
    const text = { type: "text", raw: "a", text: "a" };
    expect(() => validateMarkdownTokens(Array(MARKDOWN_LIMITS.tokenCount).fill(text))).not.toThrow();
    expect(() => validateMarkdownTokens(Array(MARKDOWN_LIMITS.tokenCount + 1).fill(text))).toThrow("token-limit");
    let nested: unknown[] = [text];
    for (let i = 1; i < MARKDOWN_LIMITS.depth; i++) nested = [{ type: "em", raw: "*a*", tokens: nested }];
    expect(() => validateMarkdownTokens(nested)).not.toThrow();
    expect(() => validateMarkdownTokens([{ type: "em", raw: "*a*", tokens: nested }])).toThrow("depth-limit");
  });

  it.each([null, {}, [null], [{ type: "future" }], [{ type: "text", raw: "x" }],
    [{ type: "paragraph", raw: "x" }], [{ type: "heading", raw: "x", depth: 7, tokens: [] }],
    [{ type: "list", raw: "x", ordered: false, loose: false, items: [{ type: "text", raw: "x", text: "x" }] }],
  ])("rejects malformed trees instead of dropping source: %j", (tokens) => {
    expect(() => validateMarkdownTokens(tokens)).toThrow("invalid-tokens");
  });
});
