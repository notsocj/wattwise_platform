"use client";

import { useState, useEffect } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import AddApplianceModal from "@/components/ui/AddApplianceModal";

export default function AddApplianceTile() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleSuccess(deviceName: string) {
    setIsOpen(false);
    setSuccessMessage(`"${deviceName}" added to your fleet!`);
    router.refresh();
  }

  // Auto-dismiss toast after 3.5 s
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  return (
    <>
      {/* Dashed "Add Appliance" tile */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-xl border border-dashed border-white/10 p-4 flex flex-col items-center justify-center min-h-32.5 text-white/30 hover:text-white/50 hover:border-white/20 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl border border-dashed border-current flex items-center justify-center mb-2">
          <Plus className="w-5 h-5" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider">
          Add Appliance
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <AddApplianceModal
          onClose={() => setIsOpen(false)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Success toast — sits above the bottom nav (bottom-24 = 96px) */}
      {successMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl bg-bida/15 border border-bida/30 backdrop-blur-sm px-4 py-3 shadow-lg w-[calc(100%-2rem)] max-w-97.5">
          <CheckCircle2 className="w-4 h-4 text-bida shrink-0" />
          <p className="text-sm font-semibold text-bida">{successMessage}</p>
        </div>
      )}
    </>
  );
}
