import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOOTER_SERVICES, type BookingRecord, type CustomerProfileRecord } from '../data/scooterData';
import {
  calculateRepairEstimate,
  deriveCustomersFromBookings,
  filterServicesByCategory,
  formatDuration,
  formatServicePrice,
  getSeattleScheduleStatus,
  validateBookingForm,
} from './repairCalculator';

test('filterServicesByCategory filters active services accurately', () => {
  const all = filterServicesByCategory(SCOOTER_SERVICES, 'all');
  assert.equal(all.length, 9);

  const packages = filterServicesByCategory(SCOOTER_SERVICES, 'packages');
  assert.equal(packages.length, 4);
  assert.ok(packages.every((item) => item.category === 'packages'));

  const mobility = filterServicesByCategory(SCOOTER_SERVICES, 'mobility');
  assert.equal(mobility.length, 1);
  assert.equal(mobility[0].id, 'mobility-scooter-labor');
});

test('calculateRepairEstimate reflects official $0 dispatch fee and fixed packages', () => {
  const silver = calculateRepairEstimate(['silver-tune-up']);
  assert.equal(silver.dispatchFee, 0);
  assert.equal(silver.estimatedLaborTotal, 65);
  assert.equal(silver.estimatedLaborLabel, '$65');
  assert.equal(silver.diagnosticCredit, 0);
  assert.equal(silver.recommendedMode, 'mobile');

  const gold = calculateRepairEstimate(['gold-commuter']);
  assert.equal(gold.estimatedLaborTotal, 110);
  assert.equal(gold.estimatedLaborLabel, '$110');
});

test('calculateRepairEstimate credits $45 electrical diagnosis when paired with repair labor', () => {
  const combined = calculateRepairEstimate([
    'electrical-diagnosis',
    'electronics-hardware-labor',
  ]);
  assert.equal(combined.diagnosticCredit, 45);
  assert.equal(combined.dispatchFee, 0);
  assert.equal(combined.estimatedLaborTotal, 45);
  assert.equal(combined.estimatedLaborLabel, 'from $45');
  assert.equal(combined.recommendedMode, 'pickup');
});

test('formatServicePrice formats fixed, from, and hourly rates cleanly', () => {
  assert.equal(formatServicePrice({ pricingType: 'fixed', price: 30 }), '$30');
  assert.equal(formatServicePrice({ pricingType: 'from', price: 175 }), 'from $175');
  assert.equal(formatServicePrice({ pricingType: 'hourly', price: 45 }), '$45/hr');
});

test('deriveCustomersFromBookings merges saved CRM profiles with booking history', () => {
  const bookings: BookingRecord[] = [
    {
      id: 'RCS-1126-1001',
      referenceId: 'RCS-1126-1001',
      riderName: 'Hannah Lindholm',
      contactEmail: 'hannah@example.com',
      contactPhone: '(206) 555-0199',
      scooterModel: 'Segway Ninebot Max G2',
      address: '912 E Pike St, Seattle, WA',
      preferredDay: 'Saturday',
      preferredWindow: '10:00 AM – 12:00 PM',
      serviceIds: ['silver-tune-up'],
      serviceTitles: ['Silver Essential Tune-Up'],
      estimatedLaborLabel: '$65',
      estimatedMinutes: 45,
      notes: '',
      adminNotes: '',
      status: 'confirmed',
      createdAtIso: '2026-11-26T10:00:00Z',
      updatedAtIso: '2026-11-26T10:00:00Z',
    },
    {
      id: 'RCS-1126-1002',
      referenceId: 'RCS-1126-1002',
      riderName: 'Hannah Lindholm',
      contactEmail: 'HANNAH@example.com',
      contactPhone: '(206) 555-0199',
      scooterModel: 'Segway Ninebot Max G2',
      address: '912 E Pike St, Seattle, WA',
      preferredDay: 'Sunday',
      preferredWindow: '12:00 PM – 2:30 PM',
      serviceIds: ['tire-tube-labor'],
      serviceTitles: ['Tire, Tube & Solid Tire Labor'],
      estimatedLaborLabel: '$45/hr est.',
      estimatedMinutes: 45,
      notes: '',
      adminNotes: '',
      status: 'new',
      createdAtIso: '2026-11-26T11:00:00Z',
      updatedAtIso: '2026-11-26T11:00:00Z',
    },
  ];
  const saved: CustomerProfileRecord[] = [
    {
      id: 'cust-hannah',
      name: 'Hannah Lindholm',
      email: 'hannah@example.com',
      phone: '(206) 555-0199',
      address: '912 E Pike St, Seattle, WA',
      scooterModel: 'Segway Ninebot Max G2',
      serialNumber: 'N4GSD2340K0112',
      mechanicNotes: 'Prefers 50 PSI rear tire pressure.',
      updatedAtIso: '2026-11-26T12:00:00Z',
    },
  ];

  const derived = deriveCustomersFromBookings(bookings, saved);
  assert.equal(derived.length, 1);
  assert.equal(derived[0].bookingCount, 2);
  assert.equal(derived[0].serialNumber, 'N4GSD2340K0112');
  assert.equal(derived[0].hasSavedProfile, true);
});

test('validateBookingForm catches invalid input and accepts valid booking', () => {
  const bad = validateBookingForm({
    selectedServiceIds: [],
    scooterModel: '',
    riderName: '',
    contactEmail: 'bad',
    contactPhone: '123',
    address: '1st',
    preferredDay: '',
    preferredWindow: '',
    notes: '',
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.selectedServiceIds);
  assert.ok(bad.errors.contactEmail);

  const ok = validateBookingForm({
    selectedServiceIds: ['gold-commuter'],
    scooterModel: 'NIU KQi3 Pro',
    riderName: 'Devon Alvarez',
    contactEmail: 'devon@example.com',
    contactPhone: '(425) 555-0122',
    address: '1420 E Pine St, Seattle, WA',
    preferredDay: 'Friday',
    preferredWindow: '12:00 PM – 2:30 PM',
    notes: '',
  });
  assert.equal(ok.valid, true);
  assert.equal(formatDuration(75), '1 hr 15 min');

  const status = getSeattleScheduleStatus(new Date('2026-11-28T19:30:00Z'));
  assert.equal(status.isOpenNow, true);
  assert.equal(status.timeString, '11:30 AM');
});

test('getSeattleScheduleStatus formats 12-hour time with AM and PM across midnight, noon, and evening', () => {
  // PST is UTC-8 in late November
  const midnight = getSeattleScheduleStatus(new Date('2026-11-28T08:05:00Z'));
  assert.equal(midnight.hours, '12');
  assert.equal(midnight.minutes, '05');
  assert.equal(midnight.period, 'AM');
  assert.equal(midnight.timeString, '12:05 AM');
  assert.equal(midnight.isOpenNow, false);
  assert.match(midnight.statusLabel, /10:00 AM–5:00 PM/);

  const morning = getSeattleScheduleStatus(new Date('2026-11-28T17:45:00Z'));
  assert.equal(morning.hours, '9');
  assert.equal(morning.minutes, '45');
  assert.equal(morning.period, 'AM');
  assert.equal(morning.timeString, '9:45 AM');
  assert.equal(morning.isOpenNow, false);

  const noon = getSeattleScheduleStatus(new Date('2026-11-28T20:15:00Z'));
  assert.equal(noon.hours, '12');
  assert.equal(noon.minutes, '15');
  assert.equal(noon.period, 'PM');
  assert.equal(noon.timeString, '12:15 PM');
  assert.equal(noon.isOpenNow, true);

  const lateEvening = getSeattleScheduleStatus(new Date('2026-11-27T07:32:00Z'));
  assert.equal(lateEvening.hours, '11');
  assert.equal(lateEvening.minutes, '32');
  assert.equal(lateEvening.period, 'PM');
  assert.equal(lateEvening.timeString, '11:32 PM');
  assert.equal(lateEvening.isOpenNow, false);
});

