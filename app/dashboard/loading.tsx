import LoadingIndicator, {
  LoadingSkeleton,
} from "@/components/ui/LoadingIndicator";

function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-surface p-5">
      <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-white/20" />
      <LoadingSkeleton className="mb-3 h-3 w-32 rounded" />
      <LoadingSkeleton className="h-12 w-52 rounded-lg" />
      <LoadingSkeleton className="mt-3 h-4 w-44 rounded" />
    </div>
  );
}

function DeviceCardSkeleton() {
  return (
    <div className="relative min-h-[130px] overflow-hidden rounded-xl border border-white/5 bg-surface p-4">
      <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-white/20" />
      <div className="flex items-start justify-between">
        <LoadingSkeleton className="h-8 w-8 rounded-lg" />
        <LoadingSkeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2">
        <LoadingSkeleton className="h-4 w-20 rounded" />
        <LoadingSkeleton className="h-3 w-12 rounded" />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-base text-white pb-24">
      <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <LoadingSkeleton className="h-6 w-32 rounded-md" />
          <LoadingIndicator size="sm" label="Loading dashboard" />
        </div>
      </header>

      <div className="px-5 pt-[84px] flex flex-col gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />

        <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-white/20" />
          <div className="mb-4 flex items-center justify-between">
            <LoadingSkeleton className="h-4 w-24 rounded" />
            <LoadingSkeleton className="h-3 w-20 rounded" />
          </div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <LoadingSkeleton className="h-4 w-20 rounded" />
            <LoadingSkeleton className="h-7 w-32 rounded" />
          </div>
          <LoadingSkeleton className="h-2.5 w-full rounded-full" />
          <LoadingSkeleton className="mt-3 h-3 w-4/5 rounded" />
          <LoadingSkeleton className="mt-2 h-3 w-2/3 rounded" />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-mint/20 bg-mint/10 px-4 py-3">
          <LoadingSkeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton className="h-3 w-20 rounded" />
            <LoadingSkeleton className="h-4 w-full rounded" />
          </div>
          <LoadingSkeleton className="h-4 w-4 rounded" />
        </div>

        <section className="mt-2">
          <LoadingSkeleton className="mb-3 h-3 w-28 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <DeviceCardSkeleton />
            <DeviceCardSkeleton />
            <DeviceCardSkeleton />
            <DeviceCardSkeleton />
          </div>
        </section>
      </div>
    </div>
  );
}
