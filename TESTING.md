# Testing WattWise

A manual and automated checklist for the web app (`wattwise_platform`) and the ESP32-S3 units (`wattwise_hardware`). Tick items with `[x]` as you go. Each item says what to do and, after ✅, what should happen.

Last updated: October 22, 2026.

## Before you start

- **Use a separate test account** for anything destructive, such as deleting an account. Register one at `/register`; don't test deletion on your real account.
- **Use a safe load for relay tests**, like a lamp or a fan. Never a refrigerator or an aircon, since the relay cuts power.
- **Test on a phone** at <https://www.wattwise-app.site>, in both dark and light theme (toggle in the header). To get an app-like experience, add it to the home screen: Safari → Share → **Add to Home Screen** on iPhone, or Chrome → **Install app** on Android. Offline support is not built yet, so it still needs a connection.
- **The first load after a deploy can be slower** while the Seoul servers start up. Judge speed on the second load.

## 1. Automated checks

Run these in `wattwise_platform` (Node.js 22.6 or later):

```bash
npm run lint && npx tsc --noEmit -p . && npm test && npm run build
```

- [ ] ✅ No lint or type errors, all unit tests pass, and the production build succeeds.

## 2. Sign-in and public pages

- [ ] Signed out, open `/`, `/login`, `/register`, and `/onboarding`. ✅ Each appears almost instantly (they are static pages).
- [ ] Register a test account. ✅ You land on the dashboard, or see a "Confirm your email" screen if email confirmation is on.
- [ ] Log out, then log in with a wrong password. ✅ A friendly message, not a raw error.
- [ ] Log in and tap the button twice quickly. ✅ It submits only once and stays in its loading state until the dashboard opens.
- [ ] Forgot password: request a link, open it from your email, then tap **Back to Login** without changing the password. ✅ You end up signed out on the login page, not inside the app.
- [ ] While signed in, open `/login`. ✅ You are redirected to your dashboard.

## 3. Live hardware

Needs a registered, powered unit.

- [ ] Power on the unit and open the dashboard. ✅ Its card switches to **LIVE** within about 10 seconds, and watts, volts, and amps update every ~5 seconds without the page reloading.
- [ ] Open Admin → Devices. ✅ The unit shows **Online**. (Before the October 21 fix, real units always showed "never seen".)
- [ ] Disconnect the unit's Wi-Fi. ✅ Within about 20 seconds the card shows IDLE, and the device page header shows "OFFLINE · last reading Xs ago".
- [ ] Reconnect it. ✅ It returns to LIVE on its next reading.

## 4. Relay and budgets

Safe load only.

- [ ] Tap the power button on a device card. ✅ A confirmation appears before turning it off. The card, the device page, and the physical relay all agree within about 5 seconds, and the message says the command was sent.
- [ ] Turn it back on. ✅ No confirmation is needed.
- [ ] In Settings, set a very low limit on the device and enable **Automatic shutoff**. ✅ The app asks for confirmation, and the toggle turns amber.
- [ ] Let usage cross the limit. ✅ The relay cuts off, and the dashboard shows "Auto cutoff active" without a manual reload.
- [ ] Tap **Restore Power**. ✅ It asks before restoring, and the relay turns back on.

## 5. Add Appliance

- [ ] Tap **Add Appliance**, enter a MAC by hand, continue, go back, change the name, then continue again. ✅ The changed name is the one saved.
- [ ] Open the QR scanner and allow the camera. ✅ Scanning a WattWise label fills in the MAC.
- [ ] Scan any other QR code. ✅ "That QR code isn't a WattWise label."
- [ ] Deny camera access. ✅ A friendly message with the option to enter the MAC manually.
- [ ] Enter a MAC that belongs to another account. ✅ "This device is already linked to another WattWise account."

## 6. Dashboard, analytics, calendar, and rates

- [ ] The dashboard wallet, burn rate, week strip, and Meralco breakdown all load with plausible numbers.
- [ ] Switch between Home, Burn, Reports, and Settings. ✅ Each shows a skeleton briefly, then loads in about a second.
- [ ] Open a device page. ✅ Gauges and the billing-cycle numbers load in about a second.
- [ ] Calendar: move to the previous and next month. ✅ Days line up with weekdays, and "today" is correct, including around midnight Manila time.
- [ ] `/rates` shows the active Meralco breakdown and rate history.
- [ ] Settings → "Monthly kWh on your Meralco bill": save 350, and the breakdown labels distribution "301–400 kWh tier" with a higher rate; clear it, and the note says the tier is projected from monitored usage. Invalid input (letters, 0) shows an inline error.

## 7. Reports

- [ ] Switch between Daily, Weekly, and Monthly. ✅ The table arrives already filled in.
- [ ] Compare a device's monthly variable cost with the dashboard's variable spend. ✅ They agree.
- [ ] Download the PDF and the CSV. ✅ Both download. A failure shows an inline error, never a raw JSON page.

## 8. Settings

- [ ] Edit the home budget from the dashboard wallet. ✅ Values like `₱2,500` and `2500.50` are accepted; `1e3` is rejected.
- [ ] Change the billing-cycle day. ✅ The dashboard's cycle dates update.
- [ ] Turn on push alerts. ✅ The browser asks for permission only after you tap the toggle, never on page load.
- [ ] Send a test push and a test email. ✅ They arrive, or you see a plain message explaining why not.
- [ ] **Test account only:** Delete account. ✅ The button stays disabled until you type `DELETE`; deleting signs you out.

## 9. AI assistant

- [ ] Ask about your bill or a device. ✅ The answer uses your real numbers.
- [ ] Ask it to change a device limit, then confirm. ✅ The dashboard reflects the change.
- [ ] Turn on airplane mode and send a message. ✅ Your text stays in the box and a friendly error appears.

## 10. Manager and tenant

Needs a manager account.

- [ ] Create a tenant and assign a room unit. ✅ The tenant must change their password on first login, then sees only their assigned unit.
- [ ] As the manager, turn a room's relay off. ✅ It asks for confirmation; OFF shows in grey, not red.
- [ ] Open the manager pages from the bottom nav. ✅ The loading screen appears immediately.

## 11. Admin

Needs a super admin account.

- [ ] Overview, Users, Devices, Rates, Analytics, Health, and Demo Units all load.
- [ ] Devices shows Online for units that reported in the last 20 seconds, and "last seen …" or "never seen" for the rest.
- [ ] Save a user or device edit that the server rejects. ✅ The error shows inside the edit panel, not a browser popup.
- [ ] Reset or delete a demo unit. ✅ The app's own confirmation dialog appears.

## 12. Security spot checks

- [ ] As a regular user, open `/admin` and `/manager`. ✅ You are redirected away.
- [ ] As a tenant, check the dashboard, reports, and analytics. ✅ Only the assigned unit's data appears.

## 13. Hardware acceptance

From `wattwise_hardware/docs/panelist-feature-and-hardware-hardening-plan.md`. These have not yet been recorded as run on physical units.

- [ ] Clean provisioning through the `WattWise-Setup` Wi-Fi portal. ✅ The serial monitor shows the MAC and "MAC registration verified".
- [ ] Hold BOOT for 5 seconds. ✅ Wi-Fi settings clear and the setup portal returns.
- [ ] Wi-Fi outage, then recovery. ✅ Readings resume, and failed batches are retried.
- [ ] Meter reset (cumulative `energy_kwh` drops). ✅ No negative usage or cost in the app.
- [ ] A unit whose MAC is not registered. ✅ Posts are rejected and nothing appears in `energy_logs`.
- [ ] On boot with no connection, the relay stays OFF until the first successful cloud read.

## Reporting a problem

Note the section and item, the account type (owner, tenant, manager, or admin), the device and browser, what you did, and what you saw. A screenshot helps.
