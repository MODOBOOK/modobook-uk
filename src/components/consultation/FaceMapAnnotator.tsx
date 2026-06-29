import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MousePointer2, Pencil, Eraser, Undo2, Trash2, Upload, ImageIcon, User } from "lucide-react";
import { AESTHETIC_PRODUCTS, getProductsForCategory } from "@/lib/aesthetic-products";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import realisticFace from "@/assets/face-map-realistic.jpg";

export type FaceMapPin = {
  x: number; y: number;
  category?: string;
  product?: string;
  amount?: string;
  label?: string;
};
export type FaceMapStroke = { points: { x: number; y: number }[]; color: string };
export type FaceMapBg = "diagram" | "realistic" | "upload";
export type FaceMapValue = {
  pins: FaceMapPin[];
  strokes: FaceMapStroke[];
  bg?: FaceMapBg;
  bgUrl?: string | null;
};

function normalize(value: any): FaceMapValue {
  if (!value) return { pins: [], strokes: [], bg: "realistic" };
  if (Array.isArray(value)) return { pins: value as FaceMapPin[], strokes: [], bg: "realistic" };
  return {
    pins: value.pins ?? [],
    strokes: value.strokes ?? [],
    bg: value.bg ?? "realistic",
    bgUrl: value.bgUrl ?? null,
  };
}

type Mode = "pin" | "draw" | "erase";

// SVG viewBox kept at 200x260 for backwards compatibility with existing saved pins.
const VB_W = 200;
const VB_H = 260;

export function FaceMapAnnotator({
  value, onChange, color = "#dc2626", title = "Face map",
}: {
  value: any;
  onChange: (v: FaceMapValue) => void;
  color?: string;
  title?: string;
}) {
  const v = normalize(value);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("pin");
  const drawingRef = useRef(false);
  const currentStroke = useRef<FaceMapStroke | null>(null);
  const [tempStroke, setTempStroke] = useState<FaceMapStroke | null>(null);
  const [pinDialog, setPinDialog] = useState<{ x: number; y: number } | null>(null);

  function toLocal(e: any) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    const t = e.touches?.[0];
    pt.x = t ? t.clientX : e.clientX;
    pt.y = t ? t.clientY : e.clientY;
    const m = svg.getScreenCTM()!.inverse();
    return pt.matrixTransform(m);
  }

  function onDown(e: any) {
    e.preventDefault();
    const p = toLocal(e);
    if (mode === "pin") {
      setPinDialog({ x: p.x, y: p.y });
      return;
    }
    if (mode === "draw") {
      drawingRef.current = true;
      currentStroke.current = { points: [{ x: p.x, y: p.y }], color };
      setTempStroke(currentStroke.current);
    }
    if (mode === "erase") {
      const r = 12;
      const pinIdx = v.pins.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < r);
      if (pinIdx >= 0) {
        onChange({ ...v, pins: v.pins.filter((_, i) => i !== pinIdx) });
        return;
      }
      const strokeIdx = v.strokes.findIndex((s) =>
        s.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < r),
      );
      if (strokeIdx >= 0) {
        onChange({ ...v, strokes: v.strokes.filter((_, i) => i !== strokeIdx) });
      }
    }
  }
  function onMove(e: any) {
    if (mode !== "draw" || !drawingRef.current || !currentStroke.current) return;
    e.preventDefault();
    const p = toLocal(e);
    currentStroke.current.points.push({ x: p.x, y: p.y });
    setTempStroke({ ...currentStroke.current });
  }
  function onUp() {
    if (mode === "draw" && drawingRef.current && currentStroke.current) {
      if (currentStroke.current.points.length > 1) {
        onChange({ ...v, strokes: [...v.strokes, currentStroke.current] });
      }
      currentStroke.current = null;
      setTempStroke(null);
      drawingRef.current = false;
    }
  }

  function undo() {
    if (v.strokes.length > 0) {
      onChange({ ...v, strokes: v.strokes.slice(0, -1) });
    } else if (v.pins.length > 0) {
      onChange({ ...v, pins: v.pins.slice(0, -1) });
    }
  }
  function clearAll() {
    if (!confirm("Clear all annotations?")) return;
    onChange({ ...v, pins: [], strokes: [] });
  }

  function setBg(bg: FaceMapBg) {
    onChange({ ...v, bg });
  }

  function handleUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...v, bg: "upload", bgUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  const bgSrc = v.bg === "upload" ? v.bgUrl : v.bg === "realistic" ? realisticFace : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{title}</Label>
        <div className="flex flex-wrap gap-1">
          <ToolBtn active={mode === "pin"} onClick={() => setMode("pin")} icon={<MousePointer2 className="h-3.5 w-3.5" />}>Tag</ToolBtn>
          <ToolBtn active={mode === "draw"} onClick={() => setMode("draw")} icon={<Pencil className="h-3.5 w-3.5" />}>Draw</ToolBtn>
          <ToolBtn active={mode === "erase"} onClick={() => setMode("erase")} icon={<Eraser className="h-3.5 w-3.5" />}>Erase</ToolBtn>
          <Button size="sm" variant="ghost" onClick={undo} disabled={v.pins.length + v.strokes.length === 0}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} disabled={v.pins.length + v.strokes.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Background switcher */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Background:</span>
        <ToolBtn active={v.bg === "realistic"} onClick={() => setBg("realistic")} icon={<User className="h-3.5 w-3.5" />}>Realistic</ToolBtn>
        <ToolBtn active={v.bg === "diagram"} onClick={() => setBg("diagram")} icon={<ImageIcon className="h-3.5 w-3.5" />}>Diagram</ToolBtn>
        <ToolBtn
          active={v.bg === "upload"}
          onClick={() => { if (v.bgUrl) setBg("upload"); else fileRef.current?.click(); }}
          icon={<Upload className="h-3.5 w-3.5" />}
        >
          {v.bgUrl ? "Patient photo" : "Upload"}
        </ToolBtn>
        {v.bg === "upload" && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => fileRef.current?.click()}>
            Replace
          </Button>
        )}
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
        />
      </div>

      <div className="overflow-hidden rounded-lg border bg-muted/30 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={`block w-full touch-none ${mode === "draw" ? "cursor-crosshair" : mode === "erase" ? "cursor-not-allowed" : "cursor-pointer"}`}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        >
          {/* Background: photo or schematic diagram */}
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

          {/* Strokes */}
          {v.strokes.map((s, i) => (
            <polyline
              key={i}
              points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={s.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            />
          ))}
          {tempStroke && (
            <polyline
              points={tempStroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={tempStroke.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            />
          )}

          {/* Pins */}
          {v.pins.map((p, i) => {
            const lbl = [p.product ?? p.label, p.amount].filter(Boolean).join(" · ");
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
                {lbl && (
                  <text x={p.x + 6} y={p.y + 3} fontSize="6.5" fill="#111"
                    style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 2 } as any}>
                    {lbl}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {v.pins.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {v.pins.map((p, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              {[p.product ?? p.label, p.amount].filter(Boolean).join(" · ") || "Pin"}
            </Badge>
          ))}
        </div>
      )}

      <PinDialog
        open={!!pinDialog}
        onClose={() => setPinDialog(null)}
        onSave={(pin) => {
          if (!pinDialog) return;
          onChange({ ...v, pins: [...v.pins, { ...pin, x: pinDialog.x, y: pinDialog.y }] });
          setPinDialog(null);
        }}
      />
    </div>
  );
}

function ToolBtn({ active, onClick, icon, children }: any) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="h-7 gap-1 px-2 text-xs"
    >
      {icon}{children}
    </Button>
  );
}

function PinDialog({ open, onClose, onSave }: {
  open: boolean;
  onClose: () => void;
  onSave: (p: Partial<FaceMapPin>) => void;
}) {
  const [category, setCategory] = useState<string>("anti-wrinkle");
  const [product, setProduct] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const products = getProductsForCategory(category);

  useEffect(() => { if (open) { setProduct(""); setAmount(""); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Tag this area</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Treatment type</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setProduct(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AESTHETIC_PRODUCTS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Product</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {products.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
            <div className="flex flex-wrap gap-2">
              {["0.1ml","0.25ml","0.5ml","1ml","2u","4u","10u","20u"].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  className={`rounded-md border px-2 py-1 text-xs ${amount === a ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}
                >{a}</button>
              ))}
            </div>
            <Input
              placeholder="Or enter custom (e.g. 0.3ml, 6u)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({ category, product: product || undefined, amount: amount || undefined, label: product || undefined })}
            disabled={!product && !amount}
          >Drop pin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
