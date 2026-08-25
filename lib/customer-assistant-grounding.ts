export type CustomerDeviceCard = {
  id: string;
  name: string;
  limit_php: number;
  spend_php: number;
  calendar_month_spend_php?: number;
  progress_percent: number;
  current_watts: number;
  telemetry_state: "fresh" | "stale";
  budget_status: string;
};

export type CustomerAssistantDisplay = {
  type: "device_list";
  title: string;
  devices: CustomerDeviceCard[];
};

type GroundingContext = {
  devices: CustomerDeviceCard[];
  calendar_month_label?: string;
  /** False means the month query did not return usable telemetry. Never present that as zero spend. */
  calendar_month_data_available?: boolean;
};

function php(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isBillQuestion(message: string): boolean {
  const text = message.toLowerCase();
  return (
    /why\s+(is|was).*bill.*(high|expensive)/.test(text) ||
    /bakit.*(mataas|mahal).*(bill|kuryente)/.test(text) ||
    /(bill|kuryente).*(mataas|mahal|high|expensive)/.test(text)
  );
}

function isDeviceListQuestion(message: string): boolean {
  const text = message.toLowerCase();
  return (
    /(list|show|display|ano|what).*(device|appliance)/.test(text) ||
    /(device|appliance).*(list|meron|have)/.test(text)
  );
}

export function buildDeviceDisplay(
  devices: CustomerDeviceCard[],
  title = "Your devices",
  refs?: string[]
): CustomerAssistantDisplay | null {
  const selected = refs?.length
    ? refs
        .map((ref) => {
          const index = Number(ref.replace(/^device_/, "")) - 1;
          return Number.isInteger(index) ? devices[index] : undefined;
        })
        .filter((device): device is CustomerDeviceCard => Boolean(device))
    : devices;
  const unique = [...new Map(selected.map((device) => [device.id, device])).values()].slice(0, 8);
  return unique.length ? { type: "device_list", title, devices: unique } : null;
}

export function buildGroundedCustomerResponse(
  message: string,
  context: GroundingContext
): { reply: string; display: CustomerAssistantDisplay | null } | null {
  if (isDeviceListQuestion(message)) {
    if (!context.devices.length) {
      return { reply: "Wala pang device na visible sa account mo.", display: null };
    }
    return {
      reply: `Here ${context.devices.length === 1 ? "is" : "are"} your ${context.devices.length} visible device${context.devices.length === 1 ? "" : "s"}. Tap a card to view its details.`,
      display: buildDeviceDisplay(context.devices),
    };
  }

  if (!isBillQuestion(message)) return null;
  if (!context.devices.length) {
    return {
      reply: "Hindi pa natin ma-check ang bill drivers dahil wala pang device data sa account mo. Add or assign a device first.",
      display: null,
    };
  }

  const usesCalendarMonth = context.calendar_month_data_available !== false && Boolean(context.calendar_month_label) && context.devices.some(
    (device) => typeof device.calendar_month_spend_php === "number"
  );
  const spendForAnswer = (device: CustomerDeviceCard) =>
    usesCalendarMonth ? Math.max(0, device.calendar_month_spend_php ?? 0) : Math.max(0, device.spend_php);
  const ranked = [...context.devices].sort((first, second) => {
    if (spendForAnswer(second) !== spendForAnswer(first)) return spendForAnswer(second) - spendForAnswer(first);
    return second.current_watts - first.current_watts;
  });
  const totalSpend = ranked.reduce((total, device) => total + spendForAnswer(device), 0);
  const top = ranked[0];
  const next = ranked[1];
  let reply: string;
  if (totalSpend > 0) {
    const topSpend = spendForAnswer(top);
    const share = Math.round((topSpend / totalSpend) * 100);
    const windowLabel = usesCalendarMonth ? context.calendar_month_label : "current billing cycle";
    reply = `For ${windowLabel}, ${php(totalSpend)} ang recorded variable energy spend. ${top.name} ang biggest contributor at ${php(topSpend)} (${share}% of tracked spend)`;
    if (next && spendForAnswer(next) > 0) reply += `, followed by ${next.name} at ${php(spendForAnswer(next))}`;
    reply += `. ${top.telemetry_state === "fresh" ? `Its latest draw is about ${top.current_watts} W.` : "Its live reading is currently stale, but the cycle total is recorded."}`;
    if (usesCalendarMonth) {
      const billingCycleSpend = ranked.reduce((sum, device) => sum + Math.max(0, device.spend_php), 0);
      reply += ` Your current billing cycle is separate and currently has ${php(billingCycleSpend)}; device budget progress below uses that billing-cycle amount.`;
    }
  } else {
    const live = [...ranked].sort((first, second) => second.current_watts - first.current_watts)[0];
    reply = live.current_watts > 0
      ? `Wala pang recorded billing-cycle spend, pero ${live.name} ang highest live load ngayon at about ${live.current_watts} W. Keep it monitored to see its cost contribution.`
      : "Wala pang recorded usage spend at fresh live load sa visible devices mo, so there is not enough WattWise data yet to identify a bill driver.";
  }
  return {
    reply,
    display: buildDeviceDisplay(
      ranked,
      usesCalendarMonth ? `${context.calendar_month_label} bill contributors` : "Current billing-cycle contributors"
    ),
  };
}
