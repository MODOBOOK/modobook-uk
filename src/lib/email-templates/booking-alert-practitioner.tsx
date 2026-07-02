import * as React from "react";
import { Html, Section, Text, Link } from "@react-email/components";
import { BrandedShell, brandStyles, type BrandContext } from "./_branded-shell";

export type BookingAlertPractitionerData = {
  brand: BrandContext;
  practitionerFirstName?: string | null;
  patientName: string;
  patientEmail?: string | null;
  patientPhone?: string | null;
  treatmentName: string;
  dateLabel: string;
  timeLabel: string;
  locationName?: string | null;
  amountPaidLabel?: string | null;
  totalLabel?: string | null;
  dashboardUrl?: string | null;
};

export function BookingAlertPractitioner(props: BookingAlertPractitionerData) {
  const { brand } = props;
  const s = brandStyles(brand);
  return (
    <Html>
      <BrandedShell
        brand={brand}
        preview={`New booking: ${props.patientName} — ${props.treatmentName} on ${props.dateLabel}`}
      >
        <Text style={s.h1}>You&rsquo;ve got a new booking! 🎉</Text>
        <Text style={s.text}>
          Hi {props.practitionerFirstName || "there"}, {props.patientName} just booked in with you.
        </Text>

        <Section style={s.detailCard}>
          <Text style={s.detailRow}>
            <span style={s.detailLabel}>Patient</span> <strong>{props.patientName}</strong>
          </Text>
          {props.patientEmail ? (
            <Text style={s.detailRow}>
              <span style={s.detailLabel}>Email</span>{" "}
              <Link href={`mailto:${props.patientEmail}`} style={{ color: s.accent }}>
                {props.patientEmail}
              </Link>
            </Text>
          ) : null}
          {props.patientPhone ? (
            <Text style={s.detailRow}>
              <span style={s.detailLabel}>Phone</span> {props.patientPhone}
            </Text>
          ) : null}
          <Text style={s.detailRow}>
            <span style={s.detailLabel}>Treatment</span> {props.treatmentName}
          </Text>
          <Text style={s.detailRow}>
            <span style={s.detailLabel}>When</span> {props.dateLabel} at {props.timeLabel}
          </Text>
          {props.locationName ? (
            <Text style={s.detailRow}>
              <span style={s.detailLabel}>Location</span> {props.locationName}
            </Text>
          ) : null}
          {props.amountPaidLabel ? (
            <Text style={s.detailRow}>
              <span style={s.detailLabel}>Paid</span> {props.amountPaidLabel}
              {props.totalLabel ? ` of ${props.totalLabel}` : ""}
            </Text>
          ) : null}
        </Section>

        {props.dashboardUrl ? (
          <div style={s.buttonWrap}>
            <Link href={props.dashboardUrl} style={s.button}>
              Open in MODO
            </Link>
          </div>
        ) : null}
      </BrandedShell>
    </Html>
  );
}

export default BookingAlertPractitioner;
