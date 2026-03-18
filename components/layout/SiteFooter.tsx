export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-line)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>Wattwise Platform foundation scaffold.</p>
        <p>Built for monitoring, billing insight, and hardware control flows.</p>
      </div>
    </footer>
  );
}
