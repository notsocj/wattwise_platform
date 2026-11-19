# WattWise and the OWASP Top 10 (2025)

How the WattWise platform (Next.js on Vercel, Supabase, ESP32-S3 units) handles each risk in the [OWASP Top 10:2025](https://owasp.org/Top10/2025/). Each row names where the control lives, so it can be checked in the code. Last reviewed November 19, 2026.

**Legend:** ✅ in place · ⚠️ in place with a known limit · 🔜 not yet

## Summary

| # | Risk | Status |
|---|---|---|
| A01 | Broken Access Control | ✅ |
| A02 | Security Misconfiguration | ✅ |
| A03 | Software Supply Chain Failures | ✅ |
| A04 | Cryptographic Failures | ⚠️ hardware TLS not pinned |
| A05 | Injection | ✅ |
| A06 | Insecure Design | ✅ |
| A07 | Authentication Failures | ✅ |
| A08 | Software or Data Integrity Failures | ⚠️ hardware identified by MAC |
| A09 | Security Logging and Alerting Failures | ⚠️ logs, no automatic alerts |
| A10 | Mishandling of Exceptional Conditions | ✅ |

## A01 Broken Access Control ✅

- **Row Level Security on every table.** No public table has RLS turned off (checked on production, November 19, 2026). Owners, tenants, and managers see only their own units through `can_access_device()` (migrations `018`, `033`, `040`).
- **Every API route checks the caller.** All 33 routes in `app/api/` call `getSessionUser()`, `getManagerSession()`, or `requireAdminApi()`; the landing chatbot checks the request's origin instead. Ownership is rechecked in the query (for example `.or(owner_id.eq.…,user_id.eq.…)` in the relay route), and tenants can't control power.
- **Roles enforced in the middleware.** `lib/supabase/middleware.ts` verifies the signed session token, reads the role from the database, and blocks `/admin` for non-admins and `/manager` for non-managers. Disabled accounts and signed-out sessions are treated as signed out immediately (migration `045`).
- **Identity headers can't be forged.** The middleware deletes any client-sent `x-wattwise-*` headers before setting its own (tested: a forged "admin, verified" request gets 401).
- **Hardware can read only what it needs.** The public key may read only `devices.mac_address` and `devices.relay_state` (migration `040`).
- **Cross-site request forgery.** Session cookies are `SameSite=Lax`, and the middleware also refuses any API write that a browser sends from another site (`lib/csrf.ts`, tested in `tests/csrf.test.ts`).

**Demo:** call `/api/admin/users` signed out (401), as an owner (403), and from another origin (403).

## A02 Security Misconfiguration ✅

- **Security headers on every response** (`next.config.ts`): `Strict-Transport-Security` (2 years, subdomains), `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` against clickjacking, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that allows only the camera (for QR scanning), and CSP `base-uri`, `object-src`, and `form-action` limits. The `X-Powered-By` header is off.
- **Secrets stay on the server.** `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` are only read in server code; `.env` files are git-ignored (`.env.example` lists names only).
- **No default accounts or debug pages in production**; errors show the app's own error page (`app/error.tsx`).

**Demo:** `curl -I https://www.wattwise-app.site/login`, or [securityheaders.com](https://securityheaders.com).

## A03 Software Supply Chain Failures ✅

- **Locked dependencies:** `package-lock.json` is committed and CI installs with `npm ci`. Next.js is pinned to an exact patched version (16.4.6).
- **Known-vulnerability scan:** `npm audit --omit=dev` reports 0 vulnerabilities (November 19, 2026). The **Security checks** workflow (`.github/workflows/security-checks.yml`) fails on any high or critical advisory, on every push, pull request, and weekly.
- **Automatic updates:** Dependabot opens weekly update pull requests (`.github/dependabot.yml`).

## A04 Cryptographic Failures ⚠️

- **HTTPS everywhere** with HSTS; Vercel and Supabase terminate TLS.
- **Passwords are never stored by WattWise.** Supabase Auth stores bcrypt hashes; tenant temporary passwords come from `crypto.getRandomValues` (`lib/temp-password.ts`).
- **Landing chatbot visitors are tracked only by a salted hash of their IP**, never the raw address (migration `042`).
- **Limit:** the ESP32 firmware sends readings over HTTPS but doesn't pin or verify Supabase's certificate. Pinning needs a firmware update on every unit.

## A05 Injection ✅

- **No hand-built SQL with user input.** The app queries through the Supabase client and parameterized RPCs; search text is cleaned by `lib/postgrest.ts` before it reaches a PostgREST filter.
- **No HTML injection.** React escapes all output; the only raw HTML is two constant strings (the theme script and generated icons).
- **AI prompt injection is contained.** The landing chatbot refuses off-topic and injection attempts before calling the model (`publicGuardReply`, tested in `tests/public-assistant.test.ts`). The customer assistant can only propose actions, which run after the user confirms a card and pass the same permission checks as the normal routes.
- **Strict input validation** at each route: device edits (`lib/device-edit.ts`), rate edits (`lib/meralco-rate-input.ts`), chat bodies (length and history caps).

## A06 Insecure Design ✅

- **Limits on everything that costs money or can be spammed:**
  - landing chatbot: 5 a minute and 30 a day per visitor, 1,500 a day overall (migration `042`);
  - customer assistant: a per-account message limit;
  - every other AI feature: 10 a minute and 200 a day per account (`lib/ai-rate-limit.ts`, migration `048`). These fail closed: if the limiter itself fails, no OpenAI call is made.
- **Safety by design for power control:** budget breaches can require approval instead of cutting power, the assistant never turns a unit on under automatic cutoff, and impossible kWh jumps are ignored by the billing trigger (migration `039`).
- **Destructive actions need confirmation** (`useConfirmDialog`), and removing a unit also deletes its readings so they can't leak to the next owner.

## A07 Authentication Failures ✅

- **Strong passwords:** at least 8 characters with an uppercase letter, a lowercase letter, a number, and a symbol, shown live on sign-up and password change (`lib/password-policy.ts`) and enforced by Supabase Auth.
- **Two-factor sign-in for the admin console:** an authenticator-app code (TOTP) is required for `/admin` and every `/api/admin` route (`app/two-factor/page.tsx`, middleware, `requireAdminApi()`).
- **Brute-force protection:** Supabase Auth rate-limits sign-in and password-reset attempts.
- **Sessions can be ended everywhere** ("log out of all devices"), and disabled accounts lose access on their next request.
- **Tenants must replace their temporary password** on first sign-in.

**Demo:** sign in to the admin console (password, then authenticator code), and try `password1` on the sign-up form.

## A08 Software or Data Integrity Failures ⚠️

- **Readings are checked before they count:** an insert is accepted only for a registered unit's MAC address (migration `022`), and kWh jumps no 10 kW appliance could make are ignored when computing spend (migration `039`).
- **Admin changes are audited** with before and after values (`admin_audit_logs`, Admin → Audit Log), and manual Meralco rate edits are validated before saving.
- **Deploys come only from the `main` branch** through Vercel's Git integration; database changes are versioned migrations.
- **Limit:** a unit proves who it is only by its MAC address and the shared public key, so someone who knows a MAC could send fake readings for it. Closing this needs a per-device secret and a firmware update.

## A09 Security Logging and Alerting Failures ⚠️

- **Admin audit log** for every admin action (`writeAdminAudit()`).
- **Auth logs** (sign-ins, failures, MFA) in Supabase → Authentication → Logs; request logs in Vercel.
- **Server errors are logged on the server** (`console.error`) with their detail, while users see a plain message.
- **Budget and power events** are stored in `device_budget_events` and sent as push or email notifications.
- **Limit:** there are no automatic alerts for suspicious activity (for example many failed admin sign-ins); someone has to look at the logs.

## A10 Mishandling of Exceptional Conditions ✅

- **No internal error text in responses.** Database and AI-provider errors are logged on the server and replaced with a plain message (`adminError()` in `lib/admin-auth.ts`, the insights route). Only messages the app raises on purpose (such as "limit too low") reach the user.
- **Fail closed:** rate limiters return 503 instead of skipping the check; the relay keeps its last safe state when a response is invalid; a missing Meralco rate stops billing instead of guessing a price.
- **A route error boundary** (`app/error.tsx`) shows a friendly page instead of a stack trace.

## Known limits and next steps

1. **Per-device secrets for hardware** (A08) and **certificate pinning** (A04): both need a firmware update on every unit.
2. **Super-admin database permissions** granted by RLS don't yet require the two-factor level (`aal2`); the admin pages and APIs do.
3. **A full Content Security Policy** (`script-src`, `connect-src`) would need nonces for Next.js and third-party scripts; the current policy covers framing, plugins, `<base>`, and form targets.
4. **Leaked-password protection** (Supabase checks passwords against known breaches) needs the Supabase Pro plan.
5. **Automatic alerts** for repeated failed admin sign-ins (A09).
