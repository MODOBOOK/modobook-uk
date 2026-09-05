import { useEffect, useRef, useState } from "react";

/**
 * Renders text on a single line, shrinking the font size until it fits
 * the available width. Never wraps, never truncates.
 */
export function FitText({
  children,
  className,
  max = 16,
  min = 9,
}: {
  children: React.ReactNode;
  className?: string;
  /** maximum font size in px */
  max?: number;
  /** minimum font size in px */
  min?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(max);

  useEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      const available = box.clientWidth;
      if (!available) return;
      let next = max;
      text.style.fontSize = `${next}px`;
      while (text.scrollWidth > available && next > min) {
        next -= 0.5;
        text.style.fontSize = `${next}px`;
      }
      setSize(next);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [children, max, min]);

  return (
    <div ref={boxRef} className="min-w-0 w-full overflow-hidden">
      <span
        ref={textRef}
        className={`block whitespace-nowrap ${className ?? ""}`}
        style={{ fontSize: `${size}px`, lineHeight: 1.2 }}
      >
        {children}
      </span>
    </div>
  );
}
