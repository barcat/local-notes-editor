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

  it("clears the current draft when a new note is selected", async () => {
    render(<App />);
    const title = screen.getByPlaceholderText("Bez tytułu");
    const content = screen.getByPlaceholderText("Zacznij pisać…");

    fireEvent.input(title, { target: { value: "Robocza" } });
    fireEvent.input(content, { target: { value: "Treść" } });
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Nowa notatka" }));

    await waitFor(() => expect(title).toHaveValue(""));
    expect(content).toHaveValue("");
  });

  it("autosaves a draft and restores it when the app is mounted again", async () => {
    const repository = createNoteRepository(`app-test-${crypto.randomUUID()}`);
    const firstRender = render(<App repository={repository} autoSaveDelay={0} />);

    fireEvent.input(screen.getByPlaceholderText("Bez tytułu"), { target: { value: "Trwała notatka" } });
    fireEvent.input(screen.getByPlaceholderText("Zacznij pisać…"), { target: { value: "HTML <b>i Markdown **bez interpretacji**" } });
    await waitFor(async () => {
      const saved = await repository.getMostRecent();
      expect(saved?.content).toBe("HTML <b>i Markdown **bez interpretacji**");
    });

    firstRender.unmount();
    render(<App repository={repository} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Trwała notatka"));
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

  it("cancels deletion or removes the current note and opens an empty editor", async () => {
    const repository = createNoteRepository(`app-delete-test-${crypto.randomUUID()}`);
    await saveNote(createNote("Do usunięcia", "treść", 10), repository, 10);
    render(<App repository={repository} />);
    await waitFor(() => expect(screen.getByPlaceholderText("Bez tytułu")).toHaveValue("Do usunięcia"));

    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Usuń" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(screen.getByRole("dialog", { name: "Usunąć notatkę?" })).toBeInTheDocument();
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
