import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  getSmsBlastAudience, listSmsBlasts, startSmsBlastCheckout, confirmSmsBlast, cancelSmsBlast,
} from '@/lib/sms-marketing.functions'
import { countSms, blastCost, formatPence, SMS_MIN_TEXTS } from '@/lib/sms-count'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, MessageSquare, Users2, CreditCard, AlertTriangle, ChevronDown, Search } from 'lucide-react'
import { toast } from 'sonner'

type Patient = { id: string; name: string; phone: string }

export const Route = createFileRoute('/_authenticated/dashboard/marketing/sms')({
  component: SmsBlastPage,
  validateSearch: (s: Record<string, unknown>) => ({
    blast: typeof s.blast === 'string' ? s.blast : undefined,
    session_id: typeof s.session_id === 'string' ? s.session_id : undefined,
  }),
})

type Blast = {
  id: string; name: string; body: string; status: string
  recipient_count: number; segments: number; billable_texts: number
  total_pence: number; sent_count: number; failed_count: number
  created_at: string; sent_at: string | null
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    awaiting_payment: 'bg-amber-100 text-amber-800',
    paid: 'bg-blue-100 text-blue-800',
    sending: 'bg-blue-100 text-blue-800',
    sent: 'bg-emerald-100 text-emerald-800',
  }
  return <Badge className={map[status] || ''}>{status.replace('_', ' ')}</Badge>
}

function SmsBlastPage() {
  const search = useSearch({ from: '/_authenticated/dashboard/marketing/sms' })
  const audienceFn = useServerFn(getSmsBlastAudience)
  const listFn = useServerFn(listSmsBlasts)
  const checkoutFn = useServerFn(startSmsBlastCheckout)
  const confirmFn = useServerFn(confirmSmsBlast)
  const cancelFn = useServerFn(cancelSmsBlast)

  const [audience, setAudience] = useState<{ count: number; pricePence: number; minTexts: number } | null>(null)
  const [blasts, setBlasts] = useState<Blast[]>([])
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const [a, l] = await Promise.all([audienceFn(), listFn()])
    setAudience(a as any)
    setBlasts(l as Blast[])
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // Coming back from Stripe: confirm payment and fire the blast.
  useEffect(() => {
    if (!search.blast || !search.session_id) return
    setBusy(true)
    confirmFn({ data: { blastId: search.blast, sessionId: search.session_id } })
      .then((r: any) => {
        if (r?.status === 'sent') toast.success(`Texts sent to ${r.sent ?? 0} patients`)
        else toast.message('Payment still processing — your texts will go out as soon as it clears.')
        window.history.replaceState({}, '', '/dashboard/marketing/sms')
        return refresh()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not confirm payment'))
      .finally(() => setBusy(false))
  }, [search.blast, search.session_id])

  const count = useMemo(() => countSms(body), [body])
  const recipients = audience?.count ?? 0
  const cost = blastCost(recipients, count.segments)
  const belowMin = cost.texts < SMS_MIN_TEXTS

  async function pay() {
    if (!body.trim()) { toast.error('Write your message first'); return }
    setBusy(true)
    try {
      const origin = window.location.origin
      const res: any = await checkoutFn({
        data: {
          name: name.trim() || undefined,
          body: body.trim(),
          successUrl: `${origin}/dashboard/marketing/sms`,
          cancelUrl: `${origin}/dashboard/marketing/sms`,
        },
      })
      if (res?.url) window.location.href = res.url
      else throw new Error('Stripe did not return a checkout link')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open payment')
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users2 className="h-4 w-4" /> Opted-in mobiles</div>
          <div className="text-2xl font-semibold mt-1">{recipients}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><MessageSquare className="h-4 w-4" /> Texts in this blast</div>
          <div className="text-2xl font-semibold mt-1">{cost.texts}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" /> Cost (10p per text)</div>
          <div className="text-2xl font-semibold mt-1">{formatPence(cost.pence)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name (just for your records)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="August offer" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Hi {{name}}, we have 3 slots left for lip filler this Saturday — reply to book."
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{count.chars} characters</span>
              <span>{count.segments} text{count.segments === 1 ? '' : 's'} per patient</span>
              <span>{count.remaining} left in this text</span>
              {count.unicode && <span className="text-amber-600">Emoji/special characters shorten each text to 70 characters</span>}
              <span>Use {'{{name}}'} for their first name</span>
            </div>
          </div>

          {belowMin && (
            <div className="flex items-start gap-2 text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Blasts start at {SMS_MIN_TEXTS} texts. You&rsquo;re at {cost.texts}.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Paid up front by card. Texts go out from MODO as soon as the payment clears.
            </p>
            <Button className="w-full sm:w-auto" disabled={busy || belowMin || !body.trim()} onClick={pay}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Pay {formatPence(cost.pence)} &amp; send
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Previous blasts</h2>
        {blasts.length === 0 && <p className="text-sm text-muted-foreground">No text blasts yet.</p>}
        {blasts.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{b.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{b.body}</div>
                </div>
                {statusBadge(b.status)}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{b.recipient_count} patients</span>
                <span>{b.billable_texts} texts</span>
                <span>{formatPence(b.total_pence)}</span>
                {b.status === 'sent' && <span>{b.sent_count} delivered · {b.failed_count} failed</span>}
              </div>
              {b.status === 'awaiting_payment' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try { await cancelFn({ data: { id: b.id } }); await refresh() }
                    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
                  }}
                >
                  Discard
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
