import Image from "next/image";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

export default function AppLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-base text-white tracking-tight">
      <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2">
        <Image
          src="/wattwise_mascot.png"
          alt="WattWise mascot"
          width={176}
          height={176}
          priority
          className="h-32 w-32 object-contain"
        />
      </div>

      <div className="absolute inset-x-0 top-[60%] flex -translate-y-1/2 flex-col items-center px-6 text-center">
        <h1 className="text-5xl font-bold text-white">
          Watt<span className="text-mint">Wise</span>
        </h1>
        <p className="mt-2 text-[10px] font-semibold tracking-[0.4em] text-mint/70 sm:text-xs">
          INTELLIGENT ENERGY
        </p>
        <div className="mt-6 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
          <LoadingIndicator size="sm" label="Preparing your energy hub" />
        </div>
      </div>
    </div>
  );
}
