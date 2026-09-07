import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Editor } from "./components/Editor";
import { ErrorToast } from "./components/ErrorToast";
import { LeftDrawer } from "./components/LeftDrawer";
import { createNoteId, createSaveCoordinator } from "./noteOperations";
import { noteRepository } from "./noteRepository";
import { buildEditorPath, parseRoute, pushEditorPath, replaceEditorPath, type Route } from "./routing";
import type { Note, NoteDraft, NoteRepository } from "./types";

interface AppProps {
  repository?: NoteRepository;
  autoSaveDelay?: number;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function readableTitleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("pl-PL") + word.slice(1))
    .join(" ");
}

function routePath(route: Route): string {
  return route.kind === "editor" ? buildEditorPath(route.slug) : window.location.pathname;
}

export function App({ repository = noteRepository, autoSaveDelay }: AppProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [draft, setDraft] = useState<NoteDraft>({ title: "", content: "" });
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasUserEditedRef = useRef(false);
  const acceptedPathRef = useRef(window.location.pathname);
  const navigationIdRef = useRef(0);
  const isNavigatingRef = useRef(false);

  const refreshNotes = useCallback(async () => {
    setNotes(await repository.listMostRecent());
  }, [repository]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("#open-drawer")?.focus());
  }, []);

  const saveCoordinator = useMemo(
    () => createSaveCoordinator({
      repository,
      ...(autoSaveDelay === undefined ? {} : { delay: autoSaveDelay }),
      onSaved: (saved, isLatest) => {
        if (!isLatest) return;
        setDraft({ id: saved.id, title: saved.title, content: saved.content, slug: saved.slug });
        setIsDirty(false);
        setSaveError(null);
        if (!isNavigatingRef.current) {
          replaceEditorPath(saved.slug);
          acceptedPathRef.current = buildEditorPath(saved.slug);
        }
        void refreshNotes().catch((error: unknown) => setLoadError(errorMessage(error, "Nie udało się odświeżyć listy notatek.")));
      },
      onError: (error, _note, isLatest) => {
        if (isLatest) setSaveError(errorMessage(error, "Nie udało się zapisać notatki."));
      },
    }),
    [autoSaveDelay, refreshNotes, repository],
  );

  useEffect(() => () => saveCoordinator.dispose(), [saveCoordinator]);

  useEffect(() => {
    void refreshNotes().catch((error: unknown) => setLoadError(errorMessage(error, "Nie udało się odczytać listy notatek.")));
  }, [refreshNotes]);

  useEffect(() => {
    if (route.kind !== "editor") {
      setIsHydrated(true);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsHydrated(false);
      setLoadError(null);
      saveCoordinator.cancel();
      try {
        const note = route.slug ? await repository.getBySlug(route.slug) : await repository.getMostRecent();
        if (cancelled) return;

        if (!hasUserEditedRef.current) {
          setDraft(note
            ? { id: note.id, title: note.title, content: note.content, slug: note.slug }
            : { title: route.slug ? readableTitleFromSlug(route.slug) : "", content: "", slug: route.slug });
          setIsDirty(false);
          requestAnimationFrame(() => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(note ? ".editor-content" : ".editor-title")?.focus());
        }
        setIsHydrated(true);
      } catch (error) {
        if (cancelled) return;
        setLoadError(errorMessage(error, "Nie udało się odczytać lokalnej notatki."));
        setIsHydrated(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [repository, route, saveCoordinator]);

  useEffect(() => {
    if (!isHydrated || !isDirty || !draft.id || route.kind !== "editor") return;
    const note: Note = {
      id: draft.id,
      title: draft.title,
      slug: draft.slug ?? "",
      content: draft.content,
      updatedAt: 0,
    };
    saveCoordinator.schedule(note);
  }, [draft, isDirty, isHydrated, route.kind, saveCoordinator]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  const updateDraft = useCallback((field: "title" | "content", value: string) => {
    hasUserEditedRef.current = true;
    setSaveError(null);
    setIsDirty(true);
    setDraft((current) => ({ ...current, id: current.id ?? createNoteId(), [field]: value }));
  }, []);

  const startNewNote = useCallback(async () => {
    const navigationId = ++navigationIdRef.current;
    isNavigatingRef.current = true;
    try {
      await saveCoordinator.flush();
      if (navigationId !== navigationIdRef.current) return;
      saveCoordinator.cancel();
      hasUserEditedRef.current = false;
      const nextRoute: Route = { kind: "editor" };
      replaceEditorPath();
      acceptedPathRef.current = buildEditorPath();
      setRoute(nextRoute);
      setDraft({ title: "", content: "" });
      setIsDirty(false);
      setSaveError(null);
      closeDrawer();
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".editor-title")?.focus());
    } catch (error) {
      setSaveError(errorMessage(error, "Nie udało się utrwalić bieżącej notatki."));
    } finally {
      if (navigationId === navigationIdRef.current) isNavigatingRef.current = false;
    }
  }, [closeDrawer, saveCoordinator]);

  const selectNote = useCallback(async (slug: string) => {
    const navigationId = ++navigationIdRef.current;
    isNavigatingRef.current = true;
    try {
      await saveCoordinator.flush();
      await repository.getBySlug(slug);
      if (navigationId !== navigationIdRef.current) return;
      hasUserEditedRef.current = false;
      pushEditorPath(slug);
      acceptedPathRef.current = buildEditorPath(slug);
      setRoute({ kind: "editor", slug });
      closeDrawer();
    } catch (error) {
      setSaveError(errorMessage(error, "Nie udało się otworzyć notatki."));
    } finally {
      if (navigationId === navigationIdRef.current) isNavigatingRef.current = false;
    }
  }, [closeDrawer, repository, saveCoordinator]);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = parseRoute();
      const navigationId = ++navigationIdRef.current;
      isNavigatingRef.current = true;
      void saveCoordinator.flush().then(() => {
        if (navigationId !== navigationIdRef.current) return;
        if (nextRoute.kind === "not-found") {
          setRoute(nextRoute);
        } else {
          hasUserEditedRef.current = false;
          setRoute(nextRoute);
          closeDrawer();
        }
        acceptedPathRef.current = routePath(nextRoute);
      }).catch((error: unknown) => {
        window.history.replaceState({}, "", acceptedPathRef.current);
        setSaveError(errorMessage(error, "Nie udało się utrwalić bieżącej notatki."));
      }).finally(() => {
        if (navigationId === navigationIdRef.current) isNavigatingRef.current = false;
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeDrawer, saveCoordinator]);

  const openEditor = useCallback(() => {
    replaceEditorPath();
    acceptedPathRef.current = buildEditorPath();
    hasUserEditedRef.current = false;
    setRoute({ kind: "editor" });
  }, []);

  if (route.kind === "not-found") {
    return (
      <main class="route-error">
        <h1>Nie znaleziono strony</h1>
        <p>Ta ścieżka nie jest prawidłową trasą edytora.</p>
        <button type="button" onClick={openEditor}>Otwórz edytor</button>
      </main>
    );
  }

  const activeSlug = draft.slug ?? route.slug;
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

      <LeftDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onNewNote={() => { void startNewNote(); }}
        notes={notes}
        activeSlug={activeSlug}
        search={search}
        onSearchChange={setSearch}
        onSelectNote={(slug) => { void selectNote(slug); }}
      />
      {visibleError && <ErrorToast message={visibleError} onDismiss={() => { setSaveError(null); setLoadError(null); }} />}
    </>
  );
}
