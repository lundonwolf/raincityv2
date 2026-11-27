import { useState } from 'react';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type {
  ScooterService,
  ServiceCategory,
  SiteSettings,
} from '../data/scooterData';
import {
  filterServicesByCategory,
  formatCurrency,
  formatDuration,
  formatServicePrice,
  type RepairEstimate,
} from '../utils/repairCalculator';
import { SafeImage } from './SafeImage';

interface ServiceMatrixProps {
  services: ScooterService[];
  settings: SiteSettings;
  selectedServiceIds: string[];
  estimate: RepairEstimate;
  onToggleService: (serviceId: string) => void;
  onProceedToBook: () => void;
}

const CATEGORY_TABS: { id: ServiceCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'packages', label: 'Packages' },
  { id: 'standup', label: 'Stand-Up' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'mobility', label: 'Mobility' },
];

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function ServiceMatrix({
  services,
  settings,
  selectedServiceIds,
  estimate,
  onToggleService,
  onProceedToBook,
}: ServiceMatrixProps) {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('all');
  const shouldReduceMotion = useReducedMotion();
  const visibleServices = filterServicesByCategory(services, activeCategory);
  const basicInspectionPrice =
    services.find((s) => s.id === 'basic-inspection')?.price ?? 30;
  const electricalDiagnosisPrice =
    services.find((s) => s.id === 'electrical-diagnosis')?.price ?? 45;

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="py-12 sm:py-16"
    >
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 space-y-10">
        {/* Header + Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs tracking-wider text-[#A1A1AA]">
              {settings.pricingEyebrow}
            </p>
            <h1
              id="services-heading"
              className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#F4F4F0] [text-wrap:balance]"
            >
              {settings.pricingHeadline}
            </h1>
            <p className="text-base text-[#A1A1AA] leading-relaxed">
              {settings.pricingIntro}
            </p>
          </div>

          {/* Interactive segmented filter tabs — guaranteed single row */}
          <div
            role="tablist"
            aria-label="Filter repair services by category"
            className="flex items-center gap-1 p-1.5 rounded-[14px] bg-[#141418] border border-white/10 self-start overflow-x-auto max-w-full"
          >
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`relative min-h-[38px] px-3.5 sm:px-4 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#121214]'
                      : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="service-category-active-bg"
                      aria-hidden="true"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.01 }
                          : { type: 'spring', stiffness: 460, damping: 34 }
                      }
                      className="absolute inset-0 rounded-[10px] bg-[#F4F4F0]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Up-front Pricing Spec Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-[18px] bg-[#F4F4F0] text-[#121214] p-4 sm:p-5 border border-black/10">
            <div className="font-mono text-[11px] text-[#52525B]">BASIC INSPECTION</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              ${basicInspectionPrice}
            </div>
            <p className="text-xs text-[#3F3F46] mt-1">Safety check & repair scope</p>
          </div>
          <div className="rounded-[18px] bg-[#131316] text-[#F4F4F0] p-4 sm:p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">ELECTRICAL DIAGNOSIS</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              ${electricalDiagnosisPrice}
            </div>
            <p className="text-xs text-[#A1A1AA] mt-1">Up to 40 min · credited to repair</p>
          </div>
          <div className="rounded-[18px] bg-[#131316] text-[#F4F4F0] p-4 sm:p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">GENERAL LABOR RATE</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              ${settings.hourlyRate}/hr
            </div>
            <p className="text-xs text-[#A1A1AA] mt-1">Stand-up & mobility labor</p>
          </div>
          <div className="rounded-[18px] bg-[#131316] text-[#F4F4F0] p-4 sm:p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">DISPATCH & TRAVEL</div>
            <div className="font-dot text-3xl font-extrabold text-[#E8452C] tabular-nums mt-1">
              $0
            </div>
            <p className="text-xs text-[#A1A1AA] mt-1">No travel or dispatch fees</p>
          </div>
        </div>

        {/* Service Packages & Selectable Labor Cards */}
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {visibleServices.map((service, index) => {
              const isSelected = selectedServiceIds.includes(service.id);
              const isLightTile = service.featuredTone === 'light';
              const spanHeroWide = activeCategory === 'all' && index === 0;
              const remainderCount = visibleServices.length % 3;
              const spanLastWide =
                activeCategory === 'all' &&
                index === visibleServices.length - 1 &&
                remainderCount === 2;

              return (
                <motion.article
                  key={service.id}
                  layout={shouldReduceMotion ? false : 'position'}
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 18, scale: 0.985 }
                  }
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0, scale: 1 }
                  }
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0, transition: { duration: 0.1 } }
                      : {
                          opacity: 0,
                          y: -8,
                          scale: 0.975,
                          transition: { duration: 0.16, ease: EASE_OUT_EXPO },
                        }
                  }
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : { y: -2, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.12 }
                      : {
                          duration: 0.34,
                          delay: Math.min(index * 0.045, 0.27),
                          ease: EASE_OUT_EXPO,
                          layout: { duration: 0.26, ease: EASE_OUT_EXPO },
                        }
                  }
                  className={`rounded-[22px] p-6 flex flex-col justify-between gap-6 transition-colors border ${
                    spanHeroWide ? 'md:col-span-2 lg:col-span-2' : ''
                  } ${spanLastWide ? 'md:col-span-2 lg:col-span-2' : ''} ${
                    isLightTile
                      ? isSelected
                        ? 'bg-[#F4F4F0] text-[#121214] border-[#E8452C] ring-1 ring-[#E8452C]'
                        : 'bg-[#F4F4F0] text-[#121214] border-black/10'
                      : isSelected
                        ? 'bg-[#141418] text-[#F4F4F0] border-[#E8452C] ring-1 ring-[#E8452C]'
                        : 'bg-[#131316] text-[#F4F4F0] border-white/10'
                  }`}
                >
                  <div
                    className={
                      spanHeroWide
                        ? 'grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 items-stretch'
                        : 'space-y-5'
                    }
                  >
                    <div className="space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div
                          className={`flex items-center justify-between gap-3 text-xs font-mono ${
                            isLightTile ? 'text-[#52525B]' : 'text-[#A1A1AA]'
                          }`}
                        >
                          <span>
                            {service.index} · {service.categoryLabel}
                          </span>
                          <span>
                            {service.mode === 'mobile' ? 'On-Site Mobile' : 'Mobile / Pickup'}
                          </span>
                        </div>

                        <h2 className="text-xl font-semibold tracking-tight leading-snug">
                          {service.title}
                        </h2>

                        <p
                          className={`text-sm leading-relaxed ${
                            isLightTile ? 'text-[#3F3F46]' : 'text-[#B4B4BC]'
                          }`}
                        >
                          {service.summary}
                        </p>
                      </div>

                      <ul
                        className={`space-y-2 text-xs leading-relaxed pt-2 border-t ${
                          isLightTile
                            ? 'border-black/10 text-[#27272A]'
                            : 'border-white/10 text-[#D4D4D8]'
                        }`}
                      >
                        {service.includes.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <span
                              className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E8452C] shrink-0"
                              aria-hidden="true"
                            />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {spanHeroWide && (
                      <div className="rounded-[14px] overflow-hidden border border-black/10 bg-[#09090B] min-h-[220px]">
                        <SafeImage
                          src="/src/assets/images/scooter_hub_brake_detail_1795691530712.jpg"
                          alt="Electric scooter hub motor wheel, slotted hydraulic brake rotor, and tubeless tire"
                          fallbackTitle="Hub Motor & Brake Assembly"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-4 pt-4 border-t ${
                      isLightTile ? 'border-black/10' : 'border-white/10'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-dot text-2xl font-bold tabular-nums leading-none">
                        {formatServicePrice(service)}
                      </div>
                      <div
                        className={`font-mono text-xs tabular-nums ${
                          isLightTile ? 'text-[#52525B]' : 'text-[#A1A1AA]'
                        }`}
                      >
                        Labor only · Est. {formatDuration(service.durationMinutes)}
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => onToggleService(service.id)}
                      aria-pressed={isSelected}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                      transition={{ duration: 0.14, ease: EASE_OUT_EXPO }}
                      className={`min-h-[42px] px-4 py-2 rounded-[12px] text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#E8452C] text-white hover:bg-[#D53A22]'
                          : isLightTile
                            ? 'bg-[#121214] text-[#F4F4F0] hover:bg-[#27272A]'
                            : 'bg-[#F4F4F0] text-[#121214] hover:bg-white'
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isSelected ? (
                          <motion.span
                            key="selected"
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.14, ease: EASE_OUT_EXPO }}
                            className="inline-flex items-center gap-2"
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            Selected
                          </motion.span>
                        ) : (
                          <motion.span
                            key="add"
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.14, ease: EASE_OUT_EXPO }}
                            className="inline-flex items-center gap-2"
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            Add Service
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Official Hourly Labor Reference Tables (Stand-Up + Mobility) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="rounded-[22px] bg-[#131316] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="font-mono text-[11px] text-[#A1A1AA]">STAND-UP E-SCOOTERS</div>
                <h2 className="text-lg font-semibold text-[#F4F4F0] mt-0.5">
                  Individual E-Scooter Labor
                </h2>
              </div>
              <span className="font-dot text-xl font-bold text-[#F4F4F0] tabular-nums">
                ${settings.hourlyRate}/hr
              </span>
            </div>
            <ul className="divide-y divide-white/8 text-sm">
              {settings.standupHourlyItems.map((item) => (
                <li key={item} className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[#E4E4E7]">{item}</span>
                  <span className="font-mono text-xs text-[#A1A1AA] whitespace-nowrap shrink-0 tabular-nums">
                    ${settings.hourlyRate}/hour
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] border border-black/10 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
                <div>
                  <div className="font-mono text-[11px] text-[#52525B]">MOBILITY SCOOTERS</div>
                  <h2 className="text-lg font-semibold text-[#121214] mt-0.5">
                    Mobility Scooter Labor
                  </h2>
                </div>
                <span className="font-dot text-xl font-bold text-[#121214] tabular-nums">
                  ${settings.hourlyRate}/hr
                </span>
              </div>
              <ul className="divide-y divide-black/10 text-sm">
                {settings.mobilityHourlyItems.map((item) => (
                  <li key={item} className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-[#18181B]">{item}</span>
                    <span className="font-mono text-xs text-[#52525B] whitespace-nowrap shrink-0 tabular-nums">
                      ${settings.hourlyRate}/hour
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#52525B] leading-relaxed">
                Battery voltage/load checks and timed capacity testing are billed at $
                {settings.hourlyRate}/hour. Complete battery-pack replacement is offered; internal
                battery rebuilding is outside this menu.
              </p>
            </div>

            <div className="rounded-[22px] bg-[#131316] border border-white/10 p-6 space-y-3">
              <div className="font-mono text-[11px] text-[#E8452C]">BEFORE APPROVAL</div>
              <h2 className="text-lg font-semibold text-[#F4F4F0]">How estimates work</h2>
              <ul className="space-y-2 text-xs text-[#D4D4D8] leading-relaxed">
                {settings.estimateRules.map((rule) => (
                  <li key={rule} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E8452C] shrink-0"
                      aria-hidden="true"
                    />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Live Repair Manifest Bar */}
        <motion.div
          layout={shouldReduceMotion ? false : 'position'}
          data-testid="repair-manifest-bar"
          className="rounded-[20px] bg-[#141418] border border-white/12 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
        >
          <div className="space-y-1.5">
            <div className="font-mono text-xs text-[#A1A1AA]">
              ACTIVE REPAIR ESTIMATE · {estimate.selectedServices.length}{' '}
              {estimate.selectedServices.length === 1 ? 'SERVICE' : 'SERVICES'} SELECTED
            </div>
            {estimate.selectedServices.length === 0 ? (
              <p className="text-sm text-[#D4D4D8]">
                Select any service package or labor category above to build your estimate.
              </p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <motion.span
                  key={estimate.estimatedLaborLabel}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                  className="font-dot text-2xl sm:text-3xl font-bold text-[#F4F4F0] tabular-nums"
                >
                  {estimate.estimatedLaborLabel}
                </motion.span>
                <span className="text-xs font-mono text-[#A1A1AA] tabular-nums">
                  $0 travel fee · {formatDuration(estimate.estimatedMinutes)} est. labor
                  {estimate.diagnosticCredit > 0
                    ? ` · -${formatCurrency(estimate.diagnosticCredit)} electrical diagnosis credit applied`
                    : ''}
                </span>
              </div>
            )}
          </div>

          <motion.button
            type="button"
            onClick={onProceedToBook}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.14, ease: EASE_OUT_EXPO }}
            className="min-h-[44px] px-5 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            Continue to Booking
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
