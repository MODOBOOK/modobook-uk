import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyReviews, setReviewApproval } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

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

function ReviewMod() {
  const fetchReviews = useServerFn(listMyReviews);
  const setApproval = useServerFn(setReviewApproval);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const r = await fetchReviews();
    setReviews(r.reviews as Review[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function toggle(id: string, approved: boolean) {
    try {
      await setApproval({ data: { reviewId: id, approved } });
      toast.success(approved ? "Review published" : "Review hidden");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Patient reviews</h1>
        <p className="text-sm text-muted-foreground">Approve or hide reviews from your public MODO Book page.</p>
      </div>
      {reviews.length === 0 ? (
        <p className="text-muted-foreground">No reviews yet.</p>
      ) : reviews.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                ))}
              </div>
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
    </div>
  );
}
