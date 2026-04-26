import LoadingIndicator, {
  LoadingSkeleton,
  LoadingSkeletonText,
} from "@/components/ui/LoadingIndicator";

export default function DeviceDetailLoading() {
  return (
    <div className="min-h-screen bg-base text-white pb-8">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <LoadingSkeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <LoadingSkeleton className="h-5 w-44 rounded" />
            <LoadingSkeleton className="h-3 w-36 rounded" />
          </div>
        </div>
        <LoadingIndicator size="sm" label="Loading device" />
      </header>

      <div className="px-5 pb-8 flex min-h-[calc(100vh-88px)] flex-col gap-5">
        <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <LoadingSkeleton className="mt-0.5 h-9 w-9 rounded-full" />
          <LoadingSkeletonText lines={3} className="flex-1" />
        </div>

        <section className="grid flex-1 grid-cols-3 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-2 py-8">
          <div className="flex flex-col items-center gap-2">
            <LoadingSkeleton className="h-24 w-24 rounded-full" />
            <LoadingSkeleton className="h-3 w-14 rounded" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingSkeleton className="h-24 w-24 rounded-full" />
            <LoadingSkeleton className="h-3 w-16 rounded" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingSkeleton className="h-24 w-24 rounded-full" />
            <LoadingSkeleton className="h-3 w-14 rounded" />
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LoadingSkeleton className="h-10 w-10 rounded-lg" />
              <LoadingSkeletonText lines={2} />
            </div>
            <LoadingSkeleton className="h-7 w-14 rounded-full" />
          </div>
          <LoadingSkeleton className="h-3 w-3/4 rounded" />
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <LoadingSkeleton className="h-5 w-32 rounded" />
            <LoadingSkeleton className="h-3 w-20 rounded" />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <LoadingSkeleton className="h-4 w-28 rounded" />
            <LoadingSkeleton className="h-6 w-24 rounded" />
          </div>
          <LoadingSkeleton className="h-2.5 w-full rounded-full" />
          <LoadingSkeleton className="mt-3 h-3 w-5/6 rounded" />
          <LoadingSkeleton className="mt-2 h-3 w-2/3 rounded" />
        </section>
      </div>
    </div>
  );
}
