import type { ComponentType } from 'react'
import { template as bookingConfirmation } from './booking-confirmation'
import { template as bookingCancellation } from './booking-cancellation'
import { template as medicalFormRequest } from './medical-form-request'
import { template as reviewRequest } from './review-request'
import { template as marketingBroadcast } from './marketing-broadcast'
import { template as patientMessage } from './patient-message'
import { template as appointmentReminder } from './appointment-reminder'
import { template as adminBroadcast } from './admin-broadcast'
import { template as staffInvite } from './staff-invite'
import { template as rebookReminder } from './rebook-reminder'
import { template as topupReminder } from './topup-reminder'
import { template as platformArrears } from './platform-arrears'
import { template as waitlistWelcome } from './waitlist-welcome'
import { template as waitlistOpen } from './waitlist-open'
import { template as prescriberInvoice } from './prescriber-invoice'
import { template as giftCardDelivery } from './gift-card-delivery'
import { template as newBookingPractitioner } from './new-booking-practitioner'
import { template as complianceReminder } from './compliance-reminder'
import { template as membershipInvite } from './membership-invite'
import { template as membershipTerms } from './membership-terms'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'membership-terms': membershipTerms,
  'booking-confirmation': bookingConfirmation,
  'booking-cancellation': bookingCancellation,
  'appointment-reminder': appointmentReminder,
  'medical-form-request': medicalFormRequest,
  'review-request': reviewRequest,
  'marketing-broadcast': marketingBroadcast,
  'patient-message': patientMessage,
  'admin-broadcast': adminBroadcast,
  'staff-invite': staffInvite,
  'rebook-reminder': rebookReminder,
  'topup-reminder': topupReminder,
  'platform-arrears': platformArrears,
  'waitlist-welcome': waitlistWelcome,
  'waitlist-open': waitlistOpen,
  'prescriber-invoice': prescriberInvoice,
  'gift-card-delivery': giftCardDelivery,
  'new-booking-practitioner': newBookingPractitioner,
  'compliance-reminder': complianceReminder,
  'membership-invite': membershipInvite,
}
