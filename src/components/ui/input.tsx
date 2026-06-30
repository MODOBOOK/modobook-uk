import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onClick, onTouchEnd, ...props }, ref) => {
    const clearIfZero = (el: HTMLInputElement) => {
      if (type !== "number") return;
      const v = el.value;
      if (v === "0" || v === "0.00" || v === "0.0" || /^0+(\.0+)?$/.test(v)) {
        // Clear the 0 so typing replaces it on all devices (mobile/iPad/desktop).
        // Use the native setter so React's controlled value updates correctly.
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, "");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        try { el.select(); } catch { /* noop */ }
      }
    };
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onFocus={(e) => { clearIfZero(e.currentTarget); onFocus?.(e); }}
        onClick={(e) => { clearIfZero(e.currentTarget); onClick?.(e); }}
        onTouchEnd={(e) => { clearIfZero(e.currentTarget); onTouchEnd?.(e); }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
