export default function DashboardCalendarLoading() {
  return (
    <div className="min-h-screen bg-base px-5 pt-[92px] text-white">
      <div className="animate-pulse space-y-4">
        <div className="rounded-xl border border-white/[0.06] bg-surface p-5">
          <div className="h-3 w-28 rounded bg-white/[0.08]" />
          <div className="mt-3 h-6 w-44 rounded bg-white/[0.10]" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="h-20 rounded-xl bg-white/[0.06]" />
            <div className="h-20 rounded-xl bg-white/[0.06]" />
          </div>
        </div>
        <div className="h-12 rounded-xl bg-white/[0.06]" />
        <div className="rounded-xl border border-white/[0.06] bg-surface p-4">
          <div className="mb-3 grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={`label-${index}`} className="h-3 rounded bg-white/[0.06]" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, colIndex) => (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="h-24 rounded-xl bg-white/[0.05]"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
