import { computeMeralcoBill } from "@/lib/meralco-rates";
import type { EnergySummary } from "@/types/energy";

const todayKwh = 12.6;

export const sampleEnergySummary: EnergySummary = {
  todayKwh,
  projectedBillPhp: computeMeralcoBill(286.4),
  activeDevices: 4,
};
