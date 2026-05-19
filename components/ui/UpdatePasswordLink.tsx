"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";

type UpdatePasswordLinkProps = {
  className?: string;
  label?: string;
};

export default function UpdatePasswordLink({
  className,
  label = "Update Password",
}: UpdatePasswordLinkProps) {
  return (
    <Link
      href="/update-password"
      aria-label={label}
      title={label}
      className={
        className ??
        "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/70 transition-colors hover:border-white/20 hover:text-white"
      }
    >
      <KeyRound className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
