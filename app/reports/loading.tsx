import { PageTitleSkeleton } from "@/components/ui/PageHeader";
import {
  LoadingSkeleton,
  LoadingSkeletonText,
} from "@/components/ui/LoadingIndicator";

export default function ReportsLoading() {
  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 px-5 pt-[84px] lg:pt-0 text-fg">
      <PageTitleSkeleton />
      <div>
        <div className="flex gap-2">
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
