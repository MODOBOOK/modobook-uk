import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const calendarQuery = z.object({
  title: z.string().trim().min(1).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().max(300).default(''),
  details: z.string().trim().max(1000).default(''),
})

function escapeCalendarText(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
}

export const Route = createFileRoute('/api/public/calendar')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const parsed = calendarQuery.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) return new Response('Invalid calendar details', { status: 400 })

        const { title, date, start, end, location, details } = parsed.data
        const stamp = (time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`
        const now = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')
        const body = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//MODO//Appointment//EN',
          'CALSCALE:GREGORIAN',
          'BEGIN:VEVENT',
          `UID:${crypto.randomUUID()}@modobook.uk`,
          `DTSTAMP:${now}`,
          `DTSTART;TZID=Europe/London:${stamp(start)}`,
          `DTEND;TZID=Europe/London:${stamp(end)}`,
          `SUMMARY:${escapeCalendarText(title)}`,
          `LOCATION:${escapeCalendarText(location)}`,
          `DESCRIPTION:${escapeCalendarText(details)}`,
          'END:VEVENT',
          'END:VCALENDAR',
          '',
        ].join('\r\n')

        return new Response(body, {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="appointment.ics"',
            'Cache-Control': 'private, no-store',
          },
        })
      },
    },
  },
})