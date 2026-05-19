export type DashboardDeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  is_online: boolean | null;
  appliance_type: string | null;
  relay_state: boolean | null;
};
