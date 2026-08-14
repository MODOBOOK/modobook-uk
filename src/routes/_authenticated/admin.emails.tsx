import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { amIAdmin } from '@/lib/admin.functions'
import {
  listPlatformEmailCustomizations,
  savePlatformEmailCustomization,
  sendAdminBroadcast,
  listAdminBroadcasts,
  previewAdminBroadcast,
  sendAdminBroadcastTest,
  countWaitlist,
  previewWaitlistOpenEmail,
  sendWaitlistOpenTest,
  sendWaitlistOpenEmail,
} from '@/lib/admin-emails.functions'
import type { AdminBlock as Block } from '@/lib/email-templates/admin-broadcast'
import { generateAdminEmail } from '@/lib/ai-admin-email.functions'
import { parsePresetBody } from '@/lib/marketing-presets'
import { EMAIL_DEFAULTS } from '@/lib/email-templates/defaults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Mail, Send, ArrowLeft, Shield, Plus, Trash2, ChevronUp, ChevronDown, Eye, Image as ImageIcon, Link as LinkIcon, Code, Rocket, PartyPopper, Sparkles } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
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

  const [waitlistLaunchOpen, setWaitlistLaunchOpen] = useState(false)

  useEffect(() => {
    Promise.all([listCust(), listBroadcasts()])
      .then(([c, b]) => { setCustoms(c as any[]); setBroadcasts(b as any[]) })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const customsByKey: Record<string, any> = {}
  for (const c of customs) customsByKey[c.template_key] = c

  if (loading) return (
    <AdminShell>
      <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
    </AdminShell>
  )

  return (
    <AdminShell>
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
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

      <WaitlistLaunchCard onOpen={() => setWaitlistLaunchOpen(true)} />

      {waitlistLaunchOpen && (
        <WaitlistLaunchDialog
          onClose={() => setWaitlistLaunchOpen(false)}
          onSent={async () => {
            setWaitlistLaunchOpen(false)
            const b = await listBroadcasts()
            setBroadcasts(b as any[])
          }}
        />
      )}

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
                    <Badge variant={b.template_key === 'waitlist-open' ? 'default' : 'outline'}>
                      {b.template_key === 'waitlist-open'
                        ? `Launch · ${b.recipient_count}`
                        : b.audience === 'all_practitioners'
                          ? `${b.recipient_count} practitioner${b.recipient_count === 1 ? '' : 's'}`
                          : b.audience === 'waitlist'
                            ? `Waitlist · ${b.recipient_count}`
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
    </AdminShell>
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
  const defaults = EMAIL_DEFAULTS[def.key] ?? { subject: '', intro: '', closing: '', variables: [] as string[] }
  const [subject, setSubject] = useState<string>(existing?.subject_override ?? defaults.subject)
  const [intro, setIntro] = useState<string>(existing?.intro_override ?? defaults.intro)
  const [closing, setClosing] = useState<string>(existing?.closing_override ?? defaults.closing)

  const resetToDefaults = () => {
    setSubject(defaults.subject)
    setIntro(defaults.intro)
    setClosing(defaults.closing)
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit {def.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Pre-filled with the current wording — tweak what you want and leave the rest. The confirmation button, links and security wording are always kept in place automatically.
          </p>
          <div>
            <Label>Subject line</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={defaults.subject || 'Default subject'} />
          </div>
          <div>
            <Label>Opening line</Label>
            <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={defaults.intro} />
          </div>
          <div>
            <Label>Closing / sign-off</Label>
            <Textarea rows={3} value={closing} onChange={(e) => setClosing(e.target.value)} placeholder={defaults.closing || "e.g. Any questions? Reply to this email and we'll help."} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={resetToDefaults}>Reset to default</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({
              subject_override: subject.trim() || null,
              intro_override: intro.trim() || null,
              closing_override: closing.trim() || null,
            })}>Save</Button>
          </div>
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
    audience: 'all_practitioners' | 'user' | 'waitlist'
    recipient_email?: string | null
    subject: string
    message: string
    cta_text?: string | null
    cta_url?: string | null
    blocks?: Block[] | null
  }) => Promise<void> | void
}) {
  const preview = useServerFn(previewAdminBroadcast)
  const sendTest = useServerFn(sendAdminBroadcastTest)
  const waitlistCount = useServerFn(countWaitlist)

  const [audience, setAudience] = useState<'all_practitioners' | 'user' | 'waitlist'>('all_practitioners')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [busy, setBusy] = useState(false)
  const [waitlist, setWaitlist] = useState<number | null>(null)

  // Preview state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    waitlistCount().then((r: any) => setWaitlist(r.count)).catch(() => {})
  }, [])

  const payload = () => ({
    subject: subject.trim(),
    message: message.trim(),
    cta_text: ctaText.trim() || null,
    cta_url: ctaUrl.trim() || null,
    blocks: blocks.length ? blocks : null,
  })

  const disabled =
    !subject.trim() || (!message.trim() && blocks.length === 0) ||
    (audience === 'user' && !email.trim()) ||
    Boolean((ctaText.trim() && !ctaUrl.trim()) || (!ctaText.trim() && ctaUrl.trim()))

  const addBlock = (b: Block) => setBlocks((p) => [...p, b])
  const updateBlock = (i: number, patch: Partial<Block>) =>
    setBlocks((p) => p.map((b, idx) => (idx === i ? ({ ...b, ...patch } as Block) : b)))
  const removeBlock = (i: number) => setBlocks((p) => p.filter((_, idx) => idx !== i))
  const moveBlock = (i: number, dir: -1 | 1) =>
    setBlocks((p) => {
      const next = [...p]
      const j = i + dir
      if (j < 0 || j >= next.length) return p
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const runPreview = async () => {
    setPreviewing(true)
    try {
      const res = await preview({ data: { ...payload(), firstName: 'Alex' } })
      setPreviewHtml((res as any).html)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    } finally { setPreviewing(false) }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <RadioGroupItem value="waitlist" id="aud-wait" />
                <Label htmlFor="aud-wait" className="font-normal cursor-pointer">
                  Launch waitlist{waitlist !== null ? ` (${waitlist})` : ''}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="user" id="aud-one" />
                <Label htmlFor="aud-one" className="font-normal cursor-pointer">A specific person (by email)</Label>
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
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A quick update from MODO Book" />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={"Hi there,\n\nWe just shipped a new feature we think you'll love..."} />
            <p className="text-xs text-muted-foreground mt-1">
              Blank lines start a new paragraph. Use <code>{'{{first_name}}'}</code> to personalise.
            </p>
          </div>

          {/* Content blocks */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium mr-auto">Content blocks</p>
              <Button type="button" size="sm" variant="outline" onClick={() => addBlock({ type: 'heading', text: '', level: 2 })}>
                <Plus className="mr-1 h-3 w-3" /> Heading
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addBlock({ type: 'paragraph', text: '' })}>
                <Plus className="mr-1 h-3 w-3" /> Text
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addBlock({ type: 'image', src: '', alt: '', url: '' })}>
                <ImageIcon className="mr-1 h-3 w-3" /> Image
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addBlock({ type: 'button', text: '', url: '' })}>
                <LinkIcon className="mr-1 h-3 w-3" /> Button
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addBlock({ type: 'divider' })}>
                <Plus className="mr-1 h-3 w-3" /> Divider
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addBlock({ type: 'html', html: '', full: false })}>
                <Code className="mr-1 h-3 w-3" /> Code
              </Button>
            </div>

            {blocks.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                Optional — add images, buttons or embedded code beneath your message.
              </p>
            ) : (
              <div className="space-y-3">
                {blocks.map((b, i) => (
                  <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{b.type}</span>
                      <div className="ml-auto flex gap-1">
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveBlock(i, -1)}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveBlock(i, 1)}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeBlock(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {b.type === 'heading' && (
                      <Input value={b.text} onChange={(e) => updateBlock(i, { text: e.target.value } as any)} placeholder="Heading text" />
                    )}
                    {b.type === 'paragraph' && (
                      <Textarea rows={4} value={b.text} onChange={(e) => updateBlock(i, { text: e.target.value } as any)} placeholder="Paragraph text" />
                    )}
                    {b.type === 'image' && (
                      <div className="space-y-2">
                        <Input value={b.src} onChange={(e) => updateBlock(i, { src: e.target.value } as any)} placeholder="Image URL (https://…)" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={b.alt || ''} onChange={(e) => updateBlock(i, { alt: e.target.value } as any)} placeholder="Alt text" />
                          <Input value={b.url || ''} onChange={(e) => updateBlock(i, { url: e.target.value } as any)} placeholder="Link when clicked (optional)" />
                        </div>
                      </div>
                    )}
                    {b.type === 'button' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={b.text} onChange={(e) => updateBlock(i, { text: e.target.value } as any)} placeholder="Button text" />
                        <Input value={b.url} onChange={(e) => updateBlock(i, { url: e.target.value } as any)} placeholder="https://modobook.uk/…" />
                      </div>
                    )}
                    {b.type === 'html' && (
                      <div className="space-y-2">
                        <Textarea
                          rows={6}
                          className="font-mono text-xs"
                          value={b.html}
                          onChange={(e) => updateBlock(i, { html: e.target.value } as any)}
                          placeholder="<table>…your HTML…</table>"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={!!b.full}
                            onChange={(e) => updateBlock(i, { full: e.target.checked } as any)}
                          />
                          Use as the full email (replaces the MODO layout)
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Footer button text (optional)</Label>
              <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="See what's new" />
            </div>
            <div>
              <Label>Footer button URL</Label>
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://modobook.uk/…" />
            </div>
          </div>

          {/* Preview + test send */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium mr-auto">Preview</p>
              <Button type="button" size="sm" variant="outline" onClick={runPreview} disabled={previewing || !subject.trim()}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="mr-1 h-3.5 w-3.5" /> Show preview</>}
              </Button>
            </div>
            {previewHtml && (
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                className="h-[420px] w-full rounded-md border bg-white"
              />
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Send a test copy to</Label>
                <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@modobook.co.uk" />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!testEmail.trim() || !subject.trim() || busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await sendTest({ data: { recipient_email: testEmail.trim(), ...payload() } })
                    toast.success('Test email queued')
                  } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
                  finally { setBusy(false) }
                }}
              >
                Send test
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy || disabled}
            onClick={async () => {
              const label = audience === 'all_practitioners' ? 'every active practitioner'
                : audience === 'waitlist' ? `everyone on the launch waitlist${waitlist !== null ? ` (${waitlist})` : ''}` : null
              if (label && !confirm(`Send this message to ${label}?`)) return
              setBusy(true)
              try {
                await onSend({
                  audience,
                  recipient_email: audience === 'user' ? email.trim() : null,
                  ...payload(),
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

function WaitlistLaunchCard({ onOpen }: { onOpen: () => void }) {
  const countWaitlistFn = useServerFn(countWaitlist)
  const sendTest = useServerFn(sendWaitlistOpenTest)
  const [count, setCount] = useState<number | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    countWaitlistFn().then((r: any) => setCount(r.count)).catch(() => {})
  }, [])

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <PartyPopper className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Launch waitlist</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Send the official "MODO is open" email to everyone on the practitioner waitlist.
              {count !== null ? (
                <span className="ml-1 font-medium text-foreground">({count} people)</span>
              ) : null}
            </p>
          </div>
          <Button onClick={onOpen} className="shrink-0">
            <Rocket className="mr-2 h-4 w-4" /> Send launch email
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end border-t pt-4">
          <div className="flex-1">
            <Label className="text-xs">Send a test copy to</Label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@modobook.co.uk"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!testEmail.trim() || testing}
            onClick={async () => {
              setTesting(true)
              try {
                await sendTest({ data: { recipient_email: testEmail.trim() } })
                toast.success(`Test email sent to ${testEmail.trim()}`)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed to send test')
              } finally { setTesting(false) }
            }}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send test'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


function WaitlistLaunchDialog({
  onClose,
  onSent,
}: {
  onClose: () => void
  onSent: () => Promise<void>
}) {
  const preview = useServerFn(previewWaitlistOpenEmail)
  const sendTest = useServerFn(sendWaitlistOpenTest)
  const sendAll = useServerFn(sendWaitlistOpenEmail)
  const countWaitlistFn = useServerFn(countWaitlist)

  const [html, setHtml] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    setPreviewing(true)
    preview({ data: { firstName: 'Alex' } })
      .then((r: any) => setHtml(r.html))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Preview failed'))
      .finally(() => setPreviewing(false))
    countWaitlistFn().then((r: any) => setCount(r.count)).catch(() => {})
  }, [])

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Send waitlist launch email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This sends the dedicated waitlist-open email (features, Home Screen install steps and WhatsApp support) to
            {count !== null ? ` ${count} people` : ' everyone on the waitlist'}.
          </p>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4" /> Preview
            </p>
            {previewing ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : html ? (
              <iframe
                title="Waitlist email preview"
                srcDoc={html}
                className="w-full h-96 rounded-md border bg-white"
                sandbox="allow-same-origin"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Could not load preview.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label className="text-xs">Send a test copy to</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@modobook.co.uk"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-auto"
              disabled={!testEmail.trim() || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await sendTest({ data: { recipient_email: testEmail.trim() } })
                  toast.success('Test email queued')
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed')
                } finally { setBusy(false) }
              }}
            >
              Send test
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Send the launch email to ${count !== null ? count : 'everyone on'} the waitlist?`)) return
              setBusy(true)
              try {
                const res = await sendAll()
                toast.success(`Queued ${res.sent} email${res.sent === 1 ? '' : 's'}${res.failed ? ` (${res.failed} failed)` : ''}`)
                await onSent()
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed')
              } finally { setBusy(false) }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send to waitlist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

