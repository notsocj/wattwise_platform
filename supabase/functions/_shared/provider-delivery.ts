export type ProviderResult = {
  status: "sent" | "failed" | "skipped";
  attempts: number;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

// OneSignal's current Create Message API requires an explicit push channel.
export const oneSignalPushEndpoint = "https://api.onesignal.com/notifications?c=push";

type ProviderRequestOptions = {
  fetcher?: typeof fetch;
  pause?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
};

export function hasRequiredProviderConfig(...values: Array<string | undefined>): boolean {
  return values.every((value) => typeof value === "string" && value.trim().length > 0);
}

export function parseOneSignalSuccess(body: Record<string, unknown>): ProviderResult {
  if (body.recipients === 0) {
    return {
      status: "skipped",
      attempts: 1,
      errorCode: "no_push_subscription",
      errorMessage: "No active push subscription was found.",
    };
  }

  return {
    status: "sent",
    attempts: 1,
    providerMessageId: typeof body.id === "string" ? body.id : undefined,
  };
}

function providerErrorDetail(body: Record<string, unknown>): string | null {
  const candidate = typeof body.errors === "string"
    ? body.errors
    : Array.isArray(body.errors) ? body.errors.filter((value): value is string => typeof value === "string").join("; ")
    : typeof body.error === "string" ? body.error
    : typeof body.message === "string" ? body.message
    : "";
  const safe = candidate
    .replace(/(authorization|api[ _-]?key|token)\s*[:=]\s*[^\s,;]+/gi, "$1: [redacted]")
    .replace(/[\r\n]+/g, " ").trim().slice(0, 220);
  return safe || null;
}

export async function sendProviderRequest(
  requestFactory: () => Request,
  parseSuccess: (body: Record<string, unknown>) => ProviderResult,
  options: ProviderRequestOptions = {}
): Promise<ProviderResult> {
  const fetcher = options.fetcher ?? fetch;
  const pause =
    options.pause ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const maxAttempts = options.maxAttempts ?? 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetcher(requestFactory());
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (response.ok) {
        return { ...parseSuccess(body), attempts: attempt };
      }

      const temporary = response.status === 429 || response.status >= 500;
      if (temporary && attempt < maxAttempts) {
        await pause(250 * 2 ** (attempt - 1));
        continue;
      }

      return {
        status: "failed",
        attempts: attempt,
        errorCode: `provider_http_${response.status}`,
        errorMessage: providerErrorDetail(body) ?? "The notification provider rejected the request.",
      };
    } catch {
      if (attempt < maxAttempts) {
        await pause(250 * 2 ** (attempt - 1));
        continue;
      }

      return {
        status: "failed",
        attempts: attempt,
        errorCode: "provider_network_error",
        errorMessage: "The notification provider could not be reached.",
      };
    }
  }

  return {
    status: "failed",
    attempts: maxAttempts,
    errorCode: "provider_unknown_error",
    errorMessage: "The notification provider request did not complete.",
  };
}
