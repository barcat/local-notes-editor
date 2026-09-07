import { fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { App } from "./app";
import { createNoteRepository } from "./noteRepository";

describe("App shell", () => {
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

  it("clears the current draft when a new note is selected", () => {
    render(<App />);
    const title = screen.getByPlaceholderText("Bez tytułu");
    const content = screen.getByPlaceholderText("Zacznij pisać…");

    fireEvent.input(title, { target: { value: "Robocza" } });
    fireEvent.input(content, { target: { value: "Treść" } });
    fireEvent.click(screen.getByRole("button", { name: "Otwórz notatki i ustawienia" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Nowa notatka" }));

    expect(title).toHaveValue("");
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
});
