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
