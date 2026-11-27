import { useEffect, useState } from 'react';
import type { SiteSettings } from '../data/scooterData';
import { getSeattleScheduleStatus } from '../utils/repairCalculator';
import { DotGlyph } from './DotGlyph';

interface ClockWidgetProps {
  settings: SiteSettings;
}

export function ClockWidget({ settings }: ClockWidgetProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const schedule = getSeattleScheduleStatus(now);
  const phoneHref = `tel:+1${settings.phoneDisplay.replace(/\D/g, '')}`;

  return (
    <div className="bg-[#F4F4F0] text-[#121214] rounded-[20px] p-5 border border-black/10 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
      {/* Left: Dot-matrix Seattle clock inspired by Nothing OS */}
      <div className="flex items-center gap-3.5 sm:border-r sm:border-black/10 sm:pr-5">
        <div
          className="flex items-end gap-1.5 leading-none"
          aria-label={`Seattle time ${schedule.timeString}`}
        >
          <div className="flex flex-col items-end leading-none">
            <span className="font-dot text-4xl font-extrabold tracking-tight text-[#121214] tabular-nums">
              {schedule.hours}
            </span>
            <span className="font-dot text-4xl font-extrabold tracking-tight text-[#121214] tabular-nums">
              {schedule.minutes}
            </span>
          </div>
          <span className="font-mono text-xs font-bold tracking-wider text-[#E8452C] pb-1">
            {schedule.period}
          </span>
        </div>
        <DotGlyph size={44} color="#18181B" accentColor="#E8452C" />
      </div>

      {/* Right: Authentic Seattle operating window & phone */}
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs font-medium text-[#52525B] tracking-wide">
            SEATTLE PT · {schedule.dayLabel}
          </span>
          <span className="font-mono text-xs font-semibold text-[#121214]">
            {schedule.isOpenNow ? 'Open Today' : 'By Appointment'}
          </span>
        </div>

        <p className="text-sm font-semibold text-[#121214]">{settings.hoursShort}</p>

        {/* Segmented operating days indicator (M T W T F S S) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div
            className="flex items-center gap-1.5"
            aria-label="Operating days Monday, Friday, Saturday, Sunday"
          >
            {[
              { d: 'M', active: true },
              { d: 'T', active: false },
              { d: 'W', active: false },
              { d: 'T', active: false },
              { d: 'F', active: true },
              { d: 'S', active: true },
              { d: 'S', active: true },
            ].map((item, idx) => (
              <span
                key={idx}
                className={`w-5 h-5 rounded text-[11px] font-mono font-semibold inline-flex items-center justify-center ${
                  item.active ? 'bg-[#121214] text-[#F4F4F0]' : 'bg-black/8 text-[#71717A]'
                }`}
              >
                {item.d}
              </span>
            ))}
          </div>
          <a
            href={phoneHref}
            className="font-mono text-xs font-semibold text-[#E8452C] hover:underline whitespace-nowrap shrink-0"
          >
            {settings.phoneDisplay}
          </a>
        </div>
      </div>
    </div>
  );
}
