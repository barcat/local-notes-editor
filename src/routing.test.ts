import { describe, expect, it } from "vitest";
import { buildEditorPath, buildNotesPath, parseRoute, PENDING_PATH_STORAGE_KEY, restorePendingPath, stripBasePath } from "./routing";

describe("routing", () => {
  it("parses and builds the list route without conflicting with note routes", () => {
    for (const base of ["/", "/local-notes-editor/"]) {
      const path = buildNotesPath(base);
      expect(parseRoute(path, base)).toEqual({ kind: "list" });
      expect(parseRoute(`${path}/`, base)).toEqual({ kind: "list" });
      expect(parseRoute(`${path}/test`, base)).toEqual({ kind: "editor", slug: "test" });
    }
    expect(buildNotesPath("/")).toBe("/notatki");
    expect(buildNotesPath("/local-notes-editor/")).toBe("/local-notes-editor/notatki");
  });

  it("restores a direct list URL after the GitHub Pages fallback", () => {
    const storage = { getItem: () => "/local-notes-editor/notatki", removeItem: () => {} };
    restorePendingPath("/local-notes-editor/", storage);
    expect(parseRoute(window.location.pathname, "/local-notes-editor/")).toEqual({ kind: "list" });
  });
  it("parses root and note routes with a GitHub Pages base path", () => {
    expect(parseRoute("/local-notes-editor/", "/local-notes-editor/")).toEqual({ kind: "editor" });
    expect(parseRoute("/local-notes-editor/notatki/moj-pomysl", "/local-notes-editor/")).toEqual({
      kind: "editor",
      slug: "moj-pomysl",
    });
  });

  it("encodes slugs and rejects paths outside the configured base", () => {
    expect(buildEditorPath("mój pomysł", "/local-notes-editor/")).toBe("/local-notes-editor/notatki/m%C3%B3j%20pomys%C5%82");
    expect(stripBasePath("/other/notatki/test", "/local-notes-editor/")).toBeUndefined();
    expect(parseRoute("/local-notes-editor/inne", "/local-notes-editor/")).toEqual({ kind: "not-found", path: "/inne" });
  });

  it("restores only a valid pending app path before initialization", () => {
    const values = new Map([[PENDING_PATH_STORAGE_KEY, "/local-notes-editor/notatki/moj-pomysl"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
    };

    expect(restorePendingPath("/local-notes-editor/", storage)).toBe("/local-notes-editor/notatki/moj-pomysl");
    expect(window.location.pathname).toBe("/local-notes-editor/notatki/moj-pomysl");
    expect(values.has(PENDING_PATH_STORAGE_KEY)).toBe(false);
  });
});
