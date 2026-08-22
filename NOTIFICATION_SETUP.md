# WattWise Notification Setup

The code is safe to deploy before provider credentials exist. Budget automation and in-app alerts keep working; external deliveries are recorded as skipped when a required provider setting is missing.

## 1. Apply the database migration

Apply `supabase/migrations/027_notification_delivery.sql` to the production Supabase project. It creates private per-user preferences, an RLS-protected delivery log, idempotency enforcement, and the server-only test cooldown.

## 2. Configure OneSignal Web Push

1. Create a OneSignal Web app and choose **Custom Code** integration.
2. Set the production site URL to `https://www.wattwise-app.site`.
3. Set the service worker file to `push/onesignal/OneSignalSDKWorker.js`.
4. Set the service worker scope to `/push/onesignal/`.
5. Keep automatic/slidedown permission prompts disabled. WattWise asks only after the user enables push in Settings.
6. Add the OneSignal App ID to Vercel as `NEXT_PUBLIC_ONESIGNAL_APP_ID`, for Production and Preview as needed, then redeploy.

The worker must be reachable at:

```text
https://www.wattwise-app.site/push/onesignal/OneSignalSDKWorker.js
```

It should return JavaScript content over HTTPS. On iPhone, web push is available only from the installed Home Screen PWA; the Settings UI explains this before requesting permission.

## 3. Configure Resend Email

1. In Resend, add a sending subdomain such as `notify.wattwise-app.site`.
2. Add the DNS records Resend provides to the DNS zone that manages `wattwise-app.site`.
3. Wait for Resend to mark the domain verified.
4. Choose a sender such as `WattWise Alerts <alerts@notify.wattwise-app.site>` for `RESEND_FROM_EMAIL`.

Do not use a `vercel.app` address as the sender domain. The sending domain must be one you control and can verify through DNS.

## 4. Configure and deploy the Edge Function

Set these Supabase Edge Function secrets with the real values later:

```bash
supabase secrets set ONESIGNAL_APP_ID="..."
supabase secrets set ONESIGNAL_APP_API_KEY="..."
supabase secrets set RESEND_API_KEY="..."
supabase secrets set RESEND_FROM_EMAIL="WattWise Alerts <alerts@notify.wattwise-app.site>"
supabase secrets set APP_BASE_URL="https://www.wattwise-app.site"
supabase secrets set NOTIFICATION_WEBHOOK_SECRET="a-long-random-secret"
```

Deploy the function with gateway JWT verification disabled because it accepts two request types and validates both internally: a shared-secret database webhook or an authenticated user test request.

```bash
supabase functions deploy dispatch-budget-notifications --no-verify-jwt
```

Never place the OneSignal REST API key, Resend key, service-role key, or webhook secret in Vercel `NEXT_PUBLIC_*` variables.

## 5. Create the Supabase Database Webhook

In **Supabase Dashboard → Database → Webhooks**:

1. Choose **Create a new webhook**.
2. Name it `dispatch-budget-notifications`.
3. Select table `public.device_budget_events`.
4. Enable only the `INSERT` event.
5. Use HTTP method `POST`.
6. Set the URL to `https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-budget-notifications`.
7. Add header `x-wattwise-webhook-secret` with the exact value used for `NOTIFICATION_WEBHOOK_SECRET`.
8. Save and enable the webhook.

Do not create a webhook on `energy_logs`; notifications are driven only by the already-deduplicated budget event table.

## 6. Presentation verification

1. Open Settings and confirm critical email is on by default.
2. Enable push from a deliberate user click and send one test push.
3. Send one test email. Test actions have a server-enforced 60-second cooldown per channel.
4. Trigger a demo unit through 80% and verify push only.
5. Trigger `approval_required` and `auto_cutoff` 100% paths and verify push plus email.
6. Confirm both owner/manager and assigned tenant receive only channels they enabled.
7. Re-send the same webhook payload and confirm no duplicate delivery is created.

Expected policy: 50% in-app only, 80% push, and both 100% terminal events push plus critical email.
