import type { SiteSettings } from '../data/scooterData';
import type { AppRoute } from '../types/routes';

interface PolicyPagesProps {
  activePolicy: '/warranty' | '/terms' | '/privacy';
  settings: SiteSettings;
  onNavigate: (route: AppRoute) => void;
}

const POLICY_TABS: { route: '/warranty' | '/terms' | '/privacy'; label: string }[] = [
  { route: '/warranty', label: 'Warranty & Returns' },
  { route: '/terms', label: 'Terms of Service' },
  { route: '/privacy', label: 'Privacy & Data' },
];

export function PolicyPages({ activePolicy, settings, onNavigate }: PolicyPagesProps) {
  const phoneHref = `tel:+1${settings.phoneDisplay.replace(/\D/g, '')}`;

  return (
    <section className="py-14 sm:py-20">
      <div className="max-w-[1040px] mx-auto px-5 sm:px-8 space-y-10">
        {/* Header + Policy Switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div className="space-y-3">
            <p className="font-mono text-xs tracking-wider text-[#A1A1AA]">
              Legal & Service Documentation · Effective {settings.policyEffectiveDate}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F4F4F0] [text-wrap:balance]">
              {activePolicy === '/warranty' && 'Warranty & Returns Policy'}
              {activePolicy === '/terms' && 'Terms of Service'}
              {activePolicy === '/privacy' && 'Privacy & Data Collection Policy'}
            </h1>
          </div>

          <div
            role="tablist"
            aria-label="Policy documents"
            className="flex items-center gap-1 p-1.5 rounded-[14px] bg-[#141418] border border-white/10 self-start overflow-x-auto max-w-full"
          >
            {POLICY_TABS.map((tab) => {
              const isActive = activePolicy === tab.route;
              return (
                <button
                  key={tab.route}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onNavigate(tab.route)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F4F4F0] text-[#121214]'
                      : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* WARRANTY & RETURNS */}
        {activePolicy === '/warranty' && (
          <div className="space-y-6">
            {/* Highlight Hardware Card */}
            <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-8 border border-black/10 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
              <div className="md:border-r md:border-black/10 md:pr-8">
                <div className="font-mono text-xs text-[#52525B]">WORKMANSHIP COVERAGE</div>
                <div className="font-dot text-5xl font-extrabold text-[#121214] tabular-nums mt-1">
                  {settings.warrantyDays} DAYS
                </div>
              </div>
              <p className="text-sm sm:text-base text-[#27272A] leading-relaxed">
                {settings.warrantyHighlightNote}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 space-y-3">
                <h2 className="text-lg font-semibold text-[#F4F4F0]">
                  1. Covered Workmanship Issues
                </h2>
                <p className="text-sm text-[#A1A1AA] leading-relaxed">
                  Covers defects directly resulting from work performed by {settings.businessName}:
                </p>
                <ul className="space-y-2 text-sm text-[#D4D4D8]">
                  <li>· Improper component installation or incorrect assembly.</li>
                  <li>· A fastener, brake caliper, or electrical connection improperly secured.</li>
                  <li>
                    · A repaired condition recurring because the original workmanship was defective.
                  </li>
                </ul>
              </article>

              <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 space-y-3">
                <h2 className="text-lg font-semibold text-[#F4F4F0]">
                  2. What Is Not Covered
                </h2>
                <ul className="space-y-2 text-sm text-[#D4D4D8]">
                  <li>· New or unrelated failures, crashes, impacts, road debris, or punctures.</li>
                  <li>· Normal wear and tear on brake pads, tires, tubes, or consumables.</li>
                  <li>
                    · Water exposure, corrosion, overloading, abuse, heat damage, or incompatible
                    chargers.
                  </li>
                  <li>
                    · Post-repair modifications by the owner or another repair provider, or
                    continued riding after a known warning defect.
                  </li>
                </ul>
              </article>

              <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 space-y-3">
                <h2 className="text-lg font-semibold text-[#F4F4F0]">
                  3. Parts & Customer-Supplied Parts
                </h2>
                <p className="text-sm text-[#D4D4D8] leading-relaxed">
                  Replacement parts purchased through {settings.businessName} carry the warranty
                  offered by the applicable manufacturer or distributor. We assist with valid
                  supplier claims, though supplier decisions govern replacement approvals.
                </p>
                <p className="text-sm text-[#A1A1AA] leading-relaxed">
                  Parts supplied by the customer carry no parts warranty from{' '}
                  {settings.businessName}; we warrant only our installation workmanship. Additional
                  labor to diagnose, remove, or swap defective or incompatible customer-supplied
                  parts is billed at ${settings.hourlyRate}/hour.
                </p>
              </article>

              <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 space-y-3">
                <h2 className="text-lg font-semibold text-[#F4F4F0]">
                  4. Batteries & Special-Order Returns
                </h2>
                <p className="text-sm text-[#D4D4D8] leading-relaxed">
                  Lithium-ion batteries naturally degrade with age, charge cycles, storage habits,
                  and weather exposure. Complete OEM-compatible battery pack replacements are
                  offered; internal cell rebuilding is outside our service menu.
                </p>
                <p className="text-sm text-[#A1A1AA] leading-relaxed">
                  Special-order parts may require an approved deposit and are subject to supplier
                  return windows and restocking fees once installed or opened.
                </p>
              </article>
            </div>
          </div>
        )}

        {/* TERMS OF SERVICE */}
        {activePolicy === '/terms' && (
          <div className="space-y-5">
            <article className="rounded-[20px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-7 border border-black/10 space-y-3">
              <h2 className="text-lg font-semibold">1. Mobile Service Scope & Safety</h2>
              <p className="text-sm text-[#27272A] leading-relaxed">
                {settings.termsScopeNote}
              </p>
            </article>

            <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 sm:p-7 space-y-3">
              <h2 className="text-lg font-semibold text-[#F4F4F0]">
                2. Transparent Pricing & Zero Travel Fees
              </h2>
              <p className="text-sm text-[#D4D4D8] leading-relaxed">
                General repair labor is billed at <strong>${settings.hourlyRate}/hour</strong>{' '}
                whenever a fixed-price service package is not selected. Fixed packages include Basic
                Inspection ($30), Silver Essential Tune-Up ($65), Gold Commuter Service ($110),
                Comprehensive Service (from $175), and Electrical Diagnosis ($45 for up to 40
                minutes, credited when an approved repair quote includes the same troubleshooting
                work).
              </p>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                {settings.dispatchPolicyNote} Prices cover labor only; replacement parts, materials,
                shipping, and applicable Washington State sales tax are billed separately.
              </p>
            </article>

            <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 sm:p-7 space-y-3">
              <h2 className="text-lg font-semibold text-[#F4F4F0]">
                3. Estimates, Scope Approvals & Payment
              </h2>
              <ul className="space-y-2 text-sm text-[#D4D4D8] leading-relaxed">
                <li>
                  · Component compatibility and repair scope are confirmed with you before work
                  begins beyond the initial inspection or diagnosis.
                </li>
                <li>
                  · Seized fasteners, corroded axles, or unusual aftermarket assemblies may require
                  revised time estimates, which are always discussed prior to proceeding.
                </li>
                <li>
                  · Special-order parts may require an approved deposit before ordering. Final
                  payment is due upon completion of service unless otherwise agreed in writing.
                </li>
              </ul>
            </article>

            <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 sm:p-7 space-y-3">
              <h2 className="text-lg font-semibold text-[#F4F4F0]">
                4. Appointments, Cancellations & Rider Responsibility
              </h2>
              <p className="text-sm text-[#D4D4D8] leading-relaxed">
                Please provide accurate scooter model details, known error codes, and safe street or
                driveway parking access for mobile visits. If you need to reschedule or cancel,
                notify us as early as possible by phone or email so we can reopen the slot for other
                local riders. Riders are responsible for safe operation, helmet use, and compliance
                with local traffic laws following service.
              </p>
            </article>

            <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 sm:p-7 space-y-3">
              <h2 className="text-lg font-semibold text-[#F4F4F0]">
                5. Third-Party Google Maps Reviews
              </h2>
              <p className="text-sm text-[#D4D4D8] leading-relaxed">
                Verified customer ratings and reviews displayed on our Reviews page are streamed
                live from Google Maps Platform. Use of Google Maps features and links is subject to
                the{' '}
                <a
                  href="https://maps.google.com/help/terms_maps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F4F4F0] underline decoration-[#E8452C]"
                >
                  Google Maps/Google Earth Additional Terms of Service
                </a>{' '}
                and the{' '}
                <a
                  href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F4F4F0] underline decoration-[#E8452C]"
                >
                  Google Maps Platform Terms of Service
                </a>
                .
              </p>
            </article>
          </div>
        )}

        {/* PRIVACY & DATA COLLECTION */}
        {activePolicy === '/privacy' && (
          <div className="space-y-5">
            <article className="rounded-[20px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-7 border border-black/10 space-y-3">
              <h2 className="text-lg font-semibold">1. Information We Collect</h2>
              <p className="text-sm text-[#27272A] leading-relaxed">
                {settings.privacyIntroNote}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs text-[#27272A]">
                <div className="rounded-[12px] bg-white p-4 border border-black/10 space-y-1">
                  <div className="font-mono font-semibold text-[#121214]">CONTACT & APPOINTMENT</div>
                  <p>
                    Name, phone number, email address, street service address, requested day/time
                    window, and booking or cancellation history.
                  </p>
                </div>
                <div className="rounded-[12px] bg-white p-4 border border-black/10 space-y-1">
                  <div className="font-mono font-semibold text-[#121214]">EQUIPMENT & DIAGNOSTICS</div>
                  <p>
                    Scooter manufacturer, model, serial number, battery/charger specs, error codes,
                    odometer readings, condition photos, and repair records.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 sm:p-7 space-y-3">
              <h2 className="text-lg font-semibold text-[#F4F4F0]">
                2. How Your Data Is Used & Protected
              </h2>
              <ul className="space-y-2 text-sm text-[#D4D4D8] leading-relaxed">
                <li>
                  · To confirm parts compatibility, dispatch your mobile visit, and send arrival or
                  estimate updates.
                </li>
                <li>
                  · To track your {settings.warrantyDays}-day workmanship warranty and previous
                  service history.
                </li>
                <li>
                  · Booking and customer records are stored in an access-controlled database
                  restricted exclusively to the shop administrator—never sold or rented to third
                  parties.
                </li>
                <li>
                  · We do not store full payment card numbers directly; card transactions are
                  handled through third-party payment processors.
                </li>
              </ul>
            </article>

            <article className="rounded-[20px] bg-[#131316] border border-white/10 p-6 sm:p-7 space-y-3">
              <h2 className="text-lg font-semibold text-[#F4F4F0]">
                3. Condition Photos, Cookies & Your Privacy Rights
              </h2>
              <p className="text-sm text-[#D4D4D8] leading-relaxed">
                We may capture photos of scooter components for diagnostic reference, parts
                matching, or warranty documentation. Customer-identifying details are never shared
                publicly without permission. Essential browser storage is used to keep your active
                service selections and booking confirmation available across page reloads. Live
                customer reviews on our Reviews page are requested directly from Google Maps
                Platform (not cached in our database) and are subject to the{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F4F4F0] underline decoration-[#E8452C]"
                >
                  Google Privacy Policy
                </a>
                .
              </p>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                To request a copy, correction, or deletion of your customer record, email{' '}
                <a
                  href={`mailto:${settings.email}`}
                  className="text-[#F4F4F0] underline decoration-[#E8452C]"
                >
                  {settings.email}
                </a>{' '}
                or call{' '}
                <a href={phoneHref} className="text-[#F4F4F0] underline decoration-[#E8452C]">
                  {settings.phoneDisplay}
                </a>
                .
              </p>
            </article>
          </div>
        )}

        {/* Bottom CTA Strip */}
        <div className="rounded-[20px] bg-[#141418] border border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm text-[#D4D4D8]">
            Questions about warranty coverage, estimates, or your scooter model?
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/pricing')}
              className="min-h-[42px] px-4 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] cursor-pointer whitespace-nowrap"
            >
              View Pricing
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/book')}
              className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              Book Repair
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
