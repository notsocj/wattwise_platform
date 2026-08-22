import {
  LoadingSkeleton,
  LoadingSkeletonText,
} from "@/components/ui/LoadingIndicator";

export default function ReportsLoading() {
  return (
    <div className="min-h-screen bg-base px-5 pt-6 text-white">
      <div className="mx-auto max-w-[760px]">
        <LoadingSkeleton className="h-16 rounded-xl" />
        <div className="mt-6 flex gap-2">
          <LoadingSkeleton className="h-9 w-20 rounded-lg" />
          <LoadingSkeleton className="h-9 w-20 rounded-lg" />
          <LoadingSkeleton className="h-9 w-20 rounded-lg" />
        </div>
        <LoadingSkeletonText className="mt-6" lines={2} />
        <LoadingSkeleton className="mt-6 h-72 rounded-xl" />
      </div>
    </div>
  );
}
