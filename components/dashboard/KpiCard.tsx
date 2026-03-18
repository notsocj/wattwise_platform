type KpiCardProps = {
  label: string;
  value: string;
  description: string;
};

export function KpiCard({ label, value, description }: KpiCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-[var(--color-line)] bg-[color:var(--color-panel)] p-6 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {description}
      </p>
    </article>
  );
}
