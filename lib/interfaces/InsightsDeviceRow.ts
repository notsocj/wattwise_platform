export type InsightsDeviceRow = {
  id: string;
  device_name: string;
  appliance_type: string | null;
  relay_state: boolean | null;
  is_online: boolean | null;
};
