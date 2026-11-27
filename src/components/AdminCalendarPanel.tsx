import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { BookingRecord, BookingStatus } from '../data/scooterData';
import {
  buildMonthCalendarGrid,
  formatBookingDate,
  formatBookingDateShort,
  getBookingsMissingDate,
  getMonthTitle,
  getOngoingBookings,
  getTodayPacificDateKey,
  getUpcomingDatedBookings,
  isValidDateKey,
} from '../utils/bookingDates';

interface AdminCalendarPanelProps {
  bookings: BookingRecord[];
  updatingStatusId: string | null;
  onQuickStatusChange: (booking: BookingRecord, nextStatus: BookingStatus) => Promise<void>;
  onEditBooking: (booking: BookingRecord) => void;
  onOpenConfirm: (booking: BookingRecord) => void;
  onOpenMessages: (booking: BookingRecord) => void;
  onDeleteBooking: (bookingId: string) => Promise<void>;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_DOT_COLOR: Record<BookingStatus, string> = {
  new: 'bg-[#E8452C]',
  confirmed: 'bg-emerald-400',
  in_progress: 'bg-[#4A82E8]',
  ongoing: 'bg-amber-400',
  completed: 'bg-[#71717A]',
  cancelled: 'bg-[#52525B]',
};

const STATUS_CHIP_CLASS: Record<BookingStatus, string> = {
  new: 'bg-[#E8452C]/20 text-[#FCA5A5] border-[#E8452C]/40',
  confirmed: 'bg-emerald-500/18 text-emerald-300 border-emerald-500/35',
  in_progress: 'bg-[#4A82E8]/20 text-[#93C5FD] border-[#4A82E8]/40',
  ongoing: 'bg-amber-500/20 text-amber-200 border-amber-400/45',
  completed: 'bg-white/8 text-[#A1A1AA] border-white/10',
  cancelled: 'bg-white/5 text-[#71717A] border-white/10 line-through',
};

const STATUS_LABEL_MAP: Record<BookingStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function shortWindowLabel(win: string): string {
  if (win.startsWith('10:')) return '10a';
  if (win.startsWith('12:')) return '12p';
  if (win.startsWith('2:')) return '2:30p';
  return win.slice(0, 5);
}

export function AdminCalendarPanel({
  bookings,
  updatingStatusId,
  onQuickStatusChange,
  onEditBooking,
  onOpenConfirm,
  onOpenMessages,
  onDeleteBooking,
}: AdminCalendarPanelProps) {
  const todayKey = useMemo(() => getTodayPacificDateKey(), []);
  const [todayYear, todayMonth] = useMemo(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return [y, m - 1];
  }, [todayKey]);

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | BookingStatus>('active');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visibleBookings = useMemo(() => {
    if (statusFilter === 'all') return bookings;
    if (statusFilter === 'active') {
      return bookings.filter((b) => b.status !== 'cancelled');
    }
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const cells = useMemo(
    () => buildMonthCalendarGrid(viewYear, viewMonth, todayKey, visibleBookings),
    [viewYear, viewMonth, todayKey, visibleBookings],
  );

  const selectedDayBookings = useMemo(() => {
    const match = cells.find((c) => c.dateKey === selectedDateKey);
    if (match) return match.bookings;
    return visibleBookings.filter((b) => b.bookingDate === selectedDateKey);
  }, [cells, selectedDateKey, visibleBookings]);

  const ongoingBookings = useMemo(() => getOngoingBookings(bookings), [bookings]);
  const upcomingBookings = useMemo(
    () => getUpcomingDatedBookings(bookings, todayKey),
    [bookings, todayKey],
  );
  const missingDateBookings = useMemo(() => getBookingsMissingDate(bookings), [bookings]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const jumpToDateKey = (dateKey: string) => {
    if (!isValidDateKey(dateKey)) return;
    const [y, m] = dateKey.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedDateKey(dateKey);
  };

  const monthBookingCount = useMemo(
    () =>
      cells
        .filter((c) => c.inCurrentMonth)
        .reduce((sum, cell) => sum + cell.bookings.length, 0),
    [cells],
  );

  return (
    <div className="space-y-6">
      {/* Calendar Header & Controls */}
      <div className="rounded-[20px] bg-[#131316] border border-white/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-[10px] border border-white/15 text-[#F4F4F0] hover:bg-white/10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => jumpToDateKey(todayKey)}
              className="min-h-[38px] px-3 rounded-[10px] border border-white/15 text-xs font-semibold text-[#F4F4F0] hover:bg-white/10 cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-[10px] border border-white/15 text-[#F4F4F0] hover:bg-white/10 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#F4F4F0]">
              {getMonthTitle(viewYear, viewMonth)}
            </h2>
            <p className="font-mono text-[11px] text-[#A1A1AA]">
              {monthBookingCount} SCHEDULED THIS MONTH · {ongoingBookings.length} ONGOING / IN
              PROGRESS · {upcomingBookings.length} UPCOMING
            </p>
          </div>
        </div>

        {/* Status Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'active', label: 'Active' },
              { id: 'all', label: 'All' },
              { id: 'new', label: 'New' },
              { id: 'confirmed', label: 'Confirmed' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'ongoing', label: 'Ongoing' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`min-h-[34px] px-2.5 py-1 rounded-[8px] text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === opt.id
                  ? 'bg-[#E8452C] text-white'
                  : 'bg-[#191920] text-[#A1A1AA] border border-white/10 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Month Grid + Selected Day & Upcoming/Ongoing Rail */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-6 items-start">
        {/* Left: Month Calendar Grid */}
        <div className="rounded-[22px] bg-[#131316] border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[11px] text-[#A1A1AA] pb-1">
            {WEEKDAY_HEADERS.map((day) => {
              const isOpen = day === 'Mon' || day === 'Fri' || day === 'Sat' || day === 'Sun';
              return (
                <div key={day} className="py-1">
                  <span className={isOpen ? 'text-[#F4F4F0] font-semibold' : 'text-[#71717A]'}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell) => {
              const isSelected = cell.dateKey === selectedDateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  aria-label={`${formatBookingDate(cell.dateKey)}, ${cell.bookings.length} booking${cell.bookings.length === 1 ? '' : 's'}`}
                  aria-pressed={isSelected}
                  className={`min-h-[96px] sm:min-h-[112px] p-2 rounded-[12px] border text-left flex flex-col gap-1.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1D1D25] border-[#E8452C] ring-1 ring-[#E8452C]'
                      : cell.inCurrentMonth
                        ? cell.isOperatingDay
                          ? 'bg-[#17171C] border-white/12 hover:border-white/30'
                          : 'bg-[#111114] border-white/6 hover:border-white/20'
                        : 'bg-[#0C0C0E] border-white/5 opacity-55 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`font-mono text-xs tabular-nums inline-flex items-center justify-center rounded-md ${
                        cell.isToday
                          ? 'bg-[#E8452C] text-white font-bold px-1.5 py-0.5'
                          : cell.inCurrentMonth
                            ? 'text-[#F4F4F0] font-semibold'
                            : 'text-[#71717A]'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {cell.bookings.length > 0 && (
                      <span className="font-mono text-[10px] text-[#A1A1AA] tabular-nums">
                        {cell.bookings.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 w-full overflow-hidden">
                    {cell.bookings.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        className={`px-1.5 py-0.5 rounded-[6px] border text-[10px] leading-tight truncate flex items-center gap-1 ${STATUS_CHIP_CLASS[b.status]}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_COLOR[b.status]}`}
                          aria-hidden="true"
                        />
                        <span className="font-mono opacity-80 shrink-0">
                          {shortWindowLabel(b.preferredWindow)}
                        </span>
                        <span className="truncate font-medium">{b.riderName}</span>
                      </div>
                    ))}
                    {cell.bookings.length > 3 && (
                      <div className="font-mono text-[10px] text-[#A1A1AA] px-1">
                        +{cell.bookings.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-white/10 font-mono text-[11px] text-[#A1A1AA]">
            {STATUS_OPTIONS.filter((s) => s.value !== 'cancelled').map((s) => (
              <span key={s.value} className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_DOT_COLOR[s.value]}`}
                  aria-hidden="true"
                />
                {s.label}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-[#71717A]">
              Highlighted columns: Mon, Fri, Sat, Sun operating days
            </span>
          </div>
        </div>

        {/* Right Column: Selected Day Agenda + Ongoing Spotlight + Upcoming Queue */}
        <div className="space-y-5">
          {/* Selected Day Schedule */}
          <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-5 sm:p-6 border border-black/10 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-3">
              <div>
                <div className="font-mono text-[11px] text-[#52525B] flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
                  SELECTED DAY SCHEDULE
                </div>
                <h3 className="text-lg font-semibold mt-0.5">
                  {formatBookingDate(selectedDateKey)}
                </h3>
              </div>
              <span className="font-mono text-xs text-[#52525B] tabular-nums">
                {selectedDayBookings.length}{' '}
                {selectedDayBookings.length === 1 ? 'BOOKING' : 'BOOKINGS'}
              </span>
            </div>

            {selectedDayBookings.length === 0 ? (
              <p className="text-xs text-[#52525B] py-4">
                No appointments scheduled on {formatBookingDate(selectedDateKey)}. Click any
                highlighted calendar date or an upcoming booking below to inspect its details.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDayBookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-[14px] bg-white border border-black/10 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-[#52525B] flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-[#121214]">{b.referenceId}</span>
                          <span>{b.preferredWindow}</span>
                          <span>{b.estimatedLaborLabel}</span>
                        </div>
                        <div className="text-sm font-semibold text-[#121214] mt-0.5">
                          {b.riderName} · {b.scooterModel}
                        </div>
                        <p className="text-xs text-[#52525B] mt-0.5">{b.address}</p>
                        <p className="text-xs text-[#27272A] mt-1">
                          {b.serviceTitles.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/8">
                      <label className="sr-only" htmlFor={`cal-status-${b.id}`}>
                        Status for {b.referenceId}
                      </label>
                      <select
                        id={`cal-status-${b.id}`}
                        disabled={updatingStatusId === b.id}
                        value={b.status}
                        onChange={(e) =>
                          onQuickStatusChange(b, e.target.value as BookingStatus)
                        }
                        className="min-h-[34px] px-2.5 py-1 rounded-[8px] bg-[#F4F4F0] border border-black/15 text-xs font-semibold text-[#121214] cursor-pointer"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => onOpenConfirm(b)}
                        className="min-h-[34px] px-2.5 py-1 rounded-[8px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" aria-hidden="true" />
                        Confirm
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenMessages(b)}
                        className="min-h-[34px] px-2.5 py-1 rounded-[8px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#121214] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" aria-hidden="true" />
                        Updates
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditBooking(b)}
                        className="min-h-[34px] px-2.5 py-1 rounded-[8px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#121214] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        Edit
                      </button>

                      {confirmDeleteId === b.id ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteBooking(b.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[32px] px-2.5 rounded-[8px] bg-[#E8452C] text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[32px] px-2 rounded-[8px] border border-black/15 text-[11px] text-[#52525B] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete booking ${b.referenceId}`}
                          onClick={() => setConfirmDeleteId(b.id)}
                          className="min-h-[34px] min-w-[34px] ml-auto inline-flex items-center justify-center rounded-[8px] border border-black/15 text-[#52525B] hover:text-[#E8452C] hover:border-[#E8452C] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ongoing & In-Progress Repairs Spotlight */}
          <div className="rounded-[20px] bg-[#131316] border border-amber-400/25 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                ONGOING &amp; ACTIVE REPAIRS ({ongoingBookings.length})
              </div>
            </div>

            {ongoingBookings.length === 0 ? (
              <p className="text-xs text-[#A1A1AA]">
                No repairs currently marked Ongoing or In Progress. Set any multi-day or
                parts-ordered job to <strong>Ongoing</strong> to keep it pinned here.
              </p>
            ) : (
              <div className="space-y-2">
                {ongoingBookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-[12px] bg-[#1A1A21] border border-white/10 p-3 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (b.bookingDate) {
                          jumpToDateKey(b.bookingDate);
                        } else {
                          onEditBooking(b);
                        }
                      }}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span
                          className={
                            b.status === 'ongoing'
                              ? 'text-amber-300 font-semibold'
                              : 'text-[#60A5FA] font-semibold'
                          }
                        >
                          {STATUS_LABEL_MAP[b.status].toUpperCase()}
                        </span>
                        <span className="text-[#A1A1AA]">
                          {formatBookingDateShort(b.bookingDate, b.preferredDay)}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#F4F4F0] truncate mt-0.5">
                        {b.riderName} · {b.scooterModel}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditBooking(b)}
                      className="min-h-[32px] px-2.5 rounded-[8px] border border-white/15 hover:bg-white/10 text-[11px] font-semibold text-[#F4F4F0] shrink-0 cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Scheduled Queue */}
          <div className="rounded-[20px] bg-[#131316] border border-white/10 p-5 space-y-3">
            <div className="font-mono text-xs text-[#A1A1AA] font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
              UPCOMING DATED BOOKINGS ({upcomingBookings.length})
            </div>

            {upcomingBookings.length === 0 ? (
              <p className="text-xs text-[#A1A1AA]">
                No upcoming dated appointments from today onward.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {upcomingBookings.slice(0, 10).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => b.bookingDate && jumpToDateKey(b.bookingDate)}
                    className="w-full text-left rounded-[12px] bg-[#191920] hover:bg-[#202029] border border-white/8 p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_COLOR[b.status]}`}
                          aria-hidden="true"
                        />
                        <span className="text-[#F4F4F0] font-semibold">
                          {formatBookingDateShort(b.bookingDate, b.preferredDay)}
                        </span>
                        <span className="text-[#A1A1AA]">{b.preferredWindow}</span>
                      </div>
                      <div className="text-xs font-medium text-[#E4E4E7] truncate mt-0.5">
                        {b.riderName} · {b.scooterModel}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-[#A1A1AA] shrink-0">
                      {STATUS_LABEL_MAP[b.status].toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legacy / Unscheduled Bookings Missing Exact Date */}
          {missingDateBookings.length > 0 && (
            <div className="rounded-[20px] bg-[#131316] border border-white/10 p-5 space-y-3">
              <div className="font-mono text-xs text-[#E8452C] font-semibold">
                NEEDS EXACT DATE ({missingDateBookings.length})
              </div>
              <p className="text-xs text-[#A1A1AA]">
                These older or imported bookings only have a weekday. Click Assign Date to place
                them on the calendar.
              </p>
              <div className="space-y-2">
                {missingDateBookings.slice(0, 6).map((b) => (
                  <div
                    key={b.id}
                    className="rounded-[10px] bg-[#191920] border border-white/8 px-3 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#F4F4F0] truncate">
                        {b.riderName} · {b.scooterModel}
                      </div>
                      <div className="font-mono text-[11px] text-[#A1A1AA]">
                        {b.preferredDay} · {b.preferredWindow}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditBooking(b)}
                      className="min-h-[32px] px-2.5 rounded-[8px] bg-[#F4F4F0] text-[#121214] text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Assign Date
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
