type DemoSimulationChanges = {
  is_active?: unknown;
  simulated_watts?: unknown;
  simulated_voltage_v?: unknown;
  reset_energy?: unknown;
};

type DemoSimulationUpdate = {
  is_active?: boolean;
  live_since?: null;
  simulated_watts?: number;
  simulated_voltage_v?: number;
  energy_kwh?: number;
  last_generated_at?: null;
  updated_at?: string;
};

function numberInRange(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export function buildDemoSimulationUpdate(
  changes: DemoSimulationChanges,
  now = new Date()
): { update: DemoSimulationUpdate } | { error: string } {
  const update: DemoSimulationUpdate = {};
  if (typeof changes.is_active === "boolean") {
    update.is_active = changes.is_active;
    // Start clears the previous run's expiry in the same write as activation.
    // The simulator sets a fresh DB timestamp on its next tick. Keep the meter
    // and last reading intact so resuming can backfill the actual gap.
    if (changes.is_active) update.live_since = null;
  }
  if (changes.simulated_watts !== undefined) {
    const watts = numberInRange(changes.simulated_watts, 0, 5000);
    if (watts === null) return { error: "Watts must be between 0 and 5,000." };
    update.simulated_watts = watts;
  }
  if (changes.simulated_voltage_v !== undefined) {
    const voltage = numberInRange(changes.simulated_voltage_v, 180, 260);
    if (voltage === null) return { error: "Voltage must be between 180 and 260." };
    update.simulated_voltage_v = voltage;
  }
  if (changes.reset_energy === true) {
    update.energy_kwh = 0;
    update.last_generated_at = null;
  }
  if (Object.keys(update).length) update.updated_at = now.toISOString();
  return { update };
}
