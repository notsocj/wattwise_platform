export type ProviderResult = {
  status: "sent" | "failed" | "skipped";
  attempts: number;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

// OneSignal's current Create Message API requires an explicit push channel.
export const oneSignalPushEndpoint = "https://api.onesignal.com/notifications?c=push";
// OneSignal App IDs are public identifiers. Keep a verified WattWise fallback so
// an accidentally pasted provider secret cannot break production delivery.
export const wattWiseOneSignalAppId = "7d47613e-7c0a-4b52-b613-3c57291f45d7";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveOneSignalAppId(configuredValue: string | undefined): string {
  const configured = configuredValue?.trim() ?? "";
  return UUID_PATTERN.test(configured) ? configured : wattWiseOneSignalAppId;
}

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
  const errorValue = body.errors ?? body.error ?? body.message;
  const candidate = typeof errorValue === "string"
    ? errorValue
    : Array.isArray(errorValue)
      ? errorValue.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join("; ")
    : errorValue === undefined
      ? ""
      : JSON.stringify(errorValue);
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
