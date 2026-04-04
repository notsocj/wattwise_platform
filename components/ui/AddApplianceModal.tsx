"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { X, QrCode, Loader2, AlertCircle, ArrowLeft, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AddApplianceModalProps {
  onClose: () => void;
  onSuccess: (deviceName: string) => void;
}

// Accepts colon-separated (E0:72:A1:D5:0B:68) or hyphen-separated formats
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/;
const MAC_IN_TEXT = /([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/;

// ─── QR Scanner view (mounts/unmounts html5-qrcode on demand) ─────────────────
function QrScannerView({
  onScan,
  onCancel,
}: {
  onScan: (mac: string) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  // Stable ref so the scanner callback never holds a stale closure
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stopped = false;

    async function startScanner() {
      // Dynamic import — html5-qrcode accesses browser globals at module level
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped || !containerRef.current) return;

      const qr = new Html5Qrcode("ww-qr-box");
      scannerRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            const match = decodedText.match(MAC_IN_TEXT);
            if (match) {
              qr.stop().catch(() => {});
              onScanRef.current(match[0].toUpperCase());
            }
          },
          undefined
        );
        if (!stopped) setIsStarting(false);
      } catch (err) {
        if (!stopped) {
          setCameraError(
            err instanceof Error
              ? err.message
              : "Camera access denied. Please allow camera permissions."
          );
          setIsStarting(false);
        }
      }
    }

    startScanner();

    return () => {
      stopped = true;
      const qrInstance = scannerRef.current;
      scannerRef.current = null;
      if (qrInstance) {
        qrInstance
          .stop()
          .catch(() => {})
          .finally(() => {
            qrInstance.clear();
          });
      }
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* Scanner header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">
            Scan QR Code
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Point camera at the device QR label
          </p>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="px-5 pt-5 pb-5">
        {cameraError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <Camera className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-600 font-medium">{cameraError}</p>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-semibold text-gray-600 underline"
            >
              Enter MAC manually instead
            </button>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-black">
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10 aspect-square">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
            {/* html5-qrcode mounts its <video> element here */}
            <div
              id="ww-qr-box"
              ref={containerRef}
              className="w-full aspect-square"
            />
            {/* Viewfinder corner brackets */}
            {!isStarting && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-55 h-55 border-2 border-mint rounded-lg opacity-80" />
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] text-center text-gray-400 mt-3">
          MAC address will be filled in automatically when detected
        </p>
      </div>
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────────
export default function AddApplianceModal({ onClose, onSuccess }: AddApplianceModalProps) {
  const [macAddress, setMacAddress] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleScan = useCallback((mac: string) => {
    setMacAddress(mac);
    setShowScanner(false);
    setError(null);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedMac = macAddress.trim().toUpperCase();
    const trimmedName = deviceName.trim();

    if (!MAC_REGEX.test(trimmedMac)) {
      setError("Invalid MAC address. Expected format: E0:72:A1:D5:0B:68");
      return;
    }

    if (!trimmedName) {
      setError("Please enter a name for your appliance.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Authentication error. Please log in again.");
        return;
      }

      const { error: insertError } = await supabase.from("devices").insert({
        user_id: user.id,
        mac_address: trimmedMac,
        device_name: trimmedName,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          setError("This MAC address is already registered to a device.");
        } else {
          setError(insertError.message);
        }
        return;
      }

      onSuccess(trimmedName);
    });
  }

  return (
    // pb-20 keeps the card clear of the ~64px bottom nav bar
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pt-4 pb-20 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-107.5 rounded-2xl bg-white overflow-hidden shadow-2xl">
        {showScanner ? (
          <QrScannerView onScan={handleScan} onCancel={() => setShowScanner(false)} />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                  Add New Appliance
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Enter your device details to claim it
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              {/* MAC Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                  MAC Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={macAddress}
                    onChange={(e) => setMacAddress(e.target.value)}
                    placeholder="E0:72:A1:D5:0B:68"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isPending}
                    className="flex-1 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-300 font-mono focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/30 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    disabled={isPending}
                    title="Scan QR Code"
                    className="w-12 shrink-0 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-mint hover:border-mint/40 hover:bg-mint/5 transition-colors disabled:opacity-50"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Device Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                  Appliance Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Living Room Aircon"
                  disabled={isPending}
                  className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/30 transition-colors disabled:opacity-50"
                />
              </div>

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 leading-snug">{error}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !macAddress.trim() || !deviceName.trim()}
                  className="flex-1 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-base hover:bg-mint/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    "Claim Device"
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
