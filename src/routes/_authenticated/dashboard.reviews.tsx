import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listMyReviews, setReviewApproval,
  listMyTestimonials, upsertTestimonial, deleteTestimonial,
} from "@/lib/patient.functions";
import { extractReviews, commitReviews, type ExtractedReview } from "@/lib/ai-reviews.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Star, Loader2, Eye, EyeOff, Plus, Pencil, Trash2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/_authenticated/dashboard/reviews")({
  component: ReviewMod,
});

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  approved: boolean;
  created_at: string;
  patients?: { full_name: string } | null;
};
type Testimonial = {
  id: string;
  author_name: string;
  quote: string;
  rating: number | null;
  display_order: number | null;
  created_at: string;
};

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={onChange ? () => onChange(n) : undefined}
          className={onChange ? "p-0.5" : "pointer-events-none"}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star className={`h-4 w-4 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewMod() {
  const fetchReviews = useServerFn(listMyReviews);
  const setApproval = useServerFn(setReviewApproval);
  const fetchTestimonials = useServerFn(listMyTestimonials);
  const saveTestimonial = useServerFn(upsertTestimonial);
  const removeTestimonial = useServerFn(deleteTestimonial);
  const extractAi = useServerFn(extractReviews);
  const commitAi = useServerFn(commitReviews);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  // dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [name, setName] = useState("");
  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  // AI import state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<Array<ExtractedReview & { _include: boolean }> | null>(null);

  async function refresh() {
    const [r, t] = await Promise.all([fetchReviews(), fetchTestimonials()]);
    setReviews(r.reviews as Review[]);
    setTestimonials(t.testimonials as Testimonial[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  function openNew() {
    setEditing(null);
    setName(""); setQuote(""); setRating(5);
    setOpen(true);
  }
  function openEdit(t: Testimonial) {
    setEditing(t);
    setName(t.author_name);
    setQuote(t.quote);
    setRating(t.rating ?? 5);
    setOpen(true);
  }

  async function save() {
    if (!name.trim() || !quote.trim()) return toast.error("Add a first name and a review");
    setSaving(true);
    try {
      await saveTestimonial({ data: { id: editing?.id, author_name: name, quote, rating } });
      toast.success(editing ? "Review updated" : "Review added");
      setOpen(false);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    try {
      await removeTestimonial({ data: { id } });
      toast.success("Review deleted");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function toggle(id: string, approved: boolean) {
    try {
      await setApproval({ data: { reviewId: id, approved } });
      toast.success(approved ? "Review published" : "Review hidden");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Manage patient reviews and add your own from previous patients.
        </p>
      </div>

      {/* Practitioner-added reviews */}
      <section className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">Your added reviews</h2>
            <p className="text-xs text-muted-foreground">Reviews from existing patients you add manually — or import a batch with AI.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Import with AI
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1.5 h-4 w-4" /> Add review
            </Button>
          </div>
        </div>

        {testimonials.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No added reviews yet. Tap “Add review” to share a quote from a previous patient.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {testimonials.map((t) => (
              <Card key={t.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {t.rating != null && <Stars value={t.rating} />}
                      <p className="mt-1 text-sm italic text-foreground/90">“{t.quote}”</p>
                      <p className="mt-1 text-xs text-muted-foreground">— {t.author_name}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(t.id)} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Patient-submitted reviews */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Patient-submitted reviews</h2>
          <p className="text-xs text-muted-foreground">Approve or hide reviews left by patients on your booking page.</p>
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No patient reviews yet.</p>
        ) : reviews.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 py-4">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                <Button size="sm" variant={r.approved ? "outline" : "default"} onClick={() => toggle(r.id, !r.approved)}>
                  {r.approved ? <><EyeOff className="mr-1 h-4 w-4" />Hide</> : <><Eye className="mr-1 h-4 w-4" />Publish</>}
                </Button>
              </div>
              {r.title && <h3 className="font-semibold">{r.title}</h3>}
              <p className="text-sm">{r.body}</p>
              <p className="text-xs text-muted-foreground">{r.patients?.full_name ?? "Anonymous"} · {new Date(r.created_at).toLocaleDateString()}{r.approved ? "" : " · hidden"}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><span className="hidden" /></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit review" : "Add a review"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">Patient first name</label>
              <Input placeholder="e.g. Sarah" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold">Rating</label>
              <div className="mt-1"><Stars value={rating} onChange={setRating} /></div>
            </div>
            <div>
              <label className="text-xs font-semibold">Review</label>
              <Textarea
                rows={4}
                placeholder="What did the patient say about their experience?"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
