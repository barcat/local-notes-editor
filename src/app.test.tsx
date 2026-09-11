import { fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./app";
import { createNote, saveNote } from "./noteOperations";
import { createNoteRepository } from "./noteRepository";

describe("App shell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
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
    await saveNote(createNote("Do usunięcia", "treść", 10), repository, 10);
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
  });
});
