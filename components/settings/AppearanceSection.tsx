import ThemeToggle from "@/components/ui/ThemeToggle";

export default function AppearanceSection() {
  return (
    <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Appearance
          </h2>
          <p className="mt-1 text-xs text-fg/45">
            Theme is stored on this device and applied globally.
          </p>
        </div>
        <ThemeToggle />
      </div>
    </section>
  );
}
