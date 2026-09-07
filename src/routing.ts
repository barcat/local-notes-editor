export type Route =
  | { kind: "editor"; slug?: string }
  | { kind: "not-found"; path: string };

export const PENDING_PATH_STORAGE_KEY = "local-notes:pending-path:v1";

function getSessionStorage(): Pick<Storage, "getItem" | "removeItem"> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function normalizeBasePath(basePath: string): string {
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

export function getBasePath(basePath = import.meta.env.BASE_URL): string {
  return normalizeBasePath(basePath);
}

export function stripBasePath(pathname: string, basePath = getBasePath()): string | undefined {
  const normalizedBase = normalizeBasePath(basePath);
  if (normalizedBase === "/") return pathname || "/";
  if (pathname === normalizedBase || pathname === `${normalizedBase}/`) return "/";
  if (!pathname.startsWith(`${normalizedBase}/`)) return undefined;
  return pathname.slice(normalizedBase.length) || "/";
}

export function parseRoute(pathname = window.location.pathname, basePath = getBasePath()): Route {
  const logicalPath = stripBasePath(pathname, basePath);
  if (logicalPath === undefined) return { kind: "not-found", path: pathname };
  if (logicalPath === "/" || logicalPath === "") return { kind: "editor" };

  const noteMatch = logicalPath.match(/^\/notatki\/([^/]+)\/?$/);
  if (noteMatch) return { kind: "editor", slug: decodeURIComponent(noteMatch[1]) };

  return { kind: "not-found", path: logicalPath };
}

export function restorePendingPath(
  basePath = getBasePath(),
  storage: Pick<Storage, "getItem" | "removeItem"> | undefined = getSessionStorage(),
): string | undefined {
  if (!storage) return undefined;

  let pendingPath: string | null;
  try {
    pendingPath = storage.getItem(PENDING_PATH_STORAGE_KEY);
    storage.removeItem(PENDING_PATH_STORAGE_KEY);
  } catch {
    return undefined;
  }

  if (!pendingPath || stripBasePath(pendingPath, basePath) === undefined) return undefined;
  window.history.replaceState({}, "", pendingPath);
  return pendingPath;
}

export function buildEditorPath(slug?: string, basePath = getBasePath()): string {
  const normalizedBase = normalizeBasePath(basePath);
  const prefix = normalizedBase === "/" ? "" : normalizedBase;
  return slug ? `${prefix}/notatki/${encodeURIComponent(slug)}` : `${prefix}/`;
}

export function replaceEditorPath(slug?: string, basePath = getBasePath()): void {
  window.history.replaceState({}, "", buildEditorPath(slug, basePath));
}

export function pushEditorPath(slug?: string, basePath = getBasePath()): void {
  window.history.pushState({}, "", buildEditorPath(slug, basePath));
}
