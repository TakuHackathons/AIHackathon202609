/** Static assets and Hono API are hosted at the root of the same Worker. */
export function buildUrl(path: string): string {
  return path.startsWith('/') ? path : '/' + path;
}
