type LoadingIndicatorSize = "sm" | "md" | "lg";

type LoadingIndicatorProps = {
  size?: LoadingIndicatorSize;
  label?: string;
  showLabel?: boolean;
  className?: string;
  spinnerClassName?: string;
};

type LoadingSkeletonProps = {
  className?: string;
};

type LoadingSkeletonTextProps = {
  lines?: number;
  className?: string;
};

const SPINNER_SIZE_CLASS: Record<LoadingIndicatorSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-[3px]",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function LoadingIndicator({
  size = "md",
  label = "Loading",
  showLabel = true,
  className,
  spinnerClassName,
}: LoadingIndicatorProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "animate-spin rounded-full border-mint/35 border-t-mint",
          SPINNER_SIZE_CLASS[size],
          spinnerClassName
        )}
      />
      {showLabel ? <span className="text-xs font-medium text-white/75">{label}</span> : null}
    </span>
  );
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-white/[0.08]", className)}
    />
  );
}

export function LoadingSkeletonText({
  lines = 3,
  className,
}: LoadingSkeletonTextProps) {
  const safeLines = Math.max(1, lines);

  return (
    <div aria-hidden="true" className={cn("space-y-2", className)}>
      {Array.from({ length: safeLines }).map((_, index) => {
        const widthClass =
          index === safeLines - 1 && safeLines > 1 ? "w-2/3" : "w-full";

        return (
          <div
            key={`skeleton-line-${index}`}
            className={cn("h-3 animate-pulse rounded bg-white/[0.08]", widthClass)}
          />
        );
      })}
    </div>
  );
}
