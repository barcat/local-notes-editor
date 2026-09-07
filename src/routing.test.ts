import { describe, expect, it } from "vitest";
import { buildEditorPath, parseRoute, stripBasePath } from "./routing";

describe("routing", () => {
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
});
