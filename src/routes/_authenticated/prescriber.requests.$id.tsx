import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getRxRequest,
  decideRxRequest,
  listRxMessages,
  sendRxMessage,
  markRxRead,
  addRxAttachment,
  type RxStatus,
} from "@/lib/rx-requests.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  MessageCircleQuestion,
  Send,
  Paperclip,
  Mic,
  Square,
  Image as ImageIcon,
  FileText,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prescriber/requests/$id")({
  head: () => ({ meta: [{ title: "Review prescription request | MODO Hub" }] }),
  component: RxRequestDetail,
});

function StatusBadge({ status }: { status: RxStatus }) {
  const map: Record<RxStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
    awaiting_info: { label: "Awaiting info", cls: "bg-blue-100 text-blue-800" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
    declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
    withdrawn: { label: "Withdrawn", cls: "bg-neutral-200 text-neutral-700" },
  };
  const m = map[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function RxRequestDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchReq = useServerFn(getRxRequest);
  const decide = useServerFn(decideRxRequest);
  const fetchMsgs = useServerFn(listRxMessages);
  const send = useServerFn(sendRxMessage);
  const markRead = useServerFn(markRxRead);
  const addAtt = useServerFn(addRxAttachment);

  const reqQ = useQuery({
    queryKey: ["rx-req", id],
    queryFn: () => fetchReq({ data: { id } }),
    refetchInterval: 15_000,
  });

  const threadId = reqQ.data?.thread?.id;
  const msgsQ = useQuery({
    queryKey: ["rx-msgs", threadId],
    queryFn: () => (threadId ? fetchMsgs({ data: { thread_id: threadId } }) : Promise.resolve([])),
    enabled: !!threadId,
  });

  // Realtime updates
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`rx-thread-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rx_chat_messages", filter: `thread_id=eq.${threadId}` }, () => {
        qc.invalidateQueries({ queryKey: ["rx-msgs", threadId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "prescription_requests", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["rx-req", id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "prescription_request_events", filter: `request_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["rx-req", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, id, qc]);

  // Mark read
  useEffect(() => {
    if (threadId && msgsQ.data && msgsQ.data.length) markRead({ data: { thread_id: threadId } }).catch(() => {});
  }, [threadId, msgsQ.data, markRead]);

  if (reqQ.isLoading) return <div className="p-6">Loading…</div>;
  if (reqQ.error || !reqQ.data) return <div className="p-6">Not found.</div>;

  const { request: r, events, attachments, partner_name, viewer_role } = reqQ.data;
  const status = r.status as RxStatus;
  const snap = (r.patient_snapshot ?? {}) as { full_name?: string; dob?: string; allergies?: string };
  const med = (r.medical_history ?? {}) as Record<string, unknown>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: viewer_role === "prescriber" ? "/prescriber/requests" : "/dashboard/rx-requests" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">{r.treatment_name}</h1>
          <div className="text-sm text-muted-foreground">
            {viewer_role === "prescriber" ? `From ${partner_name}` : `To ${partner_name}`} • {new Date(r.created_at).toLocaleString()}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Patient snapshot */}
          <Card>
            <CardHeader><CardTitle>Patient</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><b>Name:</b> {snap.full_name ?? "—"}</div>
              <div><b>DOB:</b> {snap.dob ?? "—"}</div>
              <div><b>Allergies:</b> {snap.allergies || "None recorded"}</div>
            </CardContent>
          </Card>

          {/* Treatment requested */}
          <Card>
            <CardHeader><CardTitle>Treatment requested</CardTitle></CardHeader>
            <CardContent className="text-sm grid grid-cols-2 gap-y-2">
              <div><b>Treatment:</b> {r.treatment_name}</div>
              <div><b>Product:</b> {r.product_name ?? "—"}</div>
              <div><b>Dose:</b> {r.dose ?? "—"}</div>
              <div><b>Units:</b> {r.units ?? "—"}</div>
              <div><b>Area:</b> {r.area ?? "—"}</div>
              <div><b>Batch:</b> {r.batch_number ?? "—"}</div>
              {r.clinical_notes && (
                <div className="col-span-2 whitespace-pre-wrap"><b>Notes:</b> {r.clinical_notes}</div>
              )}
            </CardContent>
          </Card>

          {/* Medical history */}
          {Object.keys(med).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Medical history</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <pre className="whitespace-pre-wrap text-xs bg-muted/40 rounded p-3">{JSON.stringify(med, null, 2)}</pre>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attachments</CardTitle>
                {viewer_role === "practitioner" && <UploadAttachmentBtn requestId={id} onDone={() => qc.invalidateQueries({ queryKey: ["rx-req", id] })} addAtt={addAtt} />}
              </div>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No attachments yet.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {attachments.map((a) => (
                    <a key={a.id} href={a.url ?? "#"} target="_blank" rel="noreferrer" className="block border rounded overflow-hidden hover:shadow">
                      {a.mime_type?.startsWith("image/") && a.url ? (
                        <img src={a.url} alt={a.caption ?? ""} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center bg-muted"><FileText className="h-8 w-8 text-muted-foreground" /></div>
                      )}
                      <div className="text-xs p-2 truncate">{a.caption ?? a.kind}</div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decision panel (prescriber only, still open) */}
          {viewer_role === "prescriber" && (status === "pending" || status === "awaiting_info") && (
            <DecisionPanel id={id} onDone={() => qc.invalidateQueries({ queryKey: ["rx-req", id] })} decide={decide} />
          )}

          {/* Practitioner reply */}
          {viewer_role === "practitioner" && status === "awaiting_info" && (
            <ReplyPanel id={id} onDone={() => qc.invalidateQueries({ queryKey: ["rx-req", id] })} decide={decide} />
          )}

          {/* Withdraw (practitioner, still open) */}
          {viewer_role === "practitioner" && (status === "pending" || status === "awaiting_info") && (
            <Card>
              <CardContent className="pt-6">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Withdraw this request?")) return;
                    await decide({ data: { id, action: "withdraw" } });
                    qc.invalidateQueries({ queryKey: ["rx-req", id] });
                  }}
                >
                  Withdraw request
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: timeline + chat */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Decision timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l ml-2 space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="pl-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary"></div>
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                    <div className="text-sm font-medium capitalize">{e.kind.replaceAll("_", " ")}</div>
                    {e.summary && <div className="text-sm text-muted-foreground">{e.summary}</div>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {threadId && (
            <ChatPanel
              threadId={threadId}
              requestId={id}
              messages={msgsQ.data ?? []}
              onSend={async (payload) => {
                await send({ data: { ...payload, thread_id: threadId, request_id: id } });
                qc.invalidateQueries({ queryKey: ["rx-msgs", threadId] });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionPanel({ id, onDone, decide }: { id: string; onDone: () => void; decide: ReturnType<typeof useServerFn<typeof decideRxRequest>> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "decline" | "request_info">(null);
  async function run(action: "approve" | "decline" | "request_info") {
    if ((action === "decline" || action === "request_info") && !note.trim()) {
      toast.error("Please add a note", { description: "A short reason helps the practitioner." });
      return;
    }
    setBusy(action);
    try {
      await decide({ data: { id, action, note: note.trim() || undefined } });
      setNote("");
      onDone();
      toast("Saved");
    } catch (e) {
      toast.error("Failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Your decision</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Clinical comments…" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("approve")} disabled={!!busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button onClick={() => run("request_info")} disabled={!!busy} variant="outline">
            <MessageCircleQuestion className="h-4 w-4 mr-1" /> Request more info
          </Button>
          <Button onClick={() => run("decline")} disabled={!!busy} variant="destructive">
            <X className="h-4 w-4 mr-1" /> Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReplyPanel({ id, onDone, decide }: { id: string; onDone: () => void; decide: ReturnType<typeof useServerFn<typeof decideRxRequest>> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader><CardTitle>Reply with information</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Answer the prescriber's question…" />
        <Button
          disabled={busy || !note.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await decide({ data: { id, action: "comment", note: note.trim() } });
              setNote("");
              onDone();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send className="h-4 w-4 mr-1" /> Send reply
        </Button>
      </CardContent>
    </Card>
  );
}

function UploadAttachmentBtn({ requestId, onDone, addAtt }: { requestId: string; onDone: () => void; addAtt: ReturnType<typeof useServerFn<typeof addRxAttachment>> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(kind: "clinical_photo" | "before" | "after" | "consent_pdf" | "other") {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const path = `${requestId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("rx-request-media").upload(path, file, { upsert: false });
      if (error) throw error;
      await addAtt({ data: { request_id: requestId, kind, storage_path: path, mime_type: file.type, size_bytes: file.size, caption: file.name } });
      toast("Uploaded");
      onDone();
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={() => pick("clinical_photo")} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Paperclip className="h-4 w-4 mr-1" /> Upload
      </Button>
    </div>
  );
}

function ChatPanel({
  threadId,
  requestId,
  messages,
  onSend,
}: {
  threadId: string;
  requestId: string;
  messages: Array<{ id: string; sender_id: string | null; kind: string; body: string | null; url: string | null; attachment_mime: string | null; duration_ms: number | null; created_at: string }>;
  onSend: (p: { kind: "text" | "image" | "pdf" | "voice"; body?: string | null; attachment_path?: string | null; attachment_mime?: string | null; attachment_size?: number | null; duration_ms?: number | null }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function uploadAndSend(file: File | Blob, kind: "image" | "pdf" | "voice", filename: string, duration_ms?: number) {
    const path = `${threadId}/${crypto.randomUUID()}-${filename}`;
    const { error } = await supabase.storage.from("rx-chat-media").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (error) { toast.error("Upload failed", { description: error.message }); return; }
    await onSend({ kind, attachment_path: path, attachment_mime: file.type, attachment_size: (file as File).size ?? undefined, duration_ms });
  }

  async function pickFile(kind: "image" | "pdf") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "image" ? "image/*" : "application/pdf";
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      await uploadAndSend(f, kind, f.name);
    };
    input.click();
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const dur = Date.now() - startedRef.current;
        await uploadAndSend(blob, "voice", `voice-${Date.now()}.webm`, dur);
        stream.getTracks().forEach((t) => t.stop());
      };
      recRef.current = rec;
      startedRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch (e) {
      toast.error("Microphone blocked", { description: (e as Error).message });
    }
  }
  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="py-3"><CardTitle className="text-base">Secure clinical chat</CardTitle></CardHeader>
      <CardContent ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pt-0">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === uid;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.kind === "text" && <div className="whitespace-pre-wrap">{m.body}</div>}
                  {m.kind === "image" && m.url && <img src={m.url} className="rounded max-h-64" alt="" />}
                  {m.kind === "pdf" && m.url && <a href={m.url} target="_blank" rel="noreferrer" className="underline flex items-center gap-1"><FileText className="h-4 w-4" /> View PDF</a>}
                  {m.kind === "voice" && m.url && <audio controls src={m.url} className="max-w-full" />}
                  <div className={`text-[10px] mt-1 opacity-70 ${mine ? "text-primary-foreground" : ""}`}>{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
      <div className="border-t p-2 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => pickFile("image")} title="Image"><ImageIcon className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => pickFile("pdf")} title="PDF"><FileText className="h-4 w-4" /></Button>
        <Button size="sm" variant={recording ? "destructive" : "ghost"} onClick={recording ? stopRecording : startRecording} title="Voice">
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="min-h-[38px] max-h-24 flex-1"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) { onSend({ kind: "text", body: text.trim() }); setText(""); } } }}
        />
        <Button size="sm" onClick={() => { if (text.trim()) { onSend({ kind: "text", body: text.trim() }); setText(""); } }}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
