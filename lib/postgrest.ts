// Characters that carry meaning inside a PostgREST `or=(...)` filter or an
// ilike pattern. Stripping them keeps free-text search from altering the filter.
const POSTGREST_FILTER_CHARS = /[,()*%\\:"]/g;

export function toIlikeSearchTerm(raw: string | null | undefined): string | null {
  const term = raw?.replace(POSTGREST_FILTER_CHARS, " ").replace(/\s+/g, " ").trim();
  return term ? term : null;
}
