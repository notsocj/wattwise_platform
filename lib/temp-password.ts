import "server-only";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";

/**
 * A 16-character temporary password for tenant logins (no look-alike characters).
 * Always has an uppercase and lowercase letter, a number and a symbol, so it
 * passes the password rule in lib/password-policy.ts and Supabase Auth.
 */
export function generateTempPassword(): string {
  const alphabet = UPPER + LOWER + DIGITS;
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const pick = (chars: string, byte: number) => chars[byte % chars.length];
  const body = Array.from(bytes.subarray(0, 12), (byte) => pick(alphabet, byte)).join("");
  return `${body}${pick(UPPER, bytes[12])}${pick(LOWER, bytes[13])}!7`;
}
