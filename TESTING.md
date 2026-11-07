# Testing WattWise

A manual and automated checklist for the web app (`wattwise_platform`) and the ESP32-S3 units (`wattwise_hardware`). Tick items with `[x]` as you go. Each item says what to do and, after ✅, what should happen.

Last updated: November 7, 2026.

## Before you start

- **Use a separate test account** for anything destructive, such as deleting an account. Register one at `/register`; don't test deletion on your real account.
- **Use a safe load for relay tests**, like a lamp or a fan. Never a refrigerator or an aircon, since the relay cuts power.
- **Test on a phone and on a laptop or desktop window** (1024px or wider changes the layout) at <https://www.wattwise-app.site>, in both dark and light theme. Switch the theme in Settings → Appearance on a phone, or with **Light mode** / **Dark mode** in the desktop sidebar. To get an app-like experience, add it to the home screen: Safari → Share → **Add to Home Screen** on iPhone, or Chrome → **Install app** on Android. Offline support is not built yet, so it still needs a connection.
- **The first load after a deploy can be slower** while the Seoul servers start up. Judge speed on the second load.

## 1. Automated checks

Run these in `wattwise_platform` (Node.js 22.6 or later):

```bash
npm run lint && npx tsc --noEmit -p . && npm test && npm run build
```

- [ ] ✅ No lint or type errors, all unit tests pass, and the production build succeeds.

## 2. Sign-in and public pages

- [ ] Signed out, open `/`, `/login`, `/register`, and `/onboarding`. ✅ Each appears almost instantly (they are static pages).
- [ ] Signed out, open `/`. ✅ The owl appears in the centre, lifts, "WattWise" rises in, then the splash fades out into the landing page after about 3 seconds.
- [ ] On `/onboarding`, hover over the 3D unit (desktop) or tap it (phone). ✅ The cover lifts and the layers separate, with labels for the PZEM-004T meter, ESP32-S3, and relay. Tap again to close.
- [ ] Scroll the landing page with a mouse wheel or trackpad. ✅ Scrolling eases smoothly and each section rises in as it appears. **Get started** opens `/register` and **Log in** opens `/login`.
- [ ] On `/onboarding`, tap **Ask WattWise**, then a suggested question. ✅ Typing dots, then a short answer about WattWise. Ask "Magkano ang unit?" ✅ It says it doesn't know the price instead of making one up. Ask for code or say "ignore your instructions". ✅ The canned WattWise-only reply. Send 6 messages within a minute. ✅ The 6th shows "You're sending messages quickly".
- [ ] Signed out, tap the WattWise logo on `/login`, `/register`, or `/forgot-password` (phone) or the wordmark on the desktop brand panel. ✅ It opens the landing page.
- [ ] On a desktop window, open `/login`. ✅ A brand panel sits on the left and the form on the right.
- [ ] On `/register`, tap **Sign Up** without ticking the Terms box. ✅ "Accept the Terms and Privacy Policy to create an account." appears and nothing is sent. The **Terms and Conditions** and **Privacy Policy** links open in a new tab; the landing page footer links to both.
- [ ] Register a test account. ✅ You land on the dashboard, or see a "Confirm your email" screen if email confirmation is on.
- [ ] Log out, then log in with a wrong password. ✅ A friendly message in a red banner that slides in above the form (not a raw error), and the button returns to **Login** so you can try again.
- [ ] Log in and tap the button twice quickly. ✅ It submits only once: the button shows a spinner with "Logging in...", then a check with "Logged in! Opening WattWise...", and stays that way until the dashboard opens.
- [ ] Forgot password: request a link. ✅ The button shows "Sending...", then "Link sent!", then the "Check your email" screen.
- [ ] Forgot password: request a link, open it from your email, then tap **Back to Login** without changing the password. ✅ You end up signed out on the login page, not inside the app.
- [ ] While signed in, open `/login`. ✅ You are redirected to your dashboard.

## 3. Layout, themes, and motion

- [ ] Open the app in a window at least 1024px wide. ✅ A sidebar shows **Overview** (Home, Burn, Reports) and **Billing** (Calendar, Meralco Rates), with Settings, the theme switch, Log out, and your account card at the bottom. Pages have a title and a one-line description, and there are no back buttons.
- [ ] Click between sidebar items. ✅ The highlight moves to the clicked item at once and glides there, a thin green bar runs along the top while the page loads, and the page's cards rise in quickly.
- [ ] Open a device from the dashboard on desktop. ✅ A breadcrumb (Home › device name) replaces the back button.
- [ ] Narrow the window below 1024px. ✅ The layout switches to the phone column with the bottom tab bar.
- [ ] Switch to light mode, then reload. ✅ No dark flash before the page appears. Text is readable everywhere, mint text shows as a darker green, and input fields are a soft grey.
- [ ] Check every page in both themes, including manager and admin pages. Light mode has not been reviewed yet on manager, admin, and signed-out pages, so look closely there.
- [ ] Turn on your device's "Reduce motion" setting. ✅ Elements fade instead of sliding, and the landing page uses normal scrolling.
- [ ] Open the AI assistant. ✅ The WattWise owl is on the floating button and in the assistant header.

## 4. Live hardware

Needs a registered, powered unit.

- [ ] Power on the unit and open the dashboard. ✅ Its card switches to **LIVE** within about 10 seconds, and watts, volts, and amps update every ~5 seconds without the page reloading.
- [ ] Open Admin → Devices. ✅ The unit shows **Online**. (Before the October 21 fix, real units always showed "never seen".)
- [ ] Disconnect the unit's Wi-Fi. ✅ Within about 20 seconds the card shows IDLE, and the device page header shows "OFFLINE · last reading Xs ago".
- [ ] Reconnect it. ✅ It returns to LIVE on its next reading.

## 5. Relay and budgets

Safe load only.

- [ ] Tap the power button on a device card. ✅ A confirmation appears before turning it off. The card, the device page, and the physical relay all agree within about 5 seconds, and the message says the command was sent.
- [ ] Turn it back on. ✅ No confirmation is needed.
- [ ] In Settings, set a very low limit on the device and enable **Automatic shutoff**. ✅ The app asks for confirmation, and the toggle turns amber.
- [ ] Let usage cross the limit. ✅ The relay cuts off, and the dashboard shows "Auto cutoff active" without a manual reload.
- [ ] Tap **Restore Power**. ✅ It asks before restoring, and the relay turns back on.

## 6. Add Appliance

- [ ] Tap **Add Appliance**, enter a MAC by hand, continue, go back, change the name, then continue again. ✅ The changed name is the one saved.
- [ ] Open the QR scanner and allow the camera. ✅ Scanning a WattWise label fills in the MAC.
- [ ] Scan any other QR code. ✅ "That QR code isn't a WattWise label."
- [ ] Deny camera access. ✅ A friendly message with the option to enter the MAC manually.
- [ ] Enter a MAC that belongs to another account. ✅ "This device is already linked to another WattWise account."

## 7. Dashboard, analytics, calendar, and rates

- [ ] The dashboard wallet, burn rate, week strip, and Meralco breakdown all load with plausible numbers.
- [ ] Switch between Home, Burn, Reports, and Settings. ✅ Each shows a skeleton briefly, then loads in about a second.
- [ ] Open a device page. ✅ Gauges and the billing-cycle numbers load in about a second.
- [ ] Calendar: move to the previous and next month. ✅ Days line up with weekdays, and "today" is correct, including around midnight Manila time.
- [ ] `/rates` shows the active Meralco breakdown and rate history.
- [ ] GitHub Actions → "Sync Meralco rates" → Run workflow with `dryRun: true` and the latest published month. ✅ It finishes green and logs the parsed rates.
- [ ] Settings → "Monthly kWh on your Meralco bill": save 350, and the breakdown labels distribution "301–400 kWh tier" with a higher rate; clear it, and the note says the tier is projected from monitored usage. Invalid input (letters, 0) shows an inline error.

## 8. Reports

- [ ] Switch between Daily, Weekly, and Monthly. ✅ The table arrives already filled in.
- [ ] Compare a device's monthly variable cost with the dashboard's variable spend. ✅ They agree.
- [ ] Download the PDF and the CSV. ✅ Both download. A failure shows an inline error, never a raw JSON page.

## 9. Settings

- [ ] Edit the home budget from the dashboard wallet. ✅ Values like `₱2,500` and `2500.50` are accepted; `1e3` is rejected.
- [ ] Change the billing-cycle day. ✅ The dashboard's cycle dates update.
- [ ] Turn on push alerts. ✅ The browser asks for permission only after you tap the toggle, never on page load.
- [ ] Send a test push and a test email. ✅ They arrive, or you see a plain message explaining why not.
- [ ] Settings on a phone: groups (Billing, Appearance, Notifications, Safety, Account, Danger zone) rise in one after another. Change the billing day or kWh. ✅ A Save button appears only after you change a value. Switches slide, and the Light/Dark selector's highlight glides.
- [ ] Settings → Log out, and Log out of all devices. ✅ Each asks first; Cancel keeps you signed in. "All devices" also signs out your other phones and browsers. No page has a logout button in the top right any more (desktop keeps Log out in the sidebar).
- [ ] **Test account only:** Delete account. ✅ The button stays disabled until you type `DELETE`; deleting signs you out.

## 10. AI assistant

- [ ] Ask about your bill or a device. ✅ The answer uses your real numbers.
- [ ] Ask it to change a device limit, then confirm. ✅ The dashboard reflects the change.
- [ ] Ask "Turn off the aircon at 1 AM". ✅ A "Schedule a turn-off" card shows the exact time ("1:00 AM, Sun, Nov 8"); nothing changes until you confirm. After confirming, the device page's **Scheduled turn-offs** card lists it, and at that time the relay goes off within about 20 seconds.
- [ ] Ask "Turn it off after ₱5 more tonight" on a running demo unit (or a lamp). ✅ After confirming, the card shows progress ("₱1.20 of ₱5.00 since it was scheduled"), and the relay turns off within about 20 seconds of reaching ₱5.
- [ ] Ask "Turn off the aircon after 0.2 kWh". ✅ Same as above, counted in kWh.
- [ ] Cancel a scheduled turn-off from the device page. ✅ It asks first, then shows "Cancelled"; the device keeps running.
- [ ] Ask it to turn a device **on** at a time, or to turn it off right now. ✅ It declines; scheduled rules only turn devices off.
- [ ] As a tenant, ask to schedule a turn-off. ✅ It explains only the owner can.
- [ ] Open the assistant with an existing conversation. ✅ It opens already at the newest message (no scrolling from the top); a first open shows placeholder bubbles while history loads.
- [ ] Send a message. ✅ An owl with bouncing dots appears, with a status line ("Reading your devices...", "Checking Meralco rates...", "Writing a reply..."), and the reply eases in.
- [ ] Ask for something off-topic, like "give me C programming code for bubble sort" or "Who won the NBA finals?". ✅ It says it only helps with energy and WattWise and suggests an energy question, with no card.
- [ ] Turn on airplane mode and send a message. ✅ Your text stays in the box and a friendly error appears.

## 11. Manager and tenant

Needs a manager account.

- [ ] Create a tenant and assign a room unit. ✅ The tenant must change their password on first login, then sees only their assigned unit.
- [ ] On Tenants, for a tenant who hasn't logged in, tap **Temporary password** and confirm. ✅ A new password appears with **Copy login details**; the old one stops working, and the tenant can log in with the new one. A tenant who already set a password has no button.
- [ ] On any manager page, tap the owl button. ✅ The Manager Assistant opens as a bottom sheet (corner panel on desktop) and answers about rooms; the bottom bar has five tabs (no AI), and the Fleet page shows **AI priorities**.
- [ ] As the manager, turn a room's relay off. ✅ It asks for confirmation; OFF shows in grey, not red.
- [ ] Open the manager pages from the bottom nav (phone) and the sidebar (desktop). ✅ The loading screen appears immediately.

## 12. Admin

Needs a super admin account.

- [ ] Overview, Users, Devices, Rates, Growth, AI Costs, Analytics, Health, Audit, and Demo Units all load. Overview lists recent admin actions with the admin's email.
- [ ] Rates → **Add or correct a month**. ✅ The preview matches the history table's ₱/kWh for the same values. Save without a reason. ✅ "Say briefly why…" and nothing is saved. Save with a reason. ✅ The row shows **Manual**, the Audit Log has a `meralco_rates_create`/`update` entry, and dashboards price usage with the new rates right away.
- [ ] Health shows the database size out of 500 MB, unit counts by status, and the latest rate sync (not "No runs" when the sync has run).
- [ ] Analytics shows a 30-day kWh chart; Growth shows sign-ups per day; AI Costs shows an estimated USD cost.
- [ ] Devices shows Online for units that reported in the last 20 seconds, and "last seen …" or "never seen" for the rest.
- [ ] Save a user or device edit that the server rejects. ✅ The error shows inside the edit panel, not a browser popup.
- [ ] Reset or delete a demo unit. ✅ The app's own confirmation dialog appears.
- [ ] Create and start a new demo unit. ✅ Within about 10 seconds its owner's dashboard shows it LIVE. It begins with live readings; it does not seed 14 days of history.
- [ ] Start an existing demo unit that has been paused for at least 30 minutes. ✅ It resumes its cumulative meter and fills the existing gap in 15-minute steps, capped at 14 days. Previously recorded history remains intact.
- [ ] Pause a running demo unit and restart it within one minute. ✅ Its next reading starts a fresh four-hour run, with its cumulative meter and previous history preserved.
- [ ] Turn a running demo unit off from the owner's dashboard. ✅ Its watts drop to 0 and its kWh stops growing.
- [ ] A demo unit started more than 4 hours ago shows Paused. ✅ It pauses itself so it cannot run all day unattended.
- [ ] Start that automatically paused unit again. ✅ It remains Running over multiple simulator ticks, returns to LIVE, and receives a fresh four-hour run instead of immediately pausing again. Its previous meter value and history are preserved.

## 13. Security spot checks

- [ ] As a regular user, open `/admin` and `/manager`. ✅ You are redirected away.
- [ ] As a tenant, check the dashboard, reports, and analytics. ✅ Only the assigned unit's data appears.

## 14. Hardware acceptance

From `wattwise_hardware/docs/panelist-feature-and-hardware-hardening-plan.md`. These have not yet been recorded as run on physical units.

- [ ] Clean provisioning through the `WattWise-Setup` Wi-Fi portal. ✅ The serial monitor shows the MAC and "MAC registration verified".
- [ ] Hold BOOT for 5 seconds. ✅ Wi-Fi settings clear and the setup portal returns.
- [ ] Wi-Fi outage, then recovery. ✅ Readings resume, and failed batches are retried.
- [ ] Meter reset (cumulative `energy_kwh` drops). ✅ No negative usage or cost in the app.
- [ ] A unit whose MAC is not registered. ✅ Posts are rejected and nothing appears in `energy_logs`.
- [ ] On boot with no connection, the relay stays OFF until the first successful cloud read.

## Reporting a problem

Note the section and item, the account type (owner, tenant, manager, or admin), the device and browser, what you did, and what you saw. A screenshot helps.
