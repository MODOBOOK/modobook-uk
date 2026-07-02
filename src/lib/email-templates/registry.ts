import type { ComponentType } from 'react'
import { BookingConfirmedPatient } from './booking-confirmed-patient'
import { BookingAlertPractitioner } from './booking-alert-practitioner'
import { PractitionerMessage } from './practitioner-message'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

const brandPreview = {
  clinicName: 'Aesthetics Clinic',
  accentColor: '#b8895a',
  practitionerEmail: 'clinic@example.com',
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmed-patient': {
    component: BookingConfirmedPatient,
    displayName: 'Booking confirmed (patient)',
    subject: (d) =>
      `Your ${d.treatmentName || 'appointment'} is confirmed — ${d.dateLabel || ''}`.trim(),
    previewData: {
      brand: brandPreview,
      patientFirstName: 'Jamie',
      treatmentName: 'Lip filler consultation',
      dateLabel: 'Tuesday 12 Nov',
      timeLabel: '2:30 pm',
      locationName: 'Glasgow Studio',
      amountPaidLabel: '£50 deposit',
      outstandingLabel: '£150',
      manageUrl: 'https://modobook.uk/f/preview',
    },
  },
  'booking-alert-practitioner': {
    component: BookingAlertPractitioner,
    displayName: 'New booking alert (practitioner)',
    subject: (d) => `New booking — ${d.patientName || 'a patient'} · ${d.treatmentName || ''}`,
    previewData: {
      brand: brandPreview,
      practitionerFirstName: 'Ryan',
      patientName: 'Jamie Doe',
      patientEmail: 'jamie@example.com',
      treatmentName: 'Lip filler consultation',
      dateLabel: 'Tuesday 12 Nov',
      timeLabel: '2:30 pm',
      amountPaidLabel: '£50',
      totalLabel: '£200',
      dashboardUrl: 'https://modobook.uk/dashboard',
    },
  },
  'practitioner-message': {
    component: PractitionerMessage,
    displayName: 'Practitioner message',
    subject: (d) => d.subject || 'A message from your practitioner',
    previewData: {
      brand: brandPreview,
      subject: 'Quick note about your appointment',
      bodyText: 'Hi Jamie,\n\nJust confirming your appointment on Tuesday. Please let me know if you have any questions.\n\nBest,\nRyan',
    },
  },
}
