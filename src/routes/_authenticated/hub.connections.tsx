import { createFileRoute } from "@tanstack/react-router";
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
import { Loader2, Link as LinkIcon, X, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hub/connections")({
  ssr: false,
  component: Connections,
});

function Connections() {
  const list = useServerFn(listHubData);
  const send = useServerFn(sendLinkRequest);
  const respond = useServerFn(respondToLinkRequest);
  const remove = useServerFn(removeLink);
  const getCtx = useServerFn(getHubContext);

  const [links, setLinks] = useState<Awaited<ReturnType<typeof listHubData>>>([]);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [canSend, setCanSend] = useState(true);

  async function refresh() {
    const [data, ctx] = await Promise.all([list(), getCtx()]);
    setLinks(data);
    // Prescribers must be approved before sending requests
    setCanSend(ctx.role !== "prescriber" || ctx.prescriber?.status === "approved");
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e.message));
  }, []);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await send({ data: { code, note: note || undefined } });
      toast.success("Request sent");
      setCode("");
      setNote("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const incoming = links.filter((l) => l.direction === "incoming" && l.status === "pending");
  const outgoing = links.filter((l) => l.direction === "outgoing" && l.status === "pending");
  const accepted = links.filter((l) => l.status === "accepted");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-4 w-4 text-primary" /> Send a connection request
          </CardTitle>
          <CardDescription>Enter the MODO code of the person you want to connect with.</CardDescription>
        </CardHeader>
        <CardContent>
          {!canSend ? (
            <p className="text-sm text-muted-foreground">
              You'll be able to send requests once your prescriber verification is approved.
            </p>
          ) : (
            <form onSubmit={onSend} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="code">MODO code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="MODO-ABC123"
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
                  placeholder="Hi, I'd love to collaborate on prescribing for my clinic."
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

      <Section title="Incoming requests" items={incoming} empty="No incoming requests.">
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

      <Section title="Outgoing requests" items={outgoing} empty="No pending requests.">
        {(l) => (
          <Button size="sm" variant="ghost" onClick={() => remove({ data: { id: l.id } }).then(refresh)}>
            <X className="mr-1 h-3 w-3" /> Cancel
          </Button>
        )}
      </Section>

      <Section title="Connected" items={accepted} empty="No connections yet.">
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
                    <span className="font-medium">{l.other_name ?? "Unknown user"}</span>
                    {l.other_kind && <Badge variant="secondary" className="capitalize">{l.other_kind}</Badge>}
                  </div>
                  {l.other_code && (
                    <div className="font-mono text-xs text-muted-foreground">MODO-{l.other_code}</div>
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
