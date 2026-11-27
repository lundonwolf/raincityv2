import type { BookingRecord, SiteSettings } from '../data/scooterData';
import { formatBookingDate } from './bookingDates';

export interface ConfirmationMessageBundle {
  subject: string;
  emailBody: string;
  smsBody: string;
  mailtoHref: string;
  smsHref: string;
}

export function normalizeSmsDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

export function buildBookingConfirmationBundle(
  booking: BookingRecord,
  settings: SiteSettings,
  customNote = '',
): ConfirmationMessageBundle {
  const cleanNote = customNote.trim();
  const servicesList =
    booking.serviceTitles.length > 0 ? booking.serviceTitles.join(', ') : 'Mobile Scooter Service';
  const dateDisplay = formatBookingDate(booking.bookingDate, booking.preferredDay);

  const subject = `Booking Confirmed · ${booking.referenceId} · ${settings.businessName}`;

  const emailLines = [
    `Hi ${booking.riderName},`,
    '',
    `Your mobile scooter repair appointment with ${settings.businessName} is confirmed!`,
    '',
    `Booking Reference: ${booking.referenceId}`,
    `Scheduled Date & Window: ${dateDisplay} · ${booking.preferredWindow}`,
    `Service Address: ${booking.address}`,
    `Scooter: ${booking.scooterModel}`,
    `Requested Work: ${servicesList}`,
    `Estimated Labor: ${booking.estimatedLaborLabel} (${settings.dispatchPolicyNote})`,
  ];

  if (cleanNote) {
    emailLines.push('', `Mechanic Note: ${cleanNote}`);
  }

  emailLines.push(
    '',
    `No upfront payment is required. Any replacement parts or scope changes will be confirmed with you before work begins, and completed labor is covered by our ${settings.warrantyDays}-day workmanship warranty.`,
    '',
    `Need to adjust your window or share gate/parking instructions? Reply to this email or call/text ${settings.phoneDisplay}.`,
    '',
    `Thanks,`,
    settings.businessName,
    `${settings.phoneDisplay} · ${settings.email}`,
  );

  const emailBody = emailLines.join('\n');

  const smsParts = [
    `${settings.businessName}: Hi ${booking.riderName}, your mobile repair (${booking.referenceId}) for your ${booking.scooterModel} is CONFIRMED for ${dateDisplay}, ${booking.preferredWindow} at ${booking.address}.`,
    `Est. labor: ${booking.estimatedLaborLabel} ($0 travel fee).`,
  ];
  if (cleanNote) {
    smsParts.push(cleanNote);
  }
  smsParts.push(`Reply here or call ${settings.phoneDisplay} if anything changes.`);
  const smsBody = smsParts.join(' ');

  const mailtoHref = `mailto:${encodeURIComponent(booking.contactEmail.trim())}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(emailBody)}`;

  const smsTarget = normalizeSmsDigits(booking.contactPhone);
  const smsHref = `sms:${smsTarget}?&body=${encodeURIComponent(smsBody)}`;

  return {
    subject,
    emailBody,
    smsBody,
    mailtoHref,
    smsHref,
  };
}

export function formatConfirmationTimestamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
