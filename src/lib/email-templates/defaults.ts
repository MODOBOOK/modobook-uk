// Default wording for every editable email, surfaced to the customization UI
// so practitioners can pre-fill the fields and tweak from there.
//
// Placeholders in {{double_curlies}} are filled in at send time with the
// real patient/clinic/appointment info by interpolateOverride() in
// src/lib/email/send.server.ts. Leave a placeholder in to keep that piece
// of personalization; delete it to write your own literal wording.

export interface EmailDefault {
  subject: string
  intro: string
  body: string
  closing: string
  /** Variable names available for {{...}} interpolation in this template. */
  variables: string[]
}

export const EMAIL_DEFAULTS: Record<string, EmailDefault> = {
  'booking-confirmation': {
    subject: 'Appointment confirmed — {{clinic_name}}',
    intro: 'Dear {{patient_name}}, thank you for booking with us. We look forward to seeing you.',
    body: '',
    closing: '',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'practitioner_name', 'date_time'],
  },
  'booking-cancellation': {
    subject: 'Appointment cancelled — {{clinic_name}}',
    intro: 'Hi {{patient_name}}, this confirms your {{treatment_name}} on {{date_time}} has been cancelled.',
    body: '',
    closing: '',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'date_time'],
  },
  'appointment-reminder': {
    subject: 'Reminder: your appointment with {{clinic_name}}',
    intro: 'Hi {{patient_name}}, this is a friendly reminder about your upcoming appointment with {{clinic_name}}.',
    body: '',
    closing: 'Please let us know as soon as possible if you need to reschedule.',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'practitioner_name', 'date_time'],
  },
  'medical-form-request': {
    subject: 'Please complete your forms — {{clinic_name}}',
    intro: 'Hi {{patient_name}}, {{clinic_name}} has sent you the following forms to complete ahead of your appointment.',
    body: '',
    closing: 'Your answers are shared securely with your practitioner.',
    variables: ['patient_name', 'clinic_name', 'form_name'],
  },
  'review-request': {
    subject: 'How was your visit to {{clinic_name}}?',
    intro: "Hi {{patient_name}}, thanks for choosing {{clinic_name}} for your {{treatment_name}}. We'd love to hear how it went — it only takes a minute.",
    body: '',
    closing: 'Your feedback helps other patients and helps us keep improving.',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'practitioner_name'],
  },
  'patient-message': {
    subject: 'A message from {{clinic_name}}',
    intro: '',
    body: '',
    closing: '',
    variables: ['clinic_name'],
  },
  // Platform auth emails (admin only)
  'signup': {
    subject: 'Confirm your email',
    intro: "We're delighted to have you. Confirm your email address to activate your studio and start crafting your booking experience.",
    body: '',
    closing: '',
    variables: [],
  },
  'magiclink': {
    subject: 'Your login link',
    intro: 'Tap the button below to open your studio. This one-time link expires shortly for your security.',
    body: '',
    closing: '',
    variables: [],
  },
  'recovery': {
    subject: 'Reset your password',
    intro: 'We received a request to reset your password. Choose a new one below — the link expires shortly.',
    body: '',
    closing: '',
    variables: [],
  },
  'invite': {
    subject: "You've been invited",
    intro: "You've been invited to join Modo Book. Accept your invitation to set up your account and start collaborating.",
    body: '',
    closing: '',
    variables: [],
  },
  'email_change': {
    subject: 'Confirm your new email',
    intro: 'You requested to change your Modo Book email. Confirm below to complete the change.',
    body: '',
    closing: '',
    variables: [],
  },
}

/** Replaces {{var_name}} tokens in a string with values from vars, leaving
 *  unknown tokens as-is so nothing collapses to empty by surprise. */
export function interpolateOverride(text: string | null | undefined, vars: Record<string, string | undefined | null>): string {
  if (!text) return ''
  return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
    const v = vars[key]
    if (v === undefined || v === null || v === '') return match
    return String(v)
  })
}
