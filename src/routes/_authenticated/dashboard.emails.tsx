import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard/emails')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/notifications/email' })
  },
})
