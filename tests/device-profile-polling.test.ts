import assert from "node:assert/strict";
import test from "node:test";
import {
  DEVICE_PROFILE_MAX_WAIT_MS,
  pollForDeviceProfile,
} from "../lib/device-profile-polling.ts";

test("keeps waiting through the relay and first-telemetry startup window", async () => {
  let attempts = 0;

  const response = await pollForDeviceProfile(
    async () => {
      attempts += 1;
      if (attempts < 24) {
        return Response.json(
          {
            code: "telemetry_pending",
            error: "No fresh telemetry yet. Keep the WattWise device powered on and wait for a live reading.",
          },
          { status: 409 }
        );
      }

      return Response.json({ baseline_watts: 850 }, { status: 200 });
    },
    { sleep: async () => {} }
  );

  assert.equal(response.ok, true);
  assert.equal(attempts, 24);
  assert.equal(DEVICE_PROFILE_MAX_WAIT_MS, 120_000);
});

test("keeps waiting when the meter is online but the appliance load is still zero", async () => {
  let attempts = 0;

  const response = await pollForDeviceProfile(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        return Response.json(
          { code: "load_not_detected", error: "The appliance is drawing 0 W." },
          { status: 409 }
        );
      }

      return Response.json({ baseline_watts: 53.25 }, { status: 200 });
    },
    { sleep: async () => {} }
  );

  assert.equal(response.ok, true);
  assert.equal(attempts, 2);
});

test("does not retry errors unrelated to telemetry readiness", async () => {
  let attempts = 0;

  const response = await pollForDeviceProfile(
    async () => {
      attempts += 1;
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    },
    { sleep: async () => {} }
  );

  assert.equal(response.status, 401);
  assert.equal(attempts, 1);
});

test("stops polling when setup is closed", async () => {
  const abortController = new AbortController();
  let attempts = 0;

  await assert.rejects(
    pollForDeviceProfile(
      async () => {
        attempts += 1;
        return Response.json(
          { code: "telemetry_pending", error: "Waiting for the device." },
          { status: 409 }
        );
      },
      {
        signal: abortController.signal,
        sleep: async () => abortController.abort(),
      }
    ),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError"
  );

  assert.equal(attempts, 1);
});
