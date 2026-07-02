import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";

type Suggestion = {
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
};

export type ResolvedAddress = {
  line1: string;
  city: string;
  postcode: string;
  country: string;
};

/**
 * Google-style address autocomplete backed by OpenStreetMap Nominatim
 * (free, no API key). Debounced, keyboard accessible.
 */
export function AddressAutocomplete(props: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: ResolvedAddress) => void;
  placeholder?: string;
  id?: string;
  country?: string; // ISO-2 hint, e.g. "gb"
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusIdx, setFocusIdx] = useState<number>(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = props.value?.trim() ?? "";
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        const params = new URLSearchParams({
          q,
          format: "json",
          addressdetails: "1",
          limit: "6",
        });
        if (props.country) params.set("countrycodes", props.country);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          { signal: ctrl.signal, headers: { Accept: "application/json" } }
        );
        if (!res.ok) throw new Error("nominatim");
        const data = (await res.json()) as Suggestion[];
        setItems(data);
        setOpen(true);
        setFocusIdx(-1);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [props.value, props.country]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(s: Suggestion) {
    const a = s.address ?? {};
    const road = a.road || a.pedestrian || a.neighbourhood || a.suburb || "";
    const line1 = [a.house_number, road].filter(Boolean).join(" ").trim() ||
      s.display_name.split(",")[0].trim();
    const city = a.city || a.town || a.village || a.hamlet || "";
    const postcode = a.postcode || "";
    const country = a.country || "";
    props.onSelect({ line1, city, postcode, country });
    setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <Input
        id={props.id}
        value={props.value}
        placeholder={props.placeholder ?? "Start typing your address…"}
        onChange={(e) => props.onChange(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusIdx((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && focusIdx >= 0) {
            e.preventDefault();
            pick(items[focusIdx]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin opacity-60" />
      )}
      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {items.map((s, i) => (
            <li key={`${s.display_name}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                  i === focusIdx ? "bg-accent" : ""
                }`}
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 opacity-60" />
                <span className="line-clamp-2">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
