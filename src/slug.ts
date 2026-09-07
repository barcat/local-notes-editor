export const MAX_SLUG_LENGTH = 80;
export const DEFAULT_SLUG = "bez-tytulu";

/** Slugs that would conflict with the app's logical routes. */
export const RESERVED_SLUGS = new Set(["notatki"]);

const POLISH_LETTERS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

function transliterate(value: string): string {
  return value
    .toLocaleLowerCase("pl-PL")
    .replace(/[ąćęłńóśźż]/g, (character) => POLISH_LETTERS[character] ?? character)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function truncateSlug(slug: string, maxLength = MAX_SLUG_LENGTH): string {
  return slug.slice(0, maxLength).replace(/-+$/, "");
}

export function addSlugSuffix(baseSlug: string, suffix: number, maxLength = MAX_SLUG_LENGTH): string {
  const suffixText = `-${suffix}`;
  const base = truncateSlug(baseSlug, Math.max(1, maxLength - suffixText.length));
  return `${base || DEFAULT_SLUG.slice(0, Math.max(1, maxLength - suffixText.length))}${suffixText}`.slice(0, maxLength);
}

export function slugify(title: string): string {
  const normalized = transliterate(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = truncateSlug(normalized || DEFAULT_SLUG);
  return isReservedSlug(slug) ? DEFAULT_SLUG : slug;
}

export const toSlug = slugify;

export function firstAvailableSlug(baseSlug: string, occupiedSlugs: Iterable<string>, maxLength = MAX_SLUG_LENGTH): string {
  const occupied = new Set(occupiedSlugs);
  const base = slugify(baseSlug);
  if (!occupied.has(base) && !isReservedSlug(base)) return base;

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = addSlugSuffix(base, suffix, maxLength);
    if (!occupied.has(candidate) && !isReservedSlug(candidate)) return candidate;
  }

  throw new Error("Nie udało się znaleźć wolnego sluga.");
}

export function readableTitleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("pl-PL") + word.slice(1))
    .join(" ");
}
