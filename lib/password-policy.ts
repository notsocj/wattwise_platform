/**
 * The password rule for every new or changed password. Supabase Auth enforces
 * the same rule server-side (Authentication → Providers → Email → Password
 * requirements: minimum length 8, "Lowercase, uppercase letters, digits and
 * symbols"), so these checks only guide people before they submit.
 */
export const PASSWORD_MIN_LENGTH = 8;

// Supabase Auth's symbol set; any other character doesn't count as a symbol there.
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export const PASSWORD_RULES = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    missing: `at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "upper", label: "An uppercase letter (A–Z)", missing: "an uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { id: "lower", label: "A lowercase letter (a–z)", missing: "a lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { id: "number", label: "A number (0–9)", missing: "a number", test: (value: string) => /[0-9]/.test(value) },
  {
    id: "symbol",
    label: "A symbol, like ! @ # $ %",
    missing: "a symbol",
    test: (value: string) => [...value].some((char) => PASSWORD_SYMBOLS.includes(char)),
  },
] as const;

/** Null when the password meets every rule, otherwise one sentence naming what's missing. */
export function validateNewPassword(value: string): string | null {
  if (!value) return "Create a password.";
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.missing);
  if (!missing.length) return null;
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return `Add ${list}.`;
}
