import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import {
  AESTHETIC_PRODUCTS, getProductsForCategory, saveCustomProduct, PURPOSE_OPTIONS,
} from "@/lib/aesthetic-products";

export type LogProduct = {
  category?: string;
  treatment?: string;
  product?: string;
  price?: string;
  batch?: string;
  expiry?: string;
  quantity?: string;
  purpose?: string;
  comments?: string;
};

const TREATMENTS_BY_CATEGORY: Record<string, string[]> = {
  "anti-wrinkle": ["One Area", "Two Areas", "Three Areas", "Masseter", "Hyperhidrosis", "Nefertiti Lift", "Lip Flip"],
  "dermal-fillers": ["Lips", "Cheeks", "Chin", "Jawline", "Nasolabial Folds", "Marionette Lines", "Tear Trough", "Temples", "Nose"],
  "bio-stimulators": ["Face", "Neck", "Décolletage", "Buttocks", "Body"],
  "skin-boosters": ["Face", "Neck", "Hands", "Décolletage"],
  "polynucleotides": ["Face", "Eyes", "Neck"],
  "fat-dissolving": ["Submental (Chin)", "Jowls", "Abdomen", "Flanks", "Thighs", "Arms"],
  "chemical-peels": ["Face", "Neck", "Back", "Décolletage"],
  "microneedling": ["Face", "Neck", "Décolletage", "Scalp"],
  "prp-prf": ["Face", "Hair Restoration", "Under Eye"],
  "threads": ["Mid-face Lift", "Jawline", "Neck", "Brow"],
};

export function ProductEntryCard({
  index, value, onChange, onRemove,
}: {
  index: number;
  value: LogProduct;
  onChange: (v: LogProduct) => void;
  onRemove: () => void;
}) {
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [productListVersion, setProductListVersion] = useState(0);

  const products = useMemo(
    () => (value.category ? getProductsForCategory(value.category) : []),
    [value.category, productListVersion],
  );
  const treatments = value.category ? TREATMENTS_BY_CATEGORY[value.category] ?? [] : [];

  useEffect(() => {
    if (value.category && value.treatment && !treatments.includes(value.treatment)) {
      // keep value but don't crash
    }
  }, [value.category]); // eslint-disable-line

  function addCustomProduct() {
    const n = customName.trim();
    if (!n || !value.category) return;
    saveCustomProduct(value.category, n);
    setProductListVersion((v) => v + 1);
    onChange({ ...value, product: n });
    setCustomName("");
    setAddingCustom(false);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Treatment {index + 1}</span>
          <Button size="icon" variant="ghost" onClick={onRemove}><X className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Treatment Type">
            <Select value={value.category ?? ""} onValueChange={(v) => onChange({ ...value, category: v, treatment: "", product: "" })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {AESTHETIC_PRODUCTS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Treatment">
            <Select
              value={value.treatment ?? ""}
              onValueChange={(v) => onChange({ ...value, treatment: v })}
              disabled={!value.category}
            >
              <SelectTrigger><SelectValue placeholder={value.category ? "Select…" : "Choose type first"} /></SelectTrigger>
              <SelectContent>
                {treatments.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Product">
          {addingCustom ? (
            <div className="flex gap-2">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Product name…"
                autoFocus
              />
              <Button size="sm" onClick={addCustomProduct} disabled={!customName.trim() || !value.category}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingCustom(false); setCustomName(""); }}>Cancel</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                value={value.product ?? ""}
                onValueChange={(v) => onChange({ ...value, product: v })}
                disabled={!value.category}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder={value.category ? "Please Select" : "Choose type first"} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {products.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setAddingCustom(true)} disabled={!value.category}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </Field>

        <Field label="Price Per Treatment">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              type="number" inputMode="decimal" step="0.01"
              value={value.price ?? ""}
              onChange={(e) => onChange({ ...value, price: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="LOT / Batch No.">
            <Input value={value.batch ?? ""} onChange={(e) => onChange({ ...value, batch: e.target.value })} />
          </Field>
          <Field label="Expiry">
            <Input
              placeholder="MM/YY"
              value={value.expiry ?? ""}
              onChange={(e) => onChange({ ...value, expiry: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantity">
            <Input
              type="number" inputMode="numeric" min={1}
              value={value.quantity ?? "1"}
              onChange={(e) => onChange({ ...value, quantity: e.target.value })}
            />
          </Field>
          <Field label="Purpose">
            <Select value={value.purpose ?? ""} onValueChange={(v) => onChange({ ...value, purpose: v })}>
              <SelectTrigger><SelectValue placeholder="Please select…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {PURPOSE_OPTIONS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Comments">
          <Textarea
            rows={2}
            value={value.comments ?? ""}
            onChange={(e) => onChange({ ...value, comments: e.target.value })}
            placeholder="Site, technique, observations…"
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
