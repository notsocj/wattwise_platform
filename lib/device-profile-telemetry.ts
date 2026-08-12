export const PROFILE_TELEMETRY_FRESHNESS_MS = 2 * 60 * 1000;

export type ProfileTelemetrySample = {
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  recorded_at: string | null;
};

type ProfileTelemetryResult = {
  state: "pending" | "load_not_detected" | "ready";
  baselineWatts: number;
  voltageV: number | null;
  currentA: number | null;
};

export function toFiniteTelemetryNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyProfileTelemetry(
  sample: ProfileTelemetrySample | null,
  nowMs = Date.now()
): ProfileTelemetryResult {
  if (!sample?.recorded_at) {
    return { state: "pending", baselineWatts: 0, voltageV: null, currentA: null };
  }

  const recordedAtMs = new Date(sample.recorded_at).getTime();
  if (
    Number.isNaN(recordedAtMs) ||
    nowMs - recordedAtMs > PROFILE_TELEMETRY_FRESHNESS_MS
  ) {
    return { state: "pending", baselineWatts: 0, voltageV: null, currentA: null };
  }

  const baselineWatts = Math.max(0, toFiniteTelemetryNumber(sample.average_watts) ?? 0);
  const result = {
    baselineWatts,
    voltageV: toFiniteTelemetryNumber(sample.voltage_v),
    currentA: toFiniteTelemetryNumber(sample.current_a),
  };

  return {
    state: baselineWatts > 0 ? "ready" : "load_not_detected",
    ...result,
  };
}
