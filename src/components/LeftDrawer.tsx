import { useEffect, useRef } from "preact/hooks";
import { AppearanceSettings } from "./AppearanceSettings";
import { NotesList } from "./NotesList";
import type { EditorPreferences, Note } from "../types";

interface LeftDrawerProps {
  isOpen: boolean;
  isModal: boolean;
  onClose: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onInteract: () => void;
  isPreview: boolean;
  onTogglePreview: () => void;
  previewDisabled: boolean;
  onAllNotes: () => void;
  navigationDisabled?: boolean;
  onNewNote: () => void;
  isCreatingNote?: boolean;
  notes: Note[];
  activeSlug?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (slug: string) => void;
  preferences: EditorPreferences;
  appearanceDisabled?: boolean;
  preferencesStorageWarning: string | null;
  onPreferencesChange: (patch: Partial<EditorPreferences>) => void;
  onResetColors: () => void;
  dataNoticeDismissed: boolean;
  onDismissDataNotice: () => void;
  canExport: boolean;
  canDelete: boolean;
  onExport: () => void;
  onDelete: () => void;
}

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function LeftDrawer({
  isOpen,
  isModal,
  onClose,
  onPointerEnter,
  onPointerLeave,
  onInteract,
  isPreview,
  onTogglePreview,
  previewDisabled,
  onNewNote,
  onAllNotes,
  navigationDisabled,
  isCreatingNote = false,
  notes,
  activeSlug,
  search,
  onSearchChange,
  onSelectNote,
  preferences,
  appearanceDisabled,
  preferencesStorageWarning,
  onPreferencesChange,
  onResetColors,
  dataNoticeDismissed,
  onDismissDataNotice,
  canExport,
  canDelete,
  onExport,
  onDelete,
}: LeftDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen || !isModal) return;
    if (!drawerRef.current?.contains(document.activeElement)) closeButtonRef.current?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", keepFocusInside);
    return () => document.removeEventListener("keydown", keepFocusInside);
  }, [isOpen, isModal, onClose]);

  return (
    <>
      <button
        class={`backdrop${isModal ? " is-visible" : ""}`}
        type="button"
        tabIndex={-1}
        aria-label="Zamknij panel"
        aria-hidden={!isModal}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        class={`drawer${isOpen ? " is-open" : ""}`}
        id="left-drawer"
        role="dialog"
        aria-modal={isModal ? "true" : undefined}
        aria-label="Notatki i ustawienia"
        aria-hidden={!isOpen}
        {...(!isOpen && { inert: true })}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onInteract}
        onFocusIn={onInteract}
      >
        <div class="drawer-inner">
          <header class="drawer-header">
            <h1 class="drawer-title">LagoDraft</h1>
            <button ref={closeButtonRef} class="icon-button" type="button" aria-label="Zamknij panel" onClick={onClose}>
              ×
            </button>
          </header>

          <div class="drawer-mode-bar">
            <button type="button" class="editor-mode-button" aria-pressed={isPreview}
              aria-keyshortcuts="Control+Enter" title="Przełącz podgląd (Ctrl+Enter)"
              disabled={previewDisabled} onClick={onTogglePreview}>
              {isPreview ? "Wróć do edycji" : "Podgląd linków"}
            </button>
          </div>

          <div class="drawer-navigation">
            <button class="primary-action" type="button" disabled={isCreatingNote || navigationDisabled} onClick={onNewNote}>+ Nowa notatka</button>
            <button class="secondary-action" type="button" disabled={navigationDisabled} onClick={onAllNotes}>Wszystkie notatki</button>
          </div>

          <NotesList
            disabled={navigationDisabled}
            notes={notes}
            activeSlug={activeSlug}
            search={search}
            onSearchChange={onSearchChange}
            onSelect={onSelectNote}
          />

          <AppearanceSettings
            preferences={preferences}
            disabled={appearanceDisabled}
            storageWarning={preferencesStorageWarning}
            onChange={onPreferencesChange}
            onResetColors={onResetColors}
          />

          <div class="drawer-actions">
            <button class="secondary-action" type="button" disabled={!canExport} onClick={onExport}>Eksportuj .txt</button>
            <button class="danger-action" type="button" disabled={!canDelete} onClick={onDelete}>Usuń</button>
          </div>

          {!dataNoticeDismissed && (
            <aside class="local-note-box" role="status">
              <p>Notatki i ustawienia pozostają wyłącznie w tej przeglądarce.</p>
              <button type="button" onClick={onDismissDataNotice}>Rozumiem</button>
            </aside>
          )}
        </div>
      </aside>
    </>
  );
}
