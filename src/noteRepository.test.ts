import { describe, expect, it } from "vitest";
import { createNote, saveNote } from "./noteOperations";
import { createNoteRepository } from "./noteRepository";

function repositoryForTest() {
  return createNoteRepository(`local-notes-test-${crypto.randomUUID()}`);
}

describe("IndexedDB note repository", () => {
  it("saves, reads, updates and deletes a note without changing its id", async () => {
    const repository = repositoryForTest();
    const initial = await saveNote(createNote("Pierwsza notatka", "Treść", 10), repository, 10);
    const updated = await saveNote({ ...initial, title: "Zmieniona nazwa", content: "Nowa treść" }, repository, 20);

    expect(updated.id).toBe(initial.id);
    expect(await repository.getBySlug("zmieniona-nazwa")).toEqual(updated);

    await repository.delete(updated.id);
    expect(await repository.getBySlug("zmieniona-nazwa")).toBeUndefined();
  });

  it("lists and selects notes by descending updatedAt", async () => {
    const repository = repositoryForTest();
    const older = await saveNote(createNote("Starsza", "", 10), repository, 10);
    const newer = await saveNote(createNote("Nowsza", "", 20), repository, 20);

    expect(await repository.getMostRecent()).toEqual(newer);
    expect(await repository.listMostRecent()).toEqual([newer, older]);
  });

  it("enforces a unique slug and allows the owner to keep its slug", async () => {
    const repository = repositoryForTest();
    const first = await saveNote(createNote("Ten sam tytuł", "", 1), repository, 1);
    const second = await saveNote(createNote("Ten sam tytuł", "", 2), repository, 2);

    expect(second.slug).toBe("ten-sam-tytul-2");
    expect(await repository.isSlugAvailable(first.slug)).toBe(false);
    expect(await repository.isSlugAvailable(first.slug, first.id)).toBe(true);
  });
});
