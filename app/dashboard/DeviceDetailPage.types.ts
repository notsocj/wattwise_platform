export type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  relay_state: boolean | null;
};

export type ProfileRow = {
  monthly_budget_php: number | string | null;
};

export type EnergyLogRow = {
  energy_kwh: number | string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  recorded_at: string | null;
};

export type LegacyEnergyLogRow = {
  energy_kwh: number | string;
  average_watts: number | string | null;
  recorded_at: string | null;
};

export type UsageByDeviceRow = {
  device_id: string;
  usage_kwh: number | string;
};

export type DeviceViewModel = {
  id: string;
  name: string;
  deviceCode: string;
  watts: number;
  isOnline: boolean;
  isActive: boolean;
  maxWatts: number;
  volts: number;
  maxVolts: number;
  amps: number;
  maxAmps: number;
  monthlyBudget: number;
  variableSpendPhp: number;
  estimatedBillPhp: number;
  fixedFeeSharePhp: number;
};
