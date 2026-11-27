import {
  OPERATING_DAYS,
  type BookingRecord,
  type BookingStatus,
  type OperatingDay,
  type ScooterService,
} from '../data/scooterData';

export type TimeRangeKey = '7d' | '14d' | '30d' | 'all';

export const TIME_RANGE_OPTIONS: { id: TimeRangeKey; label: string; shortLabel: string }[] = [
  { id: '7d', label: 'Last 7 Days', shortLabel: '7D' },
  { id: '14d', label: 'Last 14 Days', shortLabel: '14D' },
  { id: '30d', label: 'Last 30 Days', shortLabel: '30D' },
  { id: 'all', label: 'All Time', shortLabel: 'All' },
];

export interface BookingTrendPoint {
  dateKey: string;
  label: string;
  totalBookings: number;
  serviceRequests: number;
  completedBookings: number;
  cancelledBookings: number;
  estimatedMinutes: number;
}

export interface ServiceDemandPoint {
  id: string;
  name: string;
  shortName: string;
  requests: number;
  sharePercent: number;
  categoryLabel: string;
}

export interface OperatingDayDemandPoint {
  day: OperatingDay;
  shortDay: string;
  bookings: number;
  serviceRequests: number;
  estimatedHours: number;
}

export interface StatusBreakdownPoint {
  status: BookingStatus;
  label: string;
  count: number;
  sharePercent: number;
  color: string;
}

export interface BookingAnalyticsSummary {
  totalBookings: number;
  totalServiceRequests: number;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  completionRate: number;
  avgServicesPerBooking: number;
  totalEstimatedHours: number;
  busiestDay: string;
  topServiceName: string;
}

const PACIFIC_TZ = 'America/Los_Angeles';

const STATUS_META: Record<BookingStatus, { label: string; color: string }> = {
  new: { label: 'New', color: '#E8452C' },
  confirmed: { label: 'Confirmed', color: '#4A82E8' },
  in_progress: { label: 'In Progress', color: '#D9A441' },
  ongoing: { label: 'Ongoing', color: '#A855F7' },
  completed: { label: 'Completed', color: '#22C55E' },
  cancelled: { label: 'Cancelled', color: '#71717A' },
};

const SHORT_DAY_MAP: Record<OperatingDay, string> = {
  Monday: 'Mon',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Converts a Date or ISO string into a YYYY-MM-DD calendar key in Pacific Time.
 */
export function toPacificDateKey(input: Date | string): string | null {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: PACIFIC_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback to UTC date key if Intl timezone data is unavailable
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Adds a signed number of days to a YYYY-MM-DD key using UTC noon arithmetic to avoid DST shifts.
 */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateKeyLabel(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateKey;
  const [, month, day] = parts;
  return `${MONTH_ABBR[month - 1] ?? month} ${day}`;
}

function getServiceRequestCount(booking: BookingRecord): number {
  if (booking.serviceIds.length > 0) return booking.serviceIds.length;
  if (booking.serviceTitles.length > 0) return booking.serviceTitles.length;
  return 0;
}

export function getRangeDayCount(range: TimeRangeKey): number | null {
  if (range === '7d') return 7;
  if (range === '14d') return 14;
  if (range === '30d') return 30;
  return null;
}

export function filterBookingsByRange(
  bookings: BookingRecord[],
  range: TimeRangeKey,
  now: Date = new Date(),
): BookingRecord[] {
  const dayCount = getRangeDayCount(range);
  if (dayCount === null) {
    return bookings.filter((b) => toPacificDateKey(b.createdAtIso) !== null);
  }
  const todayKey = toPacificDateKey(now) ?? now.toISOString().slice(0, 10);
  const startKey = shiftDateKey(todayKey, -(dayCount - 1));

  return bookings.filter((b) => {
    const key = toPacificDateKey(b.createdAtIso);
    if (!key) return false;
    return key >= startKey && key <= todayKey;
  });
}

function enumerateDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 366) {
    keys.push(cursor);
    cursor = shiftDateKey(cursor, 1);
    guard += 1;
  }
  return keys;
}

export function buildBookingTrendSeries(
  bookings: BookingRecord[],
  range: TimeRangeKey,
  now: Date = new Date(),
): BookingTrendPoint[] {
  const todayKey = toPacificDateKey(now) ?? now.toISOString().slice(0, 10);
  const filtered = filterBookingsByRange(bookings, range, now);

  const buckets = new Map<
    string,
    {
      totalBookings: number;
      serviceRequests: number;
      completedBookings: number;
      cancelledBookings: number;
      estimatedMinutes: number;
    }
  >();

  for (const booking of filtered) {
    const key = toPacificDateKey(booking.createdAtIso);
    if (!key) continue;
    const prev = buckets.get(key) ?? {
      totalBookings: 0,
      serviceRequests: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      estimatedMinutes: 0,
    };
    prev.totalBookings += 1;
    prev.serviceRequests += getServiceRequestCount(booking);
    if (booking.status === 'completed') prev.completedBookings += 1;
    if (booking.status === 'cancelled') prev.cancelledBookings += 1;
    prev.estimatedMinutes += Number.isFinite(booking.estimatedMinutes)
      ? Math.max(0, booking.estimatedMinutes)
      : 0;
    buckets.set(key, prev);
  }

  const fixedDays = getRangeDayCount(range);
  let dateKeys: string[];

  if (fixedDays !== null) {
    const startKey = shiftDateKey(todayKey, -(fixedDays - 1));
    dateKeys = enumerateDateKeys(startKey, todayKey);
  } else {
    const sortedKeys = Array.from(buckets.keys()).sort();
    if (sortedKeys.length === 0) {
      const startKey = shiftDateKey(todayKey, -6);
      dateKeys = enumerateDateKeys(startKey, todayKey);
    } else {
      const earliest = sortedKeys[0];
      const latest = sortedKeys[sortedKeys.length - 1] > todayKey ? sortedKeys[sortedKeys.length - 1] : todayKey;
      // Ensure at least a 7-day window so single-day "All Time" charts stay legible
      const minStart = shiftDateKey(latest, -6);
      const effectiveStart = earliest < minStart ? earliest : minStart;
      dateKeys = enumerateDateKeys(effectiveStart, latest);
    }
  }

  return dateKeys.map((dateKey) => {
    const bucket = buckets.get(dateKey);
    return {
      dateKey,
      label: formatDateKeyLabel(dateKey),
      totalBookings: bucket?.totalBookings ?? 0,
      serviceRequests: bucket?.serviceRequests ?? 0,
      completedBookings: bucket?.completedBookings ?? 0,
      cancelledBookings: bucket?.cancelledBookings ?? 0,
      estimatedMinutes: bucket?.estimatedMinutes ?? 0,
    };
  });
}

export function buildServiceDemandSeries(
  bookings: BookingRecord[],
  services: ScooterService[],
  range: TimeRangeKey,
  now: Date = new Date(),
): ServiceDemandPoint[] {
  const filtered = filterBookingsByRange(bookings, range, now);
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const counts = new Map<
    string,
    { id: string; name: string; shortName: string; requests: number; categoryLabel: string }
  >();

  let totalRequests = 0;

  for (const booking of filtered) {
    const itemCount = Math.max(booking.serviceIds.length, booking.serviceTitles.length);
    for (let i = 0; i < itemCount; i += 1) {
      const rawId = booking.serviceIds[i] ?? '';
      const rawTitle = booking.serviceTitles[i] ?? '';
      const catalogMatch = rawId ? serviceById.get(rawId) : undefined;

      const key = catalogMatch?.id ?? (rawId || rawTitle.toLowerCase().trim());
      if (!key) continue;

      const name = catalogMatch?.title ?? (rawTitle || rawId);
      const shortName = catalogMatch?.shortLabel ?? (rawTitle || rawId);
      const categoryLabel = catalogMatch?.categoryLabel ?? 'Custom Service';

      const prev = counts.get(key) ?? {
        id: key,
        name,
        shortName,
        requests: 0,
        categoryLabel,
      };
      prev.requests += 1;
      counts.set(key, prev);
      totalRequests += 1;
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name))
    .map((entry) => ({
      ...entry,
      sharePercent: totalRequests > 0 ? Math.round((entry.requests / totalRequests) * 100) : 0,
    }));
}

export function buildOperatingDayDemand(
  bookings: BookingRecord[],
  range: TimeRangeKey,
  now: Date = new Date(),
): OperatingDayDemandPoint[] {
  const filtered = filterBookingsByRange(bookings, range, now);
  const map = new Map<
    OperatingDay,
    { bookings: number; serviceRequests: number; estimatedMinutes: number }
  >();

  for (const day of OPERATING_DAYS) {
    map.set(day, { bookings: 0, serviceRequests: 0, estimatedMinutes: 0 });
  }

  for (const booking of filtered) {
    const bucket = map.get(booking.preferredDay);
    if (!bucket) continue;
    bucket.bookings += 1;
    bucket.serviceRequests += getServiceRequestCount(booking);
    bucket.estimatedMinutes += Number.isFinite(booking.estimatedMinutes)
      ? Math.max(0, booking.estimatedMinutes)
      : 0;
  }

  return OPERATING_DAYS.map((day) => {
    const bucket = map.get(day)!;
    return {
      day,
      shortDay: SHORT_DAY_MAP[day],
      bookings: bucket.bookings,
      serviceRequests: bucket.serviceRequests,
      estimatedHours: Number((bucket.estimatedMinutes / 60).toFixed(1)),
    };
  });
}

export function buildStatusBreakdown(
  bookings: BookingRecord[],
  range: TimeRangeKey,
  now: Date = new Date(),
): StatusBreakdownPoint[] {
  const filtered = filterBookingsByRange(bookings, range, now);
  const counts: Record<BookingStatus, number> = {
    new: 0,
    confirmed: 0,
    in_progress: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const booking of filtered) {
    if (booking.status in counts) {
      counts[booking.status] += 1;
    }
  }

  const total = filtered.length;
  return (Object.keys(STATUS_META) as BookingStatus[]).map((status) => ({
    status,
    label: STATUS_META[status].label,
    count: counts[status],
    sharePercent: total > 0 ? Math.round((counts[status] / total) * 100) : 0,
    color: STATUS_META[status].color,
  }));
}

export function summarizeBookingAnalytics(
  bookings: BookingRecord[],
  services: ScooterService[],
  range: TimeRangeKey,
  now: Date = new Date(),
): BookingAnalyticsSummary {
  const filtered = filterBookingsByRange(bookings, range, now);
  const totalBookings = filtered.length;

  let totalServiceRequests = 0;
  let activeBookings = 0;
  let completedBookings = 0;
  let cancelledBookings = 0;
  let totalMinutes = 0;

  for (const booking of filtered) {
    totalServiceRequests += getServiceRequestCount(booking);
    totalMinutes += Number.isFinite(booking.estimatedMinutes)
      ? Math.max(0, booking.estimatedMinutes)
      : 0;
    if (
      booking.status === 'new' ||
      booking.status === 'confirmed' ||
      booking.status === 'in_progress' ||
      booking.status === 'ongoing'
    ) {
      activeBookings += 1;
    } else if (booking.status === 'completed') {
      completedBookings += 1;
    } else if (booking.status === 'cancelled') {
      cancelledBookings += 1;
    }
  }

  const nonCancelled = totalBookings - cancelledBookings;
  const completionRate =
    nonCancelled > 0 ? Math.round((completedBookings / nonCancelled) * 100) : 0;
  const avgServicesPerBooking =
    totalBookings > 0 ? Number((totalServiceRequests / totalBookings).toFixed(1)) : 0;
  const totalEstimatedHours = Number((totalMinutes / 60).toFixed(1));

  const dayDemand = buildOperatingDayDemand(bookings, range, now);
  const topDay = [...dayDemand].sort((a, b) => b.bookings - a.bookings)[0];
  const busiestDay = topDay && topDay.bookings > 0 ? topDay.day : '—';

  const serviceDemand = buildServiceDemandSeries(bookings, services, range, now);
  const topServiceName = serviceDemand[0]?.shortName ?? '—';

  return {
    totalBookings,
    totalServiceRequests,
    activeBookings,
    completedBookings,
    cancelledBookings,
    completionRate,
    avgServicesPerBooking,
    totalEstimatedHours,
    busiestDay,
    topServiceName,
  };
}
