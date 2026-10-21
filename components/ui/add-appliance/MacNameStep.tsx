import { QrCode } from "lucide-react";
import type { FieldErrors } from "@/components/ui/add-appliance/useApplianceOnboarding";

export default function MacNameStep({
  macAddress,
  deviceName,
  fieldErrors,
  disabled,
  onMacAddressChange,
  onDeviceNameChange,
  onFieldBlur,
  onOpenScanner,
}: {
  macAddress: string;
  deviceName: string;
  fieldErrors: FieldErrors;
  disabled: boolean;
  onMacAddressChange: (value: string) => void;
  onDeviceNameChange: (value: string) => void;
  onFieldBlur: (field: "macAddress" | "deviceName") => void;
  onOpenScanner: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="appliance-mac-address"
          className="text-[11px] font-semibold uppercase tracking-wider text-white/60"
        >
          MAC Address
        </label>
        <div className="flex gap-2">
          <input
            id="appliance-mac-address"
            value={macAddress}
            disabled={disabled}
            onChange={(event) => onMacAddressChange(event.target.value)}
            onBlur={() => onFieldBlur("macAddress")}
            placeholder="E0:72:A1:D5:0B:68"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(fieldErrors.macAddress)}
            aria-describedby="appliance-mac-address-message"
            className={`flex-1 rounded-xl border bg-white/[0.03] px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
              fieldErrors.macAddress
                ? "border-danger/40 focus:border-danger focus:ring-danger/30"
                : "border-white/10 focus:border-mint focus:ring-mint/30"
            }`}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={onOpenScanner}
            className="flex min-h-10 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-mint/40 hover:bg-mint/5 hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
            title="Scan QR Code"
            aria-label="Scan QR code"
          >
            <QrCode className="h-4 w-4" />
          </button>
        </div>
        <p
          id="appliance-mac-address-message"
          className={`text-[11px] leading-snug ${
            fieldErrors.macAddress ? "text-danger" : "text-white/50"
          }`}
        >
          {fieldErrors.macAddress ??
            "Find this on the device label, or use the QR scanner."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="appliance-device-name"
          className="text-[11px] font-semibold uppercase tracking-wider text-white/60"
        >
          Appliance Name
        </label>
        <input
          id="appliance-device-name"
          value={deviceName}
          disabled={disabled}
          onChange={(event) => onDeviceNameChange(event.target.value)}
          onBlur={() => onFieldBlur("deviceName")}
          placeholder="e.g. Living Room Aircon"
          aria-invalid={Boolean(fieldErrors.deviceName)}
          aria-describedby="appliance-device-name-message"
          className={`rounded-xl border bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
            fieldErrors.deviceName
              ? "border-danger/40 focus:border-danger focus:ring-danger/30"
              : "border-white/10 focus:border-mint focus:ring-mint/30"
          }`}
        />
        <p
          id="appliance-device-name-message"
          className={`text-[11px] leading-snug ${
            fieldErrors.deviceName ? "text-danger" : "text-white/50"
          }`}
        >
          {fieldErrors.deviceName ??
            "Use a name you will recognize on the dashboard."}
        </p>
      </div>
    </>
  );
}
