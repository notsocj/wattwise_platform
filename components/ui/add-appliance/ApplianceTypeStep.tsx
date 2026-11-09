import { HelpCircle, Refrigerator, Tv, Wind } from "@/components/ui/icons";
import { ApplianceType } from "@/lib/constants";
import { APPLIANCE_DETAIL_MAX_LENGTH } from "@/lib/device-edit";

export const APPLIANCE_OPTIONS: {
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
  detail,
  detailError,
  onDetailChange,
}: {
  selectedType: ApplianceType | null;
  errorMessage: string | undefined;
  disabled: boolean;
  onSelect: (type: ApplianceType) => void;
  detail: string;
  detailError: string | undefined;
  onDetailChange: (value: string) => void;
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
                    : "border-fg/10 bg-fg/[0.03] hover:border-fg/20"
              }`}
            >
              <Icon className={`h-8 w-8 ${isSelected ? "text-accent" : "text-fg/50"}`} />
              <span className={`text-sm font-semibold ${isSelected ? "text-fg" : "text-fg/60"}`}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      {selectedType === ApplianceType.Other ? (
        <ApplianceDetailField value={detail} error={detailError} disabled={disabled} onChange={onDetailChange} />
      ) : null}
      <p
        id="appliance-type-message"
        className={`text-[11px] leading-snug ${
          errorMessage ? "text-danger" : "text-fg/50"
        }`}
      >
        {errorMessage ??
          "WattWise will register this MAC first, then use live telemetry for profiling."}
      </p>
    </>
  );
}

/** Free-text "what is it?" field shown when Other is picked; shared with the Device page settings. */
export function ApplianceDetailField({
  value,
  error,
  disabled,
  onChange,
  id = "appliance-detail",
}: {
  value: string;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-fg/60">
        What appliance is it?
      </label>
      <input
        id={id}
        value={value}
        maxLength={APPLIANCE_DETAIL_MAX_LENGTH}
        disabled={disabled}
        autoComplete="off"
        placeholder="e.g. Electric fan, Rice cooker, Water heater"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`h-12 w-full rounded-full border bg-shade/10 px-4 text-sm text-fg placeholder:text-fg/30 outline-none transition-colors duration-150 ease-out focus:border-mint/40 disabled:opacity-60 ${
          error ? "border-danger/50" : "border-fg/10"
        }`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
