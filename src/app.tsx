import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Editor } from "./components/Editor";
import { ErrorToast } from "./components/ErrorToast";
import { LeftDrawer } from "./components/LeftDrawer";
import { createNoteId, createSaveCoordinator } from "./noteOperations";
import { noteRepository } from "./noteRepository";
import type { Note, NoteDraft, NoteRepository } from "./types";

interface AppProps {
  repository?: NoteRepository;
  autoSaveDelay?: number;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function App({ repository = noteRepository, autoSaveDelay }: AppProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>({ title: "", content: "" });
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasUserEditedRef = useRef(false);

  const saveCoordinator = useMemo(
    () => createSaveCoordinator({
      repository,
      ...(autoSaveDelay === undefined ? {} : { delay: autoSaveDelay }),
      onSaved: (saved, isLatest) => {
        if (!isLatest) return;
        setDraft({ id: saved.id, title: saved.title, content: saved.content, slug: saved.slug });
        setIsDirty(false);
        setSaveError(null);
      },
      onError: (error, _note, isLatest) => {
        if (isLatest) setSaveError(errorMessage(error, "Nie udało się zapisać notatki."));
      },
    }),
    [autoSaveDelay, repository],
  );

  useEffect(() => () => saveCoordinator.dispose(), [saveCoordinator]);

  useEffect(() => {
    let cancelled = false;
    repository.getMostRecent().then((note) => {
      if (cancelled) return;
      if (note && !hasUserEditedRef.current) {
        setDraft({ id: note.id, title: note.title, content: note.content, slug: note.slug });
      }
      setIsHydrated(true);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setLoadError(errorMessage(error, "Nie udało się odczytać lokalnych notatek."));
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (!isHydrated || !isDirty || !draft.id) return;

    const note: Note = {
      id: draft.id,
      title: draft.title,
      slug: draft.slug ?? "",
      content: draft.content,
      updatedAt: 0,
    };
    saveCoordinator.schedule(note);
  }, [draft, isDirty, isHydrated, saveCoordinator]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("#open-drawer")?.focus());
  }, []);

  const startNewNote = useCallback(() => {
    saveCoordinator.cancel();
    hasUserEditedRef.current = false;
    setDraft({ title: "", content: "" });
    setIsDirty(false);
    setSaveError(null);
    closeDrawer();
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".editor-title")?.focus());
  }, [closeDrawer, saveCoordinator]);

  const updateDraft = useCallback((field: "title" | "content", value: string) => {
    hasUserEditedRef.current = true;
    setSaveError(null);
    setIsDirty(true);
    setDraft((current) => ({ ...current, id: current.id ?? createNoteId(), [field]: value }));
  }, []);

  const visibleError = saveError ?? loadError;

  return (
    <>
      <button
        class="menu-button"
        id="open-drawer"
        type="button"
        aria-controls="left-drawer"
        aria-expanded={isDrawerOpen}
        aria-label="Otwórz notatki i ustawienia"
        onClick={() => setIsDrawerOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
        </svg>
      </button>

      <div {...(isDrawerOpen && { inert: true })}>
        <Editor
          title={draft.title}
          content={draft.content}
          onTitleChange={(value) => updateDraft("title", value)}
          onContentChange={(value) => updateDraft("content", value)}
        />
      </div>

      <LeftDrawer isOpen={isDrawerOpen} onClose={closeDrawer} onNewNote={startNewNote} />
      {visibleError && <ErrorToast message={visibleError} onDismiss={() => { setSaveError(null); setLoadError(null); }} />}
    </>
  );
}
