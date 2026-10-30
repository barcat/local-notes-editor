import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../markdown/parseMarkdown";
import { safeLink } from "../markdown/safeLink";
import { renderMarkdownTokens } from "./renderMarkdownTokens";

function preview(content: string) {
  const result = parseMarkdown(content);
  if (!result.ok) throw new Error(result.reason);
  return render(<div class="editor-preview" data-testid="preview">{renderMarkdownTokens(result.tokens)}</div>).container;
}

describe("controlled Markdown rendering", () => {
  it("renders every v1 block and inline element, with soft and hard line breaks", () => {
    const container = preview("# A\n\n## B\n\n### C\n\n#### D\n\n##### E\n\n###### F\n\none\ntwo  \nthree\\\nfour\n\n**bold** *italic* `code`\n\n> quote\n\n---\n\n3. three\n   - child\n     - grandchild\n4. four\n\n- first\n\n  second paragraph\n\n    indented\n\n```js\nconst x = 1;\n```\n");
    for (let depth = 1; depth <= 6; depth++) expect(container.querySelector(`h${depth}`)).not.toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("one\ntwothreefour");
    expect(container.querySelectorAll("br")).toHaveLength(2);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
    expect(container.querySelector("blockquote p")).toHaveTextContent("quote");
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelector("ol")).toHaveAttribute("start", "3");
    expect(container.querySelector("ol > li > ul > li > ul > li")).toHaveTextContent("grandchild");
    expect(container.querySelector("li > p")).not.toBeNull();
    expect(container.querySelector("pre code")).toHaveTextContent("const x = 1;");
    expect(container.querySelector("p p, p ul, p ol, li > li")).toBeNull();
  });

  it("keeps HTML, SVG, images and code literal, without active elements or event attributes", () => {
    const html = '<svg onload="alert(1)"><script>alert(1)</script></svg>\n<img src="https://evil.example/pixel" onerror="alert(1)">\n<iframe src="https://evil.example"></iframe>';
    const image = "![obraz](https://evil.example/pixel)";
    const code = '[x](https://example.com) <img src=x> &amp;';
    const container = preview(`${html}\n\n${image}\n\n\`${code}\`\n\n\`\`\`html\n${code}\n\`\`\``);
    for (const line of html.split("\n")) expect(container.textContent).toContain(line);
    expect(container.textContent).toContain(image);
    expect(container.querySelectorAll("code")).toHaveLength(2);
    for (const element of container.querySelectorAll("code")) expect(element.textContent).toBe(code);
    expect(container.querySelector("img, svg, script, iframe, a, [onload], [onerror], [src]")).toBeNull();
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "file:///tmp/x", "mailto:a@example.com", "/relative", "//example.com", "https://", "https://[invalid]", "jav&#x61;script:alert(1)", "https://example.com/&#10;x", "https://example.com/&NewLine;x", "https://example.com/\u007f", "https://example.com/\u0085"])("keeps rejected URL syntax literal: %s", (url) => {
    const source = `[**x**](${url})`;
    const container = preview(source);
    expect(container.querySelector("a, strong")).toBeNull();
    expect(container.textContent).toBe(source);
    expect(safeLink(url)).toBeNull();
  });

  it("supports nested parentheses, IPv6, adjacent links and safe formatted labels", () => {
    const container = preview('[**Wiki**](https://example.com/a_(b_(c)))[IPv6](https://[2001:db8::1]/doc_(v2)) [<b>tekst</b>](http://example.com)');
    expect(screen.getByRole("link", { name: "Wiki" })).toHaveAttribute("href", "https://example.com/a_(b_(c))");
    expect(screen.getByRole("link", { name: "Wiki" }).querySelector("strong")).not.toBeNull();
    expect(screen.getByRole("link", { name: "IPv6" })).toHaveAttribute("href", "https://[2001:db8::1]/doc_(v2)");
    const htmlLabel = screen.getByRole("link", { name: /<b>.*tekst.*<\/b>/ });
    expect(htmlLabel.textContent).toBe("<b>tekst</b>");
    expect(htmlLabel.querySelector("b")).toBeNull();
    for (const link of container.querySelectorAll("a")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("decodes entities into text and destinations without interpreting the resulting HTML", () => {
    const container = preview('&lt;img src=x&gt; &amp; &#65; &#38;amp; \\* [A &amp; B](https://example.com/?a=1&amp;b=2 "A &amp; B")');
    expect(container.textContent).toBe('<img src=x> & A &amp; * A & B');
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com/?a=1&b=2");
    expect(screen.getByRole("link")).toHaveAttribute("title", "A & B");
  });

  it("uses reference definitions as metadata, and leaves GFM features literal", () => {
    const container = preview("[ref][id]\n\n[id]: https://example.com\n\n- [x] task\n\n~~strike~~\n\n| a | b |\n| - | - |");
    expect(screen.getByRole("link", { name: "ref" })).toHaveAttribute("href", "https://example.com");
    expect(container.textContent).not.toContain("[id]:");
    expect(container.textContent).toContain("[x] task");
    expect(container.textContent).toContain("~~strike~~");
    expect(container.querySelector("input, del, table")).toBeNull();
  });

  it("keeps entities literal in autolinks, as required by Markdown", () => {
    const url = "https://example.com/?a=1&amp;b=2";
    preview(`<${url}>`);
    expect(screen.getByRole("link").textContent).toBe(url);
    expect(screen.getByRole("link")).toHaveAttribute("href", url);
  });

  it("preserves incomplete labels and destinations while letting Marked recover later links", () => {
    const incomplete = "[".repeat(500);
    const container = preview(`${incomplete}\n[Dalej](https://example.com/next)`);
    expect(container.textContent).toBe(`${incomplete}\nDalej`);
    expect(screen.getByRole("link", { name: "Dalej" })).toHaveAttribute("href", "https://example.com/next");
  });

  it("keeps invalid complete destinations literal and resumes at the next link", () => {
    const invalid = "[brak](https://[wewnątrz](https://example.com))";
    const container = preview(`${invalid} [Dalej](https://example.com/next)`);
    expect(container.textContent).toContain(invalid);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Dalej" })).toBeInTheDocument();
  });

  it("shows unknown raw tokens and rejects missing source for the whole preview", () => {
    const source = '<future onload="x">';
    const { container } = render(<div>{renderMarkdownTokens([{ type: "future", raw: source }])}</div>);
    expect(container.textContent).toBe(source);
    expect(container.querySelector("future")).toBeNull();
    expect(() => renderMarkdownTokens([{ type: "future" }])).toThrow("invalid-tokens");
  });
});
