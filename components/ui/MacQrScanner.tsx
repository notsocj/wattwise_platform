"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { MAC_REGEX, normalizeMac } from "@/lib/mac-address";

function getCameraErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "The camera only works on a secure (https) connection. Enter the MAC address manually instead.";
  }

  const text = `${err instanceof Error ? err.name : ""} ${err instanceof Error ? err.message : String(err ?? "")}`.toLowerCase();
  if (text.includes("notallowed") || text.includes("permission") || text.includes("denied")) {
    return "Camera access is blocked. Allow camera access for WattWise in your browser settings, or enter the MAC address manually.";
  }
  if (text.includes("notfound") || text.includes("no camera") || text.includes("requested device not found")) {
    return "No camera was found on this device. Enter the MAC address manually instead.";
  }
  if (text.includes("notreadable") || text.includes("in use") || text.includes("could not start")) {
    return "The camera is being used by another app. Close it and try again, or enter the MAC address manually.";
  }
  return "We couldn't start the camera. Enter the MAC address manually instead.";
}

type MacQrScannerProps = {
  onScan: (mac: string) => void;
  onCancel: () => void;
};

export default function MacQrScanner({
  onScan,
  onCancel,
}: MacQrScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [sawUnrecognizedCode, setSawUnrecognizedCode] = useState(false);
  const onScanRef = useRef(onScan);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stopped = false;
    let stopInFlight: Promise<void> | null = null;

    async function stopScanner(
      qr: import("html5-qrcode").Html5Qrcode,
      scannerState?: typeof import("html5-qrcode").Html5QrcodeScannerState
    ) {
      if (stopInFlight) {
        return stopInFlight;
      }

      stopInFlight = (async () => {
        try {
          const state = qr.getState();
          const canStop =
            !scannerState ||
            (state === scannerState.SCANNING || state === scannerState.PAUSED);

          if (canStop) {
            await qr.stop();
          }
        } catch {
          // html5-qrcode throws when stop is called after scan success/unmount races.
        } finally {
          try {
            qr.clear();
          } catch {
            // Best effort cleanup; the scanner DOM may already be gone.
          }
        }
      })();

      return stopInFlight;
    }

    async function startScanner() {
      const { Html5Qrcode, Html5QrcodeScannerState } = await import("html5-qrcode");
      if (stopped) return;

      const qr = new Html5Qrcode("ww-qr-box");
      scannerRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (hasScannedRef.current) {
              return;
            }

            const normalizedMac = normalizeMac(decodedText);
            if (MAC_REGEX.test(normalizedMac)) {
              hasScannedRef.current = true;
              stopped = true;
              void stopScanner(qr, Html5QrcodeScannerState);
              onScanRef.current(normalizedMac);
            } else {
              setSawUnrecognizedCode(true);
            }
          },
          undefined
        );

        if (!stopped) {
          setIsStarting(false);
        }
      } catch (err) {
        if (!stopped) {
          setCameraError(getCameraErrorMessage(err));
          setIsStarting(false);
        }
      }
    }

    void startScanner();

    return () => {
      stopped = true;
      const qrInstance = scannerRef.current;
      scannerRef.current = null;
      if (qrInstance) {
        void stopScanner(qrInstance);
      }
    };
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 pb-4 pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 transition-colors hover:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white">
            Scan QR Code
          </h2>
          <p className="mt-0.5 text-[11px] text-white/50">
            Point camera at the device QR label
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 pt-5">
        {cameraError ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-naku/30 bg-naku/10 p-6 text-center">
            <Camera className="h-8 w-8 text-naku" />
            <p className="text-sm font-medium text-white/80">{cameraError}</p>
            <button
              type="button"
              onClick={onCancel}
              className="min-h-10 text-sm font-semibold text-mint underline"
            >
              Enter MAC manually instead
            </button>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-black">
            {isStarting ? (
              <div className="absolute inset-0 z-10 flex aspect-square items-center justify-center bg-surface">
                <LoadingIndicator size="md" label="Starting camera" />
              </div>
            ) : null}
            <div id="ww-qr-box" className="aspect-square w-full" />
            {!isStarting ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-55 w-55 rounded-lg border-2 border-mint opacity-80" />
              </div>
            ) : null}
          </div>
        )}
        <p aria-live="polite" className={`mt-3 text-center text-[11px] ${sawUnrecognizedCode ? "text-naku" : "text-white/50"}`}>
          {sawUnrecognizedCode
            ? "That QR code isn't a WattWise label. Scan the label on the device itself."
            : "MAC address will be filled in automatically when detected."}
        </p>
      </div>
    </div>
  );
}
