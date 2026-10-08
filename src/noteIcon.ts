export const DEFAULT_NOTE_ICON = "📝";
export const NOTE_ICON_PRESETS = ["📝", "💡", "📚", "💻", "🎯", "⭐", "❤️", "🔖"] as const;

// Match a complete emoji sequence, including flags, keycaps and ZWJ sequences.
const emojiSequence = /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)$/u;
// The project targets ES2022; Segmenter is available in supported desktop browsers.
const segmenter = new (Intl as typeof Intl & {
  Segmenter: new (locale?: string, options?: { granularity: "grapheme" }) => {
    segment(value: string): Iterable<unknown>;
  };
}).Segmenter(undefined, { granularity: "grapheme" });

export function isNoteIcon(value: unknown): value is string {
  return typeof value === "string" && emojiSequence.test(value.trim())
    && [...segmenter.segment(value.trim())].length === 1;
}

export function normalizeNoteIcon(value: unknown): string {
  return isNoteIcon(value) ? value.trim() : DEFAULT_NOTE_ICON;
}

export function createEmojiFavicon(icon: string): string {
  const safeIcon = normalizeNoteIcon(icon).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="50" text-anchor="middle" font-size="52">${safeIcon}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function updateFavicon(icon: string): void {
  const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
  const link = links[0] ?? document.createElement("link");
  for (const duplicate of links.slice(1)) duplicate.remove();
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.removeAttribute("sizes");
  link.href = createEmojiFavicon(icon);
  if (!link.isConnected) document.head.append(link);
}
