import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Mail, Users, LayoutTemplate, BarChart3, Zap, MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/dashboard/marketing')({
  component: MarketingLayout,
})

const tabs = [
  { to: '/dashboard/marketing', label: 'Campaigns', icon: Mail, exact: true },
  { to: '/dashboard/marketing/sms', label: 'SMS blast', icon: MessageSquare },
  { to: '/dashboard/marketing/automations', label: 'Automations', icon: Zap },
  { to: '/dashboard/marketing/segments', label: 'Segments', icon: Users },
  { to: '/dashboard/marketing/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/dashboard/marketing/analytics', label: 'Analytics', icon: BarChart3 },
]



function MarketingLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif">Marketing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Send branded emails to patients who&rsquo;ve opted in to hear from you.
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to)
          const Icon = t.icon
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition',
                active
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
