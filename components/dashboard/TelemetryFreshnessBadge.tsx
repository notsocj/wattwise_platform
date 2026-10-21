"use client";

import { useEffect, useState } from "react";
import { formatReadingAge, isFreshReading } from "@/lib/device-telemetry";

type TelemetryFreshnessBadgeProps = {
  recordedAt: string | null;
};

// Re-evaluates freshness on the client so a unit that stops posting flips to
// offline without waiting for a server refresh.
export default function TelemetryFreshnessBadge({ recordedAt }: TelemetryFreshnessBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  if (isFreshReading(recordedAt, now)) {
    return <span className="font-semibold text-bida">LIVE</span>;
  }

  const age = formatReadingAge(recordedAt, now);
  return (
    <span className="text-white/60">
      OFFLINE{age ? ` · last reading ${age}` : " · no readings yet"}
    </span>
  );
}
