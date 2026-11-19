const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * True for a state-changing API request that a browser sent from another site
 * (OWASP A01, cross-site request forgery). Session cookies are already
 * SameSite=Lax; this is the second layer. Requests with no Origin or
 * Sec-Fetch-Site (curl, servers) are left to each route's own auth check.
 */
export function isCrossSiteApiWrite(input: {
  method: string;
  pathname: string;
  origin: string | null;
  host: string | null;
  secFetchSite: string | null;
}): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase()) || !input.pathname.startsWith("/api/")) return false;
  if (input.secFetchSite === "cross-site") return true;
  if (!input.origin) return false;
  try {
    return new URL(input.origin).host !== input.host;
  } catch {
    return true; // "null" or a malformed Origin is never this site.
  }
}
