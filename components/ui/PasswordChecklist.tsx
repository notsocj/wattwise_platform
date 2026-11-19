import { Check } from "@/components/ui/icons";
import { PASSWORD_RULES } from "@/lib/password-policy";

/** Live list of the password rules under a new-password field; each turns mint once met. */
export default function PasswordChecklist({ password, id }: { password: string; id?: string }) {
  return (
    <ul id={id} className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={`flex items-center gap-2 transition-colors duration-150 ${met ? "text-accent" : "text-fg/50"}`}>
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                met ? "border-mint bg-mint text-ink" : "border-fg/25"
              }`}
            >
              {met ? <Check className="h-3 w-3" /> : null}
            </span>
            {rule.label}
            <span className="sr-only">{met ? "(met)" : "(not met yet)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
