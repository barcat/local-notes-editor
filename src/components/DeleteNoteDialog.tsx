interface DeleteNoteDialogProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteNoteDialog({ title, onCancel, onConfirm }: DeleteNoteDialogProps) {
  return (
    <div class="dialog-backdrop" role="presentation">
      <section class="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-note-title">
        <h2 id="delete-note-title">Usunąć notatkę?</h2>
        <p>Notatka „{title || "Bez tytułu"}” zostanie usunięta z tej przeglądarki.</p>
        <div class="delete-dialog-actions">
          <button type="button" class="secondary-action" onClick={onCancel}>Anuluj</button>
          <button type="button" class="danger-action" onClick={onConfirm}>Usuń notatkę</button>
        </div>
      </section>
    </div>
  );
}
