import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCOOTER_SERVICES, type BookingRecord } from '../data/scooterData.ts';
import {
  buildBookingTrendSeries,
  buildOperatingDayDemand,
  buildServiceDemandSeries,
  buildStatusBreakdown,
  filterBookingsByRange,
  summarizeBookingAnalytics,
} from './adminAnalytics.ts';

function makeBooking(overrides: Partial<BookingRecord>): BookingRecord {
  return {
    id: overrides.id ?? 'b-1',
    referenceId: overrides.referenceId ?? 'RCS-1126-0001',
    riderName: overrides.riderName ?? 'Alex Rivera',
    contactEmail: overrides.contactEmail ?? 'alex@example.com',
    contactPhone: overrides.contactPhone ?? '(206) 555-0101',
    scooterModel: overrides.scooterModel ?? 'Segway Ninebot Max G2',
    address: overrides.address ?? '1200 Pine St, Seattle, WA',
    preferredDay: overrides.preferredDay ?? 'Saturday',
    preferredWindow: overrides.preferredWindow ?? '10:00 AM – 12:00 PM',
    serviceIds: overrides.serviceIds ?? ['silver-tune-up'],
    serviceTitles: overrides.serviceTitles ?? ['Silver Essential Tune-Up'],
    estimatedLaborLabel: overrides.estimatedLaborLabel ?? '$65',
    estimatedMinutes: overrides.estimatedMinutes ?? 45,
    notes: overrides.notes ?? '',
    adminNotes: overrides.adminNotes ?? '',
    status: overrides.status ?? 'new',
    createdAtIso: overrides.createdAtIso ?? '2026-11-26T18:00:00.000Z',
    updatedAtIso: overrides.updatedAtIso ?? '2026-11-26T18:00:00.000Z',
  };
}

const FIXED_NOW = new Date('2026-11-26T20:00:00.000Z'); // 2026-11-26 12:00 PST

const SAMPLE_BOOKINGS: BookingRecord[] = [
  makeBooking({
    id: 'b-today-1',
    createdAtIso: '2026-11-26T18:00:00.000Z', // Nov 26 PST
    preferredDay: 'Saturday',
    status: 'completed',
    serviceIds: ['tire-tube-labor', 'silver-tune-up'],
    serviceTitles: ['Tire, Tube & Solid Tire Labor', 'Silver Essential Tune-Up'],
    estimatedMinutes: 90,
  }),
  makeBooking({
    id: 'b-today-2',
    createdAtIso: '2026-11-26T19:30:00.000Z', // Nov 26 PST
    preferredDay: 'Sunday',
    status: 'confirmed',
    serviceIds: ['tire-tube-labor'],
    serviceTitles: ['Tire, Tube & Solid Tire Labor'],
    estimatedMinutes: 45,
  }),
  makeBooking({
    id: 'b-4d-ago',
    createdAtIso: '2026-11-22T20:00:00.000Z', // Nov 22 PST
    preferredDay: 'Saturday',
    status: 'in_progress',
    serviceIds: ['electrical-diagnosis'],
    serviceTitles: ['Electrical Diagnosis'],
    estimatedMinutes: 40,
  }),
  makeBooking({
    id: 'b-20d-ago',
    createdAtIso: '2026-11-06T20:00:00.000Z', // Nov 6 PST
    preferredDay: 'Monday',
    status: 'cancelled',
    serviceIds: ['gold-commuter'],
    serviceTitles: ['Gold Commuter Service'],
    estimatedMinutes: 75,
  }),
];

describe('adminAnalytics', () => {
  it('filters bookings accurately by 7d, 30d, and all-time windows', () => {
    assert.equal(filterBookingsByRange(SAMPLE_BOOKINGS, '7d', FIXED_NOW).length, 3);
    assert.equal(filterBookingsByRange(SAMPLE_BOOKINGS, '30d', FIXED_NOW).length, 4);
    assert.equal(filterBookingsByRange(SAMPLE_BOOKINGS, 'all', FIXED_NOW).length, 4);
  });

  it('builds a zero-filled daily trend series with booking and service request counts', () => {
    const series = buildBookingTrendSeries(SAMPLE_BOOKINGS, '7d', FIXED_NOW);
    assert.equal(series.length, 7);
    assert.equal(series[0].dateKey, '2026-11-20');
    assert.equal(series[6].dateKey, '2026-11-26');
    assert.equal(series[6].totalBookings, 2);
    assert.equal(series[6].serviceRequests, 3);
    assert.equal(series[6].completedBookings, 1);

    const nov22 = series.find((p) => p.dateKey === '2026-11-22');
    assert.ok(nov22);
    assert.equal(nov22.totalBookings, 1);
    assert.equal(nov22.serviceRequests, 1);

    const nov24 = series.find((p) => p.dateKey === '2026-11-24');
    assert.ok(nov24);
    assert.equal(nov24.totalBookings, 0);
    assert.equal(nov24.serviceRequests, 0);
  });

  it('ranks requested services accurately and calculates share percentages', () => {
    const demand = buildServiceDemandSeries(SAMPLE_BOOKINGS, SCOOTER_SERVICES, '7d', FIXED_NOW);
    assert.equal(demand[0].id, 'tire-tube-labor');
    assert.equal(demand[0].shortName, 'Tire & Tube Labor');
    assert.equal(demand[0].requests, 2);
    assert.equal(demand[0].sharePercent, 50);
    assert.equal(demand.length, 3);
  });

  it('aggregates operating day demand and status pipeline cleanly', () => {
    const dayDemand = buildOperatingDayDemand(SAMPLE_BOOKINGS, '7d', FIXED_NOW);
    assert.equal(dayDemand.length, 4);
    const saturday = dayDemand.find((d) => d.day === 'Saturday');
    assert.equal(saturday?.bookings, 2);
    assert.equal(saturday?.serviceRequests, 3);

    const statuses = buildStatusBreakdown(SAMPLE_BOOKINGS, 'all', FIXED_NOW);
    assert.equal(statuses.find((s) => s.status === 'completed')?.count, 1);
    assert.equal(statuses.find((s) => s.status === 'cancelled')?.count, 1);
    assert.equal(statuses.find((s) => s.status === 'new')?.count, 0);
    assert.equal(statuses.find((s) => s.status === 'ongoing')?.count, 0);

    const withOngoing = [
      ...SAMPLE_BOOKINGS,
      makeBooking({
        id: 'b-ongoing-1',
        createdAtIso: '2026-11-25T18:00:00.000Z',
        bookingDate: '2026-11-28',
        preferredDay: 'Saturday',
        status: 'ongoing',
      }),
    ];
    const statusesWithOngoing = buildStatusBreakdown(withOngoing, 'all', FIXED_NOW);
    assert.equal(statusesWithOngoing.find((s) => s.status === 'ongoing')?.count, 1);
    const summaryWithOngoing = summarizeBookingAnalytics(withOngoing, SCOOTER_SERVICES, '7d', FIXED_NOW);
    assert.equal(summaryWithOngoing.activeBookings, 3);
  });

  it('summarizes KPIs and handles empty bookings safely', () => {
    const summary = summarizeBookingAnalytics(SAMPLE_BOOKINGS, SCOOTER_SERVICES, '7d', FIXED_NOW);
    assert.equal(summary.totalBookings, 3);
    assert.equal(summary.totalServiceRequests, 4);
    assert.equal(summary.completedBookings, 1);
    assert.equal(summary.completionRate, 33);
    assert.equal(summary.busiestDay, 'Saturday');
    assert.equal(summary.topServiceName, 'Tire & Tube Labor');

    const emptySummary = summarizeBookingAnalytics([], SCOOTER_SERVICES, '7d', FIXED_NOW);
    assert.equal(emptySummary.totalBookings, 0);
    assert.equal(emptySummary.completionRate, 0);
    assert.equal(emptySummary.busiestDay, '—');
    assert.equal(emptySummary.topServiceName, '—');
  });
});
