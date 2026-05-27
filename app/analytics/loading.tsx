import {
  LoadingSkeleton,
  LoadingSkeletonText,
} from "@/components/ui/LoadingIndicator";

export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-base px-5 pt-[84px] text-white">
      <div className="flex flex-col gap-4">
        <LoadingSkeleton className="h-36 rounded-xl" />
        <LoadingSkeleton className="h-72 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <LoadingSkeleton className="h-28 rounded-xl" />
          <LoadingSkeleton className="h-28 rounded-xl" />
        </div>
        <LoadingSkeletonText lines={3} />
      </div>
    </div>
  );
}
