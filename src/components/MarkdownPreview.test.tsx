import { render, screen } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKDOWN_LIMITS } from "../markdown/protocol";
import { installMarkdownWorker, MarkdownWorkerMock } from "../test/markdownWorker";
import { MarkdownPreview } from "./MarkdownPreview";

describe("Markdown worker lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); installMarkdownWorker(false); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const latest = () => MarkdownWorkerMock.instances.at(-1)!;
  const reply = () => act(() => latest().respond());

  it("shows original text while loading, then only announces the short status", () => {
    const { container } = render(<MarkdownPreview content="**tekst**" />);
    expect(screen.getByRole("status")).toHaveTextContent("Przygotowuję podgląd…");
    expect(container.querySelector(".markdown-plain")?.textContent).toBe("**tekst**");
    expect(screen.getByRole("status")).not.toHaveTextContent("**tekst**");
    reply();
    expect(container.querySelector("strong")).toHaveTextContent("tekst");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(latest().terminate).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("terminates at the deadline without automatic retry on parent renders", () => {
    const view = render(<MarkdownPreview content="**tekst**" noteId="a" />);
    act(() => { vi.advanceTimersByTime(MARKDOWN_LIMITS.timeoutMs - 1); });
    expect(latest().terminate).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(latest().terminate).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Dostępny jest tylko zwykły podgląd tekstu.");
    view.rerender(<MarkdownPreview content="**tekst**" noteId="a" />);
    expect(MarkdownWorkerMock.instances).toHaveLength(1);
    act(() => latest().respond());
    expect(view.container.querySelector("strong")).toBeNull();
    view.unmount();
    render(<MarkdownPreview content="**tekst**" noteId="a" />);
    expect(MarkdownWorkerMock.instances).toHaveLength(2);
    reply();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("cancels on source/note changes, discards stale and wrong-ID replies, and cleans up on unmount", () => {
    const view = render(<MarkdownPreview content="**old**" noteId="a" />);
    const old = latest();
    view.rerender(<MarkdownPreview content="**new**" noteId="a" />);
    const changed = latest();
    expect(old.terminate).toHaveBeenCalled();
    act(() => old.respond());
    expect(view.container.textContent).not.toContain("old");
    act(() => changed.respond({ id: -1, ok: true, tokens: [] }));
    expect(screen.getByRole("status")).toHaveTextContent("Przygotowuję");
    view.rerender(<MarkdownPreview content="**new**" noteId="b" />);
    expect(changed.terminate).toHaveBeenCalled();
    act(() => changed.respond());
    expect(screen.getByRole("status")).toHaveTextContent("Przygotowuję");
    reply();
    expect(view.container.querySelector("strong")).toHaveTextContent("new");
    view.rerender(<MarkdownPreview content="pending" noteId="b" />);
    const pending = latest();
    view.unmount();
    expect(pending.terminate).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    act(() => pending.respond());
    expect(view.container).toBeEmptyDOMElement();
  });

  it("rejects a reply past the deadline even before the timer callback is dispatched", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const { container } = render(<MarkdownPreview content="**late**" />);
    now.mockReturnValue(MARKDOWN_LIMITS.timeoutMs + 1);
    reply();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector(".markdown-plain")?.textContent).toBe("**late**");
    expect(latest().terminate).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["error", "messageerror", "parse-error", "token-limit", "depth-limit", "invalid-tokens"])("preserves the full source on %s", (reason) => {
    const content = "# Treść\n\n<b>całość</b>";
    const { container } = render(<MarkdownPreview content={content} />);
    act(() => {
      if (reason === "error") latest().onerror?.();
      else if (reason === "messageerror") latest().onmessageerror?.();
      else if (reason === "invalid-tokens") latest().respond({ id: latest().request!.id, ok: true, tokens: [{ type: "paragraph", raw: "lost" }] });
      else latest().respond({ id: latest().request!.id, ok: false, reason: reason as "parse-error" | "token-limit" | "depth-limit" });
    });
    expect(container.querySelector(".markdown-plain")?.textContent).toBe(content);
    expect(screen.getByRole("status")).toHaveTextContent("Dostępny jest tylko zwykły");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects length before constructing a worker", () => {
    const content = "a".repeat(MARKDOWN_LIMITS.contentLength + 1);
    const { container } = render(<MarkdownPreview content={content} />);
    expect(MarkdownWorkerMock.instances).toHaveLength(0);
    expect(container.querySelector(".markdown-plain")?.textContent).toBe(content);
  });

  it.each(["unsupported", "constructor", "postMessage"])("falls back when Worker is %s", (failure) => {
    if (failure === "unsupported") vi.stubGlobal("Worker", undefined);
    if (failure === "constructor") vi.stubGlobal("Worker", class { constructor() { throw new Error(); } });
    if (failure === "postMessage") vi.stubGlobal("Worker", class extends MarkdownWorkerMock {
      postMessage = vi.fn(() => { throw new Error(); });
    });
    const { container } = render(<MarkdownPreview content="**cała treść**" />);
    expect(container.querySelector(".markdown-plain")?.textContent).toBe("**cała treść**");
    expect(screen.getByRole("status")).toHaveTextContent("Dostępny jest tylko zwykły");
    expect(vi.getTimerCount()).toBe(0);
  });
});
