import { decodeHTMLStrict } from "entities/decode";

export function safeLink(href: string, autolink = false): string | null {
  const decoded = autolink ? href : decodeHTMLStrict(href);
  if (!/^https?:\/\//i.test(decoded) || /[\u0000-\u0020\u007f-\u009f]/.test(decoded)) return null;
  try {
    const url = new URL(decoded);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname ? decoded : null;
  } catch {
    return null;
  }
}
