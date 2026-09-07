import { addSlugSuffix, firstAvailableSlug, slugify } from "./slug";
import type { Note, NoteRepository } from "./types";

export const DEFAULT_NOTE_TITLE = "Bez tytułu";
export const MAX_SLUG_ATTEMPTS = 100;

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

export function createNoteId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeNoteTitle(title: string): string {
  return title.trim() || DEFAULT_NOTE_TITLE;
}

export function createNote(title = "", content = "", now = Date.now()): Note {
  return {
    id: createNoteId(),
    title: normalizeNoteTitle(title),
    slug: slugify(title),
    content,
    updatedAt: now,
  };
}

export async function getAvailableSlug(
  title: string,
  repository: NoteRepository,
  exceptId?: string,
): Promise<string> {
  const base = slugify(title);
  for (let suffix = 1; suffix <= MAX_SLUG_ATTEMPTS; suffix += 1) {
    const candidate = suffix === 1 ? base : addSlugSuffix(base, suffix);
    if (await repository.isSlugAvailable(candidate, exceptId)) return candidate;
  }

  throw new Error("Nie udało się znaleźć wolnego sluga.");
}

export async function saveNote(
  note: Note,
  repository: NoteRepository,
  now = Date.now(),
): Promise<Note> {
  const title = normalizeNoteTitle(note.title);
  const baseSlug = slugify(title);

  for (let suffix = 1; suffix <= MAX_SLUG_ATTEMPTS; suffix += 1) {
    const slug = suffix === 1 ? baseSlug : addSlugSuffix(baseSlug, suffix);
    if (!(await repository.isSlugAvailable(slug, note.id))) continue;

    const savedNote = { ...note, title, slug, updatedAt: now };
    try {
      await repository.save(savedNote);
      return savedNote;
    } catch (error) {
      if (!isConstraintError(error)) throw error;
    }
  }

  throw new Error("Nie udało się zapisać notatki z unikalnym slugiem.");
}

export function chooseAvailableSlug(baseSlug: string, occupiedSlugs: Iterable<string>): string {
  return firstAvailableSlug(baseSlug, occupiedSlugs);
}
