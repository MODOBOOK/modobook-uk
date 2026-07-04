import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  listEmailCustomizations, saveEmailCustomization,
  listReminderRules, saveReminderRule, deleteReminderRule,
} from '@/lib/emails.functions'
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
import { Loader2, Mail, Bell, Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboard/emails')({
  ssr: false,
  component: EmailsPage,
})

type EmailDef = {
  key: string
  name: string
  description: string
  category: 'transactional' | 'auth' | 'marketing'
  editable: boolean
}

const EMAILS: EmailDef[] = [
  { key: 'booking-confirmation', name: 'Booking confirmation', description: 'Sent to the patient after they book & pay.', category: 'transactional', editable: true },
  { key: 'booking-cancellation', name: 'Booking cancellation', description: 'Sent when a booking is cancelled.', category: 'transactional', editable: true },
  { key: 'appointment-reminder', name: 'Appointment reminder', description: 'Base template used by the reminder rules below.', category: 'transactional', editable: true },
  { key: 'medical-form-request', name: 'Medical form request', description: 'Asks the patient to complete a medical form.', category: 'transactional', editable: true },
  { key: 'review-request', name: 'Review request', description: 'Sent after treatment asking for a review.', category: 'transactional', editable: true },
  { key: 'patient-message', name: 'Patient message', description: 'Practitioner-composed one-off message.', category: 'transactional', editable: true },
  { key: 'signup', name: 'Account signup', description: 'Confirms new patient accounts.', category: 'auth', editable: false },
  { key: 'magiclink', name: 'Magic link', description: 'Passwordless sign-in email.', category: 'auth', editable: false },
  { key: 'recovery', name: 'Password reset', description: 'Sent when a user requests a password reset.', category: 'auth', editable: false },
  { key: 'invite', name: 'Invite', description: 'Invitations to join.', category: 'auth', editable: false },
  { key: 'email_change', name: 'Email change confirmation', description: 'Confirms an email change.', category: 'auth', editable: false },
]

function EmailsPage() {
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
    transactional: EMAILS.filter((e) => e.category === 'transactional'),
    auth: EMAILS.filter((e) => e.category === 'auth'),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif">Emails</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customise the wording of every email your clinic sends, and set up reminders before appointments.
        </p>
      </div>

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
            const customised = !!(c && (c.subject_override || c.intro_override || c.closing_override))
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
          onSave={async (payload) => {
            try {
              const saved = await saveCust({ data: { template_key: editing.key, ...payload } })
              setCustoms((prev) => {
                const next = prev.filter((x) => x.template_key !== editing.key)
                return [...next, saved as any]
              })
              toast.success('Saved')
              setEditing(null)
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
  onSave: (payload: { subject_override: string | null; intro_override: string | null; closing_override: string | null }) => void
}) {
  const [subject, setSubject] = useState(existing?.subject_override ?? '')
  const [intro, setIntro] = useState(existing?.intro_override ?? '')
  const [closing, setClosing] = useState(existing?.closing_override ?? '')

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit {def.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Leave a field blank to use the default wording. Booking details, dates, and manage-links are added automatically.</p>
          <div>
            <Label>Subject line</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Default subject" />
          </div>
          <div>
            <Label>Opening line</Label>
            <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={`e.g. Hi {{first_name}}, we can't wait to see you.`} />
          </div>
          <div>
            <Label>Closing / sign-off</Label>
            <Textarea rows={3} value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="e.g. Warmly, the team at Aesthetics by Nurse Ryan" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({
            subject_override: subject.trim() || null,
            intro_override: intro.trim() || null,
            closing_override: closing.trim() || null,
          })}>Save</Button>
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
