import type { EditorFontFamily, EditorPreferences } from "./types";

export const PREFERENCES_STORAGE_KEY = "local-notes:preferences:v1";
export const DATA_NOTICE_STORAGE_KEY = "local-notes:data-notice-dismissed:v1";
export const EDITOR_FONT_FAMILIES: EditorFontFamily[] = ["Courier New", "Consolas", "Georgia", "Arial"];

export const DEFAULT_PREFERENCES: EditorPreferences = {
  backgroundColor: "#233d4d",
  textColor: "#fe7f2d",
  fontFamily: "Courier New",
  fontSizePt: 13,
  lineHeight: 1.8,
  editorWidthPx: 920,
};

export interface PreferencesLoadResult {
  preferences: EditorPreferences;
  storageAvailable: boolean;
  correctedInvalidData: boolean;
}

export interface StorageResult {
  ok: boolean;
  error?: unknown;
}

export function sanitizePreferencesPatch(patch: Partial<EditorPreferences>): Partial<EditorPreferences> {
  const sanitized: Partial<EditorPreferences> = {};
  if ("backgroundColor" in patch) {
    const value = normalizeHexColor(patch.backgroundColor);
    if (value) sanitized.backgroundColor = value;
  }
  if ("textColor" in patch) {
    const value = normalizeHexColor(patch.textColor);
    if (value) sanitized.textColor = value;
  }
  if ("fontFamily" in patch && isEditorFontFamily(patch.fontFamily)) sanitized.fontFamily = patch.fontFamily;
  if ("fontSizePt" in patch && boundedNumber(patch.fontSizePt, 10, 24) !== undefined) sanitized.fontSizePt = patch.fontSizePt;
  if ("lineHeight" in patch && boundedNumber(patch.lineHeight, 1.2, 2.4) !== undefined) sanitized.lineHeight = patch.lineHeight;
  if ("editorWidthPx" in patch && boundedNumber(patch.editorWidthPx, 480, 1200) !== undefined) sanitized.editorWidthPx = patch.editorWidthPx;
  return sanitized;
}

function getStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return undefined;
  return value.toLowerCase();
}

export function isEditorFontFamily(value: unknown): value is EditorFontFamily {
  return typeof value === "string" && EDITOR_FONT_FAMILIES.includes(value as EditorFontFamily);
}

function boundedNumber(value: unknown, minimum: number, maximum: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) return undefined;
  return value;
}

export function parsePreferences(raw: string | null): { preferences: EditorPreferences; correctedInvalidData: boolean } {
  if (raw === null) return { preferences: { ...DEFAULT_PREFERENCES }, correctedInvalidData: false };

  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    parsed = value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    parsed = {};
  }

  const backgroundColor = normalizeHexColor(parsed.backgroundColor);
  const textColor = normalizeHexColor(parsed.textColor);
  const fontSizePt = boundedNumber(parsed.fontSizePt, 10, 24);
  const lineHeight = boundedNumber(parsed.lineHeight, 1.2, 2.4);
  const editorWidthPx = boundedNumber(parsed.editorWidthPx, 480, 1200);
  const fontFamily = isEditorFontFamily(parsed.fontFamily) ? parsed.fontFamily : undefined;

  return {
    preferences: {
      backgroundColor: backgroundColor ?? DEFAULT_PREFERENCES.backgroundColor,
      textColor: textColor ?? DEFAULT_PREFERENCES.textColor,
      fontFamily: fontFamily ?? DEFAULT_PREFERENCES.fontFamily,
      fontSizePt: fontSizePt ?? DEFAULT_PREFERENCES.fontSizePt,
      lineHeight: lineHeight ?? DEFAULT_PREFERENCES.lineHeight,
      editorWidthPx: editorWidthPx ?? DEFAULT_PREFERENCES.editorWidthPx,
    },
    correctedInvalidData: backgroundColor === undefined
      || textColor === undefined
      || fontFamily === undefined
      || fontSizePt === undefined
      || lineHeight === undefined
      || editorWidthPx === undefined,
  };
}

export function loadPreferences(storage: Storage | undefined = getStorage()): PreferencesLoadResult {
  if (!storage) {
    return { preferences: { ...DEFAULT_PREFERENCES }, storageAvailable: false, correctedInvalidData: false };
  }

  try {
    const parsed = parsePreferences(storage.getItem(PREFERENCES_STORAGE_KEY));
    if (parsed.correctedInvalidData) {
      try {
        storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(parsed.preferences));
      } catch {
        // The corrected values still apply for this session even if persistence is unavailable.
      }
    }
    return { ...parsed, storageAvailable: true };
  } catch {
    return { preferences: { ...DEFAULT_PREFERENCES }, storageAvailable: false, correctedInvalidData: false };
  }
}

export function savePreferences(preferences: EditorPreferences, storage: Storage | undefined = getStorage()): StorageResult {
  if (!storage) return { ok: false, error: new Error("localStorage jest niedostępny.") };
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function applyPreferences(preferences: EditorPreferences, root: HTMLElement = document.documentElement): void {
  const fontFallback = preferences.fontFamily === "Georgia" ? "serif" : preferences.fontFamily === "Arial" ? "sans-serif" : "monospace";
  root.style.setProperty("--editor-bg", preferences.backgroundColor);
  root.style.setProperty("--editor-text", preferences.textColor);
  root.style.setProperty("--editor-font-family", `"${preferences.fontFamily}", ${fontFallback}`);
  root.style.setProperty("--editor-font-size", `${preferences.fontSizePt}pt`);
  root.style.setProperty("--editor-line-height", String(preferences.lineHeight));
  root.style.setProperty("--editor-width", `${preferences.editorWidthPx}px`);
  root.ownerDocument.defaultView?.dispatchEvent(new Event("editor-appearance-change"));
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hexColor: string): number {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  return (0.2126 * channelToLinear(red)) + (0.7152 * channelToLinear(green)) + (0.0722 * channelToLinear(blue));
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(normalizeHexColor(foreground) ?? DEFAULT_PREFERENCES.textColor);
  const backgroundLuminance = relativeLuminance(normalizeHexColor(background) ?? DEFAULT_PREFERENCES.backgroundColor);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hasSufficientContrast(preferences: Pick<EditorPreferences, "backgroundColor" | "textColor">): boolean {
  return contrastRatio(preferences.textColor, preferences.backgroundColor) >= 4.5;
}

export function isDataNoticeDismissed(storage: Storage | undefined = getStorage()): boolean {
  try {
    return storage?.getItem(DATA_NOTICE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissDataNotice(storage: Storage | undefined = getStorage()): StorageResult {
  if (!storage) return { ok: false, error: new Error("localStorage jest niedostępny.") };
  try {
    storage.setItem(DATA_NOTICE_STORAGE_KEY, "true");
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
