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
  closing: string
  /** Variable names available for {{...}} interpolation in this template. */
  variables: string[]
}

export const EMAIL_DEFAULTS: Record<string, EmailDefault> = {
  'booking-confirmation': {
    subject: 'Booking confirmed — {{clinic_name}}',
    intro: 'Hi {{patient_name}}, thanks for booking with {{clinic_name}}.',
    closing: 'If anything changes, use the link above to reschedule or cancel.',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'practitioner_name', 'date_time'],
  },
  'booking-cancellation': {
    subject: 'Appointment cancelled — {{clinic_name}}',
    intro: 'Hi {{patient_name}}, this confirms your {{treatment_name}} on {{date_time}} has been cancelled.',
    closing: 'If you have any questions, just reply to this email.',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'date_time'],
  },
  'appointment-reminder': {
    subject: 'Reminder: your appointment at {{clinic_name}}',
    intro: 'Hi {{patient_name}}, just a friendly reminder about your {{treatment_name}} on {{date_time}}.',
    closing: 'Looking forward to seeing you.',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'practitioner_name', 'date_time'],
  },
  'medical-form-request': {
    subject: 'Please complete your {{form_name}} — {{clinic_name}}',
    intro: 'Hi {{patient_name}}, {{clinic_name}} has sent you {{form_name}} to complete ahead of your appointment. It only takes a few minutes.',
    closing: 'Your answers are shared securely with your practitioner.',
    variables: ['patient_name', 'clinic_name', 'form_name'],
  },
  'review-request': {
    subject: 'How was your visit to {{clinic_name}}?',
    intro: "Hi {{patient_name}}, thanks for choosing {{clinic_name}}. We'd love to hear how it went — it only takes a minute.",
    closing: 'Your feedback helps other patients and helps us keep improving.',
    variables: ['patient_name', 'clinic_name', 'treatment_name', 'practitioner_name'],
  },
  'patient-message': {
    subject: 'A message from {{clinic_name}}',
    intro: '',
    closing: '',
    variables: ['clinic_name'],
  },
  // Platform auth emails (admin only)
  'signup': {
    subject: 'Confirm your email',
    intro: "We're delighted to have you. Confirm your email address to activate your studio and start crafting your booking experience.",
    closing: '',
    variables: [],
  },
  'magiclink': {
    subject: 'Your login link',
    intro: 'Tap the button below to open your studio. This one-time link expires shortly for your security.',
    closing: '',
    variables: [],
  },
  'recovery': {
    subject: 'Reset your password',
    intro: 'We received a request to reset your password. Choose a new one below — the link expires shortly.',
    closing: '',
    variables: [],
  },
  'invite': {
    subject: "You've been invited",
    intro: "You've been invited to join Modo Book. Accept your invitation to set up your account and start collaborating.",
    closing: '',
    variables: [],
  },
  'email_change': {
    subject: 'Confirm your new email',
    intro: 'You requested to change your Modo Book email. Confirm below to complete the change.',
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
