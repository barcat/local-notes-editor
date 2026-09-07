import { describe, expect, it, vi } from "vitest";
import { createNote, createSaveCoordinator } from "./noteOperations";
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
});
