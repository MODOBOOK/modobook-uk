import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { listTemplates, saveTemplate, deleteTemplate } from '@/lib/marketing.functions'
import { generateMarketingEmail } from '@/lib/ai-marketing.functions'
import { MARKETING_PRESETS } from '@/lib/marketing-presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Trash2, Loader2, LayoutTemplate, Sparkles, Code2, Type } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboard/marketing/templates')({
  component: TemplatesPage,
})

type Mode = 'content' | 'html'

function TemplatesPage() {
  const list = useServerFn(listTemplates)
  const save = useServerFn(saveTemplate)
  const remove = useServerFn(deleteTemplate)
  const generate = useServerFn(generateMarketingEmail)

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState(''); const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState(''); const [bodyText, setBodyText] = useState('')
  const [mode, setMode] = useState<Mode>('content')

  // AI composer
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiTone, setAiTone] = useState('')
  const [aiMode, setAiMode] = useState<Mode>('content')
  const [aiBusy, setAiBusy] = useState(false)

  useEffect(() => { list().then((r) => setItems(r as any[])).catch((e) => toast.error(e.message)).finally(() => setLoading(false)) }, [])

  function openNew() {
    setEditing(null); setName(''); setSubject(''); setPreheader(''); setBodyText('')
    setMode('content'); setOpen(true)
  }

  function applyPreset(p: typeof MARKETING_PRESETS[number]) {
    setEditing(null); setName(p.name); setSubject(p.subject); setPreheader(p.preheader)
    setBodyText(p.body); setMode('content'); setOpen(true)
  }

  function openEdit(t: any) {
    const blocks = (t.body_json || []) as any[]
    const htmlBlock = blocks.find((b) => b.type === 'html')
    setEditing(t); setName(t.name); setSubject(t.subject || ''); setPreheader(t.preheader || '')
    if (htmlBlock) {
      setMode('html'); setBodyText(htmlBlock.html || '')
    } else {
      setMode('content')
      setBodyText(blocks
        .map((b: any) => b.type === 'heading' ? `# ${b.text}` : b.type === 'paragraph' ? b.text : b.type === 'button' ? `[BUTTON](${b.url}) ${b.text}` : '')
        .filter(Boolean)
        .join('\n\n'))
    }
    setOpen(true)
  }

  function parseBlocks(text: string) {
    if (mode === 'html') return [{ type: 'html', html: text, full: true }]
    return text.split(/\n{2,}/).map((raw) => raw.trim()).filter(Boolean).map((chunk) => {
      if (chunk.startsWith('# ')) return { type: 'heading', text: chunk.slice(2).trim() }
      const btn = chunk.match(/^\[BUTTON\]\((\S+)\)\s+(.+)$/)
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

  async function handleGenerate() {
    if (!aiPrompt.trim()) { toast.error('Tell the AI what the email is about'); return }
    setAiBusy(true)
    try {
      const r = await generate({ data: { prompt: aiPrompt, mode: aiMode, tone: aiTone } }) as any
      setEditing(null)
      setName((prev) => prev || aiPrompt.slice(0, 60))
      setSubject(r.subject || '')
      setPreheader(r.preheader || '')
      setMode(r.mode === 'html' ? 'html' : 'content')
      setBodyText(r.mode === 'html' ? (r.html || '') : (r.body || ''))
      setAiOpen(false); setOpen(true)
      toast.success('Draft generated — edit anything you like')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Generation failed') }
    finally { setAiBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Templates</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />Generate with AI
          </Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New template</Button>
        </div>
      </div>

      {/* Branded starter layouts */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Branded layouts</h3>
          <p className="text-xs text-muted-foreground">
            Each layout is sent inside your clinic&rsquo;s email design — your logo, your brand colour, your fonts.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_PRESETS.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p)} className="text-left">
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="p-4 space-y-2">
                  <div className="h-16 rounded-md bg-gradient-to-br from-primary/15 to-muted flex items-center justify-center">
                    <LayoutTemplate className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{p.description}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>

      {/* Saved templates */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Your saved templates</h3>
        {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-8" /> :
          items.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <LayoutTemplate className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm text-muted-foreground mt-1">Start from a branded layout above, or let AI write one for you.</p>
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
      </div>

      {/* Editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><Label>Preheader</Label><Input value={preheader} onChange={(e) => setPreheader(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === 'content' ? 'default' : 'outline'} onClick={() => setMode('content')}>
                <Type className="h-4 w-4 mr-2" />Branded content
              </Button>
              <Button type="button" size="sm" variant={mode === 'html' ? 'default' : 'outline'} onClick={() => setMode('html')}>
                <Code2 className="h-4 w-4 mr-2" />Email code
              </Button>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={mode === 'html' ? 14 : 10}
                className={mode === 'html' ? 'font-mono text-xs' : undefined}
                placeholder={mode === 'html'
                  ? '<table role="presentation" width="100%"> … </table>'
                  : '# A heading\n\nA paragraph goes here.\n\n[BUTTON](https://…) Book now'} />
              <p className="text-xs text-muted-foreground mt-1">
                {mode === 'html'
                  ? 'Raw HTML is sent as-is (your unsubscribe footer is added automatically). Use inline styles only.'
                  : <>Lines starting with <code># </code> become headings. <code>[BUTTON](url) text</code> becomes a branded button. Everything else is a paragraph.</>}
                {' '}Merge tags: <code>{'{{first_name}}'}</code>, <code>{'{{clinic_name}}'}</code>, <code>{'{{last_treatment}}'}</code>, <code>{'{{booking_url}}'}</code>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI composer */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate an email with AI</DialogTitle>
            <DialogDescription>Describe the email and AI will write it in your clinic&rsquo;s style.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>What&rsquo;s the email about?</Label>
              <Textarea rows={4} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. A November offer on skin boosters — £50 off a course of three, bookable until the end of the month." />
            </div>
            <div>
              <Label>Tone (optional)</Label>
              <Input value={aiTone} onChange={(e) => setAiTone(e.target.value)} placeholder="Warm and calm / upbeat / clinical" />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={aiMode === 'content' ? 'default' : 'outline'} onClick={() => setAiMode('content')}>
                <Type className="h-4 w-4 mr-2" />Branded content
              </Button>
              <Button type="button" size="sm" variant={aiMode === 'html' ? 'default' : 'outline'} onClick={() => setAiMode('html')}>
                <Code2 className="h-4 w-4 mr-2" />Email code
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {aiMode === 'content'
                ? 'Content is placed into your branded template — logo, colours and buttons stay on-brand.'
                : 'AI writes ready-to-send HTML using your brand colour and logo. You can edit the code afterwards.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={aiBusy}>
              {aiBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
