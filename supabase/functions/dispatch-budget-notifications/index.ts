import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildBudgetNotification,
  escapeHtml,
  getChannelsForBudgetEvent,
  isChannelEnabled,
  resolveRecipientIds,
  type BudgetEventInput,
  type BudgetNotificationMessage,
  type NotificationChannel,
  type NotificationPreferences,
} from "../_shared/notification-policy.ts";
import {
  hasRequiredProviderConfig,
  oneSignalPushEndpoint,
  parseOneSignalSuccess,
  sendProviderRequest,
  type ProviderResult,
} from "../_shared/provider-delivery.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wattwise-webhook-secret",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BudgetEventRecord = BudgetEventInput & {
  id: string;
  device_id: string;
};

type DatabaseWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: unknown;
};

type DeviceRow = {
  id: string;
  device_name: string;
  owner_id: string | null;
  user_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  role: string | null;
};

type PreferenceRow = NotificationPreferences & {
  user_id: string;
  onesignal_external_id: string;
};

type DeliveryRow = {
  id: string;
  status: "pending" | "sent" | "failed" | "skipped";
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function readBearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.replace(/^Bearer\s+/i, "").trim() || null;
}

async function secretsMatch(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;

  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(receivedHash);
  const right = new Uint8Array(expectedHash);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseBudgetEvent(value: unknown): BudgetEventRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const deviceId = typeof record.device_id === "string" ? record.device_id : "";
  const eventType = typeof record.event_type === "string" ? record.event_type : "";
  const thresholdPercent =
    record.threshold_percent === null || record.threshold_percent === undefined
      ? null
      : Number(record.threshold_percent);
  const spendPhp = Number(record.spend_php);
  const thresholdPhp =
    record.threshold_php === null || record.threshold_php === undefined
      ? null
      : Number(record.threshold_php);

  if (
    !uuidPattern.test(id) ||
    !uuidPattern.test(deviceId) ||
    !Number.isFinite(spendPhp) ||
    (thresholdPercent !== null && !Number.isFinite(thresholdPercent)) ||
    (thresholdPhp !== null && !Number.isFinite(thresholdPhp))
  ) {
    return null;
  }

  return {
    id,
    device_id: deviceId,
    event_type: eventType,
    threshold_percent: thresholdPercent,
    spend_php: spendPhp,
    threshold_php: thresholdPhp,
  };
}

function destinationForRole(role: string | null, deviceId?: string): string {
  if (role === "manager") return "/manager/rooms";
  return deviceId ? `/dashboard/${encodeURIComponent(deviceId)}` : "/dashboard";
}

async function reserveDelivery(
  supabase: SupabaseClient,
  input: {
    budget_event_id: string | null;
    recipient_id: string;
    channel: NotificationChannel;
    is_test: boolean;
  }
): Promise<{ delivery: DeliveryRow | null; duplicate: boolean }> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .insert(input)
    .select("id,status")
    .single<DeliveryRow>();

  if (error?.code === "23505") {
    return { delivery: null, duplicate: true };
  }

  if (error || !data) {
    throw new Error("Unable to reserve notification delivery.");
  }

  return { delivery: data, duplicate: false };
}

async function finishDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  result: ProviderResult
) {
  const { error } = await supabase
    .from("notification_deliveries")
    .update({
      status: result.status,
      attempts: result.attempts,
      provider_message_id: result.providerMessageId ?? null,
      error_code: result.errorCode ?? null,
      error_message: result.errorMessage ?? null,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", deliveryId);

  if (error) throw new Error("Unable to finalize notification delivery.");
}

async function sendPush(
  deliveryId: string,
  externalId: string,
  message: BudgetNotificationMessage
): Promise<ProviderResult> {
  const appId = Deno.env.get("ONESIGNAL_APP_ID")?.trim();
  const apiKey = Deno.env.get("ONESIGNAL_APP_API_KEY")?.trim();
  if (!hasRequiredProviderConfig(appId, apiKey)) {
    return {
      status: "skipped",
      attempts: 0,
      errorCode: "provider_not_configured",
      errorMessage: "OneSignal is not configured.",
    };
  }

  return sendProviderRequest(
    () =>
      new Request(oneSignalPushEndpoint, {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: {
          Accept: "application/json",
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: appId,
          include_aliases: { external_id: [externalId] },
          target_channel: "push",
          headings: { en: message.heading },
          contents: { en: message.content },
          url: message.url,
          data: { source: "wattwise_budget" },
          android_accent_color: "FF00E66F",
          ...(message.urgent ? { priority: 10 } : {}),
          idempotency_key: deliveryId,
        }),
      }),
    parseOneSignalSuccess
  );
}

async function sendEmail(
  deliveryId: string,
  recipientEmail: string,
  message: BudgetNotificationMessage
): Promise<ProviderResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim();
  if (!hasRequiredProviderConfig(apiKey, from)) {
    return {
      status: "skipped",
      attempts: 0,
      errorCode: "provider_not_configured",
      errorMessage: "Resend is not configured.",
    };
  }

  return sendProviderRequest(
    () =>
      new Request("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": deliveryId,
        },
        body: JSON.stringify({
          from,
          to: [recipientEmail],
          subject: message.emailSubject,
          html: message.emailHtml,
        }),
      }),
    (body) => ({
      status: "sent",
      attempts: 1,
      providerMessageId: typeof body.id === "string" ? body.id : undefined,
    })
  );
}

async function dispatchReservedDelivery(
  supabase: SupabaseClient,
  delivery: DeliveryRow,
  channel: NotificationChannel,
  profile: ProfileRow,
  preferences: PreferenceRow,
  message: BudgetNotificationMessage
): Promise<ProviderResult> {
  let result: ProviderResult;

  if (!isChannelEnabled(preferences, channel)) {
    result = {
      status: "skipped",
      attempts: 0,
      errorCode: "preference_disabled",
      errorMessage: "This notification channel is disabled in Settings.",
    };
  } else if (channel === "push") {
    result = await sendPush(delivery.id, preferences.onesignal_external_id, message);
  } else {
    result = await sendEmail(delivery.id, profile.email, message);
  }

  await finishDelivery(supabase, delivery.id, result);
  return result;
}

function configuredBaseUrl(): string | null {
  const raw = Deno.env.get("APP_BASE_URL")?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function handleWebhook(
  supabase: SupabaseClient,
  payload: DatabaseWebhookPayload
): Promise<Response> {
  if (
    payload.type !== "INSERT" ||
    payload.table !== "device_budget_events" ||
    payload.schema !== "public"
  ) {
    return json({ error: "Unsupported webhook payload." }, 400);
  }

  const event = parseBudgetEvent(payload.record);
  if (!event) return json({ error: "Invalid budget event payload." }, 400);

  const channels = getChannelsForBudgetEvent(event);
  if (channels.length === 0) {
    return json({ ok: true, ignored: true, reason: "in_app_only" });
  }

  const appBaseUrl = configuredBaseUrl();

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id,device_name,owner_id,user_id,tenant_id,user_approved_limit_php")
    .eq("id", event.device_id)
    .maybeSingle<DeviceRow>();

  if (deviceError || !device) return json({ error: "Budget event device was not found." }, 404);

  const recipientIds = resolveRecipientIds(device.owner_id, device.user_id, device.tenant_id);
  if (recipientIds.length === 0) return json({ ok: true, skipped: true, reason: "no_recipients" });

  const [{ data: profiles, error: profilesError }, { data: preferenceRows, error: preferencesError }] =
    await Promise.all([
      supabase.from("profiles").select("id,email,role").in("id", recipientIds),
      supabase
        .from("notification_preferences")
        .select("user_id,onesignal_external_id,budget_push_enabled,budget_email_enabled")
        .in("user_id", recipientIds),
    ]);

  if (profilesError || preferencesError) {
    return json({ error: "Notification recipients could not be resolved." }, 500);
  }

  const profileMap = new Map((profiles as ProfileRow[] | null)?.map((row) => [row.id, row]));
  const preferenceMap = new Map(
    (preferenceRows as PreferenceRow[] | null)?.map((row) => [row.user_id, row])
  );
  const results: Array<Record<string, unknown>> = [];

  for (const recipientId of recipientIds) {
    const profile = profileMap.get(recipientId);
    const preferences = preferenceMap.get(recipientId);

    for (const channel of channels) {
      const reservation = await reserveDelivery(supabase, {
        budget_event_id: event.id,
        recipient_id: recipientId,
        channel,
        is_test: false,
      });

      if (reservation.duplicate) {
        results.push({ recipient_id: recipientId, channel, status: "duplicate" });
        continue;
      }

      if (!reservation.delivery) continue;

      if (!appBaseUrl) {
        const result: ProviderResult = {
          status: "skipped",
          attempts: 0,
          errorCode: "provider_not_configured",
          errorMessage: "APP_BASE_URL is not configured.",
        };
        await finishDelivery(supabase, reservation.delivery.id, result);
        results.push({ recipient_id: recipientId, channel, status: result.status, code: result.errorCode });
        continue;
      }

      if (!profile || !preferences) {
        const result: ProviderResult = {
          status: "skipped",
          attempts: 0,
          errorCode: "recipient_not_ready",
          errorMessage: "The recipient profile or notification preferences are unavailable.",
        };
        await finishDelivery(supabase, reservation.delivery.id, result);
        results.push({ recipient_id: recipientId, channel, status: result.status, code: result.errorCode });
        continue;
      }

      const message = buildBudgetNotification(
        {
          ...event,
          threshold_php: Number(device.user_approved_limit_php ?? event.threshold_php),
        },
        device.device_name,
        appBaseUrl,
        destinationForRole(profile.role, device.id)
      );
      const result = await dispatchReservedDelivery(
        supabase,
        reservation.delivery,
        channel,
        profile,
        preferences,
        message
      );
      results.push({ recipient_id: recipientId, channel, status: result.status, code: result.errorCode });
    }
  }

  return json({ ok: true, event_id: event.id, results });
}

async function handleTest(
  supabase: SupabaseClient,
  userId: string,
  channel: NotificationChannel
): Promise<Response> {
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("id,email,role").eq("id", userId).maybeSingle<ProfileRow>(),
    supabase
      .from("notification_preferences")
      .select("user_id,onesignal_external_id,budget_push_enabled,budget_email_enabled")
      .eq("user_id", userId)
      .maybeSingle<PreferenceRow>(),
  ]);

  if (!profile || !preferences) return json({ error: "Notification settings are not ready." }, 409);

  const appBaseUrl = configuredBaseUrl();
  const { data: reservationRows, error: reservationError } = await supabase.rpc(
    "reserve_notification_test_delivery",
    { p_recipient_id: userId, p_channel: channel }
  );
  if (reservationError || !Array.isArray(reservationRows) || !reservationRows[0]) {
    return json({ error: "Unable to prepare the test notification." }, 500);
  }

  const reservation = reservationRows[0] as {
    delivery_id: string | null;
    retry_after_seconds: number;
  };
  if (!reservation.delivery_id) {
    return json(
      {
        error: "Please wait before sending another test notification.",
        retry_after_seconds: reservation.retry_after_seconds,
      },
      429
    );
  }
  const delivery: DeliveryRow = { id: reservation.delivery_id, status: "pending" };

  if (!appBaseUrl) {
    const result: ProviderResult = {
      status: "skipped",
      attempts: 0,
      errorCode: "provider_not_configured",
      errorMessage: "APP_BASE_URL is not configured.",
    };
    await finishDelivery(supabase, delivery.id, result);
    return json({ ok: true, channel, status: result.status, code: result.errorCode });
  }

  const url = new URL(destinationForRole(profile.role), appBaseUrl).toString();
  const heading = "WattWise test notification";
  const content = "Ayos! Ready na ang budget alerts mo for the presentation.";
  const message: BudgetNotificationMessage = {
    heading,
    content,
    emailSubject: heading,
    emailHtml: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#171717;line-height:1.6"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(content)}</p><p><a href="${escapeHtml(url)}">Open WattWise</a></p></body></html>`,
    url,
    urgent: false,
  };
  const result = await dispatchReservedDelivery(
    supabase,
    delivery,
    channel,
    profile,
    preferences,
    message
  );

  return json({ ok: true, channel, status: result.status, code: result.errorCode });
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function configuration is incomplete." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const webhookAuthorized = await secretsMatch(
    request.headers.get("x-wattwise-webhook-secret"),
    Deno.env.get("NOTIFICATION_WEBHOOK_SECRET")
  );

  if (webhookAuthorized) {
    return handleWebhook(supabase, payload as DatabaseWebhookPayload);
  }

  if (payload.mode !== "test" || (payload.channel !== "push" && payload.channel !== "email")) {
    return json({ error: "Unauthorized request." }, 401);
  }

  const token = readBearerToken(request);
  if (!token) return json({ error: "Unauthorized request." }, 401);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return json({ error: "Unauthorized request." }, 401);

  return handleTest(supabase, user.id, payload.channel);
}

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch {
    return json({ error: "Notification dispatch could not be completed." }, 500);
  }
});
