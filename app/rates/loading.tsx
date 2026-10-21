import { LoadingSkeleton } from "@/components/ui/LoadingIndicator";

export default function RatesLoading() {
  return (
    <div className="min-h-screen bg-canvas px-5 pt-[84px] text-white">
      <LoadingSkeleton className="h-7 w-40 rounded" />
      <LoadingSkeleton className="mt-6 h-96 rounded-xl" />
      <LoadingSkeleton className="mt-5 h-52 rounded-xl" />
    </div>
  );
}
