import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  EDITOR_FONT_FAMILIES,
  PREFERENCES_STORAGE_KEY,
  applyPreferences,
  dismissDataNotice,
  hasSufficientContrast,
  isDataNoticeDismissed,
  loadPreferences,
  parsePreferences,
  normalizePreferences,
  isEditorFontFamily,
  sanitizePreferencesPatch,
  savePreferences,
} from "./preferences";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
}

describe("editor preferences", () => {
  it("loads valid values and accepts range boundaries", () => {
    const parsed = parsePreferences(JSON.stringify({
      backgroundColor: "#ABCDEF",
      textColor: "#123456",
      fontFamily: "IBM Plex Sans",
      fontSizePt: 10,
      lineHeight: 2.4,
      editorWidthPx: 1200,
    }));

    expect(parsed.preferences).toEqual({
      backgroundColor: "#abcdef",
      textColor: "#123456",
      fontFamily: "IBM Plex Sans",
      fontSizePt: 10,
      lineHeight: 2.4,
      editorWidthPx: 1200,
    });
    expect(parsed.correctedInvalidData).toBe(false);
  });

  it("accepts the three bundled IBM Plex fonts without correcting stored preferences", () => {
    for (const fontFamily of ["IBM Plex Mono", "IBM Plex Sans", "IBM Plex Serif"] as const) {
      expect(isEditorFontFamily(fontFamily)).toBe(true);
      const parsed = parsePreferences(JSON.stringify({ ...DEFAULT_PREFERENCES, fontFamily }));
      expect(parsed.preferences.fontFamily).toBe(fontFamily);
      expect(parsed.correctedInvalidData).toBe(false);
    }
    expect(isEditorFontFamily("Comic Sans")).toBe(false);
  });

  it("offers only IBM Plex fonts and defaults to Mono", () => {
    expect(EDITOR_FONT_FAMILIES).toEqual(["IBM Plex Mono", "IBM Plex Sans", "IBM Plex Serif"]);
    expect(DEFAULT_PREFERENCES.fontFamily).toBe("IBM Plex Mono");
  });

  it.each(["Courier New", "Consolas", "Commit Mono", "Georgia", "Arial"])(
    "corrects the retired %s font without resetting other preferences",
    (fontFamily) => {
      const stored = { ...DEFAULT_PREFERENCES, fontFamily, fontSizePt: 18, textColor: "#abcdef" };
      const storage = memoryStorage({ [PREFERENCES_STORAGE_KEY]: JSON.stringify(stored) });
      const loaded = loadPreferences(storage);
      const expected = { ...stored, fontFamily: "IBM Plex Mono" };

      expect(isEditorFontFamily(fontFamily)).toBe(false);
      expect(loaded.preferences).toEqual(expected);
      expect(loaded.correctedInvalidData).toBe(true);
      expect(JSON.parse(storage.getItem(PREFERENCES_STORAGE_KEY)!)).toEqual(expected);
      expect(loadPreferences(storage).correctedInvalidData).toBe(false);
    },
  );

  it("replaces invalid fields independently with defaults", () => {
    const parsed = parsePreferences(JSON.stringify({
      backgroundColor: "red",
      textColor: "#ffffff",
      fontFamily: "Comic Sans",
      fontSizePt: 25,
      lineHeight: 1.2,
      editorWidthPx: 480,
    }));

    expect(parsed.preferences.backgroundColor).toBe(DEFAULT_PREFERENCES.backgroundColor);
    expect(parsed.preferences.textColor).toBe("#ffffff");
    expect(parsed.preferences.fontFamily).toBe(DEFAULT_PREFERENCES.fontFamily);
    expect(parsed.preferences.fontSizePt).toBe(DEFAULT_PREFERENCES.fontSizePt);
    expect(parsed.preferences.lineHeight).toBe(1.2);
    expect(parsed.preferences.editorWidthPx).toBe(480);
    expect(parsed.correctedInvalidData).toBe(true);
  });

  it("persists preferences and the dismissible data notice", () => {
    const storage = memoryStorage();
    expect(savePreferences(DEFAULT_PREFERENCES, storage).ok).toBe(true);
    expect(loadPreferences(storage).preferences).toEqual(DEFAULT_PREFERENCES);
    expect(isDataNoticeDismissed(storage)).toBe(false);
    expect(dismissDataNotice(storage).ok).toBe(true);
    expect(isDataNoticeDismissed(storage)).toBe(true);
  });

  it("saves and restores each bundled font", () => {
    for (const fontFamily of ["IBM Plex Mono", "IBM Plex Sans", "IBM Plex Serif"] as const) {
      const storage = memoryStorage();
      const preferences = { ...DEFAULT_PREFERENCES, fontFamily };
      expect(savePreferences(preferences, storage).ok).toBe(true);
      expect(loadPreferences(storage).preferences.fontFamily).toBe(fontFamily);
    }
  });

  it("applies explicit fallback stacks for bundled fonts", () => {
    const root = document.createElement("div");
    for (const [fontFamily, fallback] of [
      ["IBM Plex Mono", "monospace"],
      ["IBM Plex Sans", "sans-serif"],
      ["IBM Plex Serif", "serif"],
    ] as const) {
      applyPreferences({ ...DEFAULT_PREFERENCES, fontFamily }, root);
      expect(root.style.getPropertyValue("--editor-font-family")).toBe(`"${fontFamily}", ${fallback}`);
    }
  });

  it("reports storage failures without blocking defaults", () => {
    const failingStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    } as unknown as Storage;

    expect(loadPreferences(failingStorage).preferences).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences(failingStorage).storageAvailable).toBe(false);
    expect(savePreferences(DEFAULT_PREFERENCES, failingStorage).ok).toBe(false);
    expect(hasSufficientContrast({ backgroundColor: "#ffffff", textColor: "#ffffff" })).toBe(false);
    expect(hasSufficientContrast({ backgroundColor: "#ffffff", textColor: "#000000" })).toBe(true);
  });

  it("sanitizes interactive updates at the same field boundaries", () => {
    expect(sanitizePreferencesPatch({ fontSizePt: 9, lineHeight: 2.4, editorWidthPx: 1201, textColor: "#ABCDEF" })).toEqual({
      lineHeight: 2.4,
      textColor: "#abcdef",
    });
  });
  it("normalizes missing, partial and malformed note settings with independent fallbacks", () => {
    for (const value of [undefined, null, [], "invalid"]) {
      expect(normalizePreferences(value).preferences).toEqual(DEFAULT_PREFERENCES);
    }
    const fallback = { ...DEFAULT_PREFERENCES, fontSizePt: 18 };
    expect(normalizePreferences({ textColor: "#ABCDEF", lineHeight: 99 }, fallback).preferences)
      .toEqual({ ...fallback, textColor: "#abcdef" });
    expect(normalizePreferences(DEFAULT_PREFERENCES).correctedInvalidData).toBe(false);
  });

});
