import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { listTemplates, saveTemplate, deleteTemplate } from '@/lib/marketing.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trash2, Loader2, LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboard/marketing/templates')({
  component: TemplatesPage,
})

function TemplatesPage() {
  const list = useServerFn(listTemplates)
  const save = useServerFn(saveTemplate)
  const remove = useServerFn(deleteTemplate)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState(''); const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState(''); const [bodyText, setBodyText] = useState('')

  useEffect(() => { list().then((r) => setItems(r as any[])).catch((e) => toast.error(e.message)).finally(() => setLoading(false)) }, [])

  function openNew() {
    setEditing(null); setName(''); setSubject(''); setPreheader(''); setBodyText(''); setOpen(true)
  }
  function openEdit(t: any) {
    setEditing(t); setName(t.name); setSubject(t.subject || ''); setPreheader(t.preheader || '')
    // Flatten blocks back to text for simple editing
    const text = (t.body_json || [])
      .map((b: any) => b.type === 'heading' ? `# ${b.text}` : b.type === 'paragraph' ? b.text : b.type === 'button' ? `[BUTTON](${b.url}) ${b.text}` : '')
      .join('\n\n')
    setBodyText(text); setOpen(true)
  }

  function parseBlocks(text: string) {
    return text.split(/\n{2,}/).map((raw) => raw.trim()).filter(Boolean).map((chunk) => {
      if (chunk.startsWith('# ')) return { type: 'heading', text: chunk.slice(2).trim() }
      const btn = chunk.match(/^\[BUTTON\]\((https?:[^)]+)\)\s+(.+)$/)
      if (btn) return { type: 'button', url: btn[1], text: btn[2] }
      return { type: 'paragraph', text: chunk }
    })
  }

  async function handleSave() {
    if (!name.trim()) return
    try {
      const saved = await save({ data: {
        id: editing?.id, name: name.trim(), subject, preheader,
        body_json: parseBlocks(bodyText) as any,
      } })
      setItems((prev) => [saved, ...prev.filter((t) => t.id !== (saved as any).id)])
      setOpen(false); toast.success('Saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    try { await remove({ data: { id } }); setItems((p) => p.filter((t) => t.id !== id)) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Templates</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New template</Button>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-8" /> :
        items.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <LayoutTemplate className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Save reusable copy so you don&rsquo;t start from scratch every time.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <Card key={t.id}><CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <button className="font-medium hover:underline text-left" onClick={() => openEdit(t)}>{t.name}</button>
                  <p className="text-sm text-muted-foreground truncate">{t.subject || <em>No subject</em>}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent></Card>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><Label>Preheader</Label><Input value={preheader} onChange={(e) => setPreheader(e.target.value)} /></div>
            <div>
              <Label>Content</Label>
              <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={10}
                placeholder={"# A heading\n\nA paragraph goes here.\n\n[BUTTON](https://…) Book now"} />
              <p className="text-xs text-muted-foreground mt-1">Lines starting with <code># </code> become headings. <code>[BUTTON](url) text</code> becomes a button. Everything else is a paragraph. Use <code>{'{{first_name}}'}</code> or <code>{'{{clinic_name}}'}</code>.</p>
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
