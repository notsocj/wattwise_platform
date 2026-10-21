import "server-only";
import { InsightType } from "@/lib/constants";
import {
  createEmptyStructuredInsights,
  type StructuredInsightsPayload,
} from "@/lib/insights";

export type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  appliance_type: string | null;
  owner_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
};

export type UsageByDeviceDayRow = {
  device_id: string;
  day_key: string;
  usage_kwh: string | number;
};

export type UsageResult = {
  totalKwh: number;
  byDevice: Map<string, number>;
};

export type TopDevice = {
  name: string;
  kwh: number;
  cost: number;
};

export type CachedInsightMetadata = {
  billing_cycle_start_day: number;
  cycle_start_date: string;
  cycle_end_date: string;
};

export function computeUsage(rows: UsageByDeviceDayRow[] | null): UsageResult {
  if (!rows?.length) {
    return { totalKwh: 0, byDevice: new Map() };
  }

  const byDevice = new Map<string, number>();

  for (const row of rows) {
    const kwh = Number(row.usage_kwh);
    if (!Number.isFinite(kwh) || kwh < 0) {
      continue;
    }

    byDevice.set(row.device_id, (byDevice.get(row.device_id) ?? 0) + kwh);
  }

  let totalKwh = 0;

  for (const usage of byDevice.values()) {
    totalKwh += usage;
  }

  return { totalKwh, byDevice };
}

export function parseCachedInsightMetadata(value: unknown): CachedInsightMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const billingCycleStartDay = payload.billing_cycle_start_day;
  const cycleStartDate = payload.cycle_start_date;
  const cycleEndDate = payload.cycle_end_date;

  if (
    !Number.isInteger(billingCycleStartDay) ||
    typeof cycleStartDate !== "string" ||
    typeof cycleEndDate !== "string"
  ) {
    return null;
  }

  return {
    billing_cycle_start_day: Number(billingCycleStartDay),
    cycle_start_date: cycleStartDate,
    cycle_end_date: cycleEndDate,
  };
}

export function sanitizeRequestedPayload(
  insightType: InsightType,
  payload: StructuredInsightsPayload,
  fallback: StructuredInsightsPayload
): StructuredInsightsPayload {
  const empty = createEmptyStructuredInsights();

  switch (insightType) {
    case InsightType.BudgetAlert: {
      const budget =
        payload.budget.is_at_risk && payload.budget.message
          ? payload.budget
          : fallback.budget;

      return {
        ...empty,
        budget: budget.is_at_risk
          ? budget
          : { is_at_risk: false, message: "" },
      };
    }
    case InsightType.AnomalyAlert: {
      const anomaly =
        payload.anomaly.is_detected && payload.anomaly.message
          ? payload.anomaly
          : fallback.anomaly;

      return {
        ...empty,
        anomaly: anomaly.is_detected
          ? anomaly
          : { is_detected: false, message: "" },
      };
    }
    case InsightType.CostOptimizer: {
      const tipidTip =
        payload.tipid_tip.has_tip && payload.tipid_tip.message
          ? payload.tipid_tip
          : fallback.tipid_tip;

      return {
        ...empty,
        tipid_tip: tipidTip.has_tip
          ? tipidTip
          : { has_tip: false, message: "" },
      };
    }
    case InsightType.WeeklyRecap: {
      const weeklyRecap =
        payload.weekly_recap.has_recap && payload.weekly_recap.message
          ? payload.weekly_recap
          : fallback.weekly_recap;

      return {
        ...empty,
        weekly_recap: weeklyRecap.has_recap
          ? weeklyRecap
          : { has_recap: false, message: "" },
      };
    }
    default:
      return empty;
  }
}

export function buildFallbackInsights(params: {
  insightType: InsightType;
  monthlyBudget: number;
  cycleCostPhp: number;
  projectedCycleBill: number;
  daysElapsed: number;
  thisWeek: UsageResult;
  lastWeek: UsageResult;
  thisWeekCost: number;
  lastWeekCost: number;
  topDevices: TopDevice[];
  deviceCount: number;
}): StructuredInsightsPayload {
  const {
    insightType,
    monthlyBudget,
    cycleCostPhp,
    projectedCycleBill,
    daysElapsed,
    thisWeek,
    lastWeek,
    thisWeekCost,
    lastWeekCost,
    topDevices,
    deviceCount,
  } = params;

  const empty = createEmptyStructuredInsights();
  const topDevice = topDevices[0] ?? null;
  const topDeviceShare = topDevice && thisWeek.totalKwh > 0
    ? topDevice.kwh / thisWeek.totalKwh
    : 0;
  const weekJumpRatio =
    lastWeek.totalKwh > 0 ? thisWeek.totalKwh / lastWeek.totalKwh : 1;

  switch (insightType) {
    case InsightType.BudgetAlert: {
      const isAtRisk =
        projectedCycleBill >= monthlyBudget ||
        (daysElapsed >= 10 && cycleCostPhp >= monthlyBudget * 0.8);

      return {
        ...empty,
        budget: isAtRisk
          ? {
              is_at_risk: true,
              message: topDevice
                ? `Naku boss, projected ka sa ₱${projectedCycleBill.toFixed(2)} laban sa ₱${monthlyBudget.toFixed(2)} budget mo this billing cycle. Bantayan lalo si ${topDevice.name} kasi siya ang pinakamabigat ngayon at nasa ₱${topDevice.cost.toFixed(2)} na ang ambag niya.`
                : `Naku boss, projected ka sa ₱${projectedCycleBill.toFixed(2)} laban sa ₱${monthlyBudget.toFixed(2)} budget mo this billing cycle. Medyo bawasan muna ang high-watt appliance hours para di tayo lumampas.`,
            }
          : { is_at_risk: false, message: "" },
      };
    }
    case InsightType.AnomalyAlert: {
      const isDetected =
        (lastWeek.totalKwh > 0 &&
          weekJumpRatio >= 1.4 &&
          thisWeek.totalKwh - lastWeek.totalKwh >= 0.5) ||
        (topDevice !== null && topDeviceShare >= 0.7 && topDevice.cost >= 50 && deviceCount > 1);

      return {
        ...empty,
        anomaly: isDetected
          ? {
              is_detected: true,
              message: topDevice && topDeviceShare >= 0.7
                ? `${topDevice.name} ang nangingibabaw sa usage mo ngayon, nasa ${(
                    topDeviceShare * 100
                  ).toFixed(0)}% ng weekly consumption. Sulit i-check kung may naiwan na bukas o mas mahaba ang takbo kaysa normal.`
                : `May unusual jump sa weekly usage mo: ${thisWeek.totalKwh.toFixed(2)} kWh this week kumpara sa ${lastWeek.totalKwh.toFixed(2)} kWh last week. I-check muna kung aling appliance ang mas tumagal ang gamit nitong mga huling araw.`,
            }
          : { is_detected: false, message: "" },
      };
    }
    case InsightType.CostOptimizer: {
      const hasTip = topDevice !== null && topDevice.cost >= 10;
      const estimatedSavings = topDevice ? Math.max(topDevice.cost * 0.12, 5) : 0;

      return {
        ...empty,
        tipid_tip: hasTip
          ? {
              has_tip: true,
              message: `Tipid move: unahin mong bawasan ang runtime ni ${topDevice.name} this week. Kung mababawasan mo kahit kaunti ang paggamit nito, puwedeng makatipid ng mga ₱${estimatedSavings.toFixed(2)} base sa current trend.`,
            }
          : { has_tip: false, message: "" },
      };
    }
    case InsightType.WeeklyRecap: {
      const hasRecap = thisWeek.totalKwh > 0 || lastWeek.totalKwh > 0;
      const deltaPercent =
        lastWeek.totalKwh > 0
          ? ((thisWeek.totalKwh - lastWeek.totalKwh) / lastWeek.totalKwh) * 100
          : 0;

      return {
        ...empty,
        weekly_recap: hasRecap
          ? {
              has_recap: true,
              message:
                deltaPercent <= 0
                  ? `Bida ka boss, nasa ${thisWeek.totalKwh.toFixed(2)} kWh (₱${thisWeekCost.toFixed(2)}) ka this week kumpara sa ${lastWeek.totalKwh.toFixed(2)} kWh (₱${lastWeekCost.toFixed(2)}) last week.`
                  : `This week nasa ${thisWeek.totalKwh.toFixed(2)} kWh (₱${thisWeekCost.toFixed(2)}) ka versus ${lastWeek.totalKwh.toFixed(2)} kWh (₱${lastWeekCost.toFixed(2)}) last week, so may room pa para humabol sa tipid.`,
            }
          : { has_recap: false, message: "" },
      };
    }
    default:
      return empty;
  }
}

export function buildUserPrompt(params: {
  insightType: InsightType;
  monthlyBudget: number;
  cycleCostPhp: number;
  projectedCycleBill: number;
  daysElapsed: number;
  cycleStartDate: string;
  cycleEndDate: string;
  billingCycleStartDay: number;
  devices: DeviceRow[];
  thisWeek: UsageResult;
  lastWeek: UsageResult;
  thisWeekCost: number;
  lastWeekCost: number;
  topDevices: TopDevice[];
  viewerRole: string;
  tenantHardLimitPhp: number | null;
}): string {
  const {
    insightType,
    monthlyBudget,
    cycleCostPhp,
    projectedCycleBill,
    daysElapsed,
    cycleStartDate,
    cycleEndDate,
    billingCycleStartDay,
    devices,
    thisWeek,
    lastWeek,
    thisWeekCost,
    lastWeekCost,
    topDevices,
    viewerRole,
    tenantHardLimitPhp,
  } = params;

  const topDevicesStr =
    topDevices
      .map((device) => `${device.name}: ${device.kwh.toFixed(2)} kWh (₱${device.cost.toFixed(2)})`)
      .join(", ") || "none";

  return JSON.stringify({
    insight_type: insightType,
    instruction:
      "Populate only the object that matches insight_type. All other objects must have false booleans and empty messages.",
    data: {
      monthly_budget_php: Number(monthlyBudget.toFixed(2)),
      viewer_role: viewerRole,
      tenant_hard_limit_php:
        tenantHardLimitPhp === null ? null : Number(tenantHardLimitPhp.toFixed(2)),
      advice_tone:
        viewerRole === "tenant"
          ? "Tenant view: explain the landlord-imposed hard limit in casual Taglish and warn before auto-off."
          : viewerRole === "manager"
            ? "Manager view: frame advice around room/fleet management and tenant sub-meter limits."
            : "Homeowner view: use normal practical Taglish energy coaching.",
      current_billing_cycle_spend_php: Number(cycleCostPhp.toFixed(2)),
      projected_billing_cycle_php: Number(projectedCycleBill.toFixed(2)),
      days_elapsed_in_cycle: daysElapsed,
      billing_cycle_start_day: billingCycleStartDay,
      cycle_start_date: cycleStartDate,
      cycle_end_date: cycleEndDate,
      this_week_kwh: Number(thisWeek.totalKwh.toFixed(2)),
      this_week_php: Number(thisWeekCost.toFixed(2)),
      last_week_kwh: Number(lastWeek.totalKwh.toFixed(2)),
      last_week_php: Number(lastWeekCost.toFixed(2)),
      device_count: devices.length,
      device_names: devices.map((device) => device.device_name),
      top_devices: topDevicesStr,
    },
  });
}
