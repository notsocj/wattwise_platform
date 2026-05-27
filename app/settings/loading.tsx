import {
  LoadingSkeleton,
  LoadingSkeletonText,
} from "@/components/ui/LoadingIndicator";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-base px-5 pt-[84px] text-white">
      <div className="flex flex-col gap-4">
        <LoadingSkeleton className="h-28 rounded-xl" />
        <LoadingSkeleton className="h-64 rounded-xl" />
        <LoadingSkeleton className="h-72 rounded-xl" />
        <LoadingSkeletonText lines={2} />
      </div>
    </div>
  );
}
