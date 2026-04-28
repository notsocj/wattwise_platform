export type DeviceRow = {
  id: string;
  device_name: string;
  appliance_type: string | null;
  relay_state: boolean | null;
  is_online: boolean | null;
};

export type UsageByDeviceDayRow = {
  device_id: string;
  day_key: string;
  usage_kwh: number | string;
};

export type LeaderboardItem = {
  rank: number;
  name: string;
  usageKWh: number;
  cost: number;
  tag: "HIGH COST" | "MODERATE" | "EFFICIENT";
  tagColor: "text-danger" | "text-naku" | "text-bida";
};
