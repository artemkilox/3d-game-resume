const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Public-file URL. On GitHub Pages this includes the repository prefix. */
export function asset(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (base && (path === base || path.startsWith(`${base}/`))) return path;
  return `${base}${path}`;
}
