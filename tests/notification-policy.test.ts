import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBudgetNotification,
  escapeHtml,
  getChannelsForBudgetEvent,
  isChannelEnabled,
  resolveRecipientIds,
} from "../supabase/functions/_shared/notification-policy.ts";
import {
  hasRequiredProviderConfig,
  parseOneSignalSuccess,
  sendProviderRequest,
} from "../supabase/functions/_shared/provider-delivery.ts";

test("maps only existing 80% and terminal budget events to external channels", () => {
  assert.deepEqual(
    getChannelsForBudgetEvent({
      event_type: "budget_warning",
      threshold_percent: 50,
      spend_php: 500,
      threshold_php: 1_000,
    }),
    []
  );
  assert.deepEqual(
    getChannelsForBudgetEvent({
      event_type: "budget_warning",
      threshold_percent: 80,
      spend_php: 800,
      threshold_php: 1_000,
    }),
    ["push"]
  );
  assert.deepEqual(
    getChannelsForBudgetEvent({
      event_type: "approval_required",
      threshold_percent: 100,
      spend_php: 1_000,
      threshold_php: 1_000,
    }),
    ["push", "email"]
  );
  assert.deepEqual(
    getChannelsForBudgetEvent({
      event_type: "auto_cutoff",
      threshold_percent: 100,
      spend_php: 1_000,
      threshold_php: 1_000,
    }),
    ["push", "email"]
  );
});

test("resolves owner and tenant once without exposing or adding unrelated users", () => {
  assert.deepEqual(resolveRecipientIds("owner-id", "legacy-id", "tenant-id"), [
    "owner-id",
    "tenant-id",
  ]);
  assert.deepEqual(resolveRecipientIds(null, "legacy-id", "legacy-id"), ["legacy-id"]);
  assert.deepEqual(resolveRecipientIds(null, null, null), []);
});

test("honors per-channel preference flags", () => {
  const preferences = { budget_push_enabled: false, budget_email_enabled: true };
  assert.equal(isChannelEnabled(preferences, "push"), false);
  assert.equal(isChannelEnabled(preferences, "email"), true);
});

test("builds deterministic Taglish budget messages with safe HTML and destination", () => {
  const message = buildBudgetNotification(
    {
      event_type: "auto_cutoff",
      threshold_percent: 100,
      spend_php: 1_025.5,
      threshold_php: 1_000,
    },
    '<Aircon & "Bedroom">',
    "https://wattwise-app.site",
    "/manager/rooms"
  );

  assert.match(message.content, /100%/);
  assert.match(message.content, /₱1,025\.50 spent of ₱1,000\.00/);
  assert.match(message.content, /Pinatay muna ng WattWise/);
  assert.equal(message.url, "https://wattwise-app.site/manager/rooms");
  assert.equal(message.urgent, true);
  assert.doesNotMatch(message.emailHtml, /<Aircon/);
  assert.match(message.emailHtml, /&lt;Aircon &amp; &quot;Bedroom&quot;&gt;/);
  assert.equal(escapeHtml("<>&\"'"), "&lt;&gt;&amp;&quot;&#039;");
});

test("detects missing provider configuration and no push subscription", () => {
  assert.equal(hasRequiredProviderConfig("app-id", "api-key"), true);
  assert.equal(hasRequiredProviderConfig("app-id", "  "), false);
  assert.equal(hasRequiredProviderConfig("app-id", undefined), false);
  assert.deepEqual(parseOneSignalSuccess({ recipients: 0 }), {
    status: "skipped",
    attempts: 1,
    errorCode: "no_push_subscription",
    errorMessage: "No active push subscription was found.",
  });
});

test("retries 429 and 5xx provider responses with the same idempotency key", async () => {
  const statuses = [429, 503, 200];
  const pauses: number[] = [];
  const idempotencyKeys: Array<string | null> = [];
  let calls = 0;

  const result = await sendProviderRequest(
    () =>
      new Request("https://provider.example/send", {
        method: "POST",
        headers: { "Idempotency-Key": "delivery-uuid" },
      }),
    (body) => ({
      status: "sent",
      attempts: 1,
      providerMessageId: typeof body.id === "string" ? body.id : undefined,
    }),
    {
      fetcher: async (request) => {
        calls += 1;
        idempotencyKeys.push(new Request(request).headers.get("Idempotency-Key"));
        const status = statuses.shift() ?? 500;
        return Response.json(status === 200 ? { id: "provider-id" } : {}, { status });
      },
      pause: async (milliseconds) => {
        pauses.push(milliseconds);
      },
    }
  );

  assert.equal(calls, 3);
  assert.deepEqual(pauses, [250, 500]);
  assert.deepEqual(idempotencyKeys, ["delivery-uuid", "delivery-uuid", "delivery-uuid"]);
  assert.deepEqual(result, {
    status: "sent",
    attempts: 3,
    providerMessageId: "provider-id",
  });
});

test("does not retry permanent provider rejection such as invalid sender configuration", async () => {
  let calls = 0;
  const result = await sendProviderRequest(
    () => new Request("https://provider.example/send"),
    () => ({ status: "sent", attempts: 1 }),
    {
      fetcher: async () => {
        calls += 1;
        return Response.json({}, { status: 403 });
      },
      pause: async () => {},
    }
  );

  assert.equal(calls, 1);
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "provider_http_403");
});

test("retries network timeouts and returns a sanitized final failure", async () => {
  let calls = 0;
  const result = await sendProviderRequest(
    () => new Request("https://provider.example/send"),
    () => ({ status: "sent", attempts: 1 }),
    {
      fetcher: async () => {
        calls += 1;
        throw new DOMException("Timed out", "TimeoutError");
      },
      pause: async () => {},
    }
  );

  assert.equal(calls, 3);
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "provider_network_error");
  assert.doesNotMatch(result.errorMessage ?? "", /Timed out/);
});

