import { Link } from "@tanstack/react-router";
import monogram from "@/assets/modo-monogram.png";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { img: string; text: string; gap: string; sub: string }> = {
  sm: { img: "h-7 w-7",   text: "text-lg",    gap: "gap-2",   sub: "text-[8px]"  },
  md: { img: "h-10 w-10", text: "text-2xl",   gap: "gap-2.5", sub: "text-[9px]"  },
  lg: { img: "h-16 w-16", text: "text-4xl",   gap: "gap-3",   sub: "text-[10px]" },
};

export function BrandMark({
  size = "md",
  withWordmark = true,
  tagline: _tagline,
  className,
  to,
}: {
  size?: Size;
  withWordmark?: boolean;
  /** Deprecated — brand no longer uses taglines. */
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
        <span
          className={cn(
            "font-serif font-light leading-none tracking-[0.25em] text-foreground",
            s.text,
          )}
        >
          MODO
        </span>
      )}
    </span>
  );
  if (to) return <Link to={to} className="inline-flex items-center">{inner}</Link>;
  return inner;
}
