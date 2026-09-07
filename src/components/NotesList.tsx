import type { Note } from "../types";

interface NotesListProps {
  notes: Note[];
  activeSlug?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (slug: string) => void;
}

export function NotesList({ notes, activeSlug, search, onSearchChange, onSelect }: NotesListProps) {
  const normalizedSearch = search.trim().toLocaleLowerCase("pl-PL");
  const filteredNotes = notes.filter((note) => note.title.toLocaleLowerCase("pl-PL").includes(normalizedSearch));

  return (
    <>
      <label>
        <span class="visually-hidden">Szukaj notatek</span>
        <input
          class="search"
          type="search"
          placeholder="Szukaj po tytule"
          value={search}
          onInput={(event) => onSearchChange(event.currentTarget.value)}
        />
      </label>

      <p class="section-label">Ostatnio edytowane</p>
      {filteredNotes.length === 0 ? (
        <p class="empty-list">{notes.length === 0 ? "Nie masz jeszcze żadnych notatek." : "Brak pasujących notatek."}</p>
      ) : (
        <nav class="notes-list" aria-label="Lista notatek">
          {filteredNotes.map((note) => (
            <button
              class={`note-list-item${note.slug === activeSlug ? " is-active" : ""}`}
              type="button"
              aria-current={note.slug === activeSlug ? "page" : undefined}
              onClick={() => onSelect(note.slug)}
            >
              {note.title}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
