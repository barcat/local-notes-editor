import { useLayoutEffect, useRef } from "preact/hooks";

interface EditorProps {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onTitleConfirm: () => void;
  onContentChange: (value: string) => void;
  showTitleSave: boolean;
  isTitleSaving: boolean;
}

export function Editor({ title, content, onTitleChange, onTitleConfirm, onContentChange, showTitleSave, isTitleSaving }: EditorProps) {
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
        <div class="editor-title-row">
          <label class="editor-title-label">
            <span class="visually-hidden">Tytuł notatki</span>
            <input
              class="editor-title"
              value={title}
              placeholder="Bez tytułu"
              autoComplete="off"
              onInput={(event) => onTitleChange(event.currentTarget.value)}
            />
          </label>
          {showTitleSave && (
            <button
              class="title-save-button"
              type="button"
              aria-label="Zapisz tytuł"
              disabled={isTitleSaving}
              onClick={onTitleConfirm}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 4h11l3 3v13H5zM8 4v6h8V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
              </svg>
            </button>
          )}
        </div>
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
