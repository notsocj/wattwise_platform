export const DEVICE_PROFILE_MAX_ATTEMPTS = 25;
export const DEVICE_PROFILE_RETRY_DELAY_MS = 5_000;
export const DEVICE_PROFILE_MAX_WAIT_MS =
  (DEVICE_PROFILE_MAX_ATTEMPTS - 1) * DEVICE_PROFILE_RETRY_DELAY_MS;

type PollOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Device profile polling was cancelled.", "AbortError");
  }
}

function sleepWithSignal(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);

    const timeoutId = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Device profile polling was cancelled.", "AbortError"));
      },
      { once: true }
    );
  });
}

async function hasRetryableTelemetryState(response: Response): Promise<boolean> {
  if (response.ok) return false;

  const payload = await response.clone().json().catch(() => ({}));
  const code = String((payload as { code?: unknown }).code ?? "").toLowerCase();
  const message = String((payload as { error?: unknown }).error ?? "").toLowerCase();

  return (
    code === "telemetry_pending" ||
    code === "load_not_detected" ||
    message.includes("no fresh telemetry")
  );
}

export async function pollForDeviceProfile(
  requestProfile: () => Promise<Response>,
  options: PollOptions = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? DEVICE_PROFILE_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEVICE_PROFILE_RETRY_DELAY_MS;
  const sleep =
    options.sleep ?? ((delayMs) => sleepWithSignal(delayMs, options.signal));

  let response: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    throwIfAborted(options.signal);
    response = await requestProfile();
    if (
      response.ok ||
      !(await hasRetryableTelemetryState(response)) ||
      attempt === maxAttempts - 1
    ) {
      return response;
    }

    await sleep(retryDelayMs);
  }

  throw new Error("Device profile polling completed without a response.");
}
