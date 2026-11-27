import { OPERATING_DAYS, type BookingRecord, type OperatingDay } from '../data/scooterData';

const PACIFIC_TZ = 'America/Los_Angeles';

const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MONTH_SHORT = [
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
] as const;

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface UpcomingOperatingDate {
  dateKey: string;
  dayName: OperatingDay;
  shortLabel: string;
  longLabel: string;
}

export interface CalendarDayCell {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isOperatingDay: boolean;
  weekdayName: string;
  bookings: BookingRecord[];
}

export function getTodayPacificDateKey(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: PACIFIC_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback to UTC
  }
  return now.toISOString().slice(0, 10);
}

export function isValidDateKey(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function shiftCalendarDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekdayNameFromDateKey(dateKey: string): string | null {
  if (!isValidDateKey(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return WEEKDAY_LONG[dt.getUTCDay()] ?? null;
}

export function getOperatingDayFromDateKey(dateKey: string): OperatingDay | null {
  const weekday = getWeekdayNameFromDateKey(dateKey);
  if (!weekday) return null;
  return (OPERATING_DAYS as readonly string[]).includes(weekday)
    ? (weekday as OperatingDay)
    : null;
}

export function getUpcomingOperatingDates(
  count = 8,
  fromDate: Date = new Date(),
): UpcomingOperatingDate[] {
  const startKey = getTodayPacificDateKey(fromDate);
  const results: UpcomingOperatingDate[] = [];
  let cursor = startKey;
  let guard = 0;

  while (results.length < count && guard < 60) {
    const dayName = getOperatingDayFromDateKey(cursor);
    if (dayName) {
      const [y, m, d] = cursor.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const shortDay = WEEKDAY_SHORT[dt.getUTCDay()];
      const monthName = MONTH_SHORT[m - 1];
      results.push({
        dateKey: cursor,
        dayName,
        shortLabel: `${shortDay}, ${monthName} ${d}`,
        longLabel: `${dayName}, ${MONTH_LONG[m - 1]} ${d}, ${y}`,
      });
    }
    cursor = shiftCalendarDateKey(cursor, 1);
    guard += 1;
  }

  return results;
}

export function formatBookingDate(
  bookingDate?: string,
  preferredDay?: OperatingDay,
): string {
  if (isValidDateKey(bookingDate)) {
    const [y, m, d] = bookingDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const shortDay = WEEKDAY_SHORT[dt.getUTCDay()];
    const monthName = MONTH_SHORT[m - 1];
    return `${shortDay}, ${monthName} ${d}, ${y}`;
  }
  return preferredDay ?? 'Unscheduled';
}

export function formatBookingDateShort(
  bookingDate?: string,
  preferredDay?: OperatingDay,
): string {
  if (isValidDateKey(bookingDate)) {
    const [y, m, d] = bookingDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const shortDay = WEEKDAY_SHORT[dt.getUTCDay()];
    const monthName = MONTH_SHORT[m - 1];
    return `${shortDay}, ${monthName} ${d}`;
  }
  return preferredDay ?? 'No date';
}

export function extractDateKeyFromRaw(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix && isValidDateKey(isoPrefix[1])) {
    return isoPrefix[1];
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    const key = `${year}-${month}-${day}`;
    if (isValidDateKey(key)) return key;
  }

  return undefined;
}

export function getMonthTitle(year: number, monthIndex: number): string {
  return `${MONTH_LONG[monthIndex] ?? 'Month'} ${year}`;
}

function getWindowSortRank(windowStr: string): number {
  if (windowStr.startsWith('10:')) return 1;
  if (windowStr.startsWith('12:')) return 2;
  if (windowStr.startsWith('2:')) return 3;
  return 4;
}

export function buildMonthCalendarGrid(
  year: number,
  monthIndex: number,
  todayKey: string,
  bookings: BookingRecord[],
): CalendarDayCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
  const totalCells = startWeekday + daysInMonth > 35 ? 42 : 35;

  const firstKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const gridStartKey = shiftCalendarDateKey(firstKey, -startWeekday);

  const bookingsByDate = new Map<string, BookingRecord[]>();
  for (const b of bookings) {
    if (!isValidDateKey(b.bookingDate)) continue;
    const list = bookingsByDate.get(b.bookingDate) ?? [];
    list.push(b);
    bookingsByDate.set(b.bookingDate, list);
  }
  for (const list of bookingsByDate.values()) {
    list.sort(
      (a, b) =>
        getWindowSortRank(a.preferredWindow) - getWindowSortRank(b.preferredWindow) ||
        a.riderName.localeCompare(b.riderName),
    );
  }

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dateKey = shiftCalendarDateKey(gridStartKey, i);
    const [y, m, d] = dateKey.split('-').map(Number);
    const weekdayName = getWeekdayNameFromDateKey(dateKey) ?? '';
    const isOperatingDay = (OPERATING_DAYS as readonly string[]).includes(weekdayName);
    cells.push({
      dateKey,
      dayNumber: d,
      inCurrentMonth: y === year && m - 1 === monthIndex,
      isToday: dateKey === todayKey,
      isOperatingDay,
      weekdayName,
      bookings: bookingsByDate.get(dateKey) ?? [],
    });
  }

  return cells;
}

export function getUpcomingDatedBookings(
  bookings: BookingRecord[],
  todayKey: string,
): BookingRecord[] {
  return bookings
    .filter(
      (b) =>
        isValidDateKey(b.bookingDate) &&
        b.bookingDate >= todayKey &&
        b.status !== 'completed' &&
        b.status !== 'cancelled',
    )
    .sort(
      (a, b) =>
        (a.bookingDate ?? '').localeCompare(b.bookingDate ?? '') ||
        getWindowSortRank(a.preferredWindow) - getWindowSortRank(b.preferredWindow),
    );
}

export function getOngoingBookings(bookings: BookingRecord[]): BookingRecord[] {
  return bookings
    .filter((b) => b.status === 'ongoing' || b.status === 'in_progress')
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'ongoing' ? -1 : 1;
      }
      return (a.bookingDate ?? a.createdAtIso).localeCompare(b.bookingDate ?? b.createdAtIso);
    });
}

export function getBookingsMissingDate(bookings: BookingRecord[]): BookingRecord[] {
  return bookings.filter(
    (b) =>
      !isValidDateKey(b.bookingDate) &&
      b.status !== 'completed' &&
      b.status !== 'cancelled',
  );
}
