import "server-only";

/** A 16-character temporary password for tenant logins (no look-alike characters). */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${body}!7`;
}
