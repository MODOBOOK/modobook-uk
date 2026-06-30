import { Link } from "@tanstack/react-router";
import monogram from "@/assets/modo-monogram.png";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { img: string; text: string; gap: string; sub: string }> = {
  sm: { img: "h-7 w-7",   text: "text-base",  gap: "gap-2",   sub: "text-[8px]"  },
  md: { img: "h-9 w-9",   text: "text-xl",    gap: "gap-2.5", sub: "text-[9px]"  },
  lg: { img: "h-14 w-14", text: "text-3xl",   gap: "gap-3",   sub: "text-[10px]" },
};

export function BrandMark({
  size = "md",
  withWordmark = true,
  tagline,
  className,
  to,
}: {
  size?: Size;
  withWordmark?: boolean;
  tagline?: string;
  className?: string;
  to?: string;
}) {
  const s = sizes[size];
  const inner = (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <img
        src={monogram}
        alt="MODO"
        className={cn(s.img, "object-contain")}
        draggable={false}
      />
      {withWordmark && (
        <span className="inline-flex flex-col leading-none">
          <span className={cn("font-light tracking-[0.35em] text-foreground", s.text)}>
            MODO
          </span>
          {tagline && (
            <span className={cn("mt-1 uppercase tracking-[0.3em] text-muted-foreground", s.sub)}>
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
  if (to) return <Link to={to} className="inline-flex items-center">{inner}</Link>;
  return inner;
}
