export type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  is_online: boolean | null;
  appliance_type: string | null;
  relay_state: boolean | null;
};

export type LatestReadingRow = {
  device_id: string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  energy_kwh: number | string | null;
  recorded_at: string | null;
};

export type UsageByDeviceRow = {
  device_id: string;
  usage_kwh: number | string;
};

export type ProfileRow = {
  monthly_budget_php: number | string | null;
};

export type DashboardDevice = {
  id: string;
  name: string;
  watts: number;
  volts: number;
  amps: number;
  dailyKWh: number;
  isOnline: boolean;
  isActive: boolean;
  icon: (typeof import("lucide-react"))["Wind"];
  relayState: boolean;
};
