import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: 'Unsubscribe — MODO' },
      { name: 'description', content: 'Manage your MODO email preferences.' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
})

type State =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'already' }
  | { kind: 'invalid' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    if (!t) {
      setState({ kind: 'invalid' })
      return
    }
    setToken(t)
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) return setState({ kind: 'invalid' })
        if (j.valid) return setState({ kind: 'ready' })
        if (j.reason === 'already_unsubscribed') return setState({ kind: 'already' })
        setState({ kind: 'invalid' })
      })
      .catch(() => setState({ kind: 'invalid' }))
  }, [])

  async function confirm() {
    if (!token) return
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const j = await res.json()
      if (j.success) setState({ kind: 'done' })
      else if (j.reason === 'already_unsubscribed') setState({ kind: 'already' })
      else setState({ kind: 'error', message: j.error || 'Something went wrong' })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.35em] text-primary mb-2">MODO</p>
        <h1 className="text-2xl font-serif mb-3">Email preferences</h1>

        {state.kind === 'loading' && <p className="text-sm text-muted-foreground">Checking your link…</p>}

        {state.kind === 'ready' && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Unsubscribe from MODO emails? You'll stop receiving booking, form, and review messages.
            </p>
            <button
              onClick={confirm}
              className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold uppercase tracking-widest text-background hover:opacity-90 transition"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state.kind === 'submitting' && <p className="text-sm text-muted-foreground">Updating your preferences…</p>}

        {state.kind === 'done' && (
          <p className="text-sm text-muted-foreground">You've been unsubscribed. Sorry to see you go.</p>
        )}

        {state.kind === 'already' && (
          <p className="text-sm text-muted-foreground">This email address is already unsubscribed.</p>
        )}

        {state.kind === 'invalid' && (
          <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
        )}

        {state.kind === 'error' && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
      </div>
    </div>
  )
}
