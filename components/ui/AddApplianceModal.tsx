"use client";

import { AlertCircle, X } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import MacQrScanner from "@/components/ui/MacQrScanner";
import ApplianceTypeStep from "@/components/ui/add-appliance/ApplianceTypeStep";
import BudgetLimitStep from "@/components/ui/add-appliance/BudgetLimitStep";
import MacNameStep from "@/components/ui/add-appliance/MacNameStep";
import ProfilingStep from "@/components/ui/add-appliance/ProfilingStep";
import { useApplianceOnboarding } from "@/components/ui/add-appliance/useApplianceOnboarding";

interface AddApplianceModalProps {
  onClose: () => void;
  onSuccess: (deviceName: string) => void;
}

const stepLabels = ["Device", "Type", "Live", "Approve"];

export default function AddApplianceModal({
  onClose,
  onSuccess,
}: AddApplianceModalProps) {
  const {
    step,
    macAddress,
    deviceName,
    applianceType,
    dailyHours,
    approvedLimit,
    profile,
    showScanner,
    setShowScanner,
    fieldErrors,
    error,
    isBusy,
    isSavingDevice,
    isProfiling,
    isSavingProfile,
    updateMacAddress,
    updateDeviceName,
    revalidateStep1Field,
    applyScannedMac,
    selectApplianceType,
    updateDailyHours,
    updateApprovedLimit,
    goBack,
    handleCloseModal,
    handleSubmit,
  } = useApplianceOnboarding({ onClose, onSuccess });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-20 pt-4 backdrop-blur-sm"
      onClick={(event) => {
        if (
          !isSavingDevice &&
          !isSavingProfile &&
          event.target === event.currentTarget
        ) {
          handleCloseModal();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={showScanner ? undefined : "add-appliance-modal-title"}
        aria-label={showScanner ? "Scan device QR code" : undefined}
        className="max-h-[85vh] w-full max-w-107.5 overflow-hidden overflow-y-auto rounded-2xl border border-white/10 bg-surface shadow-2xl"
      >
        {showScanner ? (
          <MacQrScanner
            onScan={applyScannedMac}
            onCancel={() => setShowScanner(false)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-5 pb-3 pt-5">
              <div>
                <h2
                  id="add-appliance-modal-title"
                  className="text-sm font-bold tracking-tight text-white"
                >
                  {step === 1 && "Add New Appliance"}
                  {step === 2 && "Choose Appliance Type"}
                  {step === 3 && "Live AI Profiling"}
                  {step === 4 && "Approve Budget Limit"}
                </h2>
                <p className="mt-0.5 text-[11px] text-white/50">
                  Step {step} of 4
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSavingDevice || isSavingProfile}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 px-5 pt-3">
              {stepLabels.map((label, index) => (
                <div key={label} className="flex-1">
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      index + 1 <= step ? "bg-mint" : "bg-white/10"
                    }`}
                  />
                  <p
                    className={`mt-1 text-center text-[10px] font-medium ${
                      index + 1 <= step ? "text-white/80" : "text-white/50"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5" noValidate>
              {step === 1 ? (
                <MacNameStep
                  macAddress={macAddress}
                  deviceName={deviceName}
                  fieldErrors={fieldErrors}
                  disabled={isBusy}
                  onMacAddressChange={updateMacAddress}
                  onDeviceNameChange={updateDeviceName}
                  onFieldBlur={revalidateStep1Field}
                  onOpenScanner={() => setShowScanner(true)}
                />
              ) : null}

              {step === 2 ? (
                <ApplianceTypeStep
                  selectedType={applianceType}
                  errorMessage={fieldErrors.applianceType}
                  disabled={isBusy}
                  onSelect={selectApplianceType}
                />
              ) : null}

              {step === 3 ? (
                <ProfilingStep
                  dailyHours={dailyHours}
                  disabled={isBusy}
                  onDailyHoursChange={updateDailyHours}
                />
              ) : null}

              {step === 4 && profile ? (
                <BudgetLimitStep
                  profile={profile}
                  approvedLimit={approvedLimit}
                  errorMessage={fieldErrors.approvedLimit}
                  disabled={isBusy}
                  onApprovedLimitChange={updateApprovedLimit}
                />
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <p className="text-sm leading-snug text-danger">{error}</p>
                </div>
              ) : null}

              <div className="flex gap-3 pt-1">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={isBusy}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isBusy}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-ink transition-all hover:bg-mint/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isBusy ? (
                    <>
                      <LoadingIndicator
                        size="sm"
                        label="Working"
                        showLabel={false}
                        spinnerClassName="border-black/30 border-t-black"
                      />
                      {isSavingDevice && "Registering..."}
                      {isProfiling && "Waiting for live data..."}
                      {isSavingProfile && "Saving..."}
                    </>
                  ) : step === 1 ? (
                    "Next"
                  ) : step === 2 ? (
                    "Register Device"
                  ) : step === 3 ? (
                    "Profile Live Reading"
                  ) : (
                    "Save Appliance"
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

    </div>
  );
}
