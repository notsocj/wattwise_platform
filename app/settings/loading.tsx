import { PageTitleSkeleton } from "@/components/ui/PageHeader";
import {
  LoadingSkeleton,
  LoadingSkeletonText,
} from "@/components/ui/LoadingIndicator";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 px-5 pt-[84px] lg:pt-0 text-fg">
      <PageTitleSkeleton />
      <div className="flex flex-col gap-4 lg:max-w-3xl">
        <LoadingSkeleton className="h-28 rounded-xl" />
        <LoadingSkeleton className="h-64 rounded-xl" />
        <LoadingSkeleton className="h-72 rounded-xl" />
        <LoadingSkeletonText lines={2} />
      </div>
    </div>
  );
}
