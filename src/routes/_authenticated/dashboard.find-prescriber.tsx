import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Compass, Handshake, Mail, MapPin, Phone, Search, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  searchDirectory,
  sendConnectRequest,
  listConnectRequests,
} from "@/lib/prescriber-directory.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/find-prescriber")({
  ssr: false,
  component: FindPrescriberPage,
});

type Listing = Awaited<ReturnType<typeof searchDirectory>>["listings"][number];

function FindPrescriberPage() {
  const qc = useQueryClient();
  const search = useServerFn(searchDirectory);
  const fetchRequests = useServerFn(listConnectRequests);
  const send = useServerFn(sendConnectRequest);

  const q = useQuery({ queryKey: ["prescriber-directory-search"], queryFn: () => search() });
  const reqsQ = useQuery({ queryKey: ["connect-requests"], queryFn: () => fetchRequests(), refetchInterval: 60_000 });

  const [townQuery, setTownQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [target, setTarget] = useState<Listing | null>(null);
  const [message, setMessage] = useState("");

  const listings = q.data?.listings ?? [];
  const sent = q.data?.sent ?? [];
  const sentMap = useMemo(() => new Map(sent.map((s) => [s.prescriber_user_id, s.status])), [sent]);
  const myRequests = (reqsQ.data ?? []).filter((r) => r.direction === "sent");

  const allServices = useMemo(
    () => Array.from(new Set(listings.flatMap((l) => l.services))).sort(),
    [listings],
  );

  const filtered = listings.filter((l) => {
    const tq = townQuery.trim().toLowerCase();
    if (tq && !(`${l.town} ${l.postcode_area ?? ""}`.toLowerCase().includes(tq))) return false;
    if (serviceFilter && !l.services.includes(serviceFilter)) return false;
    return true;
  });

  const sendMut = useMutation({
    mutationFn: () => send({ data: { prescriber_user_id: target!.user_id, message: message.trim() } }),
    onSuccess: () => {
      toast.success("Request sent — the prescriber will be in touch");
      setTarget(null);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["prescriber-directory-search"] });
      qc.invalidateQueries({ queryKey: ["connect-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl">Find a prescriber</h2>
        <p className="text-sm text-muted-foreground">
          Browse approved prescribers and request to connect. Their contact details are shared once they accept.
        </p>
      </div>

      {/* My requests */}
      {myRequests.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">Your requests</p>
            {myRequests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {r.prescriber_name}
                    {r.prescriber_town ? <span className="text-muted-foreground"> · {r.prescriber_town}</span> : null}
                  </div>
                  {r.status === "accepted" && (r.prescriber_contact_email || r.prescriber_contact_phone) ? (
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      {r.prescriber_contact_email && (
                        <a href={`mailto:${r.prescriber_contact_email}`} className="flex items-center gap-1 text-primary underline">
                          <Mail className="h-3.5 w-3.5" />{r.prescriber_contact_email}
                        </a>
                      )}
                      {r.prescriber_contact_phone && (
                        <a href={`tel:${r.prescriber_contact_phone}`} className="flex items-center gap-1 text-primary underline">
                          <Phone className="h-3.5 w-3.5" />{r.prescriber_contact_phone}
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.status === "pending" ? "Waiting for them to respond" : r.status === "accepted" ? "Accepted — they'll reach out" : "Declined"}
                    </div>
                  )}
                </div>
                <Badge variant={r.status === "pending" ? "default" : r.status === "accepted" ? "secondary" : "outline"}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={townQuery}
            onChange={(e) => setTownQuery(e.target.value)}
            placeholder="Search by town or postcode area…"
            className="h-12 rounded-xl pl-10"
          />
        </div>
        {allServices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allServices.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setServiceFilter((cur) => (cur === s ? null : s))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  serviceFilter === s ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/50",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {q.isLoading ? (
        <p className="p-8 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Compass className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">
              {listings.length === 0
                ? "No prescribers are listed yet."
                : "No prescribers match your search."}
            </p>
            {listings.length === 0 && (
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Prescribers choose to appear here once they've been approved on MODO. As soon as one lists
                themselves you'll see their area, what they prescribe and how to request a connection.
              </p>
            )}
          </CardContent>
        </Card>

      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((l) => {
            const sentStatus = sentMap.get(l.user_id);
            return (
              <Card key={l.user_id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{l.display_name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {l.town}{l.postcode_area ? ` ${l.postcode_area}` : ""} · covers ~{l.travel_radius_miles} mi
                      </div>
                      {l.regulatory_body && (
                        <div className="text-xs text-muted-foreground">{l.regulatory_body.toUpperCase()}-registered prescriber</div>
                      )}
                    </div>
                  </div>

                  {l.bio && <p className="line-clamp-3 text-sm text-muted-foreground">{l.bio}</p>}

                  {l.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {l.services.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {l.availability && <span>{l.availability}</span>}
                    <span className="font-medium text-foreground">
                      {l.rates_on_request ? "Rates on request" : l.day_rate != null ? `£${l.day_rate}/day` : "Rates on request"}
                    </span>
                  </div>

                  {sentStatus === "pending" ? (
                    <Button disabled variant="outline" className="h-10 w-full rounded-xl">Request sent</Button>
                  ) : sentStatus === "accepted" ? (
                    <Button disabled variant="secondary" className="h-10 w-full rounded-xl">
                      <Handshake className="mr-1.5 h-4 w-4" /> Connected
                    </Button>
                  ) : (
                    <Button className="h-10 w-full rounded-xl" onClick={() => { setTarget(l); setMessage(""); }}>
                      <Handshake className="mr-1.5 h-4 w-4" /> Request to connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Connect dialog */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect with {target?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Introduce your clinic and what you need. Your clinic name and account contact details are sent with the request — their details are shared with you only if they accept.
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Hi — we run a clinic in ___ and are looking for a prescriber for toxins, roughly one clinic day a month…"
            />
            <div className="text-right text-xs text-muted-foreground">{message.length}/1000</div>
            <Button
              className="h-11 w-full rounded-xl"
              disabled={sendMut.isPending || message.trim().length < 10}
              onClick={() => sendMut.mutate()}
            >
              {sendMut.isPending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
