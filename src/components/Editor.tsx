import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { isNoteIcon, normalizeNoteIcon, NOTE_ICON_PRESETS } from "../noteIcon";
import { renderLinks } from "./renderLinks";

interface EditorProps {
  isPreview: boolean;
  onPreviewChange: (isPreview: boolean) => void;
  icon: string;
  onIconChange: (icon: string) => void;
  iconDisabled: boolean;
  noteId?: string;
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onTitleConfirm: () => void;
  onContentChange: (value: string) => void;
  showTitleSave: boolean;
  isTitleSaving: boolean;
}

export function Editor({ isPreview, onPreviewChange, icon, onIconChange, iconDisabled, noteId, title, content, onTitleChange, onTitleConfirm, onContentChange, showTitleSave, isTitleSaving }: EditorProps) {
  const [isIconOpen, setIsIconOpen] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previousPreview = useRef(isPreview);
  const togglePreview = () => onPreviewChange(!isPreview);
  useLayoutEffect(() => {
    if (previousPreview.current === isPreview) return;
    previousPreview.current = isPreview;
    (isPreview ? previewRef.current : contentRef.current)?.focus();
  }, [isPreview]);
  const [customIcon, setCustomIcon] = useState("");
  const [iconError, setIconError] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const selectedIconRef = useRef<HTMLButtonElement>(null);
  const customIconRef = useRef<HTMLInputElement>(null);
  const closeIconPicker = () => {
    setIsIconOpen(false);
    iconButtonRef.current?.focus();
  };
  const chooseIcon = (value: string) => {
    if (!isNoteIcon(value)) {
      setIconError(true);
      customIconRef.current?.focus();
      return;
    }
    onIconChange(normalizeNoteIcon(value));
    closeIconPicker();
  };

  useLayoutEffect(() => { setIsIconOpen(false); }, [noteId, iconDisabled]);
  useLayoutEffect(() => {
    if (!isIconOpen) return;
    (selectedIconRef.current ?? customIconRef.current)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeIconPicker();
      }
    };
    const handleOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !iconPickerRef.current?.contains(event.target)) closeIconPicker();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [isIconOpen]);

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
  }, [content, isPreview]);

  return (
    <main class="editor-shell" id="editor-shell">
      <div class="editor">
        <div class="editor-title-row">
          <div class="note-icon-picker" ref={iconPickerRef}>
            <button type="button" class="note-icon-button" ref={iconButtonRef}
              aria-label="Zmień ikonę notatki" aria-expanded={isIconOpen}
              aria-controls="note-icon-panel" disabled={iconDisabled}
              onClick={() => {
                if (isIconOpen) closeIconPicker();
                else { setCustomIcon(icon); setIconError(false); setIsIconOpen(true); }
              }}>{icon}</button>
            {isIconOpen && (
              <div class="note-icon-panel" id="note-icon-panel" role="dialog" aria-label="Ikona notatki">
                <div class="note-icon-presets">
                  {NOTE_ICON_PRESETS.map((preset) => (
                    <button type="button" key={preset} aria-label={`Wybierz ikonę ${preset}`}
                      ref={icon === preset ? selectedIconRef : undefined}
                      aria-pressed={icon === preset} onClick={() => chooseIcon(preset)}>{preset}</button>
                  ))}
                </div>
                <form onSubmit={(event) => { event.preventDefault(); chooseIcon(customIcon); }}>
                  <label for="custom-note-icon">Własne emoji</label>
                  <div class="note-icon-custom">
                    <input id="custom-note-icon" ref={customIconRef} value={customIcon}
                      autoComplete="off" aria-invalid={iconError} aria-describedby={iconError ? "note-icon-error" : undefined}
                      onInput={(event) => { setCustomIcon(event.currentTarget.value); setIconError(false); }} />
                    <button type="submit">Zastosuj</button>
                  </div>
                  {iconError && <p id="note-icon-error" role="alert">Wpisz jedno emoji.</p>}
                </form>
              </div>
            )}
          </div>
          <label class="editor-title-label">
            <span class="visually-hidden">Tytuł notatki</span>
            <input
              class="editor-title"
              value={title}
              placeholder="Bez tytułu"
              autoComplete="off"
              onInput={(event) => onTitleChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.isComposing && !event.repeat && showTitleSave && !isTitleSaving) {
                  event.preventDefault();
                  onTitleConfirm();
                }
              }}
            />
          </label>
          {showTitleSave && (
            <button
              class="title-save-button"
              type="button"
              aria-label="Zapisz tytuł"
              title="Zapisz tytuł (Enter)"
              aria-keyshortcuts="Enter"
              disabled={isTitleSaving}
              onClick={onTitleConfirm}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
              </svg>
            </button>
          )}
        </div>
        <div onKeyDown={(event) => {
          if (event.isComposing || event.repeat) return;
          if ((event.key === "Enter" && event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey)
            || (event.key === "Escape" && isPreview)) {
            event.preventDefault();
            togglePreview();
          }
        }}>
          {/* Keep the textarea mounted to preserve selection and native undo history. */}
          <label hidden={isPreview}>
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
          {isPreview && <div ref={previewRef} class="editor-content editor-preview" tabIndex={0}
            role="region" aria-label="Podgląd notatki">{renderLinks(content)}</div>}
        </div>
      </div>
    </main>
  );
}
