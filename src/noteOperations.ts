import { addSlugSuffix, firstAvailableSlug, slugify } from "./slug";
import type { Note, NoteRepository } from "./types";

export const DEFAULT_NOTE_TITLE = "Bez tytułu";
export const MAX_SLUG_ATTEMPTS = 100;
export const AUTO_SAVE_DELAY = 400;

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

export interface SaveCoordinatorOptions {
  repository: NoteRepository;
  delay?: number;
  now?: () => number;
  onSaved?: (note: Note, isLatest: boolean) => void;
  onError?: (error: unknown, note: Note, isLatest: boolean) => void;
}

export interface SaveCoordinator {
  schedule(note: Note): number;
  flush(): Promise<Note | undefined>;
  cancel(): void;
  cancelAndWait(): Promise<void>;
  dispose(): void;
}

interface PendingSave {
  note: Note;
  version: number;
}

/** Serializes debounced writes so a slow older transaction cannot overwrite a newer draft. */
export function createSaveCoordinator({
  repository,
  delay = AUTO_SAVE_DELAY,
  now = Date.now,
  onSaved,
  onError,
}: SaveCoordinatorOptions): SaveCoordinator {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PendingSave | undefined;
  let active: Promise<Note | undefined> | undefined;
  let version = 0;
  let pendingIsReady = false;
  let disposed = false;

  const start = (): Promise<Note | undefined> => {
    if (active) return active;
    if (!pending || disposed) return Promise.resolve(undefined);

    const current = pending;
    pending = undefined;
    const operation = (async () => {
      try {
        const saved = await saveNote(current.note, repository, now());
        onSaved?.(saved, current.version === version);
        return saved;
      } catch (error) {
        onError?.(error, current.note, current.version === version);
        throw error;
      }
    })();

    active = operation;
    void operation.then(
      () => {
        active = undefined;
        if (pending && pendingIsReady) void start().catch(() => undefined);
      },
      () => {
        active = undefined;
        if (pending && pendingIsReady) void start().catch(() => undefined);
      },
    );
    return operation;
  };

  const schedule = (note: Note): number => {
    if (disposed) return version;
    version += 1;
    pending = { note, version };
    pendingIsReady = false;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      pendingIsReady = true;
      void start().catch(() => undefined);
    }, delay);
    return version;
  };

  const flush = async (): Promise<Note | undefined> => {
    if (disposed) return undefined;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pendingIsReady = true;

    let activeError: unknown;
    if (active) {
      try {
        await active;
      } catch (error) {
        activeError = error;
      }
    }

    if (pending) return start();
    if (activeError) throw activeError;
    return undefined;
  };

  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
    pendingIsReady = false;
    version += 1;
  };

  const cancelAndWait = async (): Promise<void> => {
    cancel();
    if (active) await active;
  };

  const dispose = () => {
    cancel();
    disposed = true;
  };

  return { schedule, flush, cancel, cancelAndWait, dispose };
}

export function chooseAvailableSlug(baseSlug: string, occupiedSlugs: Iterable<string>): string {
  return firstAvailableSlug(baseSlug, occupiedSlugs);
}

export function createTextExport(title: string, content: string): { blob: Blob; fileName: string } {
  return {
    blob: new Blob([content], { type: "text/plain;charset=utf-8" }),
    fileName: `${slugify(title)}.txt`,
  };
}
