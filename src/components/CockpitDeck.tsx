import { useMemo, useState } from 'react';
import { Check, Plus, RotateCw } from 'lucide-react';
import type { ScooterService, SiteSettings } from '../data/scooterData';
import { formatDuration, formatServicePrice } from '../utils/repairCalculator';

interface CockpitDeckProps {
  services: ScooterService[];
  settings: SiteSettings;
  selectedServiceIds: string[];
  onToggleService: (serviceId: string) => void;
  onJumpToBooking: () => void;
}

const DIAL_ROTATION_CLASSES = ['rotate-0', 'rotate-90', 'rotate-180', '-rotate-90'] as const;

export function CockpitDeck({
  services,
  settings,
  selectedServiceIds,
  onToggleService,
  onJumpToBooking,
}: CockpitDeckProps) {
  const deckServices = useMemo(
    () => services.filter((service) => service.active !== false).slice(0, 4),
    [services],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = deckServices.length > 0 ? activeIdx % deckServices.length : 0;
  const active = deckServices[safeIdx];

  if (!active) {
    return null;
  }

  const isSelected = selectedServiceIds.includes(active.id);
  const dialRotationClass = DIAL_ROTATION_CLASSES[safeIdx % DIAL_ROTATION_CLASSES.length];

  const handleCycleKnob = () => {
    setActiveIdx((prev) => (prev + 1) % deckServices.length);
  };

  return (
    <div
      id="diagnostics"
      className="hw-chassis rounded-[24px] p-5 sm:p-6 text-[#121214] border border-white/60 flex flex-col justify-between gap-5"
    >
      {/* Top Hardware Deck Row: Speaker grille + Recessed OLED Screen + Tactile Knobs */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[44px_1fr_68px] gap-4 items-stretch">
        <div className="hidden sm:flex flex-col items-center justify-between py-1">
          <div className="w-8 h-8 rounded-full bg-[#ECECE7] border border-black/15 shadow-inner flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-[#F7F7F4] border border-black/15 shadow-sm" />
          </div>
          <div className="hw-grille w-9 flex-1 my-3 rounded-md opacity-70" aria-hidden="true" />
        </div>

        {/* Center Recessed Obsidian OLED Service Inspector */}
        <div
          className="oled-well rounded-[14px] p-4 sm:p-5 text-[#F4F4F0] flex flex-col justify-between gap-4 border border-black"
          data-testid="cockpit-oled-screen"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
            <span className="font-mono text-[11px] tracking-wider text-[#A1A1AA]">
              {active.index} · {active.categoryLabel.toUpperCase()}
            </span>
            <span className="font-dot text-sm font-bold tracking-wider text-[#F4F4F0] tabular-nums">
              {formatDuration(active.durationMinutes).toUpperCase()} ·{' '}
              {formatServicePrice(active).toUpperCase()}
            </span>
          </div>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5 text-left">
              <h2 className="text-base sm:text-lg font-semibold text-white leading-snug">
                {active.title}
              </h2>
              <p className="text-xs sm:text-[13px] leading-relaxed text-[#B4B4BC]">
                {active.summary}
              </p>
            </div>

            {active.includes.length > 0 && (
              <ul className="space-y-1.5 pt-1 text-xs text-[#D4D4D8]">
                {active.includes.slice(0, 3).map((item) => (
                  <li key={item} className="flex items-start gap-2 leading-snug">
                    <Check
                      className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#E8452C]"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 pt-2.5 border-t border-white/10">
            <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
              <div className="space-y-0.5">
                <span className="text-[#A1A1AA] block">TRAVEL FEE</span>
                <span className="text-[#F4F4F0] font-semibold tabular-nums">$0</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#A1A1AA] block">WARRANTY</span>
                <span className="text-[#F4F4F0] font-semibold tabular-nums">
                  {settings.warrantyDays} DAYS
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[#A1A1AA] block">SERVICE MODE</span>
                <span className="text-[#F4F4F0] font-semibold">
                  {active.mode === 'pickup' ? 'PICKUP BENCH' : 'MOBILE ON-SITE'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 pt-0.5" aria-hidden="true">
              <span className="h-[3px] flex-[3] rounded-full bg-[#E8452C]" />
              <span className="h-[3px] flex-[2] rounded-full bg-[#4A82E8]" />
              <span className="h-[3px] flex-[3] rounded-full bg-[#E8452C]" />
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-center justify-between py-1 gap-3">
          <button
            type="button"
            onClick={handleCycleKnob}
            aria-label="Cycle featured service"
            title="Cycle service"
            className="group flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-[#DCDCD6] border border-black/15 shadow-inner flex items-center justify-center">
              <span
                className={`w-8 h-8 rounded-full bg-[#1F2937] border-2 border-[#F4F4F0] shadow-md flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${dialRotationClass}`}
              >
                <span className="w-1 h-2.5 rounded-full bg-white -translate-y-1.5" />
              </span>
            </span>
            <span className="font-mono text-[10px] text-[#52525B] flex items-center gap-1">
              <RotateCw className="w-2.5 h-2.5" aria-hidden="true" />
              DIAL
            </span>
          </button>

          <button
            type="button"
            onClick={onJumpToBooking}
            aria-label="Open booking page"
            className="group flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-[#DCDCD6] border border-black/15 shadow-inner flex items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-[#C79B5E] border-2 border-[#F4F4F0] shadow-md flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                <span className="w-2 h-2 rounded-full bg-[#121214]" />
              </span>
            </span>
            <span className="font-mono text-[10px] text-[#52525B]">BOOK</span>
          </button>
        </div>
      </div>

      {/* Bottom Hardware Tactile Key Matrix (Keys 1-4 + Action Key) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-[#52525B] px-0.5">
          <span className="font-medium">Inspect Live Service Package</span>
          <span className="font-mono text-[11px] tabular-nums">
            KEY 0{safeIdx + 1} / 0{deckServices.length}
          </span>
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          role="tablist"
          aria-label="Live service packages"
        >
          {deckServices.map((svc, idx) => {
            const isActive = idx === safeIdx;
            const inManifest = selectedServiceIds.includes(svc.id);
            return (
              <button
                key={svc.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveIdx(idx)}
                className={`hw-key min-h-[68px] rounded-[14px] p-3 flex flex-col items-start justify-between text-left cursor-pointer ${
                  isActive ? 'hw-key-active' : ''
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-semibold ${
                      isActive ? 'bg-[#121214] text-[#F4F4F0]' : 'bg-black/6 text-[#27272A]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  {inManifest && (
                    <span
                      className="text-[11px] font-mono font-semibold text-[#E8452C]"
                      aria-label={`${svc.shortLabel} selected`}
                    >
                      ADDED
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-[#121214] truncate w-full">
                  {svc.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => onToggleService(active.id)}
            className={`min-h-[44px] flex-1 px-4 py-2.5 rounded-[12px] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              isSelected
                ? 'bg-[#121214] text-[#F4F4F0] hover:bg-[#27272A]'
                : 'bg-[#E8452C] text-white hover:bg-[#D53A22]'
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                In Repair Request ({active.shortLabel})
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add {active.shortLabel} to Request
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onJumpToBooking}
            className="hw-key min-h-[44px] px-4 py-2.5 rounded-[12px] text-sm font-semibold text-[#121214] whitespace-nowrap cursor-pointer"
          >
            Open Booking
          </button>
        </div>
      </div>
    </div>
  );
}
