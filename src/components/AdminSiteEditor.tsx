import { useEffect, useState, type FormEvent } from 'react';
import { Code2, ExternalLink, Eye, RotateCcw, Save } from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '../data/scooterData';
import type { AppRoute } from '../types/routes';

type SiteEditorSection =
  | 'global'
  | 'home'
  | 'pricing'
  | 'reviews'
  | 'booking'
  | 'policies';

interface AdminSiteEditorProps {
  settings: SiteSettings;
  saving: boolean;
  onSave: (nextSettings: SiteSettings) => Promise<void>;
  onNavigate: (route: AppRoute) => void;
  onOpenCodeSnippets?: () => void;
}

const SECTION_TABS: {
  id: SiteEditorSection;
  label: string;
  previewRoute?: AppRoute;
  previewLabel?: string;
}[] = [
  { id: 'global', label: 'Brand & Contact', previewRoute: '/', previewLabel: 'Open Site' },
  { id: 'home', label: 'Home Page', previewRoute: '/', previewLabel: 'Preview Home' },
  { id: 'pricing', label: 'Pricing & Lists', previewRoute: '/pricing', previewLabel: 'Preview Pricing' },
  { id: 'reviews', label: 'Reviews & Brands', previewRoute: '/reviews', previewLabel: 'Preview Reviews' },
  { id: 'booking', label: 'Booking Page', previewRoute: '/book', previewLabel: 'Preview Booking' },
  { id: 'policies', label: 'Policies', previewRoute: '/warranty', previewLabel: 'Preview Policies' },
];

function linesToList(text: string, maxItems: number, maxLen: number): string[] {
  return text
    .split('\n')
    .map((line) => line.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function AdminSiteEditor({
  settings,
  saving,
  onSave,
  onNavigate,
  onOpenCodeSnippets,
}: AdminSiteEditorProps) {
  const [section, setSection] = useState<SiteEditorSection>('global');
  const [draft, setDraft] = useState<SiteSettings>(settings);
  const [standupText, setStandupText] = useState(settings.standupHourlyItems.join('\n'));
  const [mobilityText, setMobilityText] = useState(settings.mobilityHourlyItems.join('\n'));
  const [rulesText, setRulesText] = useState(settings.estimateRules.join('\n'));
  const [brandsText, setBrandsText] = useState(settings.supportedBrands.join('\n'));

  useEffect(() => {
    setDraft(settings);
    setStandupText(settings.standupHourlyItems.join('\n'));
    setMobilityText(settings.mobilityHourlyItems.join('\n'));
    setRulesText(settings.estimateRules.join('\n'));
    setBrandsText(settings.supportedBrands.join('\n'));
  }, [settings]);

  const buildPayload = (): SiteSettings => ({
    ...draft,
    standupHourlyItems: linesToList(standupText, 16, 160),
    mobilityHourlyItems: linesToList(mobilityText, 16, 160),
    estimateRules: linesToList(rulesText, 16, 240),
    supportedBrands: linesToList(brandsText, 30, 60),
  });

  const hasUnsavedChanges =
    JSON.stringify(buildPayload()) !== JSON.stringify(settings);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave(buildPayload());
  };

  const handleResetSection = () => {
    if (section === 'global') {
      setDraft((prev) => ({
        ...prev,
        businessName: DEFAULT_SITE_SETTINGS.businessName,
        tagline: DEFAULT_SITE_SETTINGS.tagline,
        phoneDisplay: DEFAULT_SITE_SETTINGS.phoneDisplay,
        email: DEFAULT_SITE_SETTINGS.email,
        hoursShort: DEFAULT_SITE_SETTINGS.hoursShort,
        hourlyRate: DEFAULT_SITE_SETTINGS.hourlyRate,
        dispatchPolicyNote: DEFAULT_SITE_SETTINGS.dispatchPolicyNote,
        warrantyDays: DEFAULT_SITE_SETTINGS.warrantyDays,
        announcement: DEFAULT_SITE_SETTINGS.announcement,
        footerNote: DEFAULT_SITE_SETTINGS.footerNote,
      }));
      return;
    }
    if (section === 'home') {
      setDraft((prev) => ({
        ...prev,
        heroEyebrow: DEFAULT_SITE_SETTINGS.heroEyebrow,
        heroHeadline: DEFAULT_SITE_SETTINGS.heroHeadline,
        heroSubcopy: DEFAULT_SITE_SETTINGS.heroSubcopy,
        studioKicker: DEFAULT_SITE_SETTINGS.studioKicker,
        studioHeadline: DEFAULT_SITE_SETTINGS.studioHeadline,
      }));
      return;
    }
    if (section === 'pricing') {
      setDraft((prev) => ({
        ...prev,
        pricingEyebrow: DEFAULT_SITE_SETTINGS.pricingEyebrow,
        pricingHeadline: DEFAULT_SITE_SETTINGS.pricingHeadline,
        pricingIntro: DEFAULT_SITE_SETTINGS.pricingIntro,
      }));
      setStandupText(DEFAULT_SITE_SETTINGS.standupHourlyItems.join('\n'));
      setMobilityText(DEFAULT_SITE_SETTINGS.mobilityHourlyItems.join('\n'));
      setRulesText(DEFAULT_SITE_SETTINGS.estimateRules.join('\n'));
      return;
    }
    if (section === 'reviews') {
      setDraft((prev) => ({
        ...prev,
        reviewsHeadline: DEFAULT_SITE_SETTINGS.reviewsHeadline,
        reviewsIntro: DEFAULT_SITE_SETTINGS.reviewsIntro,
      }));
      setBrandsText(DEFAULT_SITE_SETTINGS.supportedBrands.join('\n'));
      return;
    }
    if (section === 'booking') {
      setDraft((prev) => ({
        ...prev,
        bookingHeadline: DEFAULT_SITE_SETTINGS.bookingHeadline,
        bookingIntro: DEFAULT_SITE_SETTINGS.bookingIntro,
      }));
      return;
    }
    if (section === 'policies') {
      setDraft((prev) => ({
        ...prev,
        policyEffectiveDate: DEFAULT_SITE_SETTINGS.policyEffectiveDate,
        warrantyHighlightNote: DEFAULT_SITE_SETTINGS.warrantyHighlightNote,
        termsScopeNote: DEFAULT_SITE_SETTINGS.termsScopeNote,
        privacyIntroNote: DEFAULT_SITE_SETTINGS.privacyIntroNote,
      }));
    }
  };

  const activeMeta = SECTION_TABS.find((t) => t.id === section) ?? SECTION_TABS[0];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-8 border border-black/10 space-y-6"
    >
      {/* Editor Header + Publish Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black/10 pb-5">
        <div className="space-y-1">
          <div className="font-mono text-xs text-[#52525B]">
            FULL-SITE VISUAL CONTENT EDITOR ·{' '}
            <span className={hasUnsavedChanges ? 'text-[#E8452C] font-semibold' : 'text-[#52525B]'}>
              {hasUnsavedChanges ? 'UNSAVED CHANGES' : 'LIVE & SYNCED'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">Edit Any Page on Your Website</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeMeta.previewRoute && (
            <button
              type="button"
              onClick={() => onNavigate(activeMeta.previewRoute as AppRoute)}
              className="min-h-[40px] px-3.5 py-2 rounded-[10px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#121214] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              {activeMeta.previewLabel}
            </button>
          )}
          <button
            type="button"
            onClick={handleResetSection}
            className="min-h-[40px] px-3.5 py-2 rounded-[10px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#52525B] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset Section
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[40px] px-5 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            {saving ? 'Publishing...' : 'Publish All Site Changes'}
          </button>
        </div>
      </div>

      {/* Page-by-Page Sub-Tabs */}
      <div
        role="tablist"
        aria-label="Website page sections"
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-[14px] bg-black/5 border border-black/10"
      >
        {SECTION_TABS.map((tab) => {
          const isActive = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSection(tab.id)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#121214] text-[#F4F4F0]'
                  : 'text-[#3F3F46] hover:text-[#121214] hover:bg-black/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: BRAND & CONTACT */}
      {section === 'global' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="set-name" className="text-xs font-semibold">
                Business Name
              </label>
              <input
                id="set-name"
                type="text"
                value={draft.businessName}
                onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="set-phone" className="text-xs font-semibold">
                Phone Display
              </label>
              <input
                id="set-phone"
                type="text"
                value={draft.phoneDisplay}
                onChange={(e) => setDraft({ ...draft, phoneDisplay: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="set-email" className="text-xs font-semibold">
                Contact Email
              </label>
              <input
                id="set-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="set-hours" className="text-xs font-semibold">
                Operating Hours
              </label>
              <input
                id="set-hours"
                type="text"
                value={draft.hoursShort}
                onChange={(e) => setDraft({ ...draft, hoursShort: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="set-rate" className="text-xs font-semibold">
                General Hourly Labor Rate ($)
              </label>
              <input
                id="set-rate"
                type="number"
                min={0}
                max={500}
                value={draft.hourlyRate}
                onChange={(e) => setDraft({ ...draft, hourlyRate: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="set-warranty" className="text-xs font-semibold">
                Workmanship Warranty (Days)
              </label>
              <input
                id="set-warranty"
                type="number"
                min={0}
                max={365}
                value={draft.warrantyDays}
                onChange={(e) => setDraft({ ...draft, warrantyDays: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="set-tagline" className="text-xs font-semibold">
                Brand Tagline
              </label>
              <input
                id="set-tagline"
                type="text"
                value={draft.tagline}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="set-dispatch" className="text-xs font-semibold">
                Dispatch / Travel Policy Note
              </label>
              <input
                id="set-dispatch"
                type="text"
                value={draft.dispatchPolicyNote}
                onChange={(e) => setDraft({ ...draft, dispatchPolicyNote: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="set-announcement" className="text-xs font-semibold">
                Top Sitewide Announcement Banner (Leave blank to hide)
              </label>
              <input
                id="set-announcement"
                type="text"
                value={draft.announcement}
                onChange={(e) => setDraft({ ...draft, announcement: e.target.value })}
                placeholder="e.g. Booking winter tune-ups — $0 travel fee."
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="set-footer-note" className="text-xs font-semibold">
                Custom Footer Blurb (Optional — defaults to tagline + hours)
              </label>
              <input
                id="set-footer-note"
                type="text"
                value={draft.footerNote}
                onChange={(e) => setDraft({ ...draft, footerNote: e.target.value })}
                placeholder="Leave blank to use tagline and operating hours automatically"
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: HOME PAGE */}
      {section === 'home' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="edit-hero-eyebrow" className="text-xs font-semibold">
                Hero Eyebrow Label
              </label>
              <input
                id="edit-hero-eyebrow"
                type="text"
                maxLength={80}
                value={draft.heroEyebrow}
                onChange={(e) => setDraft({ ...draft, heroEyebrow: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-studio-kicker" className="text-xs font-semibold">
                Hero Banner Kicker (Above Studio Photo Headline)
              </label>
              <input
                id="edit-studio-kicker"
                type="text"
                maxLength={80}
                value={draft.studioKicker}
                onChange={(e) => setDraft({ ...draft, studioKicker: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-hero-headline" className="text-xs font-semibold">
              Main Hero Headline
            </label>
            <input
              id="edit-hero-headline"
              type="text"
              maxLength={160}
              value={draft.heroHeadline}
              onChange={(e) => setDraft({ ...draft, heroHeadline: e.target.value })}
              className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-hero-subcopy" className="text-xs font-semibold">
              Hero Intro Paragraph
            </label>
            <textarea
              id="edit-hero-subcopy"
              rows={3}
              maxLength={360}
              value={draft.heroSubcopy}
              onChange={(e) => setDraft({ ...draft, heroSubcopy: e.target.value })}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-studio-headline" className="text-xs font-semibold">
              Studio Banner Headline
            </label>
            <input
              id="edit-studio-headline"
              type="text"
              maxLength={160}
              value={draft.studioHeadline}
              onChange={(e) => setDraft({ ...draft, studioHeadline: e.target.value })}
              className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>
        </div>
      )}

      {/* SECTION 3: PRICING & LABOR LISTS */}
      {section === 'pricing' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="edit-pricing-eyebrow" className="text-xs font-semibold">
                Pricing Page Eyebrow
              </label>
              <input
                id="edit-pricing-eyebrow"
                type="text"
                maxLength={100}
                value={draft.pricingEyebrow}
                onChange={(e) => setDraft({ ...draft, pricingEyebrow: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-pricing-headline" className="text-xs font-semibold">
                Pricing Page Headline
              </label>
              <input
                id="edit-pricing-headline"
                type="text"
                maxLength={140}
                value={draft.pricingHeadline}
                onChange={(e) => setDraft({ ...draft, pricingHeadline: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-pricing-intro" className="text-xs font-semibold">
              Pricing Intro Paragraph
            </label>
            <textarea
              id="edit-pricing-intro"
              rows={2}
              maxLength={360}
              value={draft.pricingIntro}
              onChange={(e) => setDraft({ ...draft, pricingIntro: e.target.value })}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="edit-standup-items" className="text-xs font-semibold">
                Stand-Up E-Scooter Hourly Labor Items (One per line)
              </label>
              <textarea
                id="edit-standup-items"
                rows={7}
                value={standupText}
                onChange={(e) => setStandupText(e.target.value)}
                className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-xs font-mono leading-relaxed"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="edit-mobility-items" className="text-xs font-semibold">
                  Mobility Scooter Hourly Labor Items (One per line)
                </label>
                <textarea
                  id="edit-mobility-items"
                  rows={4}
                  value={mobilityText}
                  onChange={(e) => setMobilityText(e.target.value)}
                  className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-xs font-mono leading-relaxed"
                />
              </div>
              <p className="text-xs text-[#52525B]">
                Edit individual service cards, prices, and packages directly in the{' '}
                <strong>Pricing &amp; Service Catalog</strong> section right below this editor.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-estimate-rules" className="text-xs font-semibold">
              “How Estimates Work” Bullet Rules (One per line)
            </label>
            <textarea
              id="edit-estimate-rules"
              rows={6}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-xs font-mono leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* SECTION 4: REVIEWS & BRANDS */}
      {section === 'reviews' && (
        <div className="space-y-4">
          {onOpenCodeSnippets && (
            <div className="rounded-[14px] bg-white border border-black/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-mono text-[11px] font-semibold text-[#52525B]">
                  LIVE GOOGLE REVIEWS EMBED SCRIPT
                </div>
                <p className="text-xs text-[#3F3F46] leading-relaxed">
                  Swap your Trustindex reviews code snippet or add other widgets anytime in the{' '}
                  <strong>Code Snippets</strong> tab.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCodeSnippets}
                className="min-h-[38px] px-3.5 py-2 rounded-[10px] bg-[#121214] hover:bg-[#27272A] text-[#F4F4F0] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                Edit Reviews Code Snippet
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="edit-reviews-headline" className="text-xs font-semibold">
                Reviews Page Headline
              </label>
              <input
                id="edit-reviews-headline"
                type="text"
                maxLength={140}
                value={draft.reviewsHeadline}
                onChange={(e) => setDraft({ ...draft, reviewsHeadline: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="set-google-place-id" className="text-xs font-semibold">
                  Google Business Profile Place ID (Live Google Reviews)
                </label>
                <a
                  href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-[#E8452C] hover:underline inline-flex items-center gap-1"
                >
                  Find Place ID
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
              <input
                id="set-google-place-id"
                type="text"
                value={draft.googlePlaceId}
                onChange={(e) => setDraft({ ...draft, googlePlaceId: e.target.value })}
                placeholder="Optional ChIJ... ID (leave blank to auto-search by business name)"
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-reviews-intro" className="text-xs font-semibold">
              Reviews Intro Text
            </label>
            <textarea
              id="edit-reviews-intro"
              rows={2}
              maxLength={360}
              value={draft.reviewsIntro}
              onChange={(e) => setDraft({ ...draft, reviewsIntro: e.target.value })}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-supported-brands" className="text-xs font-semibold">
              Supported Scooter Makes / Brands (One per line, max 30)
            </label>
            <textarea
              id="edit-supported-brands"
              rows={6}
              value={brandsText}
              onChange={(e) => setBrandsText(e.target.value)}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-xs font-mono leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* SECTION 5: BOOKING PAGE */}
      {section === 'booking' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="edit-booking-headline" className="text-xs font-semibold">
              Booking Page Headline
            </label>
            <input
              id="edit-booking-headline"
              type="text"
              maxLength={140}
              value={draft.bookingHeadline}
              onChange={(e) => setDraft({ ...draft, bookingHeadline: e.target.value })}
              className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-booking-intro" className="text-xs font-semibold">
              Booking Page Intro Text
            </label>
            <textarea
              id="edit-booking-intro"
              rows={3}
              maxLength={360}
              value={draft.bookingIntro}
              onChange={(e) => setDraft({ ...draft, bookingIntro: e.target.value })}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>
        </div>
      )}

      {/* SECTION 6: POLICIES */}
      {section === 'policies' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 w-full sm:w-72">
              <label htmlFor="edit-policy-date" className="text-xs font-semibold">
                Policy Effective Date
              </label>
              <input
                id="edit-policy-date"
                type="text"
                maxLength={60}
                value={draft.policyEffectiveDate}
                onChange={(e) => setDraft({ ...draft, policyEffectiveDate: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('/warranty')}
                className="min-h-[36px] px-3 py-1.5 rounded-[10px] border border-black/15 text-xs font-semibold hover:bg-black/5 cursor-pointer"
              >
                Open Warranty
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/terms')}
                className="min-h-[36px] px-3 py-1.5 rounded-[10px] border border-black/15 text-xs font-semibold hover:bg-black/5 cursor-pointer"
              >
                Open Terms
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/privacy')}
                className="min-h-[36px] px-3 py-1.5 rounded-[10px] border border-black/15 text-xs font-semibold hover:bg-black/5 cursor-pointer"
              >
                Open Privacy
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-warranty-note" className="text-xs font-semibold">
              Warranty Page — Main Coverage Statement
            </label>
            <textarea
              id="edit-warranty-note"
              rows={3}
              maxLength={600}
              value={draft.warrantyHighlightNote}
              onChange={(e) => setDraft({ ...draft, warrantyHighlightNote: e.target.value })}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-terms-note" className="text-xs font-semibold">
              Terms of Service — Section 1 (Mobile Service Scope &amp; Safety)
            </label>
            <textarea
              id="edit-terms-note"
              rows={3}
              maxLength={600}
              value={draft.termsScopeNote}
              onChange={(e) => setDraft({ ...draft, termsScopeNote: e.target.value })}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-privacy-note" className="text-xs font-semibold">
              Privacy Policy — Section 1 Intro
            </label>
            <textarea
              id="edit-privacy-note"
              rows={2}
              maxLength={600}
              value={draft.privacyIntroNote}
              onChange={(e) => setDraft({ ...draft, privacyIntroNote: e.target.value })}
              className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
            />
          </div>
        </div>
      )}
    </form>
  );
}
