import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listHubData,
  sendLinkRequest,
  respondToLinkRequest,
  removeLink,
  getHubContext,
} from "@/lib/hub.functions";
import { formatHubCode } from "@/lib/hub-format";
import { Loader2, Link as LinkIcon, X, Check, CalendarDays, Copy, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prescriber/connections")({
  ssr: false,
  component: PrescriberConnections,
});

function PrescriberConnections() {
  const list = useServerFn(listHubData);
  const send = useServerFn(sendLinkRequest);
  const respond = useServerFn(respondToLinkRequest);
  const remove = useServerFn(removeLink);
  const getCtx = useServerFn(getHubContext);

  const [links, setLinks] = useState<Awaited<ReturnType<typeof listHubData>>>([]);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);

  async function refresh() {
    const [data, ctx] = await Promise.all([list(), getCtx()]);
    setLinks(data);
    setMyCode(ctx.code ?? null);
    setApproved(ctx.prescriber?.status === "approved");
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e.message));
  }, []);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await send({ data: { code, note: note || undefined } });
      toast.success("Request sent to practitioner");
      setCode("");
      setNote("");
      setShowSend(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!myCode) return;
    navigator.clipboard.writeText(formatHubCode(myCode));
    toast.success("Your prescriber code copied");
  }

  const incoming = links.filter((l) => l.direction === "incoming" && l.status === "pending");
  const outgoing = links.filter((l) => l.direction === "outgoing" && l.status === "pending");
  const accepted = links.filter((l) => l.status === "accepted");
  const hasAnyLink = accepted.length > 0 || incoming.length > 0 || outgoing.length > 0;

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-primary" />
            Your prescriber code
          </CardTitle>
          <CardDescription>
            Share this with practitioners so they can send you a connection request. Once linked, you
            can request clinic days at their clinic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-background px-3 py-2 font-mono text-sm">
              {myCode ? formatHubCode(myCode) : approved ? "—" : "Pending verification"}
            </code>
            {myCode && (
              <Button size="sm" variant="outline" onClick={copyCode}>
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {accepted.length > 0 && (
        <Card className="border-emerald-300/60 bg-emerald-50/40">
          <CardContent className="p-4 text-sm">
            <p className="mb-2">
              You're linked with <strong>{accepted.length}</strong> practitioner
              {accepted.length === 1 ? "" : "s"}. Next: request days at their clinic.
            </p>
            <Link to="/prescriber/visits">
              <Button size="sm" variant="outline">
                <CalendarDays className="mr-2 h-3 w-3" /> Go to Clinic visits
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {(showSend || !hasAnyLink) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4 text-primary" />
              Link with a practitioner
            </CardTitle>
            <CardDescription>
              Enter a practitioner's MODO code (starts with <strong>PR-</strong>). Most practitioners
              will send <em>you</em> the request first — they just need your code above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!approved ? (
              <p className="text-sm text-muted-foreground">
                You'll be able to send requests once your verification is approved. In the meantime,
                practitioners can add you using the code above.
              </p>
            ) : (
              <form onSubmit={onSend} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="code">Practitioner MODO code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="PR-ABC123"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note (optional)</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Hi, happy to prescribe for your clinic."
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={() => setShowSend(true)}>
            <LinkIcon className="mr-2 h-3 w-3" /> Link with another practitioner
          </Button>
        </div>
      )}

      <Section
        title="Incoming requests from practitioners"
        items={incoming}
        empty="No incoming requests. Share your code above so practitioners can add you."
      >
        {(l) => (
          <>
            <Button size="sm" variant="outline" onClick={() => respond({ data: { id: l.id, action: "accept" } }).then(refresh)}>
              <Check className="mr-1 h-3 w-3" /> Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => respond({ data: { id: l.id, action: "decline" } }).then(refresh)}>
              <X className="mr-1 h-3 w-3" /> Decline
            </Button>
          </>
        )}
      </Section>

      <Section title="Your outgoing requests" items={outgoing} empty="No pending requests you sent.">
        {(l) => (
          <Button size="sm" variant="ghost" onClick={() => remove({ data: { id: l.id } }).then(refresh)}>
            <X className="mr-1 h-3 w-3" /> Cancel
          </Button>
        )}
      </Section>

      <Section title="Linked practitioners" items={accepted} empty="No practitioners linked yet.">
        {(l) => (
          <Button size="sm" variant="ghost" onClick={() => remove({ data: { id: l.id } }).then(refresh)}>
            Unlink
          </Button>
        )}
      </Section>
    </div>
  );
}

type Link = Awaited<ReturnType<typeof listHubData>>[number];

function Section({
  title,
  items,
  empty,
  children,
}: {
  title: string;
  items: Link[];
  empty: string;
  children: (l: Link) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.other_name ?? "Unknown practitioner"}</span>
                    {l.other_kind && <Badge variant="secondary" className="capitalize">{l.other_kind}</Badge>}
                  </div>
                  {l.other_code && (
                    <div className="font-mono text-xs text-muted-foreground">{formatHubCode(l.other_code)}</div>
                  )}
                  {l.note && <p className="mt-1 text-xs text-muted-foreground">"{l.note}"</p>}
                </div>
                <div className="flex gap-2">{children(l)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
