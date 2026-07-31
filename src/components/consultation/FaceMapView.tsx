import realisticFace from "@/assets/face-map-realistic.jpg";
import type { FaceMapValue, FaceMapPin } from "./FaceMapAnnotator";

const VB_W = 200;
const VB_H = 260;

const CATEGORY_COLORS: Record<string, string> = {
  "anti-wrinkle": "#2563eb",
  "dermal-fillers": "#db2777",
  "bio-stimulators": "#ea580c",
  "skin-boosters": "#0d9488",
  "polynucleotides": "#7c3aed",
  "fat-dissolving": "#ca8a04",
  "chemical-peels": "#be185d",
  "microneedling": "#4f46e5",
  "prp-prf": "#b91c1c",
  "threads": "#166534",
};

function pinColor(p: FaceMapPin, fallback: string) {
  return (p.category && CATEGORY_COLORS[p.category]) || fallback;
}

/** Read-only render of a saved face map — used in note lists and summaries. */
export function FaceMapView({
  value,
  color = "#dc2626",
  className = "",
  showSummary = true,
}: {
  value: any;
  color?: string;
  className?: string;
  showSummary?: boolean;
}) {
  if (!value) return null;
  const v: FaceMapValue = {
    pins: value.pins ?? [],
    strokes: value.strokes ?? [],
    bg: value.bg ?? "realistic",
    bgUrl: value.bgUrl ?? null,
  };
  if (v.pins.length === 0 && v.strokes.length === 0) return null;

  const bgSrc = v.bg === "upload" ? v.bgUrl : v.bg === "realistic" ? realisticFace : null;

  const groups = new Map<string, { color: string; product: string; amount: string; count: number }>();
  for (const p of v.pins) {
    const key = `${p.category ?? "_"}|${p.product ?? p.label ?? "Tag"}|${p.amount ?? ""}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, {
      color: pinColor(p, color),
      product: p.product ?? p.label ?? "Tag",
      amount: p.amount ?? "",
      count: 1,
    });
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full">
          {bgSrc ? (
            <image href={bgSrc} x={0} y={0} width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <g>
              <ellipse cx="100" cy="120" rx="70" ry="95" fill="#fce7d6" stroke="#c08868" strokeWidth="1.5" />
              <ellipse cx="72" cy="105" rx="9" ry="5" fill="#fff" stroke="#444" />
              <ellipse cx="128" cy="105" rx="9" ry="5" fill="#fff" stroke="#444" />
              <circle cx="72" cy="105" r="2.5" fill="#333" />
              <circle cx="128" cy="105" r="2.5" fill="#333" />
              <path d="M60 92 Q72 86 84 92" fill="none" stroke="#5a3a2a" strokeWidth="2" />
              <path d="M116 92 Q128 86 140 92" fill="none" stroke="#5a3a2a" strokeWidth="2" />
              <path d="M100 110 L94 140 Q100 145 106 140 Z" fill="none" stroke="#a76" strokeWidth="1.5" />
              <path d="M82 170 Q100 162 118 170 Q100 180 82 170 Z" fill="#e89a8a" stroke="#a55" />
            </g>
          )}
          {v.strokes.map((s, i) => (
            <polyline
              key={i}
              points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={s.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            />
          ))}
          {v.pins.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="2.5" fill={pinColor(p, color)} stroke="#fff" strokeWidth="0.8" />
              {p.amount && (
                <text x={p.x + 3.5} y={p.y + 1.8} fontSize="4.5" fill="#111"
                  style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 1.2 } as any}>
                  {p.amount}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {showSummary && groups.size > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...groups.values()].map((g, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-white" style={{ backgroundColor: g.color }}>
              <span className="font-semibold">{g.product}</span>
              {g.amount && <span className="opacity-90">· {g.amount}</span>}
              <span className="rounded-full bg-white/25 px-1.5 text-[9px]">×{g.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
