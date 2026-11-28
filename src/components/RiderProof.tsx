import { ArrowRight } from 'lucide-react';
import type { CodeSnippetRecord, SiteSettings } from '../data/scooterData';
import type { AppRoute } from '../types/routes';
import { getEnabledSnippetsForPlacement } from '../utils/codeSnippets';
import { CodeSnippetMount } from './CodeSnippetMount';

interface RiderProofProps {
  settings: SiteSettings;
  codeSnippets: CodeSnippetRecord[];
  onNavigate: (route: AppRoute) => void;
}

export function RiderProof({ settings, codeSnippets, onNavigate }: RiderProofProps) {
  const brandCount = settings.supportedBrands.length;
  const reviewSnippets = getEnabledSnippetsForPlacement(codeSnippets, 'reviews_section');
  const metrics = [
    { value: '$0 fees', label: 'No dispatch or travel fees' },
    { value: `${settings.warrantyDays} days`, label: 'Workmanship warranty on every repair and tune' },
    { value: `$${settings.hourlyRate}/hr`, label: 'Transparent hourly labor outside fixed packages' },
    { value: `${brandCount}+ brands`, label: 'Commuter, dual-motor, and mobility scooters serviced' },
  ];

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="py-12 sm:py-16"
    >
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs tracking-wider text-[#A1A1AA]">
              Google Business Profile · Live Customer Reviews
            </p>
            <h1
              id="reviews-heading"
              className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#F4F4F0] [text-wrap:balance]"
            >
              {settings.reviewsHeadline}
            </h1>
          </div>

          <p className="text-sm text-[#A1A1AA] max-w-md leading-relaxed">
            {settings.reviewsIntro}
          </p>
        </div>

        {/* 4-column factual service terms strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[18px] bg-[#131316] border border-white/10 p-5 space-y-2"
            >
              <div className="font-dot text-3xl font-bold text-[#F4F4F0] tabular-nums">
                {metric.value}
              </div>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Dynamic Live Reviews Embed Snippets (managed in Admin → Code Snippets) */}
        {reviewSnippets.length > 0 && (
          <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] border border-black/10 p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3.5">
              <div className="space-y-0.5">
                <div className="font-mono text-xs text-[#52525B]">
                  VERIFIED GOOGLE REVIEWS · LIVE FEED
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-[#121214]">
                  What Seattle riders say on Google
                </h2>
              </div>
            </div>

            <div className="space-y-5">
              {reviewSnippets.map((snippet) => (
                <CodeSnippetMount
                  key={snippet.id}
                  snippet={snippet}
                  dockFloatingWidgets
                  surface="light"
                />
              ))}
            </div>
          </div>
        )}

        {/* Supported Brands & Bottom Action Strip */}
        <div className="rounded-[20px] bg-[#131316] border border-white/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="font-mono text-xs text-[#A1A1AA] block">COMMON MAKES SERVICED</span>
            <p className="text-sm text-[#E4E4E7] leading-relaxed">
              {settings.supportedBrands.join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/warranty')}
              className="min-h-[42px] px-4 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] cursor-pointer whitespace-nowrap"
            >
              Read Warranty Policy
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/book')}
              className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-xs font-semibold text-white inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              Book Repair
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

