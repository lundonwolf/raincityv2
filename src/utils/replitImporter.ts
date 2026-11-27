import {
  OPERATING_DAYS,
  TIME_WINDOWS,
  type BookingStatus,
  type CustomerProfileRecord,
  type OperatingDay,
  type PricingType,
  type RepairMode,
  type ScooterService,
  type ServiceCategory,
  type TimeWindow,
} from '../data/scooterData';

export type ImportEntityType = 'bookings' | 'customers' | 'services';

export interface ParsedTabularDataset {
  format: 'csv' | 'json';
  headers: string[];
  rows: Record<string, string>[];
}

export interface MappedBookingImport {
  referenceId: string;
  riderName: string;
  contactEmail: string;
  contactPhone: string;
  scooterModel: string;
  address: string;
  preferredDay: OperatingDay;
  preferredWindow: TimeWindow;
  serviceIds: string[];
  serviceTitles: string[];
  estimatedLaborLabel: string;
  estimatedMinutes: number;
  notes: string;
  adminNotes: string;
  status: BookingStatus;
  createdAtDate: Date;
}

export interface MappedRowResult<T> {
  rowIndex: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: T | null;
}

export const BOOKING_FIELD_DEFS = [
  { key: 'referenceId', label: 'Reference / ID', required: false },
  { key: 'riderName', label: 'Customer / Rider Name', required: true },
  { key: 'firstName', label: 'First Name (optional combine)', required: false },
  { key: 'lastName', label: 'Last Name (optional combine)', required: false },
  { key: 'contactEmail', label: 'Email', required: false },
  { key: 'contactPhone', label: 'Phone', required: false },
  { key: 'scooterModel', label: 'Scooter Make / Model', required: false },
  { key: 'address', label: 'Service Address', required: false },
  { key: 'preferredDay', label: 'Day / Appointment Date', required: false },
  { key: 'preferredWindow', label: 'Time Window', required: false },
  { key: 'services', label: 'Services / Repair Type', required: false },
  { key: 'estimatedLaborLabel', label: 'Price / Total Estimate', required: false },
  { key: 'estimatedMinutes', label: 'Est. Duration (Minutes)', required: false },
  { key: 'status', label: 'Booking Status', required: false },
  { key: 'notes', label: 'Customer Notes / Issue', required: false },
  { key: 'adminNotes', label: 'Mechanic / Internal Notes', required: false },
  { key: 'createdAt', label: 'Created Date / Timestamp', required: false },
] as const;

export const CUSTOMER_FIELD_DEFS = [
  { key: 'id', label: 'Customer ID', required: false },
  { key: 'name', label: 'Full Name', required: true },
  { key: 'firstName', label: 'First Name (optional combine)', required: false },
  { key: 'lastName', label: 'Last Name (optional combine)', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'scooterModel', label: 'Scooter Model', required: false },
  { key: 'serialNumber', label: 'Serial Number / VIN', required: false },
  { key: 'mechanicNotes', label: 'Mechanic Notes', required: false },
] as const;

export const SERVICE_FIELD_DEFS = [
  { key: 'id', label: 'Service ID / Slug', required: false },
  { key: 'title', label: 'Service Title', required: true },
  { key: 'shortLabel', label: 'Short Label', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'pricingType', label: 'Pricing Type (fixed/from/hourly)', required: false },
  { key: 'price', label: 'Price ($)', required: false },
  { key: 'durationMinutes', label: 'Est. Minutes', required: false },
  { key: 'mode', label: 'Mode (mobile/pickup)', required: false },
  { key: 'summary', label: 'Description / Summary', required: false },
  { key: 'includes', label: 'Included Items', required: false },
  { key: 'active', label: 'Active (true/false)', required: false },
] as const;

const COLUMN_ALIASES: Record<ImportEntityType, Record<string, string[]>> = {
  bookings: {
    referenceId: ['reference_id', 'referenceid', 'booking_ref', 'ref', 'confirmation_code', 'booking_code', 'order_number', 'booking_id', 'id'],
    riderName: ['rider_name', 'ridername', 'customer_name', 'customername', 'client_name', 'full_name', 'fullname', 'name'],
    firstName: ['first_name', 'firstname', 'fname'],
    lastName: ['last_name', 'lastname', 'lname'],
    contactEmail: ['contact_email', 'contactemail', 'customer_email', 'rider_email', 'email', 'email_address'],
    contactPhone: ['contact_phone', 'contactphone', 'customer_phone', 'rider_phone', 'phone', 'phone_number', 'mobile', 'tel'],
    scooterModel: ['scooter_model', 'scootermodel', 'scooter', 'model', 'vehicle', 'make_model', 'device_model', 'bike_model'],
    address: ['address', 'service_address', 'street_address', 'location', 'street', 'pickup_address'],
    preferredDay: ['preferred_day', 'preferredday', 'booking_day', 'appointment_day', 'day', 'appointment_date', 'scheduled_date', 'service_date'],
    preferredWindow: ['preferred_window', 'preferredwindow', 'time_window', 'time_slot', 'preferred_time', 'arrival_window', 'slot'],
    services: ['service_titles', 'servicetitles', 'services', 'service_name', 'service_type', 'service', 'package', 'repair_type', 'items'],
    estimatedLaborLabel: ['estimated_labor_label', 'estimated_total', 'total_price', 'total_amount', 'price', 'amount', 'estimate', 'cost', 'total'],
    estimatedMinutes: ['estimated_minutes', 'duration_minutes', 'duration', 'est_minutes'],
    status: ['status', 'booking_status', 'state', 'order_status'],
    notes: ['notes', 'customer_notes', 'rider_notes', 'issue', 'problem', 'description', 'symptoms', 'comments'],
    adminNotes: ['admin_notes', 'mechanic_notes', 'internal_notes', 'tech_notes', 'staff_notes'],
    createdAt: ['created_at', 'createdat', 'booked_at', 'submitted_at', 'timestamp', 'inserted_at', 'date'],
  },
  customers: {
    id: ['id', 'customer_id', 'profile_id', 'uid'],
    name: ['name', 'full_name', 'fullname', 'customer_name', 'rider_name', 'client_name'],
    firstName: ['first_name', 'firstname', 'fname'],
    lastName: ['last_name', 'lastname', 'lname'],
    email: ['email', 'email_address', 'contact_email', 'customer_email'],
    phone: ['phone', 'phone_number', 'contact_phone', 'mobile', 'tel'],
    address: ['address', 'street_address', 'service_address', 'location'],
    scooterModel: ['scooter_model', 'scootermodel', 'scooter', 'model', 'vehicle', 'make_model'],
    serialNumber: ['serial_number', 'serialnumber', 'serial', 'vin', 'frame_number'],
    mechanicNotes: ['mechanic_notes', 'notes', 'admin_notes', 'internal_notes', 'service_history'],
  },
  services: {
    id: ['id', 'service_id', 'slug', 'code'],
    title: ['title', 'name', 'service_name', 'package_name'],
    shortLabel: ['short_label', 'shortlabel', 'label', 'short_name'],
    category: ['category', 'category_label', 'group', 'type'],
    pricingType: ['pricing_type', 'pricingtype', 'price_type', 'rate_type'],
    price: ['price', 'labor_price', 'amount', 'rate', 'cost'],
    durationMinutes: ['duration_minutes', 'duration', 'minutes', 'est_minutes'],
    mode: ['mode', 'service_mode', 'repair_mode'],
    summary: ['summary', 'description', 'details'],
    includes: ['includes', 'included_items', 'features', 'checklist'],
    active: ['active', 'is_active', 'enabled', 'visible'],
  },
};

function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '\\N' ? '' : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * RFC-4180 compliant CSV parser handling quoted commas, escaped quotes (""),
 * multiline fields, BOM markers, and PostgreSQL \N null markers.
 */
export function parseCsvText(rawText: string): ParsedTabularDataset {
  const cleanText = rawText.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && cleanText[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) {
        matrix.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) {
      matrix.push(row);
    }
  }

  if (matrix.length === 0) {
    return { format: 'csv', headers: [], rows: [] };
  }

  const headers = matrix[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < matrix.length; r += 1) {
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c += 1) {
      record[headers[c]] = stringifyCell(matrix[r][c] ?? '');
    }
    rows.push(record);
  }

  return { format: 'csv', headers, rows };
}

/**
 * Parses PostgreSQL exports in JSON array, wrapped object ({ rows/data/bookings/customers/services }),
 * NDJSON (one JSON object per line), or CSV format automatically.
 */
export function parseReplitExportText(rawText: string): ParsedTabularDataset {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { format: 'csv', headers: [], rows: [] };
  }

  // Detect JSON array, JSON object, or NDJSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsedObjects: Record<string, unknown>[] | null = null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        parsedObjects = parsed.filter(
          (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
        );
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        const containerKey = ['rows', 'data', 'bookings', 'customers', 'services', 'records'].find(
          (key) => Array.isArray(obj[key]),
        );
        if (containerKey && Array.isArray(obj[containerKey])) {
          parsedObjects = (obj[containerKey] as unknown[]).filter(
            (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
          );
        } else {
          parsedObjects = [obj];
        }
      }
    } catch {
      // Try NDJSON (newline-delimited JSON objects)
      const lines = trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const ndjsonRows: Record<string, unknown>[] = [];
      let allValid = lines.length > 0;
      for (const line of lines) {
        try {
          const item = JSON.parse(line) as unknown;
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            ndjsonRows.push(item as Record<string, unknown>);
          } else {
            allValid = false;
            break;
          }
        } catch {
          allValid = false;
          break;
        }
      }
      if (allValid) {
        parsedObjects = ndjsonRows;
      }
    }

    if (parsedObjects) {
      const headerSet = new Set<string>();
      for (const item of parsedObjects) {
        Object.keys(item).forEach((key) => headerSet.add(key));
      }
      const headers = Array.from(headerSet);
      const rows = parsedObjects.map((item) => {
        const flat: Record<string, string> = {};
        for (const h of headers) {
          flat[h] = stringifyCell(item[h]);
        }
        return flat;
      });
      return { format: 'json', headers, rows };
    }
  }

  return parseCsvText(trimmed);
}

export function autoDetectColumnMapping(
  entity: ImportEntityType,
  headers: string[],
): Record<string, string> {
  const aliases = COLUMN_ALIASES[entity];
  const normalizedToOriginal = new Map<string, string>();
  for (const h of headers) {
    const norm = normalizeHeaderKey(h);
    if (!normalizedToOriginal.has(norm)) {
      normalizedToOriginal.set(norm, h);
    }
  }

  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  const entries = Object.entries(aliases);

  // Pass 1: Exact normalized matches first so specific fields like first_name / last_name win
  for (const [fieldKey, candidates] of entries) {
    let matched: string | undefined;
    for (const candidate of candidates) {
      const found = normalizedToOriginal.get(normalizeHeaderKey(candidate));
      if (found && !usedHeaders.has(found)) {
        matched = found;
        break;
      }
    }
    if (matched) {
      mapping[fieldKey] = matched;
      usedHeaders.add(matched);
    } else {
      mapping[fieldKey] = '';
    }
  }

  // Pass 2: Partial substring fallback for remaining unmapped fields
  for (const [fieldKey, candidates] of entries) {
    if (mapping[fieldKey]) continue;
    for (const candidate of candidates) {
      const normCandidate = normalizeHeaderKey(candidate);
      if (normCandidate.length < 4) continue;
      const partial = headers.find(
        (h) => !usedHeaders.has(h) && normalizeHeaderKey(h).includes(normCandidate),
      );
      if (partial) {
        mapping[fieldKey] = partial;
        usedHeaders.add(partial);
        break;
      }
    }
  }

  return mapping;
}

export function parsePostgresListValue(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // JSON array: ["Item 1", "Item 2"]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v ?? '').trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }

  // PostgreSQL text[] literal: {"Silver Tune-Up","Tire Swap"} or {Tire,Brake}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    const parsed = parseCsvText(`${inner}\n`).headers;
    return parsed.map((v) => v.trim()).filter(Boolean);
  }

  // Pipe, semicolon, newline, or comma separated
  const delimiter = trimmed.includes('\n')
    ? /\r?\n/
    : trimmed.includes(';')
      ? /;/
      : trimmed.includes('|')
        ? /\|/
        : /,/;

  return trimmed
    .split(delimiter)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePostgresTimestamp(raw: string, now: Date = new Date()): Date {
  const trimmed = raw.trim();
  if (!trimmed) return new Date(now.getTime() - 1000);

  // Normalize Postgres format "2025-11-14 18:22:10+00" -> ISO
  const isoCandidate = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(/\s+/, 'T').replace(/\+00$/, 'Z')
    : trimmed;

  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(now.getTime() - 1000);
  }

  // Firestore rule enforces createdAt <= request.time
  if (parsed.getTime() > now.getTime()) {
    return new Date(now.getTime() - 1000);
  }
  return parsed;
}

export function normalizeBookingStatus(raw: string): BookingStatus {
  const norm = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['completed', 'complete', 'done', 'finished', 'paid', 'closed'].includes(norm)) {
    return 'completed';
  }
  if (['confirmed', 'scheduled', 'booked', 'approved', 'accepted'].includes(norm)) {
    return 'confirmed';
  }
  if (['in_progress', 'inprogress', 'working', 'active', 'started', 'repairing'].includes(norm)) {
    return 'in_progress';
  }
  if (['cancelled', 'canceled', 'void', 'declined', 'no_show'].includes(norm)) {
    return 'cancelled';
  }
  return 'new';
}

export function normalizeOperatingDay(raw: string): { day: OperatingDay; defaulted: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { day: 'Saturday', defaulted: true };

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('mon')) return { day: 'Monday', defaulted: false };
  if (lower.startsWith('fri')) return { day: 'Friday', defaulted: false };
  if (lower.startsWith('sat')) return { day: 'Saturday', defaulted: false };
  if (lower.startsWith('sun')) return { day: 'Sunday', defaulted: false };

  // Try parsing a calendar date string (e.g. "2025-11-15") to its weekday
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const weekday = parsed.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    if ((OPERATING_DAYS as readonly string[]).includes(weekday)) {
      return { day: weekday as OperatingDay, defaulted: false };
    }
  }

  return { day: 'Saturday', defaulted: true };
}

export function normalizeTimeWindow(raw: string): TimeWindow {
  const trimmed = raw.trim();
  if ((TIME_WINDOWS as readonly string[]).includes(trimmed)) {
    return trimmed as TimeWindow;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes('2:30') || lower.includes('14:') || lower.includes('3:') || lower.includes('4:') || lower.includes('afternoon') || lower.includes('late')) {
    return '2:30 PM – 5:00 PM';
  }
  if (lower.includes('12:') || lower.includes('1:') || lower.includes('midday') || lower.includes('noon')) {
    return '12:00 PM – 2:30 PM';
  }
  return '10:00 AM – 12:00 PM';
}

function buildSafeReferenceId(raw: string, rowIndex: number): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (cleaned.length >= 6 && cleaned.length <= 32) {
    return cleaned;
  }
  if (cleaned.length > 0) {
    return `IMP-${cleaned}`.slice(0, 32).padEnd(6, '0');
  }
  return `RCS-IMP-${String(rowIndex + 1).padStart(4, '0')}`;
}

function normalizePriceLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '$45/hr est.';
  const numeric = Number(trimmed.replace(/[$,\s]/g, ''));
  if (Number.isFinite(numeric) && numeric >= 0 && /^[\d$,.\s]+$/.test(trimmed)) {
    return `$${Math.round(numeric).toLocaleString('en-US')}`;
  }
  return trimmed.length >= 2 ? trimmed.slice(0, 64) : '$45/hr est.';
}

function sanitizeSlugId(raw: string, fallbackPrefix: string, rowIndex: number): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length >= 2 ? slug : `${fallbackPrefix}-${rowIndex + 1}`;
}

export function mapRowsToBookings(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  catalog: ScooterService[],
  now: Date = new Date(),
): MappedRowResult<MappedBookingImport>[] {
  const usedRefs = new Set<string>();

  return rows.map((row, rowIndex) => {
    const get = (field: string) => {
      const col = mapping[field];
      return col ? (row[col] ?? '').trim() : '';
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    const combinedName = [get('firstName'), get('lastName')].filter(Boolean).join(' ').trim();
    const riderName = (get('riderName') || combinedName).slice(0, 100);
    if (riderName.length < 2) {
      errors.push('Missing customer/rider name (min 2 chars).');
    }

    let contactEmail = get('contactEmail').slice(0, 120);
    if (contactEmail.length < 5 || !contactEmail.includes('@')) {
      contactEmail = `migrated-${rowIndex + 1}@raincityscooter.local`;
      warnings.push('No valid email found; assigned placeholder.');
    }

    let contactPhone = get('contactPhone').slice(0, 32);
    if (contactPhone.length < 7) {
      contactPhone = '000-000-0000';
      warnings.push('No phone number found; assigned placeholder.');
    }

    let scooterModel = get('scooterModel').slice(0, 120);
    if (scooterModel.length < 2) {
      scooterModel = 'Electric Scooter (Imported)';
    }

    let address = get('address').slice(0, 200);
    if (address.length < 5) {
      address = 'Seattle, WA (Imported)';
      warnings.push('Address missing/short; filled default.');
    }

    let referenceId = buildSafeReferenceId(get('referenceId'), rowIndex);
    if (usedRefs.has(referenceId)) {
      referenceId = `${referenceId.slice(0, 27)}-${rowIndex + 1}`;
    }
    usedRefs.add(referenceId);

    const { day: preferredDay, defaulted: dayDefaulted } = normalizeOperatingDay(
      get('preferredDay') || get('createdAt'),
    );
    if (dayDefaulted && get('preferredDay')) {
      warnings.push(`Mapped day "${get('preferredDay')}" to ${preferredDay}.`);
    }

    const preferredWindow = normalizeTimeWindow(get('preferredWindow'));
    const rawServices = parsePostgresListValue(get('services'));
    const serviceIds: string[] = [];
    const serviceTitles: string[] = [];

    for (const entry of rawServices.slice(0, 12)) {
      const lower = entry.toLowerCase();
      const matched = catalog.find(
        (svc) =>
          svc.id.toLowerCase() === lower ||
          svc.title.toLowerCase() === lower ||
          svc.shortLabel.toLowerCase() === lower ||
          svc.title.toLowerCase().includes(lower) ||
          lower.includes(svc.shortLabel.toLowerCase()),
      );
      if (matched) {
        serviceIds.push(matched.id);
        serviceTitles.push(matched.title);
      } else {
        serviceIds.push(sanitizeSlugId(entry, 'imported-svc', serviceIds.length));
        serviceTitles.push(entry.slice(0, 120));
      }
    }

    if (serviceIds.length === 0) {
      serviceIds.push('imported-repair');
      serviceTitles.push('Imported Repair Service');
    }

    const estimatedLaborLabel = normalizePriceLabel(get('estimatedLaborLabel'));
    const parsedMinutes = Number(get('estimatedMinutes').replace(/[^\d.]/g, ''));
    const estimatedMinutes =
      Number.isFinite(parsedMinutes) && parsedMinutes > 0
        ? Math.min(600, Math.round(parsedMinutes))
        : 45;

    const status = normalizeBookingStatus(get('status'));
    const createdAtDate = parsePostgresTimestamp(get('createdAt'), now);

    if (errors.length > 0) {
      return { rowIndex, valid: false, errors, warnings, data: null };
    }

    return {
      rowIndex,
      valid: true,
      errors: [],
      warnings,
      data: {
        referenceId,
        riderName,
        contactEmail,
        contactPhone,
        scooterModel,
        address,
        preferredDay,
        preferredWindow,
        serviceIds,
        serviceTitles,
        estimatedLaborLabel,
        estimatedMinutes,
        notes: get('notes').slice(0, 1000),
        adminNotes: get('adminNotes').slice(0, 1000),
        status,
        createdAtDate,
      },
    };
  });
}

export function mapRowsToCustomers(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): MappedRowResult<Omit<CustomerProfileRecord, 'updatedAtIso'>>[] {
  const usedIds = new Set<string>();

  return rows.map((row, rowIndex) => {
    const get = (field: string) => {
      const col = mapping[field];
      return col ? (row[col] ?? '').trim() : '';
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    const combinedName = [get('firstName'), get('lastName')].filter(Boolean).join(' ').trim();
    const name = (get('name') || combinedName).slice(0, 100);
    if (name.length < 2) {
      errors.push('Missing customer name (min 2 chars).');
    }

    let email = get('email').slice(0, 120);
    if (email.length < 5 || !email.includes('@')) {
      email = `customer-${rowIndex + 1}@raincityscooter.local`;
      warnings.push('No valid email found; assigned placeholder.');
    }

    let phone = get('phone').slice(0, 32);
    if (phone.length < 7) {
      phone = '000-000-0000';
      warnings.push('No phone number found; assigned placeholder.');
    }

    let id = sanitizeSlugId(get('id') || email, 'cust', rowIndex);
    if (usedIds.has(id)) {
      id = `${id.slice(0, 52)}-${rowIndex + 1}`;
    }
    usedIds.add(id);

    if (errors.length > 0) {
      return { rowIndex, valid: false, errors, warnings, data: null };
    }

    return {
      rowIndex,
      valid: true,
      errors: [],
      warnings,
      data: {
        id,
        name,
        email,
        phone,
        address: get('address').slice(0, 200),
        scooterModel: get('scooterModel').slice(0, 120),
        serialNumber: get('serialNumber').slice(0, 80),
        mechanicNotes: get('mechanicNotes').slice(0, 1200),
      },
    };
  });
}

export function mapRowsToServices(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): MappedRowResult<ScooterService>[] {
  const usedIds = new Set<string>();

  return rows.map((row, rowIndex) => {
    const get = (field: string) => {
      const col = mapping[field];
      return col ? (row[col] ?? '').trim() : '';
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    const title = get('title').slice(0, 100);
    if (title.length < 2) {
      errors.push('Missing service title (min 2 chars).');
    }

    let id = sanitizeSlugId(get('id') || title, 'service', rowIndex);
    if (usedIds.has(id)) {
      id = `${id.slice(0, 54)}-${rowIndex + 1}`;
    }
    usedIds.add(id);

    const catRaw = get('category').toLowerCase();
    let category: Exclude<ServiceCategory, 'all'> = 'standup';
    let categoryLabel = 'Stand-Up Labor';
    if (catRaw.includes('pack') || catRaw.includes('tune') || catRaw.includes('inspect')) {
      category = 'packages';
      categoryLabel = 'Service Package';
    } else if (catRaw.includes('elec') || catRaw.includes('batt') || catRaw.includes('diag')) {
      category = 'electrical';
      categoryLabel = 'Electrical & Power';
    } else if (catRaw.includes('mobil')) {
      category = 'mobility';
      categoryLabel = 'Mobility Scooters';
    }

    const ptRaw = get('pricingType').toLowerCase();
    const pricingType: PricingType = ptRaw.includes('hour')
      ? 'hourly'
      : ptRaw.includes('from') || ptRaw.includes('start')
        ? 'from'
        : 'fixed';

    const priceNum = Number(get('price').replace(/[$,\s]/g, ''));
    const price = Number.isFinite(priceNum) && priceNum >= 0 ? Math.min(2000, priceNum) : 45;

    const minsNum = Number(get('durationMinutes').replace(/[^\d.]/g, ''));
    const durationMinutes =
      Number.isFinite(minsNum) && minsNum >= 5 ? Math.min(480, Math.round(minsNum)) : 45;

    const mode: RepairMode = get('mode').toLowerCase().includes('pick') ? 'pickup' : 'mobile';

    let summary = get('summary').slice(0, 400);
    if (summary.length < 4) {
      summary = `${title} labor service.`;
    }

    const includes = parsePostgresListValue(get('includes')).slice(0, 8);
    const activeRaw = get('active').toLowerCase();
    const active = !['false', '0', 'f', 'no', 'inactive', 'hidden'].includes(activeRaw);

    if (errors.length > 0) {
      return { rowIndex, valid: false, errors, warnings, data: null };
    }

    return {
      rowIndex,
      valid: true,
      errors: [],
      warnings,
      data: {
        id,
        index: String(rowIndex + 1).padStart(2, '0'),
        title,
        shortLabel: (get('shortLabel') || title).slice(0, 48),
        category,
        categoryLabel,
        pricingType,
        price,
        durationMinutes,
        mode,
        summary,
        includes: includes.length > 0 ? includes : ['Scope confirmed prior to work'],
        featuredTone: rowIndex % 2 === 0 ? 'light' : 'dark',
        active,
        sortOrder: Math.min(100, rowIndex + 1),
      },
    };
  });
}
