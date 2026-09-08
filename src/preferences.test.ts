import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  dismissDataNotice,
  hasSufficientContrast,
  isDataNoticeDismissed,
  loadPreferences,
  parsePreferences,
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
      fontFamily: "Arial",
      fontSizePt: 10,
      lineHeight: 2.4,
      editorWidthPx: 1200,
    }));

    expect(parsed.preferences).toEqual({
      backgroundColor: "#abcdef",
      textColor: "#123456",
      fontFamily: "Arial",
      fontSizePt: 10,
      lineHeight: 2.4,
      editorWidthPx: 1200,
    });
    expect(parsed.correctedInvalidData).toBe(false);
  });

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
});
