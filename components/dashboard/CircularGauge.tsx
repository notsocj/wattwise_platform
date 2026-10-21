export default function CircularGauge({
  value,
  max,
  label,
  unit,
  color = "var(--color-mint)",
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
}) {
  const radius = 42;
  const stroke = 6;
  const center = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center px-1">
      <div className="relative aspect-square w-full max-w-[108px]">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--chart-track)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none">{value}</span>
          <span className="mt-1 text-[11px] font-medium text-mint/70">
            {unit}
          </span>
        </div>
      </div>
      <span className="mt-2.5 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
        {label}
      </span>
    </div>
  );
}
