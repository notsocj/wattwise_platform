import { Zap } from "lucide-react";

export default function ProfilingStep({
  dailyHours,
  disabled,
  onDailyHoursChange,
}: {
  dailyHours: number;
  disabled: boolean;
  onDailyHoursChange: (hours: number) => void;
}) {
  return (
    <>
      <div className="rounded-xl border border-mint/20 bg-mint/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-bida" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-bida">
            Device Registered
          </span>
        </div>
        <p className="text-sm leading-relaxed text-white/80">
          Registration is saved so the hardware can upload securely. Keep the
          WattWise unit and appliance powered on while we wait for its live reading.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Estimated Daily Hours
          </span>
          <span className="text-lg font-bold text-white">{dailyHours}h</span>
        </div>
        <input
          type="range"
          min={1}
          max={24}
          step={1}
          value={dailyHours}
          disabled={disabled}
          onChange={(event) => onDailyHoursChange(Number(event.target.value))}
          className="w-full accent-mint disabled:opacity-50"
        />
        <div className="flex justify-between text-[10px] text-white/50">
          <span>1h</span>
          <span>12h</span>
          <span>24h</span>
        </div>
        <p className="text-[11px] leading-snug text-white/50">
          Use the normal daily runtime for this appliance so the AI estimate feels realistic.
        </p>
      </div>
    </>
  );
}
