import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  listAutomations, saveAutomation, deleteAutomation, toggleAutomation,
  listTemplates,
} from '@/lib/marketing.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog'
import { Cake, Repeat, UserMinus, Newspaper, Sparkles, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboard/marketing/automations')({
  component: AutomationsPage,
})

const TYPE_META: Record<string, { label: string; icon: any; description: string; color: string }> = {
  birthday: { label: 'Birthday', icon: Cake, color: 'bg-pink-100 text-pink-700', description: 'Runs daily. Sends to opted-in patients whose birthday is today.' },
  treatment_interval: { label: 'Treatment interval', icon: Repeat, color: 'bg-blue-100 text-blue-700', description: 'Runs daily. Emails patients X weeks after their last appointment of a chosen treatment.' },
  win_back: { label: 'Win-back', icon: UserMinus, color: 'bg-amber-100 text-amber-700', description: 'Runs daily. Emails patients who haven’t booked in the chosen number of days.' },
  monthly_newsletter: { label: 'Monthly newsletter', icon: Newspaper, color: 'bg-emerald-100 text-emerald-700', description: 'Runs on your chosen day of the month.' },
  custom_recurring: { label: 'Custom recurring', icon: Sparkles, color: 'bg-purple-100 text-purple-700', description: 'Send a template to all opted-in patients on the chosen day of the month.' },
}

function AutomationsPage() {
  const listFn = useServerFn(listAutomations)
  const saveFn = useServerFn(saveAutomation)
  const deleteFn = useServerFn(deleteAutomation)
  const toggleFn = useServerFn(toggleAutomation)
  const tmplsFn = useServerFn(listTemplates)

  const [rows, setRows] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [a, t] = await Promise.all([listFn(), tmplsFn()])
      setRows(a as any[]); setTemplates(t as any[])
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  async function onToggle(row: any, enabled: boolean) {
    try { await toggleFn({ data: { id: row.id, enabled } }); refresh() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }
  async function onDelete(row: any) {
    if (!confirm(`Delete "${row.name}"?`)) return
    try { await deleteFn({ data: { id: row.id } }); refresh() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium">Automations</h2>
          <p className="text-sm text-muted-foreground">Emails that send themselves on the right day, using one of your templates.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null) }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ type: 'birthday', enabled: true, config: {} })}>
              <Plus className="h-4 w-4 mr-2" />New automation
            </Button>
          </DialogTrigger>
          <AutomationDialog
            editing={editing}
            setEditing={setEditing}
            templates={templates}
            onSaved={() => { setDialogOpen(false); setEditing(null); refresh() }}
            saveFn={saveFn}
          />
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center space-y-2">
          <p className="text-muted-foreground">No automations yet.</p>
          <p className="text-xs text-muted-foreground">Add birthday emails, treatment reminders or a monthly newsletter.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const meta = TYPE_META[r.type] || TYPE_META.custom_recurring
            const Icon = meta.icon
            const template = templates.find((t) => t.id === r.template_id)
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{r.name}</p>
                      <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                      {!template && <Badge variant="destructive" className="text-xs">No template</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {template ? `Template: ${template.name}` : 'Pick a template to enable this automation.'}
                      {r.last_run_at && ` · Last run ${new Date(r.last_run_at).toLocaleString()}`}
                    </p>
                  </div>
                  <Switch checked={r.enabled} onCheckedChange={(v) => onToggle(r, v)} />
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setDialogOpen(true) }}>Edit</Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card><CardContent className="p-4 text-xs text-muted-foreground">
        Merge tags you can use in template content: <code>{'{{first_name}}'}</code>, <code>{'{{clinic_name}}'}</code>, <code>{'{{last_treatment}}'}</code>, <code>{'{{booking_url}}'}</code>.
        Only patients who opted in to marketing receive these — patients who unsubscribe are excluded automatically.
      </CardContent></Card>
    </div>
  )
}

function AutomationDialog({ editing, setEditing, templates, onSaved, saveFn }: {
  editing: any; setEditing: (v: any) => void; templates: any[]; onSaved: () => void; saveFn: any
}) {
  const [saving, setSaving] = useState(false)
  if (!editing) return null
  const meta = TYPE_META[editing.type] || TYPE_META.custom_recurring

  async function save() {
    if (!editing.name?.trim()) { toast.error('Add a name'); return }
    setSaving(true)
    try {
      await saveFn({ data: {
        id: editing.id,
        name: editing.name.trim(),
        type: editing.type,
        enabled: editing.enabled ?? true,
        template_id: editing.template_id ?? null,
        segment_id: null,
        config: editing.config || {},
      } })
      toast.success('Saved')
      onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const cfg = editing.config || {}
  const setCfg = (patch: any) => setEditing({ ...editing, config: { ...cfg, ...patch } })

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing.id ? 'Edit automation' : 'New automation'}</DialogTitle>
        <DialogDescription>{meta.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label>Type</Label>
          <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v, config: {} })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Name</Label>
          <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Birthday treat" />
        </div>

        <div>
          <Label>Template</Label>
          <Select value={editing.template_id || ''} onValueChange={(v) => setEditing({ ...editing, template_id: v || null })}>
            <SelectTrigger><SelectValue placeholder="Pick a template…" /></SelectTrigger>
            <SelectContent>
              {templates.length === 0 && <div className="p-2 text-sm text-muted-foreground">No templates yet — create one in the Templates tab first.</div>}
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {editing.type === 'treatment_interval' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Weeks after last visit</Label>
              <Input type="number" min={1} max={104} value={cfg.interval_weeks || 8}
                onChange={(e) => setCfg({ interval_weeks: parseInt(e.target.value) || 8 })} />
            </div>
            <div>
              <Label>Treatment ID</Label>
              <Input value={cfg.treatment_id || ''} placeholder="Paste treatment id"
                onChange={(e) => setCfg({ treatment_id: e.target.value || null })} />
              <p className="text-xs text-muted-foreground mt-1">Find it under Treatments.</p>
            </div>
          </div>
        )}

        {editing.type === 'win_back' && (
          <div>
            <Label>Days without a visit</Label>
            <Input type="number" min={7} max={3650} value={cfg.no_visit_days || 180}
              onChange={(e) => setCfg({ no_visit_days: parseInt(e.target.value) || 180 })} />
          </div>
        )}

        {(editing.type === 'monthly_newsletter' || editing.type === 'custom_recurring') && (
          <div>
            <Label>Day of month (1–28)</Label>
            <Input type="number" min={1} max={28} value={cfg.day_of_month || 1}
              onChange={(e) => setCfg({ day_of_month: parseInt(e.target.value) || 1 })} />
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <div>
            <Label>Enabled</Label>
            <p className="text-xs text-muted-foreground">Only enabled automations run.</p>
          </div>
          <Switch checked={editing.enabled ?? true} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
