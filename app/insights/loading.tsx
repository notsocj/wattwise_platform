import LoadingIndicator, {
  LoadingSkeleton,
  LoadingSkeletonText,
} from "@/components/ui/LoadingIndicator";

function LeaderboardRowSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-surface px-4 py-3.5">
      <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-white/20" />
      <div className="flex items-center gap-3">
        <LoadingSkeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="h-4 w-28 rounded" />
          <LoadingSkeleton className="h-3 w-24 rounded" />
        </div>
        <div className="space-y-2 text-right">
          <LoadingSkeleton className="h-4 w-14 rounded" />
          <LoadingSkeleton className="h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

function ApplianceRowSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-surface px-4 py-3">
      <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-white/20" />
      <div className="flex items-center gap-3">
        <LoadingSkeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="h-4 w-24 rounded" />
          <LoadingSkeleton className="h-3 w-20 rounded" />
        </div>
        <div className="space-y-2 text-right">
          <LoadingSkeleton className="h-4 w-12 rounded" />
          <LoadingSkeleton className="h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function InsightsLoading() {
  return (
    <div className="min-h-screen bg-base text-white pb-24">
      <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <LoadingSkeleton className="h-6 w-24 rounded-md" />
          <LoadingIndicator size="sm" label="Loading insights" />
        </div>
      </header>

      <div className="px-5 pt-[84px] flex flex-col gap-5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <LoadingSkeleton className="h-6 w-44 rounded" />
            <LoadingSkeleton className="h-3 w-24 rounded" />
          </div>
          <div className="flex flex-col gap-2.5">
            <LeaderboardRowSkeleton />
            <LeaderboardRowSkeleton />
            <LeaderboardRowSkeleton />
          </div>
        </section>

        <section>
          <LoadingSkeleton className="mb-3 h-6 w-40 rounded" />
          <div className="flex flex-col gap-2">
            <ApplianceRowSkeleton />
            <ApplianceRowSkeleton />
          </div>
        </section>

        <section className="space-y-2.5">
          <LoadingSkeleton className="h-5 w-32 rounded" />
          <div className="grid grid-cols-1 gap-3">
            <LoadingSkeleton className="h-24 w-full rounded-xl" />
            <LoadingSkeleton className="h-24 w-full rounded-xl" />
            <LoadingSkeleton className="h-24 w-full rounded-xl" />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="space-y-2">
              <LoadingSkeleton className="h-5 w-36 rounded" />
              <LoadingSkeleton className="h-3 w-24 rounded" />
            </div>
            <LoadingSkeleton className="h-3 w-20 rounded" />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-surface p-4">
            <LoadingSkeleton className="h-44 w-full rounded-lg" />
          </div>
        </section>

        <section className="mb-2">
          <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-surface p-5">
            <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-white/20" />
            <LoadingSkeletonText lines={2} />
            <div className="mt-4 flex items-end justify-between">
              <LoadingSkeleton className="h-10 w-40 rounded" />
              <LoadingSkeleton className="h-7 w-20 rounded" />
            </div>
            <LoadingSkeleton className="mt-3 h-3 w-4/5 rounded" />
          </div>
        </section>
      </div>
    </div>
  );
}
