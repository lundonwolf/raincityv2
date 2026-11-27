import type { BookingRecord, SiteSettings } from '../data/scooterData';
import { buildBookingConfirmationBundle } from '../utils/bookingConfirmation';

export interface ConfirmationEmailApiResponse {
  ok: boolean;
  provider: string;
  status: string;
  messageId: string;
  acceptedAt: string;
  to: string;
  subject: string;
  error?: string;
}

export interface MockMailOutboxItem {
  messageId: string;
  provider: string;
  status: 'sent';
  bookingId: string;
  referenceId: string;
  toEmail: string;
  riderName: string;
  subject: string;
  textBody: string;
  sentByEmail: string;
  acceptedAt: string;
}

export async function triggerBookingConfirmationEmailApi(params: {
  booking: BookingRecord;
  settings: SiteSettings;
  customNote?: string;
  idToken: string;
}): Promise<ConfirmationEmailApiResponse> {
  const bundle = buildBookingConfirmationBundle(
    params.booking,
    params.settings,
    params.customNote ?? '',
  );

  const response = await fetch('/api/send-confirmation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      bookingId: params.booking.id,
      referenceId: params.booking.referenceId,
      toEmail: params.booking.contactEmail,
      riderName: params.booking.riderName,
      subject: bundle.subject,
      textBody: bundle.emailBody,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<ConfirmationEmailApiResponse>;

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || `Mail service returned HTTP ${response.status}. Please try again.`,
    );
  }

  return {
    ok: true,
    provider: data.provider ?? 'mock-mail-service',
    status: data.status ?? 'sent',
    messageId: data.messageId ?? `mock-${Date.now()}`,
    acceptedAt: data.acceptedAt ?? new Date().toISOString(),
    to: data.to ?? params.booking.contactEmail,
    subject: data.subject ?? bundle.subject,
  };
}

export async function fetchMockMailOutbox(idToken: string): Promise<MockMailOutboxItem[]> {
  const response = await fetch('/api/mail-outbox', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    items?: MockMailOutboxItem[];
  };
  return Array.isArray(data.items) ? data.items : [];
}
