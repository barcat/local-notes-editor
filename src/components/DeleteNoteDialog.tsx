import { useEffect, useRef } from "preact/hooks";

interface DeleteNoteDialogProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function DeleteNoteDialog({ title, onCancel, onConfirm }: DeleteNoteDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
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
  }, [onCancel]);

  return (
    <div class="dialog-backdrop" role="presentation">
      <section ref={dialogRef} class="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-note-title">
        <h2 id="delete-note-title">Usunąć notatkę?</h2>
        <p>Notatka „{title || "Bez tytułu"}” zostanie usunięta z tej przeglądarki.</p>
        <div class="delete-dialog-actions">
          <button ref={cancelButtonRef} type="button" class="secondary-action" onClick={onCancel}>Anuluj</button>
          <button type="button" class="danger-action" onClick={onConfirm}>Usuń notatkę</button>
        </div>
      </section>
    </div>
  );
}
