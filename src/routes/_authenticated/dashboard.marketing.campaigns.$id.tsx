import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  getCampaign, saveCampaignDraft, sendCampaignNow, scheduleCampaign,
  cancelScheduledCampaign, sendTestEmail, listSegments, previewSegmentCount,
  listTemplates, getCampaignAnalytics,
} from '@/lib/marketing.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Loader2, Save, Send, Calendar as CalIcon, Trash2, Plus, ArrowUp, ArrowDown,
  Type as TypeIcon, Image as ImageIcon, MousePointerClick, Minus, Space, Heading as HeadingIcon,
  Eye, Code,
} from 'lucide-react'
import { toast } from 'sonner'
import { getMyProfile } from '@/lib/profiles.functions'
import { ImageUploader } from '@/components/ImageUploader'
import { Checkbox } from '@/components/ui/checkbox'
import type { Block } from '@/lib/email-templates/marketing-broadcast'

export const Route = createFileRoute('/_authenticated/dashboard/marketing/campaigns/$id')({
  component: CampaignEditor,
})

function CampaignEditor() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const get = useServerFn(getCampaign)
  const save = useServerFn(saveCampaignDraft)
  const sendNow = useServerFn(sendCampaignNow)
  const schedule = useServerFn(scheduleCampaign)
  const cancel = useServerFn(cancelScheduledCampaign)
  const sendTest = useServerFn(sendTestEmail)
  const segsFn = useServerFn(listSegments)
  const previewCount = useServerFn(previewSegmentCount)
  const tmplsFn = useServerFn(listTemplates)
  const analyticsFn = useServerFn(getCampaignAnalytics)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [campaign, setCampaign] = useState<any>(null)
  const [name, setName] = useState(''); const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState(''); const [blocks, setBlocks] = useState<Block[]>([])
  const [segmentId, setSegmentId] = useState<string>('all')
  const [segments, setSegments] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [scheduleTime, setScheduleTime] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [analytics, setAnalytics] = useState<any>(null)

  useEffect(() => {
    let alive = true
    Promise.all([get({ data: { id } }), segsFn(), tmplsFn()])
      .then(([c, s, t]) => {
        if (!alive) return
        setCampaign(c); setName((c as any).name); setSubject((c as any).subject || '')
        setPreheader((c as any).preheader || ''); setBlocks(((c as any).body_json || []) as Block[])
        setSegmentId((c as any).segment_id || 'all')
        setSegments(s as any[]); setTemplates(t as any[])
        if ((c as any).status === 'sent') {
          analyticsFn({ data: { id } }).then((a) => alive && setAnalytics(a))
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    let alive = true
    previewCount({ data: { segmentId: segmentId === 'all' ? null : segmentId } })
      .then((r) => alive && setRecipientCount((r as any).count))
      .catch(() => alive && setRecipientCount(null))
    return () => { alive = false }
  }, [segmentId])

  const readOnly = campaign && (campaign.status === 'sent' || campaign.status === 'sending')

  async function doSave(silent = false) {
    setSaving(true)
    try {
      const saved = await save({ data: {
        id, name, subject, preheader, body_json: blocks,
        segment_id: segmentId === 'all' ? null : segmentId,
      } })
      setCampaign(saved)
      if (!silent) toast.success('Saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function doSendNow() {
    await doSave(true)
    if (!confirm(`Send this to ${recipientCount ?? 0} patients now?`)) return
    try {
      const r = await sendNow({ data: { id } })
      toast.success(`Sent to ${(r as any).sent} recipients`)
      navigate({ to: '/dashboard/marketing' })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Send failed') }
  }

  async function doSchedule() {
    if (!scheduleTime) return
    await doSave(true)
    try {
      await schedule({ data: { id, scheduled_for: new Date(scheduleTime).toISOString() } })
      toast.success('Scheduled')
      navigate({ to: '/dashboard/marketing' })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Schedule failed') }
  }

  async function doCancel() {
    try { const c = await cancel({ data: { id } }); setCampaign(c); toast.success('Cancelled') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function doTest(toSelf = false) {
    if (!toSelf && !testEmail) return
    await doSave(true)
    try {
      const r = await sendTest({ data: { id, to: toSelf ? null : testEmail } })
      toast.success(`Test sent to ${(r as any).sentTo || testEmail}`)
    }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  function applyTemplate(tid: string) {
    const t = templates.find((x) => x.id === tid); if (!t) return
    setSubject(t.subject || ''); setPreheader(t.preheader || ''); setBlocks((t.body_json || []) as Block[])
    toast.success(`Applied template: ${t.name}`)
  }

  if (loading) return <div className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-medium" disabled={readOnly} />
          <Badge variant="outline">{campaign?.status}</Badge>
        </div>

        <Card><CardContent className="p-4 space-y-3">
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line…" disabled={readOnly} />
          </div>
          <div>
            <Label>Preheader (preview text)</Label>
            <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Shown in inbox preview" disabled={readOnly} />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Personalise with merge tags — copy any of these into your text:</p>
            <div className="flex flex-wrap gap-1">
              {['{{first_name}}', '{{clinic_name}}', '{{last_treatment}}', '{{booking_url}}'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="px-2 py-0.5 rounded bg-muted hover:bg-muted/70 font-mono text-[11px]"
                  onClick={() => { navigator.clipboard?.writeText(tag); toast.success(`Copied ${tag}`) }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

        </CardContent></Card>

        <BlockEditor blocks={blocks} setBlocks={setBlocks} readOnly={readOnly} />

        {analytics && (
          <Card><CardContent className="p-4">
            <h3 className="font-medium mb-2">Send results</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Total: <b>{analytics.total}</b></span>
              {Object.entries(analytics.byStatus).map(([k, v]) => (
                <span key={k} className="capitalize">{k}: <b>{v as number}</b></span>
              ))}
            </div>
          </CardContent></Card>
        )}
      </div>

      <div className="space-y-4">
        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Audience</h3>
          <Select value={segmentId} onValueChange={setSegmentId} disabled={readOnly}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All opted-in patients</SelectItem>
              {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {recipientCount === null ? '…' : <><b>{recipientCount}</b> opted-in {recipientCount === 1 ? 'patient' : 'patients'} match</>}
          </p>
        </CardContent></Card>

        {templates.length > 0 && !readOnly && (
          <Card><CardContent className="p-4 space-y-2">
            <h3 className="font-medium">Start from a template</h3>
            <Select onValueChange={applyTemplate}>
              <SelectTrigger><SelectValue placeholder="Choose template…" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Send</h3>
          {!readOnly && (
            <>
              <Button className="w-full" onClick={() => doSave()} disabled={saving} variant="outline">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save draft
              </Button>

              <div className="space-y-2">
                <Button variant="secondary" className="w-full" onClick={() => doTest(true)}>
                  <Eye className="h-4 w-4 mr-2" />Send preview to me
                </Button>
                <div className="flex gap-2">
                  <Input type="email" placeholder="someone@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                  <Button variant="outline" onClick={() => doTest(false)} disabled={!testEmail}><Eye className="h-4 w-4" /></Button>
                </div>
              </div>

              <Button className="w-full" onClick={doSendNow} disabled={!recipientCount}>
                <Send className="h-4 w-4 mr-2" />Send now
              </Button>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs">Or schedule for later</Label>
                <Input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                <Button variant="outline" className="w-full" onClick={doSchedule} disabled={!scheduleTime || !recipientCount}>
                  <CalIcon className="h-4 w-4 mr-2" />Schedule
                </Button>
              </div>
            </>
          )}
          {campaign?.status === 'scheduled' && (
            <>
              <p className="text-sm">Scheduled for <b>{new Date(campaign.scheduled_for).toLocaleString()}</b></p>
              <Button variant="destructive" className="w-full" onClick={doCancel}>Cancel schedule</Button>
            </>
          )}
          {readOnly && campaign?.status === 'sent' && (
            <p className="text-sm text-muted-foreground">Sent on {new Date(campaign.sent_at).toLocaleString()}.</p>
          )}
        </CardContent></Card>
      </div>
    </div>
  )
}

function BlockEditor({ blocks, setBlocks, readOnly }: { blocks: Block[]; setBlocks: (b: Block[]) => void; readOnly: boolean }) {
  const profileFn = useServerFn(getMyProfile)
  const [profileId, setProfileId] = useState<string>('')
  useEffect(() => { profileFn({} as any).then((p: any) => setProfileId(p?.id || '')).catch(() => {}) }, [])
  function add(b: Block) { setBlocks([...blocks, b]) }
  function update(i: number, patch: Partial<Block>) {
    const next = blocks.slice(); (next[i] as any) = { ...next[i], ...patch }; setBlocks(next)
  }
  function remove(i: number) { setBlocks(blocks.filter((_, idx) => idx !== i)) }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= blocks.length) return
    const next = blocks.slice(); [next[i], next[j]] = [next[j], next[i]]; setBlocks(next)
  }
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Content</h3>
        {!readOnly && (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => add({ type: 'heading', text: 'Heading' })}><HeadingIcon className="h-3 w-3 mr-1" />Heading</Button>
            <Button size="sm" variant="outline" onClick={() => add({ type: 'paragraph', text: 'Write your message here…' })}><TypeIcon className="h-3 w-3 mr-1" />Text</Button>
            <Button size="sm" variant="outline" onClick={() => add({ type: 'button', text: 'Book now', url: '{{booking_url}}' })}><MousePointerClick className="h-3 w-3 mr-1" />Book now CTA</Button>
            <Button size="sm" variant="outline" onClick={() => add({ type: 'button', text: 'Learn more', url: 'https://' })}><MousePointerClick className="h-3 w-3 mr-1" />Custom button</Button>

            <Button size="sm" variant="outline" onClick={() => add({ type: 'image', src: '' })}><ImageIcon className="h-3 w-3 mr-1" />Image</Button>
            <Button size="sm" variant="outline" onClick={() => add({ type: 'divider' })}><Minus className="h-3 w-3 mr-1" />Divider</Button>
            <Button size="sm" variant="outline" onClick={() => add({ type: 'spacer' })}><Space className="h-3 w-3 mr-1" />Spacer</Button>
            <Button size="sm" variant="outline" onClick={() => add({ type: 'html', html: '', full: false })}><Code className="h-3 w-3 mr-1" />Embed code</Button>
          </div>
        )}
      </div>
      {blocks.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Add blocks above to compose your email.</p>}
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-lg border border-border p-3 bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{b.type}</span>
              {!readOnly && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
            {b.type === 'heading' && <Input value={b.text} onChange={(e) => update(i, { text: e.target.value })} disabled={readOnly} />}
            {b.type === 'paragraph' && <Textarea value={b.text} onChange={(e) => update(i, { text: e.target.value })} rows={4} disabled={readOnly} />}
            {b.type === 'button' && (
              <div className="grid grid-cols-2 gap-2">
                <Input value={b.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="Button text" disabled={readOnly} />
                <Input value={b.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://…" disabled={readOnly} />
              </div>
            )}
            {b.type === 'image' && (
              <div className="space-y-2">
                {profileId ? (
                  <ImageUploader
                    label="Image"
                    value={b.src}
                    onChange={(url) => update(i, { src: url || '' } as any)}
                    profileId={profileId}
                    folder="marketing"
                    previewClass="mt-2 max-h-40 rounded object-contain"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Loading uploader…</p>
                )}
                <Input value={b.alt || ''} onChange={(e) => update(i, { alt: e.target.value })} placeholder="Alt text (for accessibility)" disabled={readOnly} />
              </div>
            )}
            {b.type === 'html' && (
              <div className="space-y-2">
                <Textarea
                  value={b.html}
                  onChange={(e) => update(i, { html: e.target.value } as any)}
                  rows={10}
                  spellCheck={false}
                  className="font-mono text-xs"
                  placeholder="<table>…paste your email HTML here…</table>"
                  disabled={readOnly}
                />
                <label className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                  <Checkbox
                    checked={!!b.full}
                    onCheckedChange={(v) => update(i, { full: !!v } as any)}
                    disabled={readOnly}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">Send as a full email</span>
                    <span className="block text-xs text-muted-foreground">
                      Your code becomes the entire email — no MODO header, logo or styling. Only the unsubscribe line is added (legally required). Merge tags like {'{{first_name}}'} still work.
                    </span>
                  </span>
                </label>
              </div>
            )}
            {b.type === 'divider' && <p className="text-xs text-muted-foreground">— horizontal line —</p>}
            {b.type === 'spacer' && (
              <Select value={b.size || 'md'} onValueChange={(v) => update(i, { size: v as any })} disabled={readOnly}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </CardContent></Card>
  )
}
