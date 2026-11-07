// Isometric drawing of the stylized WattWise unit. It is the loading poster for the
// real-time model and the complete fallback when motion, JavaScript or WebGL is unavailable.

const ISO = "matrix(0.866 0.5 -0.866 0.5 0 0)";

interface Layer {
  id: string;
  thickness: number;
  top: string;
  side: string;
}

// Bottom to top, matching the 3D model's stack.
const LAYERS: readonly Layer[] = [
  { id: "base", thickness: 16, top: "#A9B8AC", side: "#7E9184" },
  { id: "relay", thickness: 9, top: "#D2DFD6", side: "#A9B8AC" },
  { id: "gap-b", thickness: 3, top: "#0D0D0D", side: "#050505" },
  { id: "sense", thickness: 9, top: "#163E28", side: "#0E2A1B" },
  { id: "compute", thickness: 9, top: "#212B28", side: "#141A18" },
  { id: "gap-a", thickness: 4, top: "#0D0D0D", side: "#050505" },
  { id: "cover", thickness: 13, top: "#F4F3EA", side: "#C9C9BF" },
];

function Slab({ fill }: { fill: string }) {
  return <rect x={-160} y={-110} width={320} height={220} rx={30} fill={fill} />;
}

export function DevicePoster({ className = "" }: { className?: string }) {
  let offset = 0;
  const total = LAYERS.reduce((sum, layer) => sum + layer.thickness, 0);
  const slabs: React.ReactNode[] = [];

  for (const layer of LAYERS) {
    const base = total - offset;
    // Extrude by stacking one-pixel copies; cheap for a static drawing.
    for (let step = layer.thickness; step > 0; step -= 1) {
      slabs.push(
        <g key={`${layer.id}-${step}`} transform={`translate(0 ${base - layer.thickness + step})`}>
          <g transform={ISO}>
            <Slab fill={layer.side} />
          </g>
        </g>,
      );
    }
    slabs.push(
      <g key={`${layer.id}-top`} transform={`translate(0 ${base - layer.thickness})`}>
        <g transform={ISO}>
          <Slab fill={layer.top} />
        </g>
      </g>,
    );
    offset += layer.thickness;
  }

  return (
    <svg className={className} viewBox="-330 -190 660 420" role="img" aria-labelledby="device-poster-title device-poster-desc">
      <title id="device-poster-title">Stylized WattWise unit</title>
      <desc id="device-poster-desc">
        A rounded, layered energy monitor. The warm-white cover carries the WattWise name, a dark display reading 65 W and online, and a green status
        light. Below it sit thin controller, sensing and relay layers on a sage base. Stylized model, not a measured replica.
      </desc>
      <ellipse cx={0} cy={total + 70} rx={300} ry={60} fill="url(#device-shadow)" />
      <defs>
        <radialGradient id="device-shadow">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {slabs}
      <g transform={ISO}>
        <text x={-128} y={-46} fontFamily="var(--font-space-grotesk), system-ui, sans-serif" fontWeight={900} fontSize={34} fill="#111">
          WattWise
        </text>
        <rect x={-130} y={-30} width={200} height={64} rx={14} fill="#0E0E0E" />
        <text x={-112} y={14} fontFamily="var(--font-space-grotesk), system-ui, sans-serif" fontWeight={800} fontSize={36} fill="#00E66F">
          65 W
        </text>
        <text x={-14} y={8} fontFamily="var(--font-space-grotesk), system-ui, sans-serif" fontWeight={700} fontSize={12} fill="#00E66F">
          ONLINE
        </text>
        <circle cx={-118} cy={72} r={5} fill="#00E66F" />
      </g>
    </svg>
  );
}
