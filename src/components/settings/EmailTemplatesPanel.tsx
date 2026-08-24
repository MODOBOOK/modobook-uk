import { useEffect, useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  listEmailCustomizations, saveEmailCustomization,
  listReminderRules, saveReminderRule, deleteReminderRule,
  sendTestEmail,
} from '@/lib/emails.functions'
import { EMAIL_DEFAULTS } from '@/lib/email-templates/defaults'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Mail, Bell, Plus, Trash2, Pencil, Send } from 'lucide-react'
import { toast } from 'sonner'

type EmailDef = {
  key: string
  name: string
  description: string
  editable: boolean
}

const EMAILS: EmailDef[] = [
  { key: 'booking-confirmation', name: 'Booking confirmation', description: 'Sent to the patient after they book & pay.', editable: true },
  { key: 'booking-cancellation', name: 'Booking cancellation', description: 'Sent when a booking is cancelled.', editable: true },
  { key: 'appointment-reminder', name: 'Appointment reminder', description: 'Base template used by the reminder rules below.', editable: true },
  { key: 'medical-form-request', name: 'Medical form request', description: 'Asks the patient to complete a medical form.', editable: true },
  { key: 'review-request', name: 'Review request', description: 'Sent after treatment asking for a review.', editable: true },
  { key: 'patient-message', name: 'Patient message', description: 'Practitioner-composed one-off message.', editable: true },
]

export function EmailTemplatesPanel() {
  const listCust = useServerFn(listEmailCustomizations)
  const saveCust = useServerFn(saveEmailCustomization)
  const listRules = useServerFn(listReminderRules)
  const saveRule = useServerFn(saveReminderRule)
  const removeRule = useServerFn(deleteReminderRule)

  const [customs, setCustoms] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EmailDef | null>(null)
  const [ruleEditing, setRuleEditing] = useState<any | null>(null)

  useEffect(() => {
    Promise.all([listCust(), listRules()])
      .then(([c, r]) => { setCustoms(c as any[]); setRules(r as any[]) })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const customsByKey = useMemo(() => {
    const m: Record<string, any> = {}
    for (const c of customs) m[c.template_key] = c
    return m
  }, [customs])

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>

  const grouped = {
    transactional: EMAILS,
  }

  return (
    <div className="space-y-6">
      {/* Reminders */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif flex items-center gap-2"><Bell className="h-5 w-5" /> Appointment reminders</h2>
            <p className="text-sm text-muted-foreground">Automatic emails sent before each appointment.</p>
          </div>
          <Button size="sm" onClick={() => setRuleEditing({ hours_before: 24, enabled: true })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add reminder
          </Button>
        </div>

        {rules.length === 0 ? (
          <PresetSuggestions
            existingHours={new Set(rules.map((r) => r.hours_before))}
            onPick={(h) => setRuleEditing({ hours_before: h, enabled: true })}
          />
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{formatHours(r.hours_before)} before appointment</p>
                      {!r.enabled && <Badge variant="outline">Off</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {r.subject || 'Default subject line'}
                    </p>
                  </div>
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={async (v) => {
                      try {
                        const saved = await saveRule({ data: { ...r, enabled: v } })
                        setRules((prev) => prev.map((x) => x.id === r.id ? saved : x))
                      } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
                    }}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setRuleEditing(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm('Delete this reminder?')) return
                    try {
                      await removeRule({ data: { id: r.id } })
                      setRules((prev) => prev.filter((x) => x.id !== r.id))
                    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            <PresetSuggestions
              existingHours={new Set(rules.map((r) => r.hours_before))}
              onPick={(h) => setRuleEditing({ hours_before: h, enabled: true })}
            />
          </div>
        )}
      </section>

      {/* Transactional emails */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-serif flex items-center gap-2"><Mail className="h-5 w-5" /> Patient emails</h2>
          <p className="text-sm text-muted-foreground">Booking, forms, reviews and messages sent to your patients.</p>
        </div>
        <div className="space-y-2">
          {grouped.transactional.map((e) => {
            const c = customsByKey[e.key]
            const customised = !!(c && (c.subject_override || c.intro_override || c.body_override || c.closing_override))
            return (
              <Card key={e.key} className="cursor-pointer hover:border-primary/40 transition" onClick={() => setEditing(e)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{e.name}</p>
                      {customised && <Badge variant="secondary">Custom</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{e.description}</p>
                  </div>
                  <Button variant="ghost" size="sm">Edit</Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>


      {editing && (
        <EmailEditDialog
          def={editing}
          existing={customsByKey[editing.key]}
          onClose={() => setEditing(null)}
          onSave={async (payload, opts) => {
            try {
              const saved = await saveCust({ data: { template_key: editing.key, ...payload } })
              setCustoms((prev) => {
                const next = prev.filter((x) => x.template_key !== editing.key)
                return [...next, saved as any]
              })
              if (!opts?.silent) {
                toast.success('Saved')
                setEditing(null)
              }
            } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
          }}
        />
      )}

      {ruleEditing && (
        <ReminderEditDialog
          rule={ruleEditing}
          onClose={() => setRuleEditing(null)}
          onSave={async (payload) => {
            try {
              const saved = await saveRule({ data: payload })
              setRules((prev) => {
                const next = prev.filter((x) => x.id !== (saved as any).id)
                return [saved as any, ...next].sort((a, b) => b.hours_before - a.hours_before)
              })
              toast.success('Saved')
              setRuleEditing(null)
            } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
          }}
        />
      )}
    </div>
  )
}

function formatHours(h: number) {
  if (h >= 24 && h % 24 === 0) return `${h / 24} day${h === 24 ? '' : 's'}`
  return `${h} hour${h === 1 ? '' : 's'}`
}

function PresetSuggestions({
  existingHours, onPick,
}: { existingHours: Set<number>; onPick: (h: number) => void }) {
  const presets = [48, 24, 2].filter((h) => !existingHours.has(h))
  if (presets.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <span className="text-xs text-muted-foreground self-center">Quick add:</span>
      {presets.map((h) => (
        <Button key={h} size="sm" variant="outline" onClick={() => onPick(h)}>
          {formatHours(h)} before
        </Button>
      ))}
    </div>
  )
}

function EmailEditDialog({
  def, existing, onClose, onSave,
}: {
  def: EmailDef
  existing?: any
  onClose: () => void
  onSave: (
    payload: {
      subject_override: string | null
      intro_override: string | null
      body_override: string | null
      closing_override: string | null
    },
    opts?: { silent?: boolean },
  ) => Promise<void> | void
}) {
  const defaults = EMAIL_DEFAULTS[def.key] ?? { subject: '', intro: '', body: '', closing: '', variables: [] as string[] }
  const [subject, setSubject] = useState<string>(existing?.subject_override ?? defaults.subject)
  const [intro, setIntro] = useState<string>(existing?.intro_override ?? defaults.intro)
  const [body, setBody] = useState<string>(existing?.body_override ?? defaults.body)
  const [closing, setClosing] = useState<string>(existing?.closing_override ?? defaults.closing)
  const [testing, setTesting] = useState(false)
  const sendTest = useServerFn(sendTestEmail)

  const resetToDefaults = () => {
    setSubject(defaults.subject)
    setIntro(defaults.intro)
    setBody(defaults.body)
    setClosing(defaults.closing)
  }

  const payload = () => ({
    subject_override: subject.trim() || null,
    intro_override: intro.trim() || null,
    body_override: body.trim() || null,
    closing_override: closing.trim() || null,
  })

  async function handleSendTest() {
    setTesting(true)
    try {
      // Silent save so overrides are persisted before enqueueing test send
      await onSave(payload(), { silent: true })
      const r = await sendTest({ data: { template_key: def.key } })
      toast.success(`Test sent to ${(r as any).sentTo}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send test')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {def.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Fields are pre-filled with the default wording. Edit whatever you like — leave the rest as-is. Your logo, brand colour, booking details and manage links are added automatically.
          </p>
          {defaults.variables.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Auto-fills:</span>{' '}
              {defaults.variables.map((v: string) => <code key={v} className="mx-0.5 rounded bg-muted px-1 py-0.5">{`{{${v}}}`}</code>)}
            </p>
          )}
          <div>
            <Label>Subject line</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={defaults.subject || 'Default subject'} />
          </div>
          <div>
            <Label>Opening line</Label>
            <Textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={defaults.intro} />
          </div>
          <div>
            <Label>Main body</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder={defaults.body || 'Leave blank to use the auto-generated appointment details block.'} />
            <p className="text-xs text-muted-foreground mt-1">When filled in, this replaces the auto details block. Use blank lines to separate paragraphs.</p>
          </div>
          <div>
            <Label>Closing / sign-off</Label>
            <Textarea rows={2} value={closing} onChange={(e) => setClosing(e.target.value)} placeholder={defaults.closing} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetToDefaults}>Reset</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleSendTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send test to me
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(payload())}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReminderEditDialog({
  rule, onClose, onSave,
}: {
  rule: any
  onClose: () => void
  onSave: (payload: any) => void
}) {
  const [hours, setHours] = useState<number>(rule.hours_before || 24)
  const [subject, setSubject] = useState(rule.subject ?? '')
  const [intro, setIntro] = useState(rule.intro ?? '')
  const [closing, setClosing] = useState(rule.closing ?? '')
  const [enabled, setEnabled] = useState(rule.enabled ?? true)

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{rule.id ? 'Edit reminder' : 'New reminder'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Send this many hours before the appointment</Label>
            <Input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Math.max(1, Math.min(720, Number(e.target.value) || 0)))} />
            <p className="text-xs text-muted-foreground mt-1">Try 48 (2 days), 24 (day before), or 2 (same-day nudge).</p>
          </div>
          <div>
            <Label>Subject line</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Leave blank for default" />
          </div>
          <div>
            <Label>Opening line</Label>
            <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="e.g. Just a quick reminder about your appointment tomorrow." />
          </div>
          <div>
            <Label>Closing / notes</Label>
            <Textarea rows={3} value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="e.g. Please arrive with a clean face, no makeup." />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Label>Enabled</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({
            id: rule.id,
            hours_before: hours,
            subject: subject.trim() || null,
            intro: intro.trim() || null,
            closing: closing.trim() || null,
            enabled,
          })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
