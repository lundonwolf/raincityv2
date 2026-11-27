import test from 'node:test';
import assert from 'node:assert/strict';
import type { BookingRecord } from '../data/scooterData';
import {
  buildMonthCalendarGrid,
  extractDateKeyFromRaw,
  formatBookingDate,
  getBookingsMissingDate,
  getOngoingBookings,
  getOperatingDayFromDateKey,
  getUpcomingDatedBookings,
  getUpcomingOperatingDates,
  isValidDateKey,
} from './bookingDates';

function makeBooking(overrides: Partial<BookingRecord>): BookingRecord {
  return {
    id: 'b-1',
    referenceId: 'RCS-1127-1001',
    riderName: 'Alex Rivera',
    contactEmail: 'alex@example.com',
    contactPhone: '206-555-0148',
    scooterModel: 'Segway Max G2',
    address: '1420 E Pine St, Seattle, WA',
    preferredDay: 'Saturday',
    bookingDate: '2026-11-28',
    preferredWindow: '10:00 AM – 12:00 PM',
    serviceIds: ['silver-tune-up'],
    serviceTitles: ['Silver Essential Tune-Up'],
    estimatedLaborLabel: '$65',
    estimatedMinutes: 45,
    notes: '',
    adminNotes: '',
    status: 'confirmed',
    createdAtIso: '2026-11-26T18:00:00.000Z',
    updatedAtIso: '2026-11-26T18:00:00.000Z',
    ...overrides,
  };
}

test('isValidDateKey validates real calendar dates and rejects invalid ones', () => {
  assert.equal(isValidDateKey('2026-11-28'), true);
  assert.equal(isValidDateKey('2026-02-29'), false); // 2026 is not a leap year
  assert.equal(isValidDateKey('2028-02-29'), true); // 2028 is a leap year
  assert.equal(isValidDateKey('2026-13-01'), false);
  assert.equal(isValidDateKey('11/28/2026'), false);
  assert.equal(isValidDateKey(''), false);
});

test('getOperatingDayFromDateKey recognizes Mon/Fri/Sat/Sun and rejects Tue/Wed/Thu', () => {
  assert.equal(getOperatingDayFromDateKey('2026-11-27'), 'Friday');
  assert.equal(getOperatingDayFromDateKey('2026-11-28'), 'Saturday');
  assert.equal(getOperatingDayFromDateKey('2026-11-29'), 'Sunday');
  assert.equal(getOperatingDayFromDateKey('2026-11-30'), 'Monday');
  assert.equal(getOperatingDayFromDateKey('2026-11-26'), null); // Thursday
  assert.equal(getOperatingDayFromDateKey('2026-11-25'), null); // Wednesday
  assert.equal(getOperatingDayFromDateKey('2026-11-24'), null); // Tuesday
});

test('getUpcomingOperatingDates generates consecutive Mon/Fri/Sat/Sun dates cleanly', () => {
  const list = getUpcomingOperatingDates(4, new Date('2026-11-26T20:00:00Z')); // Thu Nov 26 PT
  assert.equal(list.length, 4);
  assert.deepEqual(
    list.map((d) => [d.dateKey, d.dayName]),
    [
      ['2026-11-27', 'Friday'],
      ['2026-11-28', 'Saturday'],
      ['2026-11-29', 'Sunday'],
      ['2026-11-30', 'Monday'],
    ],
  );
});

test('formatBookingDate displays actual date or falls back to preferredDay', () => {
  assert.equal(formatBookingDate('2026-11-28', 'Saturday'), 'Sat, Nov 28, 2026');
  assert.equal(formatBookingDate(undefined, 'Monday'), 'Monday');
});

test('extractDateKeyFromRaw parses ISO and US slash dates', () => {
  assert.equal(extractDateKeyFromRaw('2026-11-28T10:00:00Z'), '2026-11-28');
  assert.equal(extractDateKeyFromRaw('2026-11-28'), '2026-11-28');
  assert.equal(extractDateKeyFromRaw('11/28/2026'), '2026-11-28');
  assert.equal(extractDateKeyFromRaw('Saturday'), undefined);
});

test('buildMonthCalendarGrid places bookings on exact dates and sorts by arrival window', () => {
  const afternoon = makeBooking({
    id: 'b-pm',
    riderName: 'Zoe',
    bookingDate: '2026-11-28',
    preferredWindow: '2:30 PM – 5:00 PM',
  });
  const morning = makeBooking({
    id: 'b-am',
    riderName: 'Alex',
    bookingDate: '2026-11-28',
    preferredWindow: '10:00 AM – 12:00 PM',
  });
  const grid = buildMonthCalendarGrid(2026, 10, '2026-11-26', [afternoon, morning]);
  assert.equal(grid.length, 35);

  const nov28 = grid.find((c) => c.dateKey === '2026-11-28');
  assert.ok(nov28);
  assert.equal(nov28.inCurrentMonth, true);
  assert.equal(nov28.isOperatingDay, true);
  assert.deepEqual(
    nov28.bookings.map((b) => b.id),
    ['b-am', 'b-pm'],
  );

  const nov26 = grid.find((c) => c.dateKey === '2026-11-26');
  assert.ok(nov26);
  assert.equal(nov26.isToday, true);
  assert.equal(nov26.isOperatingDay, false);
});

test('getUpcomingDatedBookings, getOngoingBookings, and getBookingsMissingDate filter accurately', () => {
  const b1 = makeBooking({ id: 'b1', bookingDate: '2026-11-28', status: 'confirmed' });
  const b2 = makeBooking({ id: 'b2', bookingDate: '2026-11-25', status: 'ongoing' });
  const b3 = makeBooking({ id: 'b3', bookingDate: undefined, status: 'new' });
  const b4 = makeBooking({ id: 'b4', bookingDate: '2026-11-30', status: 'completed' });

  const upcoming = getUpcomingDatedBookings([b1, b2, b3, b4], '2026-11-26');
  assert.deepEqual(upcoming.map((b) => b.id), ['b1']);

  const ongoing = getOngoingBookings([b1, b2, b3, b4]);
  assert.deepEqual(ongoing.map((b) => b.id), ['b2']);

  const missingDate = getBookingsMissingDate([b1, b2, b3, b4]);
  assert.deepEqual(missingDate.map((b) => b.id), ['b3']);
});
