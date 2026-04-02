import { redirect } from "next/navigation";
import { AlertTriangle, Trophy, Leaf, TrendingDown } from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import WeeklyUsageChart, {
  type WeeklyUsagePoint,
} from "@/components/insights/WeeklyUsageChart";
import LogoutButton from "@/components/ui/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { computeMeralcoBill, getActiveMeralcoRates } from "@/lib/meralco-rates";

type DeviceRow = {
  id: string;
  device_name: string;
};

type UsageByDeviceDayRow = {
  device_id: string;
  day_key: string;
  usage_kwh: number | string;
};

type LeaderboardItem = {
  rank: number;
  name: string;
  usageKWh: number;
  cost: number;
  tag: "HIGH COST" | "MODERATE" | "EFFICIENT";
  tagColor: "text-danger" | "text-naku" | "text-bida";
};

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function getStartOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getMondayBasedIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function getTagForCost(cost: number, averageCost: number): {
  tag: LeaderboardItem["tag"];
  tagColor: LeaderboardItem["tagColor"];
} {
  if (averageCost <= 0) {
    return { tag: "MODERATE", tagColor: "text-naku" };
  }

  if (cost >= averageCost * 1.2) {
    return { tag: "HIGH COST", tagColor: "text-danger" };
  }

  if (cost <= averageCost * 0.8) {
    return { tag: "EFFICIENT", tagColor: "text-bida" };
  }

  return { tag: "MODERATE", tagColor: "text-naku" };
}

export default async function InsightsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: devicesData } = await supabase
    .from("devices")
    .select("id, device_name")
    .order("created_at", { ascending: true });

  const devices = (devicesData ?? []) as DeviceRow[];
  const deviceIds = devices.map((device) => device.id);

  const activeRates = await getActiveMeralcoRates(supabase);

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const startOfThisWeek = getStartOfWeek(now);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const { data: usageByDeviceDayData } = deviceIds.length
    ? await supabase
        .rpc("get_usage_kwh_by_device_day", {
          p_user_id: user.id,
          p_start: startOfLastWeek.toISOString(),
          p_end: endOfToday.toISOString(),
        })
    : { data: [] as UsageByDeviceDayRow[] };

  const usageByDeviceDayRows = (usageByDeviceDayData ?? []) as UsageByDeviceDayRow[];

  const thisWeekKWhByDevice = new Map<string, number>();
  const thisWeekDaily = new Array<number>(7).fill(0);
  const lastWeekDaily = new Array<number>(7).fill(0);

  let thisWeekKWhTotal = 0;
  let lastWeekKWhTotal = 0;

  for (const row of usageByDeviceDayRows) {
    const [yearPart, monthPart, dayPart] = row.day_key.split("-").map(Number);

    if (!yearPart || !monthPart || !dayPart) {
      continue;
    }

    const kWhUsage = Number(row.usage_kwh);
    if (!Number.isFinite(kWhUsage) || kWhUsage < 0) {
      continue;
    }

    const dayDate = new Date(yearPart, monthPart - 1, dayPart);

    if (dayDate >= startOfThisWeek) {
      thisWeekKWhTotal += kWhUsage;
      const dayIndex = getMondayBasedIndex(dayDate);
      thisWeekDaily[dayIndex] += kWhUsage;
      thisWeekKWhByDevice.set(
        row.device_id,
        (thisWeekKWhByDevice.get(row.device_id) ?? 0) + kWhUsage
      );
      continue;
    }

    if (dayDate >= startOfLastWeek && dayDate < startOfThisWeek) {
      lastWeekKWhTotal += kWhUsage;
      const dayIndex = getMondayBasedIndex(dayDate);
      lastWeekDaily[dayIndex] += kWhUsage;
    }
  }

  const rawLeaderboard = devices.map((device) => {
    const usageKWh = thisWeekKWhByDevice.get(device.id) ?? 0;
    const cost = computeMeralcoBill(
      usageKWh,
      activeRates.rates,
      activeRates.vatRate
    );

    return {
      name: device.device_name,
      usageKWh,
      cost,
    };
  });

  const avgCost =
    rawLeaderboard.length > 0
      ? rawLeaderboard.reduce((sum, item) => sum + item.cost, 0) /
        rawLeaderboard.length
      : 0;

  const leaderboard: LeaderboardItem[] = rawLeaderboard
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
    .map((item, index) => {
      const { tag, tagColor } = getTagForCost(item.cost, avgCost);
      return {
        rank: index + 1,
        name: item.name,
        usageKWh: item.usageKWh,
        cost: item.cost,
        tag,
        tagColor,
      };
    });

  const weeklyData: WeeklyUsagePoint[] = WEEKDAY_LABELS.map((day, index) => ({
    day,
    thisWk: Number(thisWeekDaily[index].toFixed(2)),
    lastWk: Number(lastWeekDaily[index].toFixed(2)),
  }));

  const thisWeekPhp = computeMeralcoBill(
    thisWeekKWhTotal,
    activeRates.rates,
    activeRates.vatRate
  );
  const lastWeekPhp = computeMeralcoBill(
    lastWeekKWhTotal,
    activeRates.rates,
    activeRates.vatRate
  );

  const weekSavingsPhp = Math.max(lastWeekPhp - thisWeekPhp, 0);
  const savingsPercent =
    lastWeekPhp > 0 ? (weekSavingsPhp / lastWeekPhp) * 100 : 0;

  const daysElapsedThisWeek = Math.min(
    getMondayBasedIndex(now) + 1,
    7
  );
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const projectedMonthlyKWh =
    daysElapsedThisWeek > 0
      ? (thisWeekKWhTotal / daysElapsedThisWeek) * daysInMonth
      : 0;
  const projectedMonthlyBill = computeMeralcoBill(
    projectedMonthlyKWh,
    activeRates.rates,
    activeRates.vatRate,
    {
      fixedChargesPhp: activeRates.fixedMonthlyChargesPhp,
    }
  );

  const topDevice = leaderboard[0];

  return (
    <div className="min-h-screen bg-base text-white pb-24">
      {/* ===== Header ===== */}
      <header className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight">
            Watt<span className="text-mint">Wise</span>
          </h1>
        </div>
        <LogoutButton />
      </header>

      <div className="px-5 flex flex-col gap-5">
        {/* ===== Device Performance Leaderboard ===== */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold">Device Performance</h2>
            <div className="flex items-center gap-3 text-[10px] tracking-wider font-semibold">
              <span className="text-danger uppercase">Expensive</span>
              <span className="text-white/20">—</span>
              <span className="text-bida uppercase">Efficient</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {leaderboard.length === 0 ? (
              <div className="rounded-xl bg-surface border border-white/[0.06] px-4 py-4 text-sm text-white/60">
                No device usage logs yet for this week.
              </div>
            ) : (
              leaderboard.map((device) => (
              <div
                key={device.rank}
                className="relative rounded-xl bg-surface border border-white/[0.06] px-4 py-3.5 flex items-center gap-3 overflow-hidden"
              >
                {/* Left accent bar */}
                <div className="absolute left-0 inset-y-0 w-1 bg-mint/50 rounded-r-full" />

                {/* Rank badge */}
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-white/40 font-semibold uppercase leading-none">
                    Rank
                  </span>
                  <span className="text-sm font-bold text-white">
                    #{device.rank}
                  </span>
                </div>

                {/* Device info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold uppercase tracking-wide truncate">
                    {device.name}
                  </p>
                  <p className="text-[11px] text-white/40 truncate">
                    {device.usageKWh.toFixed(2)} kWh this week
                  </p>
                </div>

                {/* Cost + tag */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-mint">
                    ₱{device.cost.toFixed(2)}
                  </p>
                  <p className={`text-[9px] font-semibold tracking-wider ${device.tagColor}`}>
                    {device.tag}
                  </p>
                </div>
              </div>
              ))
            )}
          </div>
        </section>

        {/* ===== Coaching Feed ===== */}
        <section>
          <h2 className="text-[15px] font-bold mb-3">Coaching Feed</h2>

          {/* Naku! Alert — Critical Spike */}
          <div className="rounded-xl bg-naku/10 border border-naku/20 p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold tracking-wider text-naku uppercase">
                Naku! Alert
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-naku" />
            </div>
            <h3 className="text-xl font-bold mb-1">Critical Spike!</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-3">
              {topDevice
                ? `${topDevice.name} is currently your highest-cost device this week at ₱${topDevice.cost.toFixed(2)}.`
                : "No device spike detected yet. Start logging data to unlock usage alerts."}
            </p>
            <button className="bg-naku text-black text-xs font-bold px-4 py-2 rounded-lg transition-transform active:scale-95">
              Review Device
            </button>
          </div>

          {/* Bento row: Bida Recap + Strategy Tip */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bida Recap */}
            <div className="rounded-xl bg-bida/10 border border-bida/20 p-4 flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-bida uppercase">
                  Bida Recap
                </span>
                <h3 className="text-base font-bold mt-1.5 leading-snug">
                  Weekly Win!
                </h3>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  You saved ₱{weekSavingsPhp.toFixed(2)} this week versus last week.
                </p>
              </div>
              <Trophy className="w-5 h-5 text-bida mt-2" />
            </div>

            {/* Strategy Tip */}
            <div className="rounded-xl bg-surface border border-white/[0.06] p-4 flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">
                  Strategy Tip
                </span>
                <p className="text-xs text-white/70 mt-1.5 leading-relaxed">
                  Focus on your top-load device first; reducing its runtime gives the biggest bill impact.
                </p>
              </div>
              <Leaf className="w-5 h-5 text-bida mt-2" />
            </div>
          </div>
        </section>

        {/* ===== Trend Comparison ===== */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-[15px] font-bold">Trend Comparison</h2>
              <p className="text-[11px] text-white/40">
                Weekly Usage Patterns
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-mint" />
                This Wk
              </span>
              <span className="flex items-center gap-1.5 text-white/40">
                <span className="w-2 h-2 rounded-full bg-white/20" />
                Last Wk
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-surface border border-white/[0.06] p-4 overflow-hidden">
            <WeeklyUsageChart data={weeklyData} />
          </div>
        </section>

        {/* ===== Financial Forecast / Strategy Impact ===== */}
        <section className="mb-2">
          <div className="relative rounded-xl bg-surface border border-white/[0.06] p-5 overflow-hidden">
            <div className="absolute left-0 inset-y-0 w-1 bg-mint/60 rounded-r-full" />
            <p className="text-[11px] font-semibold tracking-widest text-white/40 uppercase mb-1">
              Strategy Impact
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-mint tracking-tight">
                  <span className="text-2xl text-white/50 mr-0.5">₱</span>
                  {projectedMonthlyBill.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/40 mb-0.5">
                  Projected Saving
                </p>
                <div className="flex items-center gap-1 justify-end">
                  <TrendingDown className="w-3.5 h-3.5 text-bida" />
                  <span className="text-lg font-bold text-bida">
                    {savingsPercent > 0 ? "-" : ""}
                    {Math.abs(savingsPercent).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-white/40">
              Based on active Meralco rate month {activeRates.effectiveMonth} and recent logged usage.
            </p>
          </div>
        </section>
      </div>

      {/* ===== Bottom Navigation ===== */}
      <BottomNav />
    </div>
  );
}
