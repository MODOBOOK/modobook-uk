import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  listCampaigns, saveCampaignDraft, deleteCampaign, getMarketingOverview,
} from '@/lib/marketing.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Mail, Trash2, Loader2, Users2 } from 'lucide-react'
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

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-serif mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
