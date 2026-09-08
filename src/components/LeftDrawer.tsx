import { useEffect, useRef } from "preact/hooks";
import { AppearanceSettings } from "./AppearanceSettings";
import { NotesList } from "./NotesList";
import type { EditorPreferences, Note } from "../types";

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNewNote: () => void;
  notes: Note[];
  activeSlug?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (slug: string) => void;
  preferences: EditorPreferences;
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
  onClose,
  onNewNote,
  notes,
  activeSlug,
  search,
  onSearchChange,
  onSelectNote,
  preferences,
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
    if (!isOpen) return;
    closeButtonRef.current?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
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
  }, [isOpen, onClose]);

  return (
    <>
      <button
        class={`backdrop${isOpen ? " is-visible" : ""}`}
        type="button"
        tabIndex={-1}
        aria-label="Zamknij panel"
        aria-hidden={!isOpen}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        class={`drawer${isOpen ? " is-open" : ""}`}
        id="left-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Notatki i ustawienia"
        aria-hidden={!isOpen}
        {...(!isOpen && { inert: true })}
      >
        <div class="drawer-inner">
          <header class="drawer-header">
            <h1 class="drawer-title">Lokalne notatki</h1>
            <button ref={closeButtonRef} class="icon-button" type="button" aria-label="Zamknij panel" onClick={onClose}>
              ×
            </button>
          </header>

          <button class="primary-action" type="button" onClick={onNewNote}>+ Nowa notatka</button>

          <NotesList
            notes={notes}
            activeSlug={activeSlug}
            search={search}
            onSearchChange={onSearchChange}
            onSelect={onSelectNote}
          />

          <AppearanceSettings
            preferences={preferences}
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
