"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import AddApplianceModal from "@/components/ui/AddApplianceModal";
import SuccessToast from "@/components/ui/SuccessToast";

export default function AddApplianceTile() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleSuccess(deviceName: string) {
    setIsOpen(false);
    setSuccessMessage(`"${deviceName}" added to your fleet!`);
    router.refresh();
  }

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

      <SuccessToast
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />
    </>
  );
}
