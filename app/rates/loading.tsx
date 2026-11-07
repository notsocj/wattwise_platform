import { PageTitleSkeleton } from "@/components/ui/PageHeader";
import { LoadingSkeleton } from "@/components/ui/LoadingIndicator";

export default function RatesLoading() {
  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 px-5 pt-[84px] lg:pt-0 text-fg">
      <PageTitleSkeleton />
      <LoadingSkeleton className="h-7 w-40 rounded" />
      <LoadingSkeleton className="mt-6 h-96 rounded-xl" />
      <LoadingSkeleton className="mt-5 h-52 rounded-xl" />
    </div>
  );
}
