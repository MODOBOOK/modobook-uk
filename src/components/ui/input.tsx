import * as React from "react";

import { cn } from "@/lib/utils";

const ZERO_RE = /^-?0+(\.0+)?$/;

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onBlur, onChange, value, ...props }, ref) => {
    // For number fields, keep what the user is typing locally while focused so
    // parents that coerce "" -> 0 can't snap a zero back into the box.
    const [draft, setDraft] = React.useState<string | null>(null);
    const isNumber = type === "number";

    const shown = isNumber && draft !== null ? draft : value;

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...(value !== undefined ? { value: shown ?? "" } : {})}
        onFocus={(e) => {
          if (isNumber) {
            const v = e.currentTarget.value;
            if (ZERO_RE.test(v)) setDraft("");
            else {
              setDraft(v);
              const el = e.currentTarget;
              requestAnimationFrame(() => { try { el.select(); } catch { /* noop */ } });
            }
          }
          onFocus?.(e);
        }}
        onChange={(e) => {
          if (isNumber) {
            let v = e.currentTarget.value;
            // Strip leading zeros like "05" -> "5" (keep "0.5").
            if (/^-?0\d/.test(v)) {
              v = v.replace(/^(-?)0+(?=\d)/, "$1");
              e.currentTarget.value = v;
            }
            setDraft(v);
          }
          onChange?.(e);
        }}
        onBlur={(e) => {
          if (isNumber) setDraft(null);
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
