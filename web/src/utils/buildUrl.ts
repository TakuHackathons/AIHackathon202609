/**
 * Prefixes public asset URLs with the configured GitHub Pages base path.
 */
export function buildUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
}
