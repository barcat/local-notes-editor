import { describe, expect, it, vi } from "vitest";
import { createNewNote, createNote, createSaveCoordinator, createTextExport, formatNoteTimestampTitle, saveNewNote } from "./noteOperations";
import { createNoteRepository } from "./noteRepository";
import type { NoteRepository } from "./types";

function repositoryWithSave(save: NoteRepository["save"]): NoteRepository {
  return {
    getBySlug: async () => undefined,
    getMostRecent: async () => undefined,
    listMostRecent: async () => [],
    save,
    delete: async () => undefined,
    isSlugAvailable: async () => true,
  };
}

describe("save coordinator", () => {
  it("formats timestamp titles and creates distinct notes in the same minute", async () => {
    const timestamp = new Date(2026, 8, 10, 9, 7, 42, 123).getTime();
    expect(formatNoteTimestampTitle(timestamp)).toBe("2026-09-10 09:07");

    const repository = createNoteRepository(`note-factory-test-${crypto.randomUUID()}`);
    const first = await saveNewNote(createNewNote(timestamp), repository, timestamp);
    const second = await saveNewNote(createNewNote(timestamp + 10_000), repository, timestamp + 10_000);

    expect(first.id).not.toBe(second.id);
    expect(first.title).toBe(second.title);
    expect(first.slug).not.toBe(second.slug);
    expect(first.content).toBe("");
  });

  it("preserves the committed slug during content autosave", async () => {
    const save = vi.fn(async () => undefined);
    const coordinator = createSaveCoordinator({ repository: repositoryWithSave(save), delay: 0 });
    coordinator.schedule({ id: "note-1", title: "Stary tytuł", slug: "stary-tytul", content: "Treść", updatedAt: 1 });
    await coordinator.flush();

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: "Stary tytuł", slug: "stary-tytul" }));
    coordinator.dispose();
  });

  it("waits 400 ms before saving and coalesces rapid edits", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => undefined);
    const coordinator = createSaveCoordinator({ repository: repositoryWithSave(save) });
    const note = createNote("Test", "pierwsza", 1);

    coordinator.schedule(note);
    await vi.advanceTimersByTimeAsync(399);
    expect(save).not.toHaveBeenCalled();

    coordinator.schedule({ ...note, content: "ostatnia" });
    await vi.advanceTimersByTimeAsync(399);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await coordinator.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ content: "ostatnia" }));
    coordinator.dispose();
    vi.useRealTimers();
  });

  it("serializes a second edit made while the first save is pending", async () => {
    vi.useFakeTimers();
    let releaseFirst: (() => void) | undefined;
    const firstSave = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const save = vi.fn()
      .mockImplementationOnce(async () => firstSave)
      .mockResolvedValue(undefined);
    const coordinator = createSaveCoordinator({ repository: repositoryWithSave(save) });
    const note = createNote("Test", "pierwsza", 1);

    coordinator.schedule(note);
    await vi.advanceTimersByTimeAsync(400);
    coordinator.schedule({ ...note, content: "druga" });
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    await coordinator.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual(expect.objectContaining({ content: "druga" }));
    coordinator.dispose();
    vi.useRealTimers();
  });

  it("reports a failed save without changing the draft", async () => {
    const failure = new Error("Brak miejsca");
    const onError = vi.fn();
    const coordinator = createSaveCoordinator({
      repository: repositoryWithSave(async () => { throw failure; }),
      delay: 0,
      onError,
    });
    const note = createNote("Test", "zachowaj mnie", 1);

    coordinator.schedule(note);
    await expect(coordinator.flush()).rejects.toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure, expect.objectContaining({ content: "zachowaj mnie" }), true);
    coordinator.dispose();
  });

  it("cancels pending saves and waits for an active save before deletion", async () => {
    let releaseSave: (() => void) | undefined;
    const saveFinished = new Promise<void>((resolve) => { releaseSave = resolve; });
    const stored = new Map<string, unknown>();
    const note = createNote("Do usunięcia", "treść", 1);
    const repository = repositoryWithSave(async (saved) => {
      await saveFinished;
      stored.set(saved.id, saved);
    });
    const coordinator = createSaveCoordinator({ repository, delay: 0 });

    coordinator.schedule(note);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const cancellation = coordinator.cancelAndWait();
    expect(stored.has(note.id)).toBe(false);
    releaseSave?.();
    await cancellation;
    stored.delete(note.id);
    expect(stored.has(note.id)).toBe(false);
    coordinator.dispose();
  });

  it("creates a UTF-8 text export from the latest content", async () => {
    const exported = createTextExport("Mój plan", "spacje  \n\nłódź <b>bez HTML</b>");
    expect(exported.fileName).toBe("moj-plan.txt");
    expect(exported.blob.type).toBe("text/plain;charset=utf-8");
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exported.blob);
    });
    expect(text).toBe("spacje  \n\nłódź <b>bez HTML</b>");
  });
});
