// Hardware posts every 5 seconds; four missed cycles marks a unit offline.
export const ACTIVE_READING_WINDOW_MS = 20 * 1000;

export function isFreshReading(recordedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!recordedAt) {
    return false;
  }

  const timestamp = new Date(recordedAt).getTime();
  return !Number.isNaN(timestamp) && now - timestamp <= ACTIVE_READING_WINDOW_MS;
}

export function formatReadingAge(recordedAt: string | null | undefined, now: number = Date.now()): string | null {
  if (!recordedAt) {
    return null;
  }

  const timestamp = new Date(recordedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** True when a query failed because the legacy schema lacks devices.relay_state. */
export function hasMissingRelayStateColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42703" || message.includes("relay_state");
}
