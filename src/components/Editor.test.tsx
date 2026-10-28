import { fireEvent, render, screen } from "@testing-library/preact";
import type { ComponentProps } from "preact";
import { useState } from "preact/hooks";
import { describe, expect, it, vi } from "vitest";
import { Editor } from "./Editor";

const props = {
  icon: "📝", onIconChange: vi.fn(), iconDisabled: false, noteId: "first",
  title: "Notatka", content: "Przed\n[Preact](https://preactjs.com)\nPo",
  onTitleChange: vi.fn(), onTitleConfirm: vi.fn(), onContentChange: vi.fn(),
  showTitleSave: false, isTitleSaving: false,
};

function EditorHarness(overrides: Partial<ComponentProps<typeof Editor>>) {
  const [isPreview, setIsPreview] = useState(false);
  return <Editor {...props} {...overrides} isPreview={isPreview} onPreviewChange={setIsPreview} />;
}

function togglePreview() {
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Treść notatki" }), { key: "Enter", ctrlKey: true });
}

describe("link preview", () => {
  it("toggles with Ctrl+Enter and Escape, preserves source and selection without edits", () => {
    const onContentChange = vi.fn();
    render(<EditorHarness onContentChange={onContentChange} />);
    const textarea = screen.getByRole("textbox", { name: "Treść notatki" }) as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(3, 8);
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    const preview = screen.getByRole("region", { name: "Podgląd notatki" });
    expect(preview).toHaveFocus();
    expect(preview.textContent).toBe("Przed\nPreact\nPo");
    const link = screen.getByRole("link", { name: "Preact" });
    expect(link).toHaveAttribute("href", "https://preactjs.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.keyDown(link, { key: "Enter", ctrlKey: true });
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue(props.content);
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([3, 8]);
    togglePreview();
    fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" });
    expect(textarea).toHaveFocus();
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it("leaves HTML, other Markdown, malformed and unsafe links as literal text", () => {
    const content = '<img src=x onerror=alert(1)> **tekst** # nagłówek\n[x](javascript:alert(1)) [x](data:text/html,test) [x](//example.com) [x](https://) [x](https://example.com [brak](url)';
    const { container } = render(<EditorHarness content={content} />);
    togglePreview();
    expect(screen.getByRole("region").textContent).toBe(content);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelector("img, strong, h1")).toBeNull();
  });

  it("renders multiple HTTP/HTTPS links with parentheses and literal labels", () => {
    render(<EditorHarness content={'[<b>tekst</b>](http://example.com) i [Wiki](https://example.com/wiki/Test_(abc))'} />);
    togglePreview();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "<b>tekst</b>" }).querySelector("b")).toBeNull();
    expect(screen.getByRole("link", { name: "Wiki" })).toHaveAttribute("href", "https://example.com/wiki/Test_(abc)");
  });

  it("accepts mode changes from the drawer without remounting the textarea", () => {
    const onPreviewChange = vi.fn();
    const { rerender } = render(<Editor {...props} isPreview={false} onPreviewChange={onPreviewChange} />);
    const textarea = screen.getByRole("textbox", { name: "Treść notatki" });
    rerender(<Editor {...props} isPreview onPreviewChange={onPreviewChange} />);
    expect(screen.getByRole("region")).toHaveFocus();
    rerender(<Editor {...props} isPreview={false} onPreviewChange={onPreviewChange} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Treść notatki" })).toBe(textarea);
    expect(textarea).toHaveFocus();
    expect(onPreviewChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Podgląd linków" })).not.toBeInTheDocument();
  });

  it("ignores normal Enter, repeated keys and IME composition", () => {
    render(<EditorHarness />);
    const textarea = screen.getByRole("textbox", { name: "Treść notatki" });
    for (const modifiers of [{}, { ctrlKey: true, repeat: true }, { ctrlKey: true, isComposing: true },
      { ctrlKey: true, shiftKey: true }, { ctrlKey: true, altKey: true }, { ctrlKey: true, metaKey: true }]) {
      fireEvent.keyDown(textarea, { key: "Enter", ...modifiers });
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    }
  });
});
