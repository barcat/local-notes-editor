import { useEffect, useRef, useState } from "preact/hooks";
import { NotesList } from "./NotesList";
import type { Note } from "../types";

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNewNote: () => void;
  notes: Note[];
  activeSlug?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (slug: string) => void;
}

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface ColorControlProps {
  label: string;
  property: string;
  initialValue: string;
}

function ColorControl({ label, property, initialValue }: ColorControlProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <span class="color-control">
      <input
        class="color-picker"
        type="color"
        value={value}
        aria-label={label}
        onInput={(event) => {
          const nextValue = event.currentTarget.value;
          setValue(nextValue);
          document.documentElement.style.setProperty(property, nextValue);
        }}
      />
      <span class="hex-value">{value}</span>
    </span>
  );
}

export function LeftDrawer({ isOpen, onClose, onNewNote, notes, activeSlug, search, onSearchChange, onSelectNote }: LeftDrawerProps) {
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

  const setCssProperty = (property: string, value: string) => {
    document.documentElement.style.setProperty(property, value);
    window.dispatchEvent(new Event("editor-appearance-change"));
  };

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

          <section class="settings-card" aria-labelledby="appearance-title">
            <h2 class="card-title" id="appearance-title">Appearance</h2>
            <label class="setting-row">
              <span class="setting-label">Background</span>
              <ColorControl label="Kolor tła" property="--editor-bg" initialValue="#233d4d" />
            </label>
            <label class="setting-row">
              <span class="setting-label">Font Color</span>
              <ColorControl label="Kolor tekstu" property="--editor-text" initialValue="#fe7f2d" />
            </label>
          </section>

          <section class="settings-card" aria-labelledby="typography-title">
            <h2 class="card-title" id="typography-title">Typography</h2>
            <label class="setting-row">
              <span class="setting-label">Font</span>
              <select
                class="select"
                defaultValue="Courier New"
                onChange={(event) => setCssProperty("--editor-font-family", `"${event.currentTarget.value}", monospace`)}
              >
                <option>Courier New</option>
                <option>Consolas</option>
                <option>Georgia</option>
                <option>Arial</option>
              </select>
            </label>
            <label class="setting-row">
              <span class="setting-label">Font Size</span>
              <select
                class="select"
                defaultValue="13"
                onChange={(event) => setCssProperty("--editor-font-size", `${event.currentTarget.value}pt`)}
              >
                {[11, 12, 13, 14, 16, 18].map((size) => <option value={size}>{size}pt</option>)}
              </select>
            </label>
            <label class="setting-row">
              <span class="setting-label">Line Height</span>
              <input
                class="number-input"
                type="number"
                min="1.2"
                max="2.4"
                step="0.1"
                defaultValue="1.8"
                onInput={(event) => setCssProperty("--editor-line-height", event.currentTarget.value)}
              />
            </label>
            <label class="setting-row">
              <span class="setting-label">Width (px)</span>
              <input
                class="number-input"
                type="number"
                min="480"
                max="1200"
                step="10"
                defaultValue="920"
                onInput={(event) => setCssProperty("--editor-width", `${event.currentTarget.value}px`)}
              />
            </label>
          </section>

          <div class="drawer-actions">
            <button class="secondary-action" type="button" disabled>Eksportuj .txt</button>
            <button class="danger-action" type="button" disabled>Usuń</button>
          </div>

          <p class="local-note">Notatki pozostają wyłącznie w tej przeglądarce.</p>
        </div>
      </aside>
    </>
  );
}
