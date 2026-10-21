import { LoadingSkeleton } from "@/components/ui/LoadingIndicator";

export default function AdminLoading() {
  return (
    <div aria-busy="true">
      <LoadingSkeleton className="mb-6 h-8 w-56 rounded" />
      <div className="grid gap-4 sm:grid-cols-3">
        <LoadingSkeleton className="h-24 rounded-lg" />
        <LoadingSkeleton className="h-24 rounded-lg" />
        <LoadingSkeleton className="h-24 rounded-lg" />
      </div>
      <LoadingSkeleton className="mt-6 h-80 rounded-lg" />
    </div>
  );
}
