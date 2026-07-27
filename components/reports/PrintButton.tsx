"use client";

export default function PrintButton() {
  return <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold" onClick={() => window.print()}>Print / PDF</button>;
}
