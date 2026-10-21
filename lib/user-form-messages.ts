const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthFormContext = "login" | "register" | "reset" | "update";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmailAddress(
  value: string,
  emptyMessage = "Enter your email address."
): string | null {
  const email = normalizeEmail(value);

  if (!email) {
    return emptyMessage;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address, like juan@example.com.";
  }

  return null;
}

export function getFriendlyAuthError(
  message: string | undefined,
  context: AuthFormContext
): string {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return "Email or password is incorrect. Check both fields and try again.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Confirm your email before logging in. Check your inbox for the WattWise confirmation link.";
  }

  if (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("user already registered")
  ) {
    return "An account already uses this email. Log in instead, or reset your password.";
  }

  if (
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many") ||
    normalizedMessage.includes("security purposes")
  ) {
    return "Too many attempts. Wait a minute, then try again.";
  }

  if (
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("failed to")
  ) {
    return "WattWise could not connect right now. Check your internet connection and try again.";
  }

  if (context === "update") {
    if (normalizedMessage.includes("different from the old password")) {
      return "Choose a new password that is different from your current one.";
    }
    if (normalizedMessage.includes("session") || normalizedMessage.includes("jwt")) {
      return "Your session expired. Open the reset link again or log in, then retry.";
    }
    if (
      normalizedMessage.includes("code verifier") ||
      normalizedMessage.includes("expired") ||
      normalizedMessage.includes("invalid")
    ) {
      return "This reset link has expired or was already used. Request a new one from the login page.";
    }
    if (normalizedMessage.includes("password")) {
      return "Use a stronger password with at least 8 characters.";
    }
    return "We could not update your password. Try again in a moment.";
  }

  if (context === "login") {
    return "We could not log you in. Check your email and password, then try again.";
  }

  if (context === "register") {
    return "We could not create your account. Review the highlighted fields and try again.";
  }

  return "We could not send the reset link. Check the email address and try again.";
}
