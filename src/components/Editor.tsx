import { useLayoutEffect, useRef } from "preact/hooks";

interface EditorProps {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
}

export function Editor({ title, content, onTitleChange, onContentChange }: EditorProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(textarea.scrollHeight, window.innerHeight - 230)}px`;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("editor-appearance-change", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("editor-appearance-change", resize);
    };
  }, [content]);

  return (
    <main class="editor-shell" id="editor-shell">
      <div class="editor">
        <label>
          <span class="visually-hidden">Tytuł notatki</span>
          <input
            class="editor-title"
            value={title}
            placeholder="Bez tytułu"
            autoComplete="off"
            onInput={(event) => onTitleChange(event.currentTarget.value)}
          />
        </label>
        <label>
          <span class="visually-hidden">Treść notatki</span>
          <textarea
            ref={contentRef}
            class="editor-content"
            value={content}
            placeholder="Zacznij pisać…"
            spellcheck
            onInput={(event) => onContentChange(event.currentTarget.value)}
          />
        </label>
      </div>
    </main>
  );
}
