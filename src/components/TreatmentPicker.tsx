import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type PickerTreatment = {
  id: string;
  name: string;
  price?: number | null;
  duration?: number | null;
  category_id?: string | null;
};

export type PickerCategory = { id: string; name: string };

/**
 * Searchable treatment dropdown, grouped by category exactly like the public
 * service menu. Used anywhere staff pick a treatment (booking someone in,
 * treatment plans, etc.).
 */
export function TreatmentPicker({
  treatments,
  categories = [],
  value,
  onSelect,
  placeholder = "Select treatment",
  disabled,
  className,
  clearAfterSelect,
  showMeta = true,
}: {
  treatments: PickerTreatment[];
  categories?: PickerCategory[];
  value?: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Keep the trigger showing the placeholder (for "add another" pickers). */
  clearAfterSelect?: boolean;
  showMeta?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const byCat = new Map<string, PickerTreatment[]>();
    for (const t of treatments) {
      const k = t.category_id ?? "__none";
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(t);
    }
    const out: { key: string; name: string; items: PickerTreatment[] }[] = [];
    for (const c of categories) {
      const items = byCat.get(c.id);
      if (items?.length) out.push({ key: c.id, name: c.name, items });
    }
    // Categories not supplied (or treatments referencing unknown categories)
    for (const [k, items] of byCat) {
      if (k === "__none" || categories.some((c) => c.id === k)) continue;
      out.push({ key: k, name: "Other treatments", items });
    }
    const none = byCat.get("__none");
    if (none?.length) {
      out.push({ key: "__none", name: out.length ? "Uncategorised" : "Treatments", items: none });
    }
    return out;
  }, [treatments, categories]);

  const selected = value ? treatments.find((t) => t.id === value) : undefined;

  const meta = (t: PickerTreatment) =>
    showMeta
      ? [t.price != null ? `£${Number(t.price).toFixed(2)}` : null, t.duration ? `${t.duration} min` : null]
          .filter(Boolean)
          .join(" · ")
      : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {clearAfterSelect || !selected ? placeholder : selected.name}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search treatments…" />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>No treatments found.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.key} heading={g.name}>
                {g.items.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`${t.name} ${g.name}`}
                    onSelect={() => {
                      onSelect(t.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === t.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{t.name}</span>
                    {meta(t) && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{meta(t)}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
