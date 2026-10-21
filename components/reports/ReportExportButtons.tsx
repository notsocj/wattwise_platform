"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

type ExportFormat = "pdf" | "csv";

// Downloads through fetch so a failed export shows an inline message instead
// of navigating the browser to a raw JSON error page.
export default function ReportExportButtons({ period }: { period: string }) {
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: ExportFormat) {
    setPendingFormat(format);
    setError(null);
    try {
      const response = await fetch(`/api/reports?period=${period}&format=${format}`);
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Your session expired. Log in again to download reports."
            : "We couldn't prepare that report. Try again in a moment."
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wattwise-${period}-report.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error while downloading. Check your connection and retry.");
    } finally {
      setPendingFormat(null);
    }
  }

  const buttons: Array<{ format: ExportFormat; label: string; className: string }> = [
    { format: "pdf", label: "Download PDF", className: "bg-mint text-ink hover:bg-mint/90" },
    { format: "csv", label: "Download CSV", className: "border border-white/10 text-white hover:bg-white/5" },
  ];

  return (
    <div className="mb-6 print:hidden">
      <div className="grid grid-cols-2 gap-3">
        {buttons.map(({ format, label, className }) => (
          <button
            key={format}
            type="button"
            onClick={() => void download(format)}
            disabled={pendingFormat !== null}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
          >
            {pendingFormat === format ? (
              <LoadingIndicator size="sm" label={`Preparing ${format.toUpperCase()}`} showLabel={false} />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {pendingFormat === format ? "Preparing..." : label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
