export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const LETTERS_AND_SPACES_PATTERN = /^[\p{L}]+(?: [\p{L}]+)*$/u;
export const MAC_ADDRESS_PATTERN = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/;
export const CURRENCY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required.`;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();

  if (!email) {
    return "Email address is required.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validateLettersAndSpaces(
  value: string,
  label: string
): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return `${label} is required.`;
  }

  if (!LETTERS_AND_SPACES_PATTERN.test(normalized)) {
    return `${label} must use letters and spaces only.`;
  }

  return null;
}

export function normalizeNameValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validatePassword(value: string): string | null {
  if (!value) {
    return "Password is required.";
  }

  if (value.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  return null;
}

export function validateCurrencyAmount(
  value: string,
  label: string,
  max = 9_999_999.99
): { value?: number; error?: string } {
  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) {
    return { error: `${label} is required.` };
  }

  if (!CURRENCY_PATTERN.test(normalized)) {
    return { error: `${label} must be a valid amount with up to 2 decimal places.` };
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: `${label} must be greater than 0.` };
  }

  if (parsed > max) {
    return { error: `${label} cannot exceed ${max.toLocaleString("en-PH")}.` };
  }

  return { value: Number(parsed.toFixed(2)) };
}

export function validateDailyHours(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 24) {
    return "Daily usage must be a whole number from 1 to 24 hours.";
  }

  return null;
}
