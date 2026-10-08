import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Editor } from "./components/Editor";
import { DeleteNoteDialog } from "./components/DeleteNoteDialog";
import { ErrorToast } from "./components/ErrorToast";
import { LeftDrawer } from "./components/LeftDrawer";
import {
  createNewNote,
  createNoteId,
  createSaveCoordinator,
  createTextExport,
  normalizeNoteTitle,
  renameNote,
  saveNewNote,
} from "./noteOperations";
import { DEFAULT_NOTE_ICON, isNoteIcon, normalizeNoteIcon, updateFavicon } from "./noteIcon";
import { noteRepository } from "./noteRepository";
import {
  applyPreferences,
  DEFAULT_PREFERENCES,
  dismissDataNotice,
  isDataNoticeDismissed,
  loadPreferences,
  normalizePreferences,
  sanitizePreferencesPatch,
} from "./preferences";
import { buildEditorPath, parseRoute, pushEditorPath, replaceEditorPath, type Route } from "./routing";
import type { EditorPreferences, Note, NoteDraft, NoteRepository } from "./types";

interface AppProps {
  repository?: NoteRepository;
  autoSaveDelay?: number;
  initialPreferences?: EditorPreferences;
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

export function App({ repository = noteRepository, autoSaveDelay, initialPreferences }: AppProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [legacyPreferences] = useState(() => initialPreferences ?? loadPreferences().preferences);
  const [draft, setDraft] = useState<NoteDraft>({ title: "", content: "", preferences: { ...DEFAULT_PREFERENCES } });
  const [titleInput, setTitleInput] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [persistedNoteId, setPersistedNoteId] = useState<string | undefined>();
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [preferencesStorageWarning, setPreferencesStorageWarning] = useState<string | null>(null);
  const [dataNoticeDismissed, setDataNoticeDismissed] = useState(() => isDataNoticeDismissed());
  const hasUserEditedRef = useRef(false);
  const acceptedPathRef = useRef(window.location.pathname);
  const navigationIdRef = useRef(0);
  const isNavigatingRef = useRef(false);
  const isCreatingNoteRef = useRef(false);
  const draftRef = useRef(draft);
  const titleInputRef = useRef(titleInput);

  draftRef.current = draft;
  titleInputRef.current = titleInput;

  useEffect(() => {
    const title = typeof draft.title === "string" && draft.title.trim() ? draft.title : "Lokalne notatki";
    const isActive = isHydrated && route.kind === "editor" && !loadError && !isCreatingNote;
    document.title = isActive ? title : "Lokalne notatki";
    updateFavicon(isActive ? normalizeNoteIcon(draft.icon) : DEFAULT_NOTE_ICON);
  }, [draft.title, draft.icon, isHydrated, route.kind, loadError, isCreatingNote]);

  useEffect(() => {
    applyPreferences(draft.preferences);
  }, [draft.preferences]);

  const dismissNotice = useCallback(() => {
    const result = dismissDataNotice();
    if (result.ok) setDataNoticeDismissed(true);
    else setPreferencesStorageWarning("Nie udało się zapisać tej informacji — localStorage jest niedostępny.");
  }, []);

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
        const nextDraft = { ...draftRef.current, id: saved.id, title: saved.title, content: saved.content, slug: saved.slug };
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setPersistedNoteId(saved.id);
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

  const updatePreferences = useCallback((patch: Partial<EditorPreferences>) => {
    if (!isHydrated || isNavigatingRef.current || isCreatingNoteRef.current) return;
    const sanitizedPatch = sanitizePreferencesPatch(patch);
    if (Object.keys(sanitizedPatch).length === 0) return;
    const current = draftRef.current;
    const preferences = { ...current.preferences, ...sanitizedPatch };
    if (Object.keys(preferences).every((key) => preferences[key as keyof EditorPreferences] === current.preferences[key as keyof EditorPreferences])) return;
    const next = { ...current, id: current.id ?? createNoteId(), preferences };
    hasUserEditedRef.current = true;
    draftRef.current = next;
    setDraft(next);
    setIsDirty(true);
    setSaveError(null);
    applyPreferences(preferences);
    // Queue synchronously so immediate navigation can flush this change.
    saveCoordinator.schedule({ ...next, slug: next.slug ?? "", updatedAt: 0 });
  }, [isHydrated, saveCoordinator]);

  const updateNoteIcon = useCallback((icon: string) => {
    if (!isHydrated || isNavigatingRef.current || isCreatingNoteRef.current || !draftRef.current.id || !isNoteIcon(icon)) return;
    const next = { ...draftRef.current, icon: normalizeNoteIcon(icon) };
    if (next.icon === draftRef.current.icon) return;
    hasUserEditedRef.current = true;
    draftRef.current = next;
    setDraft(next);
    setIsDirty(true);
    setSaveError(null);
    // Queue immediately so navigation can flush even before effects run.
    saveCoordinator.schedule({ ...next, id: next.id!, slug: next.slug ?? "", updatedAt: 0 });
  }, [isHydrated, saveCoordinator]);

  const resetColors = useCallback(() => {
    updatePreferences({
      backgroundColor: DEFAULT_PREFERENCES.backgroundColor,
      textColor: DEFAULT_PREFERENCES.textColor,
    });
  }, [updatePreferences]);

  useEffect(() => () => saveCoordinator.dispose(), [saveCoordinator]);

  useEffect(() => {
    void refreshNotes().catch((error: unknown) => setLoadError(errorMessage(error, "Nie udało się odczytać listy notatek.")));
  }, [refreshNotes]);

  useEffect(() => {
    if (route.kind !== "editor") {
      setIsHydrated(true);
      return;
    }

    if (route.slug && draftRef.current.id && draftRef.current.slug === route.slug && !hasUserEditedRef.current) {
      setIsHydrated(true);
      return;
    }

    let cancelled = false;
    const hydrationNavigationId = navigationIdRef.current;
    const load = async () => {
      setIsHydrated(false);
      setLoadError(null);
      saveCoordinator.cancel();
      try {
        const note = route.slug ? await repository.getBySlug(route.slug) : await repository.getMostRecent();
        if (cancelled || hydrationNavigationId !== navigationIdRef.current) return;

        if (!hasUserEditedRef.current) {
          const nextDraft = note
            ? {
              id: note.id, title: note.title, content: note.content, slug: note.slug, icon: normalizeNoteIcon(note.icon),
              preferences: normalizePreferences(
                note.preferences,
                note.preferences === undefined ? legacyPreferences : DEFAULT_PREFERENCES,
              ).preferences,
            }
            : { title: route.slug ? readableTitleFromSlug(route.slug) : "", content: "", slug: route.slug, preferences: { ...DEFAULT_PREFERENCES } };
          draftRef.current = nextDraft;
          setDraft(nextDraft);
          titleInputRef.current = nextDraft.title;
          setTitleInput(nextDraft.title);
          setPersistedNoteId(note?.id);
          setIsDirty(false);
          requestAnimationFrame(() => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(note ? ".editor-content" : ".editor-title")?.focus());
        }
        setIsHydrated(true);
      } catch (error) {
        if (cancelled || hydrationNavigationId !== navigationIdRef.current) return;
        setLoadError(errorMessage(error, "Nie udało się odczytać lokalnej notatki."));
        setIsHydrated(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [legacyPreferences, repository, route, saveCoordinator]);

  useEffect(() => {
    if (!isHydrated || !isDirty || !draft.id || route.kind !== "editor") return;
    const note: Note = {
      id: draft.id,
      title: draft.title,
      slug: draft.slug ?? "",
      content: draft.content,
      icon: normalizeNoteIcon(draft.icon),
      preferences: draft.preferences,
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

  const updateDraft = useCallback((value: string) => {
    hasUserEditedRef.current = true;
    setSaveError(null);
    setIsDirty(true);
    const nextDraft = { ...draftRef.current, id: draftRef.current.id ?? createNoteId(), content: value };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, []);

  const updateTitleInput = useCallback((value: string) => {
    hasUserEditedRef.current = true;
    setSaveError(null);
    titleInputRef.current = value;
    setTitleInput(value);
  }, []);

  const confirmTitle = useCallback(async () => {
    if (isTitleSaving || !draftRef.current.id) return;

    const titleAtStart = titleInputRef.current;
    const noteId = draftRef.current.id;
    if (!noteId || titleAtStart === draftRef.current.title) return;

    setIsTitleSaving(true);
    setSaveError(null);
    try {
      await saveCoordinator.flush();
      const draftAtRenameStart = draftRef.current;
      const saved = await saveCoordinator.saveNow(
        {
          id: noteId,
          title: normalizeNoteTitle(titleAtStart),
          content: draftAtRenameStart.content,
          icon: normalizeNoteIcon(draftAtRenameStart.icon),
          preferences: draftAtRenameStart.preferences,
          slug: draftAtRenameStart.slug ?? "",
          updatedAt: 0,
        },
        renameNote,
      );

      const latestDraft = draftRef.current;
      const draftChangedDuringRename = latestDraft.content !== draftAtRenameStart.content
        || latestDraft.preferences !== draftAtRenameStart.preferences
        || latestDraft.icon !== draftAtRenameStart.icon;
      saveCoordinator.cancel();
      const nextDraft = { ...latestDraft, id: saved.id, title: saved.title, slug: saved.slug };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setPersistedNoteId(saved.id);
      setIsDirty(draftChangedDuringRename);
      if (titleInputRef.current === titleAtStart) {
        titleInputRef.current = saved.title;
        setTitleInput(saved.title);
      }
      if (!isNavigatingRef.current) {
        replaceEditorPath(saved.slug);
        acceptedPathRef.current = buildEditorPath(saved.slug);
      }
      if (draftChangedDuringRename) {
        saveCoordinator.schedule({ ...nextDraft, updatedAt: 0 });
      }
      void refreshNotes().catch((error: unknown) => setLoadError(errorMessage(error, "Nie udało się odświeżyć listy notatek.")));
    } catch (error) {
      setSaveError(errorMessage(error, "Nie udało się zapisać tytułu notatki."));
    } finally {
      setIsTitleSaving(false);
    }
  }, [isTitleSaving, refreshNotes, saveCoordinator]);

  const startNewNote = useCallback(async () => {
    if (isCreatingNoteRef.current) return;
    isCreatingNoteRef.current = true;
    setIsCreatingNote(true);
    const navigationId = ++navigationIdRef.current;
    const hadUserEdited = hasUserEditedRef.current;
    isNavigatingRef.current = true;
    hasUserEditedRef.current = true;
    try {
      await saveCoordinator.flush();
      if (navigationId !== navigationIdRef.current) return;
      saveCoordinator.cancel();
      const saved = await saveNewNote(createNewNote(), repository);
      if (navigationId !== navigationIdRef.current) return;
      hasUserEditedRef.current = false;
      const nextRoute: Route = { kind: "editor", slug: saved.slug };
      replaceEditorPath(saved.slug);
      acceptedPathRef.current = buildEditorPath(saved.slug);
      setRoute(nextRoute);
      const nextDraft = { id: saved.id, title: saved.title, content: saved.content, slug: saved.slug, icon: normalizeNoteIcon(saved.icon), preferences: normalizePreferences(saved.preferences).preferences };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      titleInputRef.current = saved.title;
      setTitleInput(saved.title);
      setPersistedNoteId(saved.id);
      setIsDirty(false);
      setSaveError(null);
      closeDrawer();
      void refreshNotes().catch((error: unknown) => setLoadError(errorMessage(error, "Nie udało się odświeżyć listy notatek.")));
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".editor-title")?.focus());
    } catch (error) {
      hasUserEditedRef.current = hadUserEdited;
      setIsHydrated(true);
      setSaveError(errorMessage(error, "Nie udało się utrwalić bieżącej notatki."));
    } finally {
      if (navigationId === navigationIdRef.current) isNavigatingRef.current = false;
      isCreatingNoteRef.current = false;
      setIsCreatingNote(false);
    }
  }, [closeDrawer, refreshNotes, repository, saveCoordinator]);

  const selectNote = useCallback(async (slug: string) => {
    const navigationId = ++navigationIdRef.current;
    isNavigatingRef.current = true;
    setIsHydrated(false);
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
      setIsHydrated(true);
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
      setIsHydrated(false);
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
        setIsHydrated(true);
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
    setIsHydrated(false);
    setRoute({ kind: "editor" });
  }, []);

  const exportCurrentNote = useCallback(() => {
    const { blob, fileName } = createTextExport(draft.title, draft.content);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [draft.content, draft.title]);

  const confirmDelete = useCallback(async () => {
    if (!persistedNoteId) return;
    const navigationId = ++navigationIdRef.current;
    isNavigatingRef.current = true;
    setIsHydrated(false);
    try {
      await saveCoordinator.cancelAndWait();
      if (navigationId !== navigationIdRef.current) return;
      await repository.delete(persistedNoteId);
      const remaining = await repository.listMostRecent();
      if (navigationId !== navigationIdRef.current) return;

      setNotes(remaining);
      setPersistedNoteId(undefined);
      setIsDeleteDialogOpen(false);
      setIsDirty(false);
      setSaveError(null);
      hasUserEditedRef.current = false;

      const nextNote = remaining[0];
      if (nextNote) {
        replaceEditorPath(nextNote.slug);
        acceptedPathRef.current = buildEditorPath(nextNote.slug);
        setRoute({ kind: "editor", slug: nextNote.slug });
      } else {
        replaceEditorPath();
        acceptedPathRef.current = buildEditorPath();
        const nextDraft = { title: "", content: "", preferences: { ...DEFAULT_PREFERENCES } };
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        titleInputRef.current = "";
        setTitleInput("");
        setRoute({ kind: "editor" });
      }
    } catch (error) {
      setIsHydrated(true);
      setSaveError(errorMessage(error, "Nie udało się usunąć notatki."));
    } finally {
      if (navigationId === navigationIdRef.current) isNavigatingRef.current = false;
    }
  }, [persistedNoteId, repository, saveCoordinator]);

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
          icon={isHydrated && !isCreatingNote && !loadError ? normalizeNoteIcon(draft.icon) : DEFAULT_NOTE_ICON}
          onIconChange={updateNoteIcon}
          iconDisabled={!isHydrated || !draft.id || isCreatingNote || Boolean(loadError)}
          noteId={draft.id}
          title={titleInput}
          content={draft.content}
          onTitleChange={updateTitleInput}
          onTitleConfirm={() => { void confirmTitle(); }}
          onContentChange={updateDraft}
          showTitleSave={titleInput !== draft.title}
          isTitleSaving={isTitleSaving}
        />
      </div>

      <LeftDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onNewNote={() => { void startNewNote(); }}
        isCreatingNote={isCreatingNote}
        notes={notes}
        activeSlug={activeSlug}
        search={search}
        onSearchChange={setSearch}
        onSelectNote={(slug) => { void selectNote(slug); }}
        preferences={draft.preferences}
        appearanceDisabled={!isHydrated || isCreatingNote}
        preferencesStorageWarning={preferencesStorageWarning}
        onPreferencesChange={updatePreferences}
        onResetColors={resetColors}
        dataNoticeDismissed={dataNoticeDismissed}
        onDismissDataNotice={dismissNotice}
        canExport={Boolean(draft.id)}
        canDelete={Boolean(persistedNoteId)}
        onExport={exportCurrentNote}
        onDelete={() => { closeDrawer(); setIsDeleteDialogOpen(true); }}
      />
      {isDeleteDialogOpen && (
        <DeleteNoteDialog
          title={draft.title}
          onCancel={() => setIsDeleteDialogOpen(false)}
          onConfirm={() => { void confirmDelete(); }}
        />
      )}
      {visibleError && <ErrorToast message={visibleError} onDismiss={() => { setSaveError(null); setLoadError(null); }} />}
    </>
  );
}
