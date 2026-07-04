import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { listCampaigns, getCampaignAnalytics } from '@/lib/marketing.functions'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, BarChart3 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/dashboard/marketing/analytics')({
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const list = useServerFn(listCampaigns)
  const analyticsFn = useServerFn(getCampaignAnalytics)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    list({}).then((rows) => {
      const sent = (rows as any[]).filter((c) => c.status === 'sent')
      setCampaigns(sent); if (sent[0]) setSelected(sent[0].id)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    analyticsFn({ data: { id: selected } }).then(setData)
  }, [selected])

  if (loading) return <Loader2 className="h-5 w-5 animate-spin mx-auto my-8" />
  if (campaigns.length === 0) return (
    <Card><CardContent className="py-12 text-center">
      <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <p className="font-medium">No analytics yet</p>
      <p className="text-sm text-muted-foreground">Analytics appear here after you send your first campaign.</p>
    </CardContent></Card>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      <div className="space-y-2">
        {campaigns.map((c) => (
          <button key={c.id} onClick={() => setSelected(c.id)}
            className={`w-full text-left rounded-lg border p-3 ${selected === c.id ? 'border-primary bg-accent' : 'border-border'}`}>
            <p className="font-medium truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : ''}</p>
          </button>
        ))}
      </div>
      <div>
        {!data ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Recipients" value={data.total} />
                <Stat label="Sent" value={data.byStatus.sent || 0} />
                <Stat label="Failed" value={data.byStatus.failed || 0} />
                <Stat label="Suppressed" value={data.byStatus.suppressed || 0} />
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <h3 className="font-medium mb-3">Recipients</h3>
              <div className="max-h-[480px] overflow-y-auto space-y-1">
                {data.recipients.map((r: any) => (
                  <div key={r.email + r.created_at} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                    <span className="truncate">{r.email}</span>
                    <Badge variant="outline" className="text-xs">{r.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-serif mt-1">{value}</p></div>
}
