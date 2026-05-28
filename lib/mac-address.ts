export const MAC_REGEX = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/;
export const MAC_IN_TEXT = /([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/;
export const COMPACT_MAC_IN_TEXT = /\b[0-9A-Fa-f]{12}\b/;

export function normalizeMac(value: string): string {
  const cleaned = value.trim();
  const separatedMatch = cleaned.match(MAC_IN_TEXT);

  if (separatedMatch) {
    return separatedMatch[0].replace(/-/g, ":").toUpperCase();
  }

  const compactMatch = cleaned.match(COMPACT_MAC_IN_TEXT);
  if (!compactMatch) {
    return cleaned.replace(/-/g, ":").toUpperCase();
  }

  return compactMatch[0]
    .toUpperCase()
    .match(/.{1,2}/g)!
    .join(":");
}
