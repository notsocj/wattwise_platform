import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What WattWise collects, why, who processes it, and your rights under the Philippine Data Privacy Act.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          WattWise helps Philippine households see what each appliance costs. This policy explains what we collect to do
          that, why, who helps us process it, and the rights you have under the Data Privacy Act of 2012 (Republic Act
          No. 10173).
        </p>
      }
      other={{ href: "/terms", label: "Terms and Conditions" }}
    >
      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> your email address, a password (stored only as a secure hash by our
            authentication provider), your home or property name, and your account type (household, landlord, or
            tenant).
          </li>
          <li>
            <strong>Device and energy data:</strong> each WattWise unit&apos;s hardware ID (MAC address), the appliance
            name you give it, and its readings every few seconds: watts, volts, amps, energy used (kWh), and whether
            its power is on or off.
          </li>
          <li>
            <strong>Your settings:</strong> budgets and limits, automatic shut-off choices, scheduled turn-offs, your
            billing cycle day, your household&apos;s monthly kWh, and notification preferences.
          </li>
          <li>
            <strong>Notifications:</strong> a push-notification ID for each browser or phone you enable, and a record
            of the alerts we send.
          </li>
          <li>
            <strong>AI assistant:</strong> the messages you send the in-app assistant and its replies (we keep your
            latest 10), and the AI insights generated for you.
          </li>
          <li>
            <strong>Landing-page chat:</strong> what you type is used only to answer you and is not stored. To stop
            abuse we keep a one-way scrambled form of your IP address (never the address itself) with the time of each
            message, for up to 24 hours.
          </li>
          <li>
            <strong>On your device:</strong> sign-in cookies that keep you logged in, and your light or dark theme
            choice in your browser&apos;s storage. We do not use advertising or tracking cookies.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Why we use it</h2>
        <ul>
          <li>To run your account and show your live usage, costs, analytics, calendar, and reports.</li>
          <li>To price your usage with Meralco&apos;s published rates and apply your budgets.</li>
          <li>
            To turn an appliance off when you asked us to: when its budget runs out with automatic shut-off on, or on a
            scheduled turn-off you confirmed.
          </li>
          <li>To send the budget alerts and emails you turned on.</li>
          <li>To answer your questions through the AI assistant and write energy-saving tips.</li>
          <li>To keep WattWise secure, prevent abuse, and fix problems.</li>
        </ul>
        <p>
          We process your data because you agreed to it when creating your account, because we need it to provide the
          service you asked for, and, for security and abuse prevention, because of our legitimate interest in keeping
          WattWise safe. We do not sell your personal data or use it for advertising.
        </p>
      </section>

      <section>
        <h2>3. Who helps us process it</h2>
        <p>We share data only with the services that run WattWise, and only what each one needs:</p>
        <ul>
          <li>
            <strong>Supabase</strong> stores your account and energy data (servers in Seoul, South Korea).
          </li>
          <li>
            <strong>Vercel</strong> hosts the app (servers in Seoul, South Korea).
          </li>
          <li>
            <strong>OpenAI</strong> writes AI assistant replies and insights. It receives your message and a summary of
            your devices, usage, and budgets, but not your password.
          </li>
          <li>
            <strong>OneSignal</strong> delivers push notifications, and <strong>Resend</strong> delivers emails.
          </li>
        </ul>
        <p>
          Some of these providers process data outside the Philippines. We use providers that protect it with security
          measures comparable to those the Data Privacy Act requires. Landlords using Manager mode can see the usage of
          units assigned to their tenants&apos; rooms, and tenants can see the units assigned to them. We may also
          disclose data when the law requires it.
        </p>
      </section>

      <section>
        <h2>4. How long we keep it</h2>
        <p>
          We keep your data while your account is active. You can delete your account any time in Settings → Danger
          zone. That removes your login, profile, devices, settings, saved insights, and assistant history. Meter
          readings are stored under your unit&apos;s hardware ID. Once your account is deleted they are no longer linked
          to you, and you can email us to have them erased too.
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul>
          <li>be informed about how your data is processed;</li>
          <li>access your data and get a copy of it;</li>
          <li>correct inaccurate data;</li>
          <li>object to processing, or withdraw your consent;</li>
          <li>have your data erased or blocked;</li>
          <li>file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
        </ul>
        <p>
          You can view and change most of your data in the app. For anything else, email{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. We will reply within 15 days. Withdrawing
          consent may mean we can no longer provide the service.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          Data travels over encrypted connections (HTTPS). Database access is limited per account by row-level security,
          passwords are hashed, and AI and admin tools run only on our servers. No system is perfectly secure. If a
          breach affects your personal data, we will notify you and the National Privacy Commission as the law
          requires.
        </p>
      </section>

      <section>
        <h2>7. Children</h2>
        <p>
          WattWise is meant for adults managing a household&apos;s electricity. If you are under 18, ask a parent or
          guardian to create and manage the account.
        </p>
      </section>

      <section>
        <h2>8. Changes to this policy</h2>
        <p>
          If we change this policy in a way that matters, we will update the date above and tell you in the app or by
          email before the change takes effect. Read it together with our{" "}
          <Link href="/terms">Terms and Conditions</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
