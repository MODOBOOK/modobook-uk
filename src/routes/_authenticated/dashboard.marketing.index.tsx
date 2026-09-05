import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  listCampaigns, saveCampaignDraft, deleteCampaign, getMarketingOverview,
  previewBulkMarketingOptIn, bulkMarketingOptIn,
} from '@/lib/marketing.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Mail, Trash2, Loader2, Users2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboard/marketing/')({
  component: CampaignsPage,
})

type Campaign = {
  id: string; name: string; subject: string; status: string;
  scheduled_for: string | null; sent_at: string | null;
  recipient_count: number; sent_count: number; failed_count: number;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    scheduled: 'bg-blue-100 text-blue-800',
    sending: 'bg-amber-100 text-amber-800',
    sent: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-muted text-muted-foreground',
    failed: 'bg-red-100 text-red-800',
  }
  return <Badge className={map[status] || ''}>{status}</Badge>
}

function CampaignsPage() {
  const list = useServerFn(listCampaigns)
  const create = useServerFn(saveCampaignDraft)
  const remove = useServerFn(deleteCampaign)
  const overview = useServerFn(getMarketingOverview)
  const navigate = useNavigate()
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ optedIn: number; totalPatients: number; totalSentLast30Days: number; campaignsLast30Days: number } | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([list(), overview()])
      .then(([rows, s]) => { if (alive) { setItems(rows as Campaign[]); setStats(s) } })
      .catch((e) => toast.error(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const c = await create({ data: { name: newName.trim(), subject: '', body_json: [] } })
      setNewOpen(false); setNewName('')
      navigate({ to: '/dashboard/marketing/campaigns/$id', params: { id: (c as any).id } })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create') }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign?')) return
    try { await remove({ data: { id } }); setItems((prev) => prev.filter((c) => c.id !== id)); toast.success('Deleted') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Opted in" value={stats.optedIn} sub={`of ${stats.totalPatients} patients`} />
          <StatCard label="Campaigns (30d)" value={stats.campaignsLast30Days} />
          <StatCard label="Emails sent (30d)" value={stats.totalSentLast30Days} />
          <div className="rounded-xl border border-dashed border-border p-4 flex flex-col justify-center gap-2">
            <p className="text-xs text-muted-foreground">Marketing consent</p>
            <p className="text-xs">Only patients who opted in receive marketing.</p>
            <BulkOptInDialog onDone={() => overview().then(setStats).catch(() => {})} />
          </div>

        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Campaigns</h2>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New campaign</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
            <Input placeholder="Internal name (e.g. Summer offer)" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first email to opted-in patients.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <Card key={c.id} className="hover:border-primary/50 transition">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <Link to="/dashboard/marketing/campaigns/$id" params={{ id: c.id }} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.subject || <em>No subject yet</em>}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {statusBadge(c.status)}
                    {c.status === 'scheduled' && c.scheduled_for && <span>Sends {new Date(c.scheduled_for).toLocaleString()}</span>}
                    {c.status === 'sent' && <span><Users2 className="h-3 w-3 inline mr-1" />{c.sent_count}/{c.recipient_count} sent</span>}
                    {c.sent_at && <span>· {new Date(c.sent_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function BulkOptInDialog({ onDone }: { onDone: () => void }) {
  const preview = useServerFn(previewBulkMarketingOptIn)
  const run = useServerFn(bulkMarketingOptIn)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ totalActive: number; alreadyOptedIn: number; eligible: number; skippedNoEmail: number; skippedNoAppointment: number; skippedUnsubscribed: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [ack, setAck] = useState({ existingCustomers: false, similarServices: false, optOutOffered: false, responsible: false })
  const allAck = ack.existingCustomers && ack.similarServices && ack.optOutOffered && ack.responsible

  useEffect(() => {
    if (!open) return
    setData(null); setConfirmText(''); setAck({ existingCustomers: false, similarServices: false, optOutOffered: false, responsible: false })
    preview().then((d: any) => setData(d)).catch((e: any) => toast.error(e.message))
  }, [open])

  async function handleRun() {
    setBusy(true)
    try {
      const res: any = await run({ data: { confirmText, acknowledgements: ack } })
      toast.success(`${res.updated} patient${res.updated === 1 ? '' : 's'} opted in`)
      setOpen(false); onDone()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full"><ShieldCheck className="h-4 w-4 mr-2" />Opt all patients in</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Opt existing patients into marketing</DialogTitle></DialogHeader>

        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Read this before you continue</p>
            <p className="mt-1">UK rules (PECR &amp; UK GDPR) only let you email marketing to people who are already your customers, about your own similar treatments, and only if they were given a clear way to say no. This action records that basis against each patient with today&rsquo;s date.</p>
          </div>
        </div>

        {!data ? (
          <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="rounded-lg border border-border p-3 text-sm space-y-1">
              <p className="font-medium">{data.eligible} patient{data.eligible === 1 ? '' : 's'} will be opted in</p>
              <p className="text-xs text-muted-foreground">Out of {data.totalActive} patients. {data.alreadyOptedIn} already opted in.</p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 pt-1 space-y-0.5">
                <li>{data.skippedNoAppointment} skipped &mdash; never booked with you</li>
                <li>{data.skippedNoEmail} skipped &mdash; no email address</li>
                <li>{data.skippedUnsubscribed} skipped &mdash; previously unsubscribed</li>
              </ul>
            </div>

            <div className="space-y-2 text-sm">
              <AckRow checked={ack.existingCustomers} onChange={(v) => setAck((p) => ({ ...p, existingCustomers: v }))}
                label="These people are my own existing patients and gave me their details during a booking or enquiry." />
              <AckRow checked={ack.similarServices} onChange={(v) => setAck((p) => ({ ...p, similarServices: v }))}
                label="I will only email them about my own similar treatments and offers." />
              <AckRow checked={ack.optOutOffered} onChange={(v) => setAck((p) => ({ ...p, optOutOffered: v }))}
                label="Every email includes a one-click unsubscribe, and I will honour opt-outs immediately." />
              <AckRow checked={ack.responsible} onChange={(v) => setAck((p) => ({ ...p, responsible: v }))}
                label="I am the data controller for these patients and take responsibility for this decision." />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Type <strong>OPT IN</strong> to confirm</p>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="OPT IN" />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleRun} disabled={busy || !data || !data.eligible || !allAck || confirmText.trim().toUpperCase() !== 'OPT IN'}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Opt them in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-current" />
      <span className="text-sm">{label}</span>
    </label>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {

  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-serif mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
