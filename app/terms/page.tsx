import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "The terms for using the WattWise app and WattWise units.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      intro={
        <p>
          These terms apply when you use the WattWise app and WattWise units. By creating an account, you agree to them
          and to our <Link href="/privacy" className="font-semibold text-accent hover:underline">Privacy Policy</Link>.
        </p>
      }
      other={{ href: "/privacy", label: "Privacy Policy" }}
    >
      <section>
        <h2>1. Your account</h2>
        <ul>
          <li>Give accurate details, keep your password private, and tell us if you think someone else used your account.</li>
          <li>You are responsible for what happens under your account, including changes you confirm in the AI assistant.</li>
          <li>
            You must be 18 or older, or have a parent or guardian create and manage the account. Landlords who create
            tenant accounts must have the tenant&apos;s permission and share these terms with them.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Costs are estimates</h2>
        <p>
          WattWise estimates costs from your unit&apos;s readings and Meralco&apos;s published rates. Your official bill
          comes from Meralco and can differ, for example because of other appliances, meter differences, rate changes,
          or missing readings while a unit was offline. Do not rely on WattWise in place of your Meralco bill.
        </p>
      </section>

      <section>
        <h2>3. Automatic shut-off and scheduled turn-offs</h2>
        <p>
          WattWise can cut power to an appliance when its budget runs out (if you turn automatic shut-off on) or at a
          time or limit you confirmed. You choose which appliances to connect and which rules to set.
        </p>
        <ul>
          <li>
            <strong>Never connect</strong> medical or life-support equipment, or anything that must stay powered for
            safety (for example a refrigerator storing medicine), to a WattWise unit with shut-off or scheduled
            turn-offs enabled.
          </li>
          <li>
            Commands are delivered on the unit&apos;s next check-in, usually within seconds, and depend on its Wi-Fi
            connection. A unit that is offline will not receive them on time.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Using WattWise units safely</h2>
        <ul>
          <li>Use a unit only within its rated voltage and current, indoors, and away from water.</li>
          <li>Do not open, modify, or repair a unit, and stop using one that is damaged, hot, or smells of burning.</li>
          <li>Connect only one appliance per unit, and only appliances you are allowed to control.</li>
        </ul>
      </section>

      <section>
        <h2>5. The AI assistant</h2>
        <p>
          The assistant and AI insights can be wrong. Check important numbers in the app. The assistant only prepares
          changes; nothing happens until you confirm. Do not use it for anything unrelated to WattWise, and do not try to
          make it ignore its rules.
        </p>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>Do not:</p>
        <ul>
          <li>access accounts, devices, or data that are not yours;</li>
          <li>send fake readings, tamper with units, or interfere with the service;</li>
          <li>scrape, overload, or reverse-engineer WattWise, or get around its limits;</li>
          <li>use WattWise for anything illegal.</li>
        </ul>
        <p>We may suspend or close accounts that break these rules.</p>
      </section>

      <section>
        <h2>7. Availability and changes</h2>
        <p>
          We work to keep WattWise running but cannot promise it will always be available or error-free. We may change or
          stop features. If we change these terms in a way that matters, we will tell you in the app or by email before
          the change takes effect; continuing to use WattWise afterwards means you accept the new terms.
        </p>
      </section>

      <section>
        <h2>8. Limitation of liability</h2>
        <p>
          To the extent the law allows, WattWise is provided &quot;as is&quot;, and we are not liable for indirect
          losses, such as spoiled food, lost data, or bills higher than estimated, that come from using or being unable
          to use WattWise. Nothing in these terms limits rights you have under Philippine consumer law.
        </p>
      </section>

      <section>
        <h2>9. Ending your account</h2>
        <p>
          You can delete your account at any time in Settings. What happens to your data is described in the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>10. Governing law and contact</h2>
        <p>
          These terms are governed by the laws of the Republic of the Philippines. Questions or complaints:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
