import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SITE_SETTINGS, type BookingRecord } from '../data/scooterData';
import {
  buildBookingConfirmationBundle,
  formatConfirmationTimestamp,
  normalizeSmsDigits,
} from './bookingConfirmation';

const SAMPLE_BOOKING: BookingRecord = {
  id: 'RCS-1042',
  referenceId: 'RCS-1042',
  riderName: 'Jordan Lee',
  contactEmail: 'jordan@example.com',
  contactPhone: '(206) 555-0199',
  scooterModel: 'Segway Ninebot Max G2',
  address: '1420 E Pine St, Seattle, WA 98122',
  preferredDay: 'Saturday',
  preferredWindow: '10:00 AM – 12:00 PM',
  serviceIds: ['silver-tune-up'],
  serviceTitles: ['Silver Essential Tune-Up'],
  estimatedLaborLabel: '$65',
  estimatedMinutes: 45,
  notes: 'Rear brake squeaks',
  adminNotes: '',
  status: 'new',
  createdAtIso: '2026-11-20T18:00:00.000Z',
  updatedAtIso: '2026-11-20T18:00:00.000Z',
};

test('normalizeSmsDigits formats US phone numbers cleanly', () => {
  assert.equal(normalizeSmsDigits('(206) 555-0199'), '+12065550199');
  assert.equal(normalizeSmsDigits('1-425-476-6177'), '+14254766177');
});

test('buildBookingConfirmationBundle populates email, SMS, and custom mechanic note', () => {
  const bundle = buildBookingConfirmationBundle(
    SAMPLE_BOOKING,
    DEFAULT_SITE_SETTINGS,
    'Arriving in a white sprinter van around 10:15 AM.',
  );

  assert.equal(bundle.subject, 'Booking Confirmed · RCS-1042 · Rain City Scooter');
  assert.ok(bundle.emailBody.includes('Hi Jordan Lee'));
  assert.ok(bundle.emailBody.includes('Saturday · 10:00 AM – 12:00 PM'));
  assert.ok(bundle.emailBody.includes('Arriving in a white sprinter van around 10:15 AM.'));
  assert.ok(bundle.smsBody.includes('CONFIRMED for Saturday, 10:00 AM – 12:00 PM'));
  assert.ok(bundle.mailtoHref.startsWith('mailto:jordan%40example.com?subject='));
  assert.ok(bundle.smsHref.startsWith('sms:+12065550199?&body='));
});

test('formatConfirmationTimestamp returns empty string for missing or invalid dates', () => {
  assert.equal(formatConfirmationTimestamp(undefined), '');
  assert.equal(formatConfirmationTimestamp('not-a-date'), '');
  assert.ok(formatConfirmationTimestamp('2026-11-26T20:15:00.000Z').length > 0);
});
