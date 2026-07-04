import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { listSegments, saveSegment, deleteSegment, previewSegmentCount } from '@/lib/marketing.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboard/marketing/segments')({
  component: SegmentsPage,
})

function SegmentsPage() {
  const list = useServerFn(listSegments)
  const save = useServerFn(saveSegment)
  const remove = useServerFn(deleteSegment)
  const preview = useServerFn(previewSegmentCount)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [gender, setGender] = useState<string>('any')
  const [lastVisitDays, setLastVisitDays] = useState<string>('')
  const [noVisitDays, setNoVisitDays] = useState<string>('')
  const [hasUpcoming, setHasUpcoming] = useState<string>('any')
  const [previewingCount, setPreviewingCount] = useState<number | null>(null)

  useEffect(() => {
    list({}).then((r) => setItems(r as any[])).catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing(null); setName(''); setDescription(''); setGender('any')
    setLastVisitDays(''); setNoVisitDays(''); setHasUpcoming('any'); setPreviewingCount(null); setOpen(true)
  }
  function openEdit(s: any) {
    setEditing(s); setName(s.name); setDescription(s.description || '')
    setGender(s.rules?.gender || 'any')
    setLastVisitDays(s.rules?.last_visit_within_days ? String(s.rules.last_visit_within_days) : '')
    setNoVisitDays(s.rules?.no_visit_within_days ? String(s.rules.no_visit_within_days) : '')
    setHasUpcoming(s.rules?.has_upcoming === true ? 'yes' : s.rules?.has_upcoming === false ? 'no' : 'any')
    setPreviewingCount(null); setOpen(true)
  }

  function buildRules() {
    const rules: any = {}
    if (gender !== 'any') rules.gender = gender
    if (lastVisitDays) rules.last_visit_within_days = Number(lastVisitDays)
    if (noVisitDays) rules.no_visit_within_days = Number(noVisitDays)
    if (hasUpcoming === 'yes') rules.has_upcoming = true
    if (hasUpcoming === 'no') rules.has_upcoming = false
    return rules
  }

  async function runPreview() {
    try {
      const r = await preview({ data: { rules: buildRules(), kind: 'dynamic' } })
      setPreviewingCount((r as any).count)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Preview failed') }
  }

  async function handleSave() {
    if (!name.trim()) return
    try {
      const saved = await save({ data: {
        id: editing?.id, name: name.trim(), description, kind: 'dynamic', rules: buildRules(),
      } })
      setItems((prev) => {
        const others = prev.filter((s) => s.id !== (saved as any).id)
        return [saved, ...others]
      })
      setOpen(false); toast.success('Saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this segment?')) return
    try { await remove({ data: { id } }); setItems((p) => p.filter((s) => s.id !== id)) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Segments</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New segment</Button>
      </div>

      {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-8" /> :
        items.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No segments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Group patients by treatments, last visit, or upcoming appointments.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <Card key={s.id}><CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <button className="font-medium hover:underline text-left" onClick={() => openEdit(s)}>{s.name}</button>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Rules: {Object.keys(s.rules || {}).length ? Object.keys(s.rules).join(', ') : 'all opted-in patients'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent></Card>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} segment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Has upcoming appointment</Label>
                <Select value={hasUpcoming} onValueChange={setHasUpcoming}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visited within (days)</Label>
                <Input type="number" placeholder="e.g. 90" value={lastVisitDays} onChange={(e) => setLastVisitDays(e.target.value)} />
              </div>
              <div>
                <Label>Not visited in (days)</Label>
                <Input type="number" placeholder="e.g. 180" value={noVisitDays} onChange={(e) => setNoVisitDays(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={runPreview}>Preview count</Button>
              {previewingCount !== null && <span className="text-sm">Matches <b>{previewingCount}</b> opted-in patients</span>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
