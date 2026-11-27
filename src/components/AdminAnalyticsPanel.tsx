import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { BookingRecord, BookingStatus, ScooterService } from '../data/scooterData';
import {
  buildBookingTrendSeries,
  buildOperatingDayDemand,
  buildServiceDemandSeries,
  buildStatusBreakdown,
  summarizeBookingAnalytics,
  TIME_RANGE_OPTIONS,
  type BookingTrendPoint,
  type OperatingDayDemandPoint,
  type ServiceDemandPoint,
  type StatusBreakdownPoint,
  type TimeRangeKey,
} from '../utils/adminAnalytics';

const STATUS_SWATCH_CLASS: Record<BookingStatus, string> = {
  new: 'bg-[#E8452C]',
  confirmed: 'bg-[#4A82E8]',
  in_progress: 'bg-[#D9A441]',
  completed: 'bg-[#22C55E]',
  cancelled: 'bg-[#71717A]',
};

interface AdminAnalyticsPanelProps {
  bookings: BookingRecord[];
  services: ScooterService[];
  onSwitchToBookings: () => void;
}

type TrendSeriesMode = 'both' | 'bookings' | 'requests';

interface CustomTooltipPayloadItem<T> {
  payload?: T;
}

interface CustomTooltipProps<T> {
  active?: boolean;
  payload?: CustomTooltipPayloadItem<T>[];
}

function TrendTooltip({ active, payload }: CustomTooltipProps<BookingTrendPoint>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-[12px] bg-[#09090B] border border-white/15 px-3.5 py-3 shadow-xl text-xs space-y-1.5 min-w-[180px]">
      <div className="font-mono text-[11px] text-[#A1A1AA] border-b border-white/10 pb-1">
        {point.label} · {point.dateKey}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-[#D4D4D8]">
          <span className="w-2 h-2 rounded-[2px] bg-[#E8452C]" aria-hidden="true" />
          Bookings
        </span>
        <span className="font-mono font-semibold text-white tabular-nums">
          {point.totalBookings}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-[#D4D4D8]">
          <span className="w-2 h-2 rounded-[2px] bg-[#4A82E8]" aria-hidden="true" />
          Service Requests
        </span>
        <span className="font-mono font-semibold text-white tabular-nums">
          {point.serviceRequests}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10 text-[#A1A1AA]">
        <span>Completed</span>
        <span className="font-mono tabular-nums text-[#F4F4F0]">{point.completedBookings}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-[#A1A1AA]">
        <span>Est. Labor</span>
        <span className="font-mono tabular-nums text-[#F4F4F0]">
          {point.estimatedMinutes} min
        </span>
      </div>
    </div>
  );
}

function ServiceTooltip({ active, payload }: CustomTooltipProps<ServiceDemandPoint>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const item = payload[0].payload;
  return (
    <div className="rounded-[12px] bg-[#09090B] border border-white/15 px-3.5 py-2.5 shadow-xl text-xs space-y-1 max-w-[240px]">
      <div className="font-semibold text-[#F4F4F0]">{item.name}</div>
      <div className="font-mono text-[11px] text-[#A1A1AA]">{item.categoryLabel}</div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10">
        <span className="text-[#D4D4D8]">Requests</span>
        <span className="font-mono font-semibold text-white tabular-nums">
          {item.requests} ({item.sharePercent}%)
        </span>
      </div>
    </div>
  );
}

function DayTooltip({ active, payload }: CustomTooltipProps<OperatingDayDemandPoint>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const item = payload[0].payload;
  return (
    <div className="rounded-[12px] bg-[#09090B] border border-white/15 px-3.5 py-2.5 shadow-xl text-xs space-y-1 min-w-[165px]">
      <div className="font-semibold text-[#F4F4F0]">{item.day}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[#D4D4D8]">Bookings</span>
        <span className="font-mono font-semibold text-white tabular-nums">{item.bookings}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[#D4D4D8]">Services</span>
        <span className="font-mono font-semibold text-[#4A82E8] tabular-nums">
          {item.serviceRequests}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[#A1A1AA]">Est. Hours</span>
        <span className="font-mono text-[#F4F4F0] tabular-nums">{item.estimatedHours}h</span>
      </div>
    </div>
  );
}

function StatusTooltip({ active, payload }: CustomTooltipProps<StatusBreakdownPoint>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const item = payload[0].payload;
  return (
    <div className="rounded-[12px] bg-[#09090B] border border-white/15 px-3.5 py-2.5 shadow-xl text-xs space-y-1 min-w-[155px]">
      <div className="font-semibold text-[#F4F4F0]">{item.label}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[#D4D4D8]">Bookings</span>
        <span className="font-mono font-semibold text-white tabular-nums">
          {item.count} ({item.sharePercent}%)
        </span>
      </div>
    </div>
  );
}

export function AdminAnalyticsPanel({
  bookings,
  services,
  onSwitchToBookings,
}: AdminAnalyticsPanelProps) {
  const [range, setRange] = useState<TimeRangeKey>('30d');
  const [trendMode, setTrendMode] = useState<TrendSeriesMode>('both');

  const trendSeries = useMemo(
    () => buildBookingTrendSeries(bookings, range),
    [bookings, range],
  );
  const serviceDemand = useMemo(
    () => buildServiceDemandSeries(bookings, services, range),
    [bookings, services, range],
  );
  const dayDemand = useMemo(
    () => buildOperatingDayDemand(bookings, range),
    [bookings, range],
  );
  const statusBreakdown = useMemo(
    () => buildStatusBreakdown(bookings, range),
    [bookings, range],
  );
  const summary = useMemo(
    () => summarizeBookingAnalytics(bookings, services, range),
    [bookings, services, range],
  );

  const visibleServices = serviceDemand.slice(0, 8);
  const activeRangeOption =
    TIME_RANGE_OPTIONS.find((opt) => opt.id === range) ?? TIME_RANGE_OPTIONS[2];

  if (bookings.length === 0) {
    return (
      <div className="rounded-[20px] bg-[#131316] border border-white/10 p-10 text-center space-y-4">
        <div className="w-11 h-11 rounded-[12px] bg-[#1A1A1F] border border-white/10 flex items-center justify-center mx-auto">
          <BarChart3 className="w-5 h-5 text-[#E8452C]" aria-hidden="true" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h2 className="text-base font-semibold text-[#F4F4F0]">
            No Booking Analytics Yet
          </h2>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            Booking trends, requested service rankings, operating day demand, and status
            breakdowns populate automatically from live Firestore bookings.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={onSwitchToBookings}
            className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#F4F4F0] hover:bg-white text-[#121214] text-xs font-semibold cursor-pointer"
          >
            Back to Bookings Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Range Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#F4F4F0]">
            Booking Trends & Service Demand
          </h2>
          <p className="text-xs text-[#A1A1AA] font-mono tabular-nums mt-0.5">
            {activeRangeOption.label.toUpperCase()} · {summary.totalBookings} BOOKING
            {summary.totalBookings === 1 ? '' : 'S'} · {summary.totalServiceRequests} SERVICE
            REQUEST{summary.totalServiceRequests === 1 ? '' : 'S'}
          </p>
        </div>

        <div
          role="group"
          aria-label="Analytics time range"
          className="flex items-center gap-1 p-1 rounded-[12px] bg-[#141418] border border-white/10 self-start sm:self-auto"
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={range === opt.id}
              onClick={() => setRange(opt.id)}
              className={`min-h-[34px] px-3 py-1 rounded-[8px] text-xs font-mono font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                range === opt.id
                  ? 'bg-[#E8452C] text-white'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
              }`}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Period KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[18px] bg-[#131316] border border-white/10 p-5">
          <div className="font-mono text-[11px] text-[#A1A1AA]">SERVICES REQUESTED</div>
          <div className="font-dot text-3xl font-extrabold text-[#4A82E8] tabular-nums mt-1">
            {summary.totalServiceRequests}
          </div>
          <div className="font-mono text-[11px] text-[#A1A1AA] tabular-nums mt-1">
            {summary.avgServicesPerBooking} avg / booking
          </div>
        </div>

        <div className="rounded-[18px] bg-[#131316] border border-white/10 p-5">
          <div className="font-mono text-[11px] text-[#A1A1AA]">COMPLETION RATE</div>
          <div className="font-dot text-3xl font-extrabold text-[#F4F4F0] tabular-nums mt-1">
            {summary.completionRate}%
          </div>
          <div className="font-mono text-[11px] text-[#A1A1AA] tabular-nums mt-1">
            {summary.completedBookings} completed · {summary.activeBookings} active
          </div>
        </div>

        <div className="rounded-[18px] bg-[#131316] border border-white/10 p-5">
          <div className="font-mono text-[11px] text-[#A1A1AA]">EST. LABOR WORKLOAD</div>
          <div className="font-dot text-3xl font-extrabold text-[#F4F4F0] tabular-nums mt-1">
            {summary.totalEstimatedHours}h
          </div>
          <div className="font-mono text-[11px] text-[#A1A1AA] mt-1 truncate">
            Peak day: {summary.busiestDay}
          </div>
        </div>

        <div className="rounded-[18px] bg-[#131316] border border-white/10 p-5">
          <div className="font-mono text-[11px] text-[#A1A1AA]">TOP REQUESTED SERVICE</div>
          <div className="text-lg font-semibold text-[#F4F4F0] leading-snug mt-1.5 truncate">
            {summary.topServiceName}
          </div>
          <div className="font-mono text-[11px] text-[#E8452C] tabular-nums mt-1.5">
            {serviceDemand[0]
              ? `${serviceDemand[0].requests} request${serviceDemand[0].requests === 1 ? '' : 's'} (${serviceDemand[0].sharePercent}%)`
              : 'No services in window'}
          </div>
        </div>
      </div>

      {/* Primary Time-Series Chart */}
      <section
        aria-label="Booking trends and service requests over time"
        className="rounded-[20px] bg-[#131316] border border-white/10 p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#F4F4F0]">
              Bookings & Service Requests Over Time
            </h3>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#A1A1AA]">
              {(trendMode === 'both' || trendMode === 'bookings') && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#E8452C]" aria-hidden="true" />
                  Bookings Submitted
                </span>
              )}
              {(trendMode === 'both' || trendMode === 'requests') && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#4A82E8]" aria-hidden="true" />
                  Service Items Requested
                </span>
              )}
            </div>
          </div>

          <div
            role="group"
            aria-label="Chart series visibility"
            className="flex items-center gap-1 p-1 rounded-[10px] bg-[#0B0B0E] border border-white/10 self-start md:self-auto"
          >
            {(
              [
                { id: 'both', label: 'Both' },
                { id: 'bookings', label: 'Bookings' },
                { id: 'requests', label: 'Services' },
              ] as { id: TrendSeriesMode; label: string }[]
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={trendMode === mode.id}
                onClick={() => setTrendMode(mode.id)}
                className={`min-h-[30px] px-2.5 py-1 rounded-[7px] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  trendMode === mode.id
                    ? 'bg-[#F4F4F0] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-[290px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendSeries}
              margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rcsBookingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E8452C" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#E8452C" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="rcsRequestsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4A82E8" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#4A82E8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: '#A1A1AA', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                tickLine={false}
                minTickGap={22}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#A1A1AA', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TrendTooltip />} />
              {(trendMode === 'both' || trendMode === 'requests') && (
                <Area
                  type="monotone"
                  dataKey="serviceRequests"
                  name="Service Requests"
                  stroke="#4A82E8"
                  strokeWidth={2}
                  fill="url(#rcsRequestsFill)"
                  activeDot={{ r: 5, fill: '#4A82E8', stroke: '#09090B', strokeWidth: 2 }}
                />
              )}
              {(trendMode === 'both' || trendMode === 'bookings') && (
                <Area
                  type="monotone"
                  dataKey="totalBookings"
                  name="Bookings"
                  stroke="#E8452C"
                  strokeWidth={2.25}
                  fill="url(#rcsBookingsFill)"
                  activeDot={{ r: 5, fill: '#E8452C', stroke: '#09090B', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Secondary Row: Service Breakdown + Operating Day & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Service Request Breakdown */}
        <section
          aria-label="Top requested services"
          className="lg:col-span-7 rounded-[20px] bg-[#131316] border border-white/10 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h3 className="text-base font-semibold text-[#F4F4F0]">
                Requested Services Breakdown
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Volume of individual packages and labor categories booked in this period.
              </p>
            </div>
            <span className="font-mono text-xs text-[#A1A1AA] tabular-nums shrink-0">
              {serviceDemand.length} TYPES
            </span>
          </div>

          {visibleServices.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#A1A1AA]">
              No service requests recorded in {activeRangeOption.label.toLowerCase()}.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={visibleServices}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.07)"
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{
                        fill: '#A1A1AA',
                        fontSize: 11,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={138}
                      tick={{ fill: '#E4E4E7', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ServiceTooltip />}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="requests" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {visibleServices.map((entry, idx) => (
                        <Cell
                          key={entry.id}
                          fill={idx === 0 ? '#E8452C' : idx === 1 ? '#4A82E8' : '#71717A'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Compact Tabular Readout */}
              <div className="border-t border-white/10 pt-3 divide-y divide-white/8">
                {visibleServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-[#D4D4D8] truncate">{svc.name}</span>
                    <span className="font-mono text-[#A1A1AA] tabular-nums shrink-0">
                      <strong className="text-[#F4F4F0]">{svc.requests}</strong> ({svc.sharePercent}
                      %)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Operating Day Demand + Status Pipeline */}
        <div className="lg:col-span-5 space-y-6">
          <section
            aria-label="Operating day demand"
            className="rounded-[20px] bg-[#131316] border border-white/10 p-5 sm:p-6 space-y-4"
          >
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-[#F4F4F0]">Operating Day Demand</h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Bookings and requested services across Mon, Fri, Sat, and Sun slots.
              </p>
            </div>

            <div className="w-full h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dayDemand}
                  margin={{ top: 6, right: 8, left: -22, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.07)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortDay"
                    tick={{
                      fill: '#D4D4D8',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fill: '#A1A1AA',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<DayTooltip />}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar
                    dataKey="bookings"
                    name="Bookings"
                    fill="#E8452C"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="serviceRequests"
                    name="Services"
                    fill="#4A82E8"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono text-[#A1A1AA]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#E8452C]" aria-hidden="true" />
                Bookings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#4A82E8]" aria-hidden="true" />
                Service Items
              </span>
            </div>
          </section>

          <section
            aria-label="Booking status pipeline"
            className="rounded-[20px] bg-[#131316] border border-white/10 p-5 sm:p-6 space-y-4"
          >
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-[#F4F4F0]">Status Pipeline</h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Current workflow stage for bookings in {activeRangeOption.label.toLowerCase()}.
              </p>
            </div>

            <div className="w-full h-[175px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusBreakdown}
                  layout="vertical"
                  margin={{ top: 2, right: 12, left: 0, bottom: 2 }}
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.07)"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{
                      fill: '#A1A1AA',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={86}
                    tick={{ fill: '#E4E4E7', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<StatusTooltip />}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={18}>
                    {statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-white/10">
              {statusBreakdown.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between gap-2 text-xs py-1"
                >
                  <span className="inline-flex items-center gap-1.5 text-[#D4D4D8] truncate">
                    <span
                      className={`w-2 h-2 rounded-[2px] shrink-0 ${STATUS_SWATCH_CLASS[item.status]}`}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                  <span className="font-mono text-[#F4F4F0] tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
