import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { amIAdmin } from '@/lib/admin.functions'
import {
  listPlatformEmailCustomizations,
  savePlatformEmailCustomization,
  sendAdminBroadcast,
  listAdminBroadcasts,
} from '@/lib/admin-emails.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Mail, Send, ArrowLeft, Shield } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/emails')({
  ssr: false,
  loader: async () => {
    const me = await amIAdmin()
    if (!me.admin) throw new Error('You do not have admin access.')
    return null
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Admin only</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: AdminEmailsPage,
})

type AuthEmailDef = { key: string; name: string; description: string }

const AUTH_EMAILS: AuthEmailDef[] = [
  { key: 'signup', name: 'Account signup', description: 'Sent when someone creates a new account and needs to confirm their email.' },
  { key: 'magiclink', name: 'Magic link sign-in', description: 'Passwordless sign-in link.' },
  { key: 'recovery', name: 'Password reset', description: 'Sent when a user requests a password reset.' },
  { key: 'invite', name: 'Invitation', description: 'Sent when someone is invited to join.' },
  { key: 'email_change', name: 'Email change confirmation', description: 'Sent to confirm a new email address.' },
]

function AdminEmailsPage() {
  const listCust = useServerFn(listPlatformEmailCustomizations)
  const saveCust = useServerFn(savePlatformEmailCustomization)
  const sendBroadcast = useServerFn(sendAdminBroadcast)
  const listBroadcasts = useServerFn(listAdminBroadcasts)

  const [customs, setCustoms] = useState<any[]>([])
  const [broadcasts, setBroadcasts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AuthEmailDef | null>(null)
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    Promise.all([listCust(), listBroadcasts()])
      .then(([c, b]) => { setCustoms(c as any[]); setBroadcasts(b as any[]) })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const customsByKey: Record<string, any> = {}
  for (const c of customs) customsByKey[c.template_key] = c

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Platform emails</h1>
          <p className="text-sm text-muted-foreground">
            Edit account emails and send messages to your practitioners.
          </p>
        </div>
        <Link to="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to admin
          </Button>
        </Link>
      </div>

      {/* Broadcast section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Send an announcement
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Message all practitioners at once, or send a one-off to a specific account.
            </p>
          </div>
          <Button onClick={() => setComposing(true)}>New message</Button>
        </CardHeader>
        <CardContent className="p-0">
          {broadcasts.length === 0 ? (
            <p className="p-4 text-sm italic text-muted-foreground">No messages sent yet.</p>
          ) : (
            <div className="divide-y">
              {broadcasts.map((b) => (
                <div key={b.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{b.subject}</span>
                    <Badge variant="outline">
                      {b.audience === 'all_practitioners'
                        ? `${b.recipient_count} practitioner${b.recipient_count === 1 ? '' : 's'}`
                        : b.recipient_email}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(b.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account emails */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-serif flex items-center gap-2">
            <Mail className="h-5 w-5" /> Account emails
          </h2>
          <p className="text-sm text-muted-foreground">
            Sign-up, password reset and other account emails sent by the platform. Edits apply system-wide.
          </p>
        </div>
        <div className="space-y-2">
          {AUTH_EMAILS.map((e) => {
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
        <EditAuthEmailDialog
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

      {composing && (
        <BroadcastDialog
          onClose={() => setComposing(false)}
          onSend={async (payload) => {
            try {
              const res = await sendBroadcast({ data: payload })
              toast.success(`Queued ${res.sent} email${res.sent === 1 ? '' : 's'}${res.failed ? ` (${res.failed} failed)` : ''}`)
              setComposing(false)
              const b = await listBroadcasts()
              setBroadcasts(b as any[])
            } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
          }}
        />
      )}
    </div>
  )
}

function EditAuthEmailDialog({
  def, existing, onClose, onSave,
}: {
  def: AuthEmailDef
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
          <p className="text-xs text-muted-foreground">
            Leave a field blank to keep the default wording. The confirmation button, links and security wording are kept in place automatically.
          </p>
          <div>
            <Label>Subject line</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Default subject" />
          </div>
          <div>
            <Label>Opening line</Label>
            <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="e.g. Welcome to Modo Book — let's get your account set up." />
          </div>
          <div>
            <Label>Closing / sign-off</Label>
            <Textarea rows={3} value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="e.g. Any questions? Reply to this email and we'll help." />
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

function BroadcastDialog({
  onClose, onSend,
}: {
  onClose: () => void
  onSend: (payload: {
    audience: 'all_practitioners' | 'user'
    recipient_email?: string | null
    subject: string
    message: string
    cta_text?: string | null
    cta_url?: string | null
  }) => Promise<void> | void
}) {
  const [audience, setAudience] = useState<'all_practitioners' | 'user'>('all_practitioners')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const disabled =
    !subject.trim() || !message.trim() ||
    (audience === 'user' && !email.trim()) ||
    Boolean((ctaText.trim() && !ctaUrl.trim()) || (!ctaText.trim() && ctaUrl.trim()))

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Send a message</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Send to</Label>
            <RadioGroup value={audience} onValueChange={(v) => setAudience(v as any)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all_practitioners" id="aud-all" />
                <Label htmlFor="aud-all" className="font-normal cursor-pointer">All active practitioners</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="user" id="aud-one" />
                <Label htmlFor="aud-one" className="font-normal cursor-pointer">A specific user (by email)</Label>
              </div>
            </RadioGroup>
          </div>

          {audience === 'user' && (
            <div>
              <Label>Recipient email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
            </div>
          )}

          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A quick update from Modo Book" />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={"Hi there,\n\nWe just shipped a new feature we think you'll love..."} />
            <p className="text-xs text-muted-foreground mt-1">Blank lines start a new paragraph.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Button text (optional)</Label>
              <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="See what's new" />
            </div>
            <div>
              <Label>Button URL</Label>
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://modobook.uk/…" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy || disabled}
            onClick={async () => {
              if (audience === 'all_practitioners' && !confirm('Send this message to every active practitioner?')) return
              setBusy(true)
              try {
                await onSend({
                  audience,
                  recipient_email: audience === 'user' ? email.trim() : null,
                  subject: subject.trim(),
                  message: message.trim(),
                  cta_text: ctaText.trim() || null,
                  cta_url: ctaUrl.trim() || null,
                })
              } finally { setBusy(false) }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
