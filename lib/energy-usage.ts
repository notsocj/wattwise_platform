type NumericLike = number | string | null | undefined;

type MinMax = {
  min: number;
  max: number;
};

type TimedReading = {
  energyKwh: number;
  timestampMs: number;
  dayKey: string;
};

const DEFAULT_JITTER_TOLERANCE_KWH = 0.01;
const DEFAULT_RESET_DROP_THRESHOLD_KWH = 0.2;

function toFiniteNumber(value: NumericLike): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function updateMinMax(target: Map<string, MinMax>, key: string, value: number): void {
  const existing = target.get(key);

  if (!existing) {
    target.set(key, { min: value, max: value });
    return;
  }

  target.set(key, {
    min: Math.min(existing.min, value),
    max: Math.max(existing.max, value),
  });
}

function toUsage(minMax: MinMax): number {
  return Math.max(0, minMax.max - minMax.min);
}

function toDelta(next: number, prev: number): number {
  if (next >= prev) {
    return next - prev;
  }

  const drop = prev - next;

  // Ignore small backward drift from telemetry noise or rounding jitter.
  if (drop <= DEFAULT_JITTER_TOLERANCE_KWH) {
    return 0;
  }

  // Only treat as reset when the drop is materially large.
  if (drop >= DEFAULT_RESET_DROP_THRESHOLD_KWH) {
    return Math.max(0, next);
  }

  return 0;
}

function toBucketKey(timestampMs: number, intervalMinutes: number): string {
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  const bucketStart = Math.floor(timestampMs / intervalMs) * intervalMs;
  return String(bucketStart);
}

function sumSequentialDeltas(readings: TimedReading[]): number {
  if (readings.length < 2) {
    return 0;
  }

  let total = 0;
  let prev = readings[0].energyKwh;

  for (let index = 1; index < readings.length; index += 1) {
    const current = readings[index].energyKwh;
    total += toDelta(current, prev);
    prev = current;
  }

  return total;
}

function buildTimedReadings(
  logs: Array<{ energy_kwh: NumericLike; recorded_at?: string | null }>,
  intervalMinutes = 1
): TimedReading[] {
  const latestReadingPerBucket = new Map<string, TimedReading>();

  for (const log of logs) {
    if (!log.recorded_at) {
      continue;
    }

    const timestamp = new Date(log.recorded_at);
    const timestampMs = timestamp.getTime();

    if (Number.isNaN(timestampMs)) {
      continue;
    }

    const energyKwh = toFiniteNumber(log.energy_kwh);
    if (energyKwh === null || energyKwh < 0) {
      continue;
    }

    const bucketKey = toBucketKey(timestampMs, intervalMinutes);
    const existing = latestReadingPerBucket.get(bucketKey);

    if (!existing || timestampMs > existing.timestampMs) {
      latestReadingPerBucket.set(bucketKey, {
        energyKwh,
        timestampMs,
        dayKey: toLocalDayKey(timestamp),
      });
    }
  }

  return Array.from(latestReadingPerBucket.values()).sort(
    (a, b) => a.timestampMs - b.timestampMs
  );
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function computeUsageKwhForLogs(
  logs: Array<{ energy_kwh: NumericLike; recorded_at?: string | null }>
): number {
  const timedReadings = buildTimedReadings(logs, 1);

  if (timedReadings.length >= 2) {
    return sumSequentialDeltas(timedReadings);
  }

  // Fallback for legacy/untimed payloads.
  const values = logs
    .map((log) => toFiniteNumber(log.energy_kwh))
    .filter((value): value is number => value !== null && value >= 0);

  if (!values.length) {
    return 0;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return Math.max(0, max - min);
}

export function computeUsageKwhByDeviceFromLogs(
  logs: Array<{
    device_id: string | null;
    energy_kwh: NumericLike;
    recorded_at?: string | null;
  }>,
  resolveDeviceId?: (rawDeviceId: string) => string | undefined,
  intervalMinutes = 1
): Map<string, number> {
  const readingsByDevice = new Map<string, Array<{ energy_kwh: NumericLike; recorded_at?: string | null }>>();

  for (const log of logs) {
    if (!log.device_id) {
      continue;
    }

    const rawDeviceId = log.device_id.trim();
    if (!rawDeviceId) {
      continue;
    }

    const resolvedDeviceId = resolveDeviceId ? resolveDeviceId(rawDeviceId) : rawDeviceId;
    if (!resolvedDeviceId) {
      continue;
    }

    const existing = readingsByDevice.get(resolvedDeviceId) ?? [];
    existing.push({
      energy_kwh: log.energy_kwh,
      recorded_at: log.recorded_at,
    });
    readingsByDevice.set(resolvedDeviceId, existing);
  }

  const usageByDevice = new Map<string, number>();
  for (const [deviceId, deviceLogs] of readingsByDevice) {
    const timedReadings = buildTimedReadings(deviceLogs, intervalMinutes);

    if (timedReadings.length >= 2) {
      usageByDevice.set(deviceId, sumSequentialDeltas(timedReadings));
      continue;
    }

    const values = deviceLogs
      .map((deviceLog) => toFiniteNumber(deviceLog.energy_kwh))
      .filter((value): value is number => value !== null && value >= 0);

    if (!values.length) {
      usageByDevice.set(deviceId, 0);
      continue;
    }

    usageByDevice.set(deviceId, Math.max(0, Math.max(...values) - Math.min(...values)));
  }

  return usageByDevice;
}

export function computeUsageKwhByDeviceAndDayFromLogs(
  logs: Array<{ device_id: string | null; energy_kwh: NumericLike; recorded_at: string | null }>,
  resolveDeviceId?: (rawDeviceId: string) => string | undefined,
  intervalMinutes = 1
): Map<string, Map<string, number>> {
  const logsByDevice = new Map<string, Array<{ energy_kwh: NumericLike; recorded_at: string | null }>>();

  for (const log of logs) {
    if (!log.device_id || !log.recorded_at) {
      continue;
    }

    const rawDeviceId = log.device_id.trim();
    if (!rawDeviceId) {
      continue;
    }

    const resolvedDeviceId = resolveDeviceId ? resolveDeviceId(rawDeviceId) : rawDeviceId;
    if (!resolvedDeviceId) {
      continue;
    }

    const existing = logsByDevice.get(resolvedDeviceId) ?? [];
    existing.push({
      energy_kwh: log.energy_kwh,
      recorded_at: log.recorded_at,
    });
    logsByDevice.set(resolvedDeviceId, existing);
  }

  const usageByDeviceDay = new Map<string, Map<string, number>>();
  for (const [deviceId, deviceLogs] of logsByDevice) {
    const timedReadings = buildTimedReadings(deviceLogs, intervalMinutes);
    const usagePerDay = new Map<string, number>();

    if (timedReadings.length >= 2) {
      for (let index = 1; index < timedReadings.length; index += 1) {
        const prev = timedReadings[index - 1];
        const current = timedReadings[index];
        const delta = toDelta(current.energyKwh, prev.energyKwh);

        usagePerDay.set(
          current.dayKey,
          (usagePerDay.get(current.dayKey) ?? 0) + delta
        );
      }

      usageByDeviceDay.set(deviceId, usagePerDay);
      continue;
    }

    // Fallback for sparse untimed data.
    const minMaxByDay = new Map<string, MinMax>();
    for (const log of deviceLogs) {
      if (!log.recorded_at) {
        continue;
      }

      const timestamp = new Date(log.recorded_at);
      if (Number.isNaN(timestamp.getTime())) {
        continue;
      }

      const energyKwh = toFiniteNumber(log.energy_kwh);
      if (energyKwh === null || energyKwh < 0) {
        continue;
      }

      updateMinMax(minMaxByDay, toLocalDayKey(timestamp), energyKwh);
    }

    for (const [dayKey, minMax] of minMaxByDay) {
      usagePerDay.set(dayKey, toUsage(minMax));
    }

    usageByDeviceDay.set(deviceId, usagePerDay);
  }

  return usageByDeviceDay;
}
