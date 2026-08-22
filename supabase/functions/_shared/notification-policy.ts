export type NotificationChannel = "push" | "email";

export type BudgetEventInput = {
  event_type: string;
  threshold_percent: number | null;
  spend_php: number;
  threshold_php: number | null;
};

export type NotificationPreferences = {
  budget_push_enabled: boolean;
  budget_email_enabled: boolean;
};

export type BudgetNotificationMessage = {
  heading: string;
  content: string;
  emailSubject: string;
  emailHtml: string;
  url: string;
  urgent: boolean;
};

export function getChannelsForBudgetEvent(
  event: BudgetEventInput
): NotificationChannel[] {
  if (event.event_type === "budget_warning") {
    return event.threshold_percent === 80 ? ["push"] : [];
  }

  if (
    event.event_type === "approval_required" ||
    event.event_type === "auto_cutoff"
  ) {
    return ["push", "email"];
  }

  return [];
}

export function resolveRecipientIds(
  ownerId: string | null,
  legacyUserId: string | null,
  tenantId: string | null
): string[] {
  return [...new Set([ownerId ?? legacyUserId, tenantId].filter(isPresent))];
}

export function isChannelEnabled(
  preferences: NotificationPreferences,
  channel: NotificationChannel
): boolean {
  return channel === "push"
    ? preferences.budget_push_enabled
    : preferences.budget_email_enabled;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeAmount(value: number | null): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

export function buildBudgetNotification(
  event: BudgetEventInput,
  deviceName: string,
  appBaseUrl: string,
  destinationPath: string
): BudgetNotificationMessage {
  const percentage =
    event.event_type === "approval_required" || event.event_type === "auto_cutoff"
      ? 100
      : event.threshold_percent ?? 0;
  const spend = formatPeso(normalizeAmount(event.spend_php));
  const limit = formatPeso(normalizeAmount(event.threshold_php));
  const safeDeviceName = deviceName.trim() || "Appliance";
  const url = new URL(destinationPath, ensureTrailingSlash(appBaseUrl)).toString();

  let heading = "WattWise budget warning";
  let action = "Malapit na sa limit—silipin ang usage habang may time pang mag-adjust.";
  let urgent = false;

  if (event.event_type === "approval_required") {
    heading = "Action needed: 100% limit reached";
    action = "Naka-on pa ang appliance. Review the usage and decide what to do next.";
    urgent = true;
  } else if (event.event_type === "auto_cutoff") {
    heading = "Safety cutoff: appliance turned off";
    action = "Pinatay muna ng WattWise ang appliance para hindi lumampas sa approved limit.";
    urgent = true;
  }

  const content = `${safeDeviceName} is at ${percentage}%: ${spend} spent of ${limit}. ${action}`;
  const safeHeading = escapeHtml(heading);
  const safeContent = escapeHtml(content);
  const safeUrl = escapeHtml(url);

  return {
    heading,
    content,
    emailSubject: `${heading} — ${safeDeviceName}`,
    emailHtml: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#171717;line-height:1.6"><h1 style="font-size:22px">${safeHeading}</h1><p>${safeContent}</p><p><a href="${safeUrl}" style="display:inline-block;border-radius:8px;background:#00a94f;color:#fff;padding:10px 16px;text-decoration:none;font-weight:700">Open WattWise</a></p><p style="color:#666;font-size:12px">You received this because critical budget email alerts are enabled in WattWise Settings.</p></body></html>`,
    url,
    urgent,
  };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isPresent(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

