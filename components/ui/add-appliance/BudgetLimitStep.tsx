import { Zap } from "lucide-react";
import type { AiProfile } from "@/components/ui/add-appliance/useApplianceOnboarding";

export default function BudgetLimitStep({
  profile,
  approvedLimit,
  errorMessage,
  disabled,
  onApprovedLimitChange,
}: {
  profile: AiProfile;
  approvedLimit: string;
  errorMessage: string | undefined;
  disabled: boolean;
  onApprovedLimitChange: (value: string) => void;
}) {
  return (
    <>
      <div className="rounded-xl border border-bida/30 bg-bida/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-bida" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-bida">
            AI Recommendation
          </span>
        </div>
        <p className="text-sm leading-relaxed text-white/80">
          {profile.taglish_advice}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] font-semibold uppercase text-white/50">
            Live W
          </p>
          <p className="mt-0.5 text-base font-bold text-white">
            {profile.baseline_watts.toFixed(0)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] font-semibold uppercase text-white/50">
            Est. kWh
          </p>
          <p className="mt-0.5 text-base font-bold text-white">
            {profile.estimated_monthly_kwh.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase text-mint">
            Suggested
          </p>
          <p className="mt-0.5 text-base font-bold text-mint">
            ₱{profile.suggested_monthly_limit_php.toLocaleString("en-PH")}
          </p>
        </div>
      </div>

      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-snug text-white/60">
        Estimated variable monthly spend: ₱
        {profile.estimated_monthly_cost_php.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="approved-limit"
          className="text-[11px] font-semibold uppercase tracking-wider text-white/60"
        >
          Approved Monthly Limit (PHP)
        </label>
        <input
          id="approved-limit"
          type="text"
          inputMode="decimal"
          value={approvedLimit}
          disabled={disabled}
          onChange={(event) => onApprovedLimitChange(event.target.value)}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby="approved-limit-message"
          className={`rounded-xl border bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
            errorMessage
              ? "border-danger/40 focus:border-danger focus:ring-danger/30"
              : "border-white/10 focus:border-mint focus:ring-mint/30"
          }`}
        />
        <p
          id="approved-limit-message"
          className={`text-[11px] leading-snug ${
            errorMessage ? "text-danger" : "text-white/50"
          }`}
        >
          {errorMessage ??
            "This per-appliance variable spend limit powers auto shutoff."}
        </p>
      </div>
    </>
  );
}
