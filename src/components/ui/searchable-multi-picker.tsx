import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type SearchableMultiPickerItem = {
  id: string;
  name: string;
  hint?: string;
};

export function SearchableMultiPicker({
  label,
  emptyMessage,
  placeholder,
  items,
  selected,
  onToggle,
  hideLabel,
}: {
  label: string;
  emptyMessage: string;
  placeholder?: string;
  items: SearchableMultiPickerItem[];
  selected: string[];
  onToggle: (id: string) => void;
  hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const selectedItems = items.filter((i) => selectedSet.has(i.id));
  const search = placeholder ?? `Search ${label.toLowerCase()}…`;
  return (
    <div>
      {!hideLabel && (
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      )}
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="mt-1 w-full justify-between font-normal"
            >
              <span className="truncate text-left">
                {selectedItems.length === 0 ? search : `${selectedItems.length} selected`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder={search} />
              <CommandList>
                <CommandEmpty>No matches.</CommandEmpty>
                <CommandGroup>
                  {items.map((it) => {
                    const isSel = selectedSet.has(it.id);
                    return (
                      <CommandItem
                        key={it.id}
                        value={`${it.name} ${it.hint ?? ""}`}
                        onSelect={() => onToggle(it.id)}
                      >
                        <Check className={`mr-2 h-4 w-4 ${isSel ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">
                          {it.name}
                          {it.hint && <span className="ml-2 text-xs opacity-70">{it.hint}</span>}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {selectedItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedItems.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/80"
              title="Remove"
            >
              {it.name}
              {it.hint && <span className="opacity-60">· {it.hint}</span>}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
