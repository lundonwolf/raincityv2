import { ArrowRight } from 'lucide-react';
import type { CodeSnippetRecord, ScooterService, SiteSettings } from '../data/scooterData';
import type { AppRoute } from '../types/routes';
import { getEnabledSnippetsForPlacement } from '../utils/codeSnippets';
import { ClockWidget } from './ClockWidget';
import { CockpitDeck } from './CockpitDeck';
import { CodeSnippetMount } from './CodeSnippetMount';
import { SafeImage } from './SafeImage';

interface HomePageProps {
  services: ScooterService[];
  settings: SiteSettings;
  codeSnippets?: CodeSnippetRecord[];
  selectedServiceIds: string[];
  onToggleService: (serviceId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

const PAGE_DIRECTORY: {
  index: string;
  route: AppRoute;
  title: string;
  description: string;
  cta: string;
  tone: 'light' | 'dark';
}[] = [
  {
    index: '01',
    route: '/pricing',
    title: 'Pricing & Labor Menu',
    description:
      '$30 basic inspection, $65 Silver tune-up, $110 Gold service, $45 electrical diagnosis, and $45/hour general labor with $0 travel fees.',
    cta: 'Open Pricing',
    tone: 'light',
  },
  {
    index: '02',
    route: '/book',
    title: 'Schedule Mobile Repair',
    description:
      'Pick your service package or hourly labor, choose an operating day and arrival window, and confirm online with no upfront payment.',
    cta: 'Book Repair',
    tone: 'dark',
  },
  {
    index: '03',
    route: '/reviews',
    title: 'Google Reviews & Brands',
    description:
      'Verified customer reviews streamed live from Google Maps, plus supported electric and mobility scooter makes.',
    cta: 'Read Reviews',
    tone: 'dark',
  },
  {
    index: '04',
    route: '/warranty',
    title: 'Warranty, Terms & Privacy',
    description:
      '30-day workmanship warranty details, customer-supplied parts guidelines, transparent service terms, and data privacy policy.',
    cta: 'Read Policies',
    tone: 'light',
  },
];

export function HomePage({
  services,
  settings,
  codeSnippets = [],
  selectedServiceIds,
  onToggleService,
  onNavigate,
}: HomePageProps) {
  const homeSnippets = getEnabledSnippetsForPlacement(codeSnippets, 'home_section');

  return (
    <section className="pt-10 pb-20 sm:pt-14 sm:pb-24">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 space-y-10">
        {/* Hero 2-Column Split + OP-1 Cockpit Deck */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.15fr] gap-8 items-stretch">
          <div className="flex flex-col justify-between gap-7">
            <div className="space-y-5">
              <p className="font-mono text-xs tracking-wider text-[#A1A1AA]">
                {settings.heroEyebrow}
              </p>

              <h1 className="text-[clamp(2.25rem,4vw,3.6rem)] font-semibold tracking-tight leading-[1.06] text-[#F4F4F0] [text-wrap:balance]">
                {settings.heroHeadline}
              </h1>

              <p className="text-base sm:text-lg text-[#B4B4BC] leading-relaxed max-w-[54ch]">
                {settings.heroSubcopy}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/book')}
                  className="min-h-[46px] px-6 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  Book Mobile Repair
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/pricing')}
                  className="min-h-[46px] px-5 py-2.5 rounded-[12px] border border-white/15 hover:bg-white/8 text-sm font-semibold text-[#F4F4F0] inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  View Pricing Menu
                  <ArrowRight className="w-4 h-4 text-[#A1A1AA]" aria-hidden="true" />
                </button>
              </div>
            </div>

            <ClockWidget settings={settings} />
          </div>

          <CockpitDeck
            services={services}
            settings={settings}
            selectedServiceIds={selectedServiceIds}
            onToggleService={onToggleService}
            onJumpToBooking={() => onNavigate('/book')}
          />
        </div>

        {/* Full-Width 16:9 Architectural Hero Studio Backdrop */}
        <div className="relative rounded-[24px] overflow-hidden border border-white/10 bg-[#111114] aspect-[16/9] max-h-[480px] w-full">
          <SafeImage
            src="/src/assets/images/hero_scooter_cockpit_1795691529007.jpg"
            alt="Matte black commuter electric scooter inside a minimalist dark concrete studio overlooking rainy Seattle twilight"
            fallbackTitle="Rain City Scooter · Seattle Studio"
            className="w-full h-full object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#09090B]/85 via-[#09090B]/20 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-0 inset-x-0 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="font-mono text-xs text-[#D4D4D8]">
                {settings.studioKicker.toUpperCase()} · {settings.dispatchPolicyNote.toUpperCase()}
              </div>
              <p className="text-lg sm:text-xl font-semibold text-white">
                {settings.studioHeadline}
              </p>
            </div>
            <div className="font-mono text-xs text-[#E4E4E7] whitespace-nowrap shrink-0">
              {settings.hoursShort} · {settings.phoneDisplay}
            </div>
          </div>
        </div>

        {/* Custom Home Page Code Snippets (if any enabled) */}
        {homeSnippets.length > 0 && (
          <div className="rounded-[22px] bg-[#131316] border border-white/10 p-5 sm:p-7 space-y-5">
            {homeSnippets.map((snippet) => (
              <CodeSnippetMount
                key={snippet.id}
                snippet={snippet}
                dockFloatingWidgets
                surface="dark"
              />
            ))}
          </div>
        )}

        {/* Dedicated Page Launchpad Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
          {PAGE_DIRECTORY.map((card) => {
            const isLight = card.tone === 'light';
            return (
              <button
                key={card.route}
                type="button"
                onClick={() => onNavigate(card.route)}
                className={`group rounded-[20px] p-5 border text-left flex flex-col justify-between gap-5 transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-[#F4F4F0] text-[#121214] border-black/10 hover:border-[#E8452C]'
                    : 'bg-[#131316] text-[#F4F4F0] border-white/10 hover:border-[#E8452C]'
                }`}
              >
                <div className="space-y-2.5">
                  <span
                    className={`font-mono text-xs ${
                      isLight ? 'text-[#52525B]' : 'text-[#A1A1AA]'
                    }`}
                  >
                    MODULE {card.index}
                  </span>
                  <h2 className="text-lg font-semibold leading-snug">{card.title}</h2>
                  <p
                    className={`text-xs leading-relaxed ${
                      isLight ? 'text-[#3F3F46]' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {card.description}
                  </p>
                </div>

                <span
                  className={`text-xs font-semibold inline-flex items-center gap-1.5 ${
                    isLight ? 'text-[#121214]' : 'text-[#F4F4F0]'
                  } group-hover:text-[#E8452C] transition-colors`}
                >
                  {card.cta}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
