import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listPublicGiftCards, purchaseGiftCard } from "@/lib/gift-cards.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug/gift-cards")({
  head: () => ({
    meta: [
      { title: "Gift cards" },
      { name: "description", content: "Buy a gift card for a friend or loved one." },
    ],
  }),
  component: PublicGiftCards,
});

type Card = { id: string; name: string; description: string | null; kind: "value" | "treatment" | "package"; amount: number | null; price: number | null; image_url: string | null };

function PublicGiftCards() {
  const { slug } = useParams({ from: "/m/$slug/gift-cards" });
  const fetch = useServerFn(listPublicGiftCards);
  const q = useQuery({ queryKey: ["public-gift-cards", slug], queryFn: () => fetch({ data: { slug } }) });
  const [buying, setBuying] = useState<Card | null>(null);
  const cards = (q.data?.cards ?? []) as Card[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand,#111)]/10">
          <Gift className="h-6 w-6" style={{ color: "var(--brand, #111)" }} />
        </div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--heading-font, inherit)" }}>Gift cards</h1>
        <p className="mt-2 text-sm opacity-70">Give the gift of self-care. Redeemable against treatments online at checkout.</p>
      </div>

      {q.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!q.isLoading && cards.length === 0 && (
        <Card><CardContent className="py-16 text-center text-sm opacity-70">No gift cards are available right now.</CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            {c.image_url ? (
              <img src={c.image_url} alt={c.name} className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[var(--brand,#111)]/20 to-[var(--brand-accent,#111)]/10">
                <Gift className="h-10 w-10 opacity-60" style={{ color: "var(--brand, #111)" }} />
              </div>
            )}
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{c.name}</h3>
                {c.kind === "value" && c.amount != null && (
                  <span className="flex shrink-0 items-baseline gap-1.5 rounded-full bg-black/5 px-2 py-0.5 text-sm font-semibold">
                    {c.price != null && Number(c.price) > 0 && Number(c.price) < Number(c.amount) && (
                      <span className="text-xs font-normal line-through opacity-60">£{Number(c.amount).toFixed(2)}</span>
                    )}
                    £{Number(c.price != null && Number(c.price) > 0 ? c.price : c.amount).toFixed(2)}
                  </span>
                )}
              </div>
              {c.description && <p className="text-sm opacity-70 line-clamp-3">{c.description}</p>}
              <Button
                className="mt-2 w-full"
                style={{ backgroundColor: "var(--brand, #111)", color: "#fff" }}
                onClick={() => setBuying(c)}
              >Buy this gift card</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {buying && <BuyDialog card={buying} slug={slug} onClose={() => setBuying(null)} />}
    </div>
  );
}

function BuyDialog({ card, slug, onClose }: { card: Card; slug: string; onClose: () => void }) {
  const buy = useServerFn(purchaseGiftCard);
  const navigate = useNavigate();
  void navigate;
  const [form, setForm] = useState({
    buyer_name: "", buyer_email: "",
    recipient_name: "", recipient_email: "",
    message: "", delivery: "recipient" as "buyer" | "recipient",
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.buyer_name || !form.buyer_email) return toast.error("Your name and email are required");
    if (!form.recipient_name || !form.recipient_email) return toast.error("Recipient name and email are required");
    setBusy(true);
    try {
      const res = await buy({
        data: {
          slug,
          gift_card_id: card.id,
          ...form,
          return_origin: window.location.origin,
        },
      });
      window.location.href = res.checkoutUrl;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Buy "{card.name}"</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Your name</Label><Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} /></div>
            <div><Label>Your email</Label><Input type="email" value={form.buyer_email} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Recipient name</Label><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></div>
            <div><Label>Recipient email</Label><Input type="email" value={form.recipient_email} onChange={(e) => setForm({ ...form, recipient_email: e.target.value })} /></div>
          </div>
          <div><Label>Personal message (optional)</Label><Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <div>
            <Label className="mb-2 block">Send the gift card to</Label>
            <RadioGroup value={form.delivery} onValueChange={(v) => setForm({ ...form, delivery: v as "buyer" | "recipient" })}>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <RadioGroupItem value="recipient" /> Send straight to recipient
              </label>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <RadioGroupItem value="buyer" /> Send to me so I can pass it on
              </label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} style={{ backgroundColor: "var(--brand, #111)", color: "#fff" }}>
            {busy ? "Redirecting…" : "Continue to payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
