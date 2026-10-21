import { HelpCircle, Refrigerator, Tv, Wind } from "lucide-react";
import { ApplianceType } from "@/lib/constants";

const APPLIANCE_OPTIONS: {
  type: ApplianceType;
  label: string;
  icon: typeof Refrigerator;
}[] = [
  { type: ApplianceType.Refrigerator, label: "Fridge", icon: Refrigerator },
  { type: ApplianceType.Aircon, label: "Aircon", icon: Wind },
  { type: ApplianceType.Tv, label: "TV", icon: Tv },
  { type: ApplianceType.Other, label: "Other", icon: HelpCircle },
];

export default function ApplianceTypeStep({
  selectedType,
  errorMessage,
  disabled,
  onSelect,
}: {
  selectedType: ApplianceType | null;
  errorMessage: string | undefined;
  disabled: boolean;
  onSelect: (type: ApplianceType) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3" aria-describedby="appliance-type-message">
        {APPLIANCE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;
          return (
            <button
              key={option.type}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option.type)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "border-mint bg-mint/5"
                  : errorMessage
                    ? "border-danger/40 bg-danger/10 hover:border-danger/60"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <Icon className={`h-8 w-8 ${isSelected ? "text-mint" : "text-white/50"}`} />
              <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-white/60"}`}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      <p
        id="appliance-type-message"
        className={`text-[11px] leading-snug ${
          errorMessage ? "text-danger" : "text-white/50"
        }`}
      >
        {errorMessage ??
          "WattWise will register this MAC first, then use live telemetry for profiling."}
      </p>
    </>
  );
}
