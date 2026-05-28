import { Building2 } from "lucide-react";
import LoadingIndicator, {
  LoadingSkeleton,
} from "@/components/ui/LoadingIndicator";

function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface p-4">
      <LoadingSkeleton className="h-7 w-16 rounded-md" />
      <LoadingSkeleton className="mt-2 h-3 w-24 rounded" />
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <LoadingSkeleton className="h-4 w-32 rounded" />
          <LoadingSkeleton className="mt-2 h-3 w-24 rounded" />
          <LoadingSkeleton className="mt-3 h-3 w-28 rounded" />
        </div>
        <LoadingSkeleton className="h-7 w-16 rounded-full" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <LoadingSkeleton className="h-3 rounded" />
        <LoadingSkeleton className="h-3 rounded" />
        <LoadingSkeleton className="h-3 rounded" />
      </div>

      <LoadingSkeleton className="mt-5 h-2 rounded-full" />
      <LoadingSkeleton className="mt-3 h-3 w-2/3 rounded" />
    </div>
  );
}

export default function ManagerLoading() {
  return (
    <div className="min-h-screen bg-base pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <LoadingSkeleton className="h-3 w-28 rounded" />
            <div className="mt-2 flex items-center gap-2">
              <Building2 className="h-5 w-5 shrink-0 text-mint" />
              <LoadingSkeleton className="h-6 w-40 rounded-md" />
            </div>
          </div>
          <LoadingIndicator size="sm" label="Loading manager" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pt-4">
        <div className="space-y-4">
          <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <LoadingSkeleton className="h-3 w-28 rounded" />
                <LoadingSkeleton className="mt-3 h-8 w-56 rounded-lg" />
                <LoadingSkeleton className="mt-3 h-4 w-full max-w-md rounded" />
              </div>
              <LoadingSkeleton className="h-10 w-10 rounded-xl" />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </section>

          <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <LoadingSkeleton className="h-4 w-28 rounded" />
              <LoadingSkeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <RoomSkeleton />
              <RoomSkeleton />
              <RoomSkeleton />
              <RoomSkeleton />
            </div>
          </section>
        </div>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-5xl -translate-x-1/2 border-t border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="grid grid-cols-6 px-2 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`manager-nav-skeleton-${index}`}
              className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5"
            >
              <LoadingSkeleton className="h-5 w-5 rounded" />
              <LoadingSkeleton className="h-2.5 w-10 rounded" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
