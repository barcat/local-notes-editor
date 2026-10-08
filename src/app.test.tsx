import { fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmojiFavicon, DEFAULT_NOTE_ICON } from "./noteIcon";
import { App } from "./app";
import { DEFAULT_PREFERENCES, PREFERENCES_STORAGE_KEY } from "./preferences";
import { createNote, saveNote } from "./noteOperations";
import { createNoteRepository } from "./noteRepository";
import type { Note, NoteRepository } from "./types";

function favicon() {
  return document.head.querySelector('link[rel="icon"]')?.getAttribute("href");
}

function chooseIcon(icon: string) {
  fireEvent.click(screen.getByRole("button", { name: "Zmień ikonę notatki" }));
  fireEvent.click(screen.getByRole("button", { name: `Wybierz ikonę ${icon}` }));
}

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve: resolve! };
}

function repositoryFromNotes(notes: Note[]): NoteRepository {
  const stored = new Map(notes.map((note) => [note.id, note]));
  return {
    getBySlug: async (slug) => [...stored.values()].find((note) => note.slug === slug),
    getMostRecent: async () => [...stored.values()].sort((left, right) => right.updatedAt - left.updatedAt)[0],
    listMostRecent: async () => [...stored.values()].sort((left, right) => right.updatedAt - left.updatedAt),
    save: async (note) => { stored.set(note.id, note); },
    delete: async (id) => { stored.delete(id); },
    isSlugAvailable: async (slug, exceptId) => [...stored.values()].every((note) => note.slug !== slug || note.id === exceptId),
  };
}

describe("App shell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    document.title = "Lokalne notatki";
    window.localStorage.clear();
  });

  it("opens the drawer, moves focus inside and closes it with Escape", async () => {
    render(<App />);

    const openButton = screen.getByRole("button", { name: "Otwórz notatki i ustawienia" });
    const drawer = screen.getByRole("dialog", { hidden: true });
    expect(drawer).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(openButton);

    const closeButton = within(drawer).getByRole("button", { name: "Zamknij panel" });
    expect(drawer).toHaveAttribute("aria-hidden", "false");
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(drawer).toHaveAttribute("aria-hidden", "true");
  });

  it("offers only IBM Plex fonts and restores the selected font on remount", async () => {
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    const repository = repositoryFromNotes([]);
    const firstRender = render(<App repository={repository} autoSaveDelay={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    const select = screen.getByRole("combobox", { name: "Font" });
    await waitFor(() => expect(select).toBeEnabled());
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "IBM Plex Mono", "IBM Plex Sans", "IBM Plex Serif",
    ]);
    expect(select).toHaveValue("IBM Plex Mono");

    for (const [fontFamily, fallback] of [
      ["IBM Plex Sans", "sans-serif"],
      ["IBM Plex Serif", "serif"],
      ["IBM Plex Mono", "monospace"],
    ]) {
      fireEvent.change(select, { target: { value: fontFamily } });
      await waitFor(() => expect(document.documentElement.style.getPropertyValue("--editor-font-family")).toBe(`"${fontFamily}", ${fallback}`));
      await waitFor(async () => expect((await repository.getMostRecent())?.preferences?.fontFamily).toBe(fontFamily));
      expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    }
    fireEvent.change(select, { target: { value: "IBM Plex Serif" } });
    await waitFor(async () => expect((await repository.getMostRecent())?.preferences?.fontFamily).toBe("IBM Plex Serif"));
    firstRender.unmount();
    render(<App repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Font" })).toHaveValue("IBM Plex Serif"));
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  });

  it("creates a persisted timestamped note without overwriting the current note", async () => {
    const repository = createNoteRepository(`app-new-note-test-${crypto.randomUUID()}`);
    const first = await saveNote(createNote("Pierwsza", "Pierwsza treść", 10), repository, 10);
    render(<App repository={repository} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Pierwsza"));

    const title = screen.getByPlaceholderText("Bez tytułu");
    const content = screen.getByPlaceholderText("Zacznij pisać…");

    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Nowa notatka" }));

    await waitFor(() => expect((title as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/));
    expect(content).toHaveValue("");
    expect(window.location.pathname).toMatch(/^\/notatki\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/);
    expect(await repository.getBySlug(first.slug)).toEqual(first);
  });

  it("autosaves a draft and restores it when the app is mounted again", async () => {
    const repository = createNoteRepository(`app-test-${crypto.randomUUID()}`);
    const firstRender = render(<App repository={repository} autoSaveDelay={0} />);

    fireEvent.input(screen.getByPlaceholderText("Zacznij pisać…"), { target: { value: "HTML <b>i Markdown **bez interpretacji**" } });
    await waitFor(async () => {
      const saved = await repository.getMostRecent();
      expect(saved?.content).toBe("HTML <b>i Markdown **bez interpretacji**");
    });

    firstRender.unmount();
    render(<App repository={repository} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Bez tytułu"));
    expect(screen.getByPlaceholderText("Zacznij pisać…")).toHaveValue("HTML <b>i Markdown **bez interpretacji**");
  });

  it("lists, searches and switches between notes", async () => {
    const repository = createNoteRepository(`app-switching-test-${crypto.randomUUID()}`);
    await saveNote(createNote("Starsza notatka", "starsza", 10), repository, 10);
    await saveNote(createNote("Nowsza notatka", "nowsza", 20), repository, 20);
    render(<App repository={repository} />);

    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Nowsza notatka"));
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Starsza notatka" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Nowsza notatka" })).toBeInTheDocument();

    fireEvent.input(screen.getByPlaceholderText("Szukaj po tytule"), { target: { value: "starsza" } });
    expect(screen.getByRole("button", { name: "Starsza notatka" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nowsza notatka" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Starsza notatka" }));

    await waitFor(() => expect(window.location.pathname).toBe("/notatki/starsza-notatka"));
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Starsza notatka"));
  });

  it("renames with the next available slug when the title is confirmed", async () => {
    const repository = createNoteRepository(`app-rename-test-${crypto.randomUUID()}`);
    await saveNote(createNote("Pierwsza", "pierwsza", 10), repository, 10);
    await saveNote(createNote("Druga", "druga", 20), repository, 20);
    render(<App repository={repository} autoSaveDelay={0} />);

    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Druga"));
    fireEvent.input(screen.getByPlaceholderText("Bez tytułu"), { target: { value: "Pierwsza" } });
    expect(screen.getByRole("button", { name: "Zapisz tytuł" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zapisz tytuł" }));

    await waitFor(async () => {
      expect(await repository.getBySlug("pierwsza-2")).toBeDefined();
    });
    expect(window.location.pathname).toBe("/notatki/pierwsza-2");
    expect((await repository.listMostRecent()).filter((note) => note.title === "Pierwsza")).toHaveLength(2);
  });

  it("keeps an unconfirmed title out of content autosaves", async () => {
    const repository = createNoteRepository(`app-pending-title-test-${crypto.randomUUID()}`);
    const original = await saveNote(createNote("Oryginalny tytuł", "stara treść", 10), repository, 10);
    window.history.replaceState({}, "", `/notatki/${original.slug}`);
    render(<App repository={repository} autoSaveDelay={0} />);

    const title = screen.getByPlaceholderText("Bez tytułu");
    const content = screen.getByPlaceholderText("Zacznij pisać…");
    await waitFor(() => expect(title).toHaveValue("Oryginalny tytuł"));
    fireEvent.input(title, { target: { value: "Nowy tytuł" } });
    fireEvent.input(content, { target: { value: "nowa treść" } });

    await waitFor(async () => {
      expect(await repository.getBySlug(original.slug)).toEqual({ ...original, content: "nowa treść", updatedAt: expect.any(Number) });
    });
    expect(await repository.getBySlug("nowy-tytul")).toBeUndefined();
    expect(window.location.pathname).toBe(`/notatki/${original.slug}`);
    expect(screen.getByRole("button", { name: "Zapisz tytuł" })).toBeEnabled();
  });

  it("confirms a normalized title and keeps the same note id", async () => {
    const repository = createNoteRepository(`app-confirm-title-test-${crypto.randomUUID()}`);
    const original = await saveNote(createNote("Stary tytuł", "treść", 10), repository, 10);
    window.history.replaceState({}, "", `/notatki/${original.slug}`);
    render(<App repository={repository} />);

    const title = screen.getByPlaceholderText("Bez tytułu");
    await waitFor(() => expect(title).toHaveValue("Stary tytuł"));
    fireEvent.input(title, { target: { value: "  Nowy tytuł  " } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz tytuł" }));

    await waitFor(async () => expect(await repository.getBySlug("nowy-tytul")).toBeDefined());
    const saved = await repository.getBySlug("nowy-tytul");
    expect(saved?.id).toBe(original.id);
    expect(saved?.title).toBe("Nowy tytuł");
    expect(window.location.pathname).toBe("/notatki/nowy-tytul");
    expect(screen.queryByRole("button", { name: "Zapisz tytuł" })).toBeNull();
  });

  it("cancels deletion or removes the current note and opens an empty editor", async () => {
    const repository = createNoteRepository(`app-delete-test-${crypto.randomUUID()}`);
    await saveNote({ ...createNote("Do usunięcia", "treść", 10), icon: "💡" }, repository, 10);
    render(<App repository={repository} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Do usunięcia"));

    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Usuń" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(screen.getByRole("dialog", { name: "Usunąć notatkę?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Usunąć notatkę?" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Usuń" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Usuń" }));
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(await repository.getBySlug("do-usuniecia")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Usuń" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Usuń" }));
    fireEvent.click(screen.getByRole("button", { name: "Usuń notatkę" }));
    await waitFor(async () => expect(await repository.getBySlug("do-usuniecia")).toBeUndefined());
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("");
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon(DEFAULT_NOTE_ICON)));
    expect(screen.getByRole("button", { name: "Zmień ikonę notatki" })).toBeDisabled();
  });

  it("uses the saved title in the browser tab, not an editable title input", async () => {
    const repository = createNoteRepository(`app-tab-title-test-${crypto.randomUUID()}`);
    const original = await saveNote(createNote("Zapisany tytuł", "treść", 10), repository, 10);
    window.history.replaceState({}, "", `/notatki/${original.slug}`);
    render(<App repository={repository} />);

    const title = screen.getByPlaceholderText("Bez tytułu");
    await waitFor(() => expect(document.title).toBe("Zapisany tytuł"));

    fireEvent.input(title, { target: { value: "Tylko w polu" } });
    expect(document.title).toBe("Zapisany tytuł");

    fireEvent.click(screen.getByRole("button", { name: "Zapisz tytuł" }));
    await waitFor(async () => expect((await repository.getBySlug("tylko-w-polu"))?.title).toBe("Tylko w polu"));
    await waitFor(() => expect(document.title).toBe("Tylko w polu"));
  });

  it("uses the fallback while a switched note is hydrating", async () => {
    const older = createNote("Starsza notatka", "starsza", 10);
    const newer = { ...createNote("Nowsza notatka", "nowsza", 20), icon: "💡" };
    const olderLookup = deferred<Note | undefined>();
    let olderLookups = 0;
    const repository = repositoryFromNotes([older, newer]);
    repository.getBySlug = async (slug) => {
      if (slug !== older.slug) return newer;
      olderLookups += 1;
      return olderLookups === 1 ? olderLookup.promise : older;
    };

    render(<App repository={repository} />);
    await waitFor(() => expect(document.title).toBe("Nowsza notatka"));
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("💡")));

    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "Starsza notatka" }));
    await waitFor(() => expect(document.title).toBe("Lokalne notatki"));
    expect(favicon()).toBe(createEmojiFavicon(DEFAULT_NOTE_ICON));
    expect(screen.getByRole("combobox", { name: "Font" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "Font Size" })).toBeDisabled();
    expect(screen.getByLabelText("Kolor tła")).toBeDisabled();

    olderLookup.resolve(older);
    await waitFor(() => expect(document.title).toBe("Starsza notatka"));
  });

  it("uses a new note's generated default title in the browser tab", async () => {
    const repository = createNoteRepository(`app-new-tab-title-test-${crypto.randomUUID()}`);
    await saveNote({ ...createNote("Existing", "", 10), icon: "💡" }, repository, 10);
    render(<App repository={repository} />);

    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Nowa notatka" }));

    await waitFor(() => expect(document.title).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/));
    expect(favicon()).toBe(createEmojiFavicon(DEFAULT_NOTE_ICON));
    expect((await repository.getMostRecent())?.icon).toBe(DEFAULT_NOTE_ICON);
  });

  it("falls back to the application title when a hydrated note title is invalid", async () => {
    const invalidNote: Note = {
      id: "invalid-title",
      title: "",
      slug: "invalid-title",
      content: "treść",
      updatedAt: 10,
    };
    const repository = repositoryFromNotes([invalidNote]);
    window.history.replaceState({}, "", `/notatki/${invalidNote.slug}`);
    document.title = "Poprzednia notatka";
    render(<App repository={repository} />);

    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue(""));
    await waitFor(() => expect(document.title).toBe("Lokalne notatki"));
  });
  it("flushes appearance before an immediate switch and keeps notes independent", async () => {
    const first = createNote("A", "a", 20);
    const second = { ...createNote("B", "b", 10), preferences: { ...DEFAULT_PREFERENCES, fontFamily: "IBM Plex Sans" as const, textColor: "#ffffff" } };
    const repository = repositoryFromNotes([first, second]);
    const view = render(<App repository={repository} autoSaveDelay={60_000} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("A"));
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Font" }), { target: { value: "IBM Plex Serif" } });
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("B"));
    expect((await repository.getBySlug(first.slug))?.preferences?.fontFamily).toBe("IBM Plex Serif");
    expect(await repository.getBySlug(second.slug)).toEqual(second);
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--editor-text")).toBe("#ffffff"));
    view.unmount();
    render(<App repository={repository} />);
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--editor-font-family")).toBe('"IBM Plex Sans", sans-serif'));
  });

  it("uses defaults for new notes", async () => {
    const custom = { ...createNote("Custom", "", 10), preferences: { ...DEFAULT_PREFERENCES, fontSizePt: 22 } };
    const repository = repositoryFromNotes([custom]);
    render(<App repository={repository} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Custom"));
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Nowa notatka" }));
    await waitFor(async () => expect(await repository.listMostRecent()).toHaveLength(2));
    expect((await repository.getMostRecent())?.preferences).toEqual(DEFAULT_PREFERENCES);
    expect((await repository.getBySlug(custom.slug))?.preferences?.fontSizePt).toBe(22);
  });

  it("preserves legacy appearance without writing on read and migrates it on content save", async () => {
    const legacy = createNote("Legacy", "", 10);
    delete legacy.preferences;
    const preferences = { ...DEFAULT_PREFERENCES, fontSizePt: 19, textColor: "#ffffff" };
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    const repository = repositoryFromNotes([legacy]);
    render(<App repository={repository} autoSaveDelay={0} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Legacy"));
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--editor-font-size")).toBe("19pt"));
    expect(await repository.getBySlug(legacy.slug)).toEqual(legacy);
    fireEvent.input(screen.getByPlaceholderText("Zacznij pisać…"), { target: { value: "updated" } });
    await waitFor(async () => expect((await repository.getBySlug(legacy.slug))?.preferences).toEqual(preferences));
  });

  it("resets only the active note's colors", async () => {
    const preferences = { ...DEFAULT_PREFERENCES, textColor: "#ffffff", backgroundColor: "#ffffff", fontSizePt: 18 };
    const a = { ...createNote("A", "", 20), preferences };
    const b = { ...createNote("B", "", 10), preferences: { ...preferences } };
    const repository = repositoryFromNotes([a, b]);
    render(<App repository={repository} autoSaveDelay={0} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("A"));
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "Przywróć domyślne kolory" }));
    await waitFor(async () => expect((await repository.getBySlug(a.slug))?.preferences).toEqual({ ...DEFAULT_PREFERENCES, fontSizePt: 18 }));
    expect(await repository.getBySlug(b.slug)).toEqual(b);
  });

  it("keeps appearance changes made while the title save is pending", async () => {
    const original = createNote("Original", "", 10);
    const repository = repositoryFromNotes([original]);
    const save = repository.save;
    const gate = deferred<void>();
    const started = deferred<void>();
    repository.save = async (note) => {
      if (note.title === "Renamed") {
        started.resolve();
        await gate.promise;
      }
      await save(note);
    };
    render(<App repository={repository} autoSaveDelay={0} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Original"));
    fireEvent.input(screen.getByPlaceholderText("Bez tytułu"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz tytuł" }));
    await started.promise;
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Font" }), { target: { value: "IBM Plex Serif" } });
    gate.resolve();
    await waitFor(async () => expect((await repository.getBySlug("renamed"))?.preferences?.fontFamily).toBe("IBM Plex Serif"));
    expect(screen.getByRole("combobox", { name: "Font" })).toHaveValue("IBM Plex Serif");
    expect(await repository.getBySlug("original")).toBeUndefined();
  });

  it("unlocks appearance after a navigation save failure and preserves the draft", async () => {
    const a = createNote("A", "", 20);
    const b = createNote("B", "", 10);
    const repository = repositoryFromNotes([a, b]);
    repository.save = async () => { throw new Error("Brak miejsca"); };
    render(<App repository={repository} autoSaveDelay={60_000} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("A"));
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Font" }), { target: { value: "IBM Plex Serif" } });
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    await waitFor(() => expect(screen.getByText("Brak miejsca")).toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Font" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Font" })).toHaveValue("IBM Plex Serif");
    expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("A");
    expect(await repository.getBySlug(a.slug)).toEqual(a);
  });

  it("flushes pending appearance on browser navigation", async () => {
    const a = createNote("A", "", 20);
    const b = createNote("B", "", 10);
    const repository = repositoryFromNotes([a, b]);
    render(<App repository={repository} autoSaveDelay={60_000} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("A"));
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.input(screen.getByRole("spinbutton", { name: "Font Size" }), { target: { value: "20" } });
    fireEvent.input(screen.getByRole("spinbutton", { name: "Line Height" }), { target: { value: "2" } });
    fireEvent.input(screen.getByRole("spinbutton", { name: "Width (px)" }), { target: { value: "800" } });
    fireEvent.input(screen.getByLabelText("Kolor tła"), { target: { value: "#123456" } });
    window.history.replaceState({}, "", `/notatki/${b.slug}`);
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("B"));
    expect((await repository.getBySlug(a.slug))?.preferences).toEqual({
      ...DEFAULT_PREFERENCES, fontSizePt: 20, lineHeight: 2, editorWidthPx: 800, backgroundColor: "#123456",
    });
    expect(await repository.getBySlug(b.slug)).toEqual(b);
  });

});

describe("per-note icons", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("updates favicon immediately, preserves committed title/slug and restores the icon from IndexedDB", async () => {
    const repository = createNoteRepository(`icons-${crypto.randomUUID()}`);
    const original = await saveNote(createNote("Original", "body", 10), repository, 10);
    const view = render(<App repository={repository} autoSaveDelay={0} />);
    await waitFor(() => expect(screen.getByLabelText("Tytuł notatki")).toHaveValue("Original"));
    fireEvent.input(screen.getByLabelText("Tytuł notatki"), { target: { value: "Unconfirmed" } });
    chooseIcon("💡");
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("💡")));
    expect(document.title).toBe("Original");
    await waitFor(async () => expect((await repository.getBySlug(original.slug))?.icon).toBe("💡"));
    expect((await repository.getBySlug(original.slug))?.title).toBe("Original");
    fireEvent.input(screen.getByLabelText("Treść notatki"), { target: { value: "updated" } });
    await waitFor(async () => expect((await repository.getBySlug(original.slug))?.content).toBe("updated"));
    view.unmount();
    render(<App repository={repository} />);
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("💡")));
    expect(screen.getByRole("button", { name: "Zmień ikonę notatki" })).toHaveTextContent("💡");
  });

  it("validates custom emoji and closes the picker with keyboard or outside click", async () => {
    const repository = repositoryFromNotes([createNote("A")]);
    render(<App repository={repository} autoSaveDelay={0} />);
    const button = screen.getByRole("button", { name: "Zmień ikonę notatki" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const input = screen.getByLabelText("Własne emoji");
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.input(input, { target: { value: "💡📚" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Wpisz jedno emoji.");
    expect(button).toHaveTextContent(DEFAULT_NOTE_ICON);
    fireEvent.input(input, { target: { value: "👩‍💻" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("👩‍💻")));
    expect(screen.queryByRole("dialog", { name: "Ikona notatki" })).toBeNull();
    expect(button).toHaveFocus();
    await waitFor(async () => expect((await repository.getMostRecent())?.icon).toBe("👩‍💻"));
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Ikona notatki" })).toBeNull();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    fireEvent(document.body, new Event("pointerdown", { bubbles: true }));
    expect(screen.queryByRole("dialog", { name: "Ikona notatki" })).toBeNull();
  });

  it("flushes an icon before immediate switching and reads legacy notes without rewriting them", async () => {
    const a = { ...createNote("A", "", 20), icon: "💡" };
    const b = createNote("B", "", 10);
    delete b.icon;
    const repository = repositoryFromNotes([a, b]);
    render(<App repository={repository} autoSaveDelay={60_000} />);
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("💡")));
    chooseIcon("📚");
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    await waitFor(() => expect(screen.getByLabelText("Tytuł notatki")).toHaveValue("B"));
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon(DEFAULT_NOTE_ICON)));
    expect((await repository.getBySlug(a.slug))?.icon).toBe("📚");
    expect(await repository.getBySlug(b.slug)).toEqual(b);
  });

  it.each(["autosave", "rename"])("keeps the latest emoji when changed during a pending %s", async (operation) => {
    const original = createNote("Original", "", 10);
    const repository = repositoryFromNotes([original]);
    const save = repository.save;
    const gate = deferred<void>();
    const started = deferred<void>();
    let firstSave = true;
    repository.save = async (note) => {
      if (firstSave) { firstSave = false; started.resolve(); await gate.promise; }
      await save(note);
    };
    render(<App repository={repository} autoSaveDelay={0} />);
    await waitFor(() => expect(screen.getByLabelText("Tytuł notatki")).toHaveValue("Original"));
    if (operation === "rename") {
      fireEvent.input(screen.getByLabelText("Tytuł notatki"), { target: { value: "Renamed" } });
      fireEvent.click(screen.getByRole("button", { name: "Zapisz tytuł" }));
    } else chooseIcon("💡");
    await started.promise;
    chooseIcon("📚");
    gate.resolve();
    const slug = operation === "rename" ? "renamed" : original.slug;
    await waitFor(async () => expect((await repository.getBySlug(slug))?.icon).toBe("📚"));
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("📚")));
    expect((await repository.getBySlug(slug))?.id).toBe(original.id);
    if (operation === "rename") expect(await repository.getBySlug(original.slug)).toBeUndefined();
  });

  it("flushes icon on popstate and resets favicon on an invalid route", async () => {
    const a = createNote("A", "", 20);
    const b = { ...createNote("B", "", 10), icon: "🇵🇱" };
    const repository = repositoryFromNotes([a, b]);
    render(<App repository={repository} autoSaveDelay={60_000} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Zmień ikonę notatki" })).toBeEnabled());
    chooseIcon("💡");
    window.history.replaceState({}, "", `/notatki/${b.slug}`);
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("🇵🇱")));
    expect((await repository.getBySlug(a.slug))?.icon).toBe("💡");
    window.history.replaceState({}, "", "/invalid/path");
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByText("Nie znaleziono strony")).toBeInTheDocument());
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon(DEFAULT_NOTE_ICON)));
    expect(document.title).toBe("Lokalne notatki");
  });

  it("keeps the current icon and displays an error if navigation cannot flush it", async () => {
    const a = createNote("A", "", 20);
    const b = createNote("B", "", 10);
    const repository = repositoryFromNotes([a, b]);
    repository.save = async () => { throw new Error("Brak miejsca"); };
    render(<App repository={repository} autoSaveDelay={60_000} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Zmień ikonę notatki" })).toBeEnabled());
    chooseIcon("💡");
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    await waitFor(() => expect(screen.getByText("Brak miejsca")).toBeInTheDocument());
    await waitFor(() => expect(favicon()).toBe(createEmojiFavicon("💡")));
    expect(await repository.getBySlug(a.slug)).toEqual(a);
  });
});
