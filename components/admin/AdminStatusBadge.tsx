import type { ReactNode } from "react";

type AdminStatusBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "info";

const toneStyles: Record<AdminStatusBadgeTone, string> = {
  success: "border-mint/25 bg-mint/10 text-mint",
  warning: "border-naku/25 bg-naku/10 text-naku",
  danger: "border-danger/25 bg-danger/10 text-danger",
  neutral: "border-white/10 bg-white/[0.04] text-white/60",
  info: "border-white/10 bg-white/[0.06] text-white/70",
};

interface AdminStatusBadgeProps {
  children: ReactNode;
  tone: AdminStatusBadgeTone;
}

export default function AdminStatusBadge({
  children,
  tone,
}: AdminStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${toneStyles[tone]}`}
    >
      {children}
    </span>
  );
}
