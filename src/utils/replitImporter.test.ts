import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOOTER_SERVICES } from '../data/scooterData.ts';
import {
  autoDetectColumnMapping,
  mapRowsToBookings,
  mapRowsToCustomers,
  mapRowsToServices,
  normalizeBookingStatus,
  parseCsvText,
  parsePostgresListValue,
  parsePostgresTimestamp,
  parseReplitExportText,
} from './replitImporter.ts';

test('parseCsvText handles quoted commas, escaped quotes, multiline notes, and Postgres \\N nulls', () => {
  const csv = [
    'id,customer_name,email,phone,notes,admin_notes',
    '42,"Rivera, Alex",alex@example.com,206-555-0199,"Rear flat tire,\n""pinch flat""",\\N',
  ].join('\n');

  const parsed = parseCsvText(csv);
  assert.equal(parsed.format, 'csv');
  assert.deepEqual(parsed.headers, ['id', 'customer_name', 'email', 'phone', 'notes', 'admin_notes']);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].customer_name, 'Rivera, Alex');
  assert.equal(parsed.rows[0].notes, 'Rear flat tire,\n"pinch flat"');
  assert.equal(parsed.rows[0].admin_notes, '');
});

test('parseReplitExportText parses PostgreSQL json_agg arrays and NDJSON cleanly', () => {
  const json = JSON.stringify([
    {
      id: 101,
      customer_name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '425-555-0144',
      scooter_model: 'Segway Max G2',
      services: ['Silver Essential Tune-Up'],
      status: 'paid',
      created_at: '2026-09-12 18:30:00+00',
    },
  ]);

  const parsed = parseReplitExportText(json);
  assert.equal(parsed.format, 'json');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].customer_name, 'Jordan Lee');
  assert.deepEqual(parsePostgresListValue(parsed.rows[0].services), ['Silver Essential Tune-Up']);
});

test('parsePostgresListValue parses PostgreSQL array literals and delimited strings', () => {
  assert.deepEqual(parsePostgresListValue('{"Silver Tune-Up","Tire Swap"}'), [
    'Silver Tune-Up',
    'Tire Swap',
  ]);
  assert.deepEqual(parsePostgresListValue('{Brake,Tube}'), ['Brake', 'Tube']);
  assert.deepEqual(parsePostgresListValue('Basic Inspection, Electrical Diagnosis'), [
    'Basic Inspection',
    'Electrical Diagnosis',
  ]);
});

test('autoDetectColumnMapping and mapRowsToBookings map snake_case Postgres columns cleanly', () => {
  const csv = [
    'id,customer_name,customer_email,customer_phone,scooter_model,service_address,services,total_price,booking_status,created_at',
    '7,Sam Patel,sam@example.com,206-555-1234,NIU KQi3 Pro,"1200 Pine St, Seattle",Silver Tune-Up,65,done,2026-10-10 17:00:00+00',
  ].join('\n');

  const parsed = parseReplitExportText(csv);
  const mapping = autoDetectColumnMapping('bookings', parsed.headers);
  const now = new Date('2026-11-26T20:00:00Z');
  const results = mapRowsToBookings(parsed.rows, mapping, SCOOTER_SERVICES, now);

  assert.equal(results.length, 1);
  assert.equal(results[0].valid, true);
  assert.ok(results[0].data);
  assert.equal(results[0].data.referenceId, 'IMP-70');
  assert.equal(results[0].data.riderName, 'Sam Patel');
  assert.equal(results[0].data.status, 'completed');
  assert.equal(results[0].data.serviceIds[0], 'silver-tune-up');
  assert.equal(results[0].data.estimatedLaborLabel, '$65');
  assert.equal(results[0].data.preferredDay, 'Saturday');
  assert.equal(results[0].data.createdAtDate.toISOString(), '2026-10-10T17:00:00.000Z');
});

test('mapRowsToCustomers combines first_name + last_name and validates cleanly', () => {
  const parsed = parseReplitExportText(
    'id,first_name,last_name,email,phone,scooter_model\n12,Taylor,Kim,taylor@example.com,206-555-9988,Apollo City',
  );
  const mapping = autoDetectColumnMapping('customers', parsed.headers);
  const results = mapRowsToCustomers(parsed.rows, mapping);

  assert.equal(results[0].valid, true);
  assert.equal(results[0].data?.name, 'Taylor Kim');
  assert.equal(results[0].data?.scooterModel, 'Apollo City');
});

test('mapRowsToServices normalizes categories, pricing types, and active flags', () => {
  const parsed = parseReplitExportText(
    'slug,title,category,pricing_type,price,duration_minutes,summary,active\nrear-flat,Rear Flat Repair,standup,hourly,45,45,Curbside tube replacement,t',
  );
  const mapping = autoDetectColumnMapping('services', parsed.headers);
  const results = mapRowsToServices(parsed.rows, mapping);

  assert.equal(results[0].valid, true);
  assert.equal(results[0].data?.id, 'rear-flat');
  assert.equal(results[0].data?.pricingType, 'hourly');
  assert.equal(results[0].data?.active, true);
});

test('normalizeBookingStatus and parsePostgresTimestamp clamp future dates safely', () => {
  assert.equal(normalizeBookingStatus('in-progress'), 'in_progress');
  assert.equal(normalizeBookingStatus('canceled'), 'cancelled');
  const now = new Date('2026-11-26T20:00:00Z');
  const futureClamped = parsePostgresTimestamp('2099-01-01T00:00:00Z', now);
  assert.ok(futureClamped.getTime() <= now.getTime());
});
