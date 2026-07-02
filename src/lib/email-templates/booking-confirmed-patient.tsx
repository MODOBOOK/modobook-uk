import * as React from "react";
import { Html, Section, Text, Link } from "@react-email/components";
import { BrandedShell, brandStyles, type BrandContext } from "./_branded-shell";

export type BookingConfirmedPatientData = {
  brand: BrandContext;
  patientFirstName: string;
  treatmentName: string;
  dateLabel: string;
  timeLabel: string;
  locationName?: string | null;
  locationAddress?: string | null;
  amountPaidLabel?: string | null;
  outstandingLabel?: string | null;
  manageUrl?: string | null;
};

export function BookingConfirmedPatient(props: BookingConfirmedPatientData) {
  const { brand, patientFirstName, treatmentName, dateLabel, timeLabel } = props;
  const s = brandStyles(brand);
  return (
    <Html>
      <BrandedShell
        brand={brand}
        preview={`Your ${treatmentName} appointment is confirmed for ${dateLabel} at ${timeLabel}`}
      >
        <Text style={s.h1}>You&rsquo;re booked in ✨</Text>
        <Text style={s.text}>Hi {patientFirstName || "there"},</Text>
        <Text style={s.text}>
          Thank you for booking with {brand.clinicName}. Your appointment is confirmed and we can&rsquo;t wait to see you.
        </Text>

        <Section style={s.detailCard}>
          <Text style={s.detailRow}>
            <span style={s.detailLabel}>Treatment</span> <strong>{treatmentName}</strong>
          </Text>
          <Text style={s.detailRow}>
            <span style={s.detailLabel}>Date</span> {dateLabel}
          </Text>
          <Text style={s.detailRow}>
            <span style={s.detailLabel}>Time</span> {timeLabel}
          </Text>
          {props.locationName ? (
            <Text style={s.detailRow}>
              <span style={s.detailLabel}>Location</span> {props.locationName}
              {props.locationAddress ? ` — ${props.locationAddress}` : ""}
            </Text>
          ) : null}
          {props.amountPaidLabel ? (
            <Text style={s.detailRow}>
              <span style={s.detailLabel}>Paid</span> {props.amountPaidLabel}
            </Text>
          ) : null}
          {props.outstandingLabel ? (
            <Text style={s.detailRow}>
              <span style={s.detailLabel}>Balance</span> {props.outstandingLabel} due on the day
            </Text>
          ) : null}
        </Section>

        {props.manageUrl ? (
          <div style={s.buttonWrap}>
            <Link href={props.manageUrl} style={s.button}>
              View or reschedule
            </Link>
          </div>
        ) : null}

        <Text style={s.muted}>
          If you need to make any changes, just reply to this email and we&rsquo;ll be in touch.
        </Text>
      </BrandedShell>
    </Html>
  );
}

export default BookingConfirmedPatient;
