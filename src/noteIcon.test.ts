import { beforeEach, describe, expect, it } from "vitest";
import { createEmojiFavicon, DEFAULT_NOTE_ICON, isNoteIcon, normalizeNoteIcon, updateFavicon } from "./noteIcon";

describe("note icons", () => {
  beforeEach(() => document.head.querySelectorAll('link[rel="icon"]').forEach((link) => link.remove()));

  it.each(["📝", "❤️", "🇵🇱", "👩‍💻", "👍🏽", "👨‍👩‍👧‍👦", "1️⃣", "🏳️‍🌈"])("accepts a single emoji: %s", (icon) => {
    expect(isNoteIcon(icon)).toBe(true);
    expect(normalizeNoteIcon(` ${icon} `)).toBe(icon);
  });

  it.each([undefined, null, 12, "", "text", "a", "1", "📝💡", "🇵", "<svg onload='alert(1)'>", "👩‍A", "💡\n📚", "🏽"])("rejects invalid input: %s", (input) => {
    expect(isNoteIcon(input)).toBe(false);
    expect(normalizeNoteIcon(input)).toBe(DEFAULT_NOTE_ICON);
  });

  it("creates an encoded SVG and never interpolates arbitrary markup", () => {
    const href = createEmojiFavicon("👩‍💻");
    expect(href).toMatch(/^data:image\/svg\+xml,%3Csvg/);
    const svg = decodeURIComponent(href.split(",")[1]);
    const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(xml.querySelector("text")?.textContent).toBe("👩‍💻");
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(decodeURIComponent(createEmojiFavicon('<script>alert(1)</script>'))).not.toContain("script");
  });

  it("reuses a single favicon link and removes conflicting duplicates", () => {
    updateFavicon("💡");
    const first = document.head.querySelector('link[rel="icon"]');
    document.head.append(first!.cloneNode());
    updateFavicon("🇵🇱");
    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="icon"]')).toBe(first);
    expect(first).toHaveAttribute("href", createEmojiFavicon("🇵🇱"));
  });
});
