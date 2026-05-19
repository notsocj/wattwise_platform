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
