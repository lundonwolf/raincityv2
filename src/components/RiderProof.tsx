import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  MessageSquarePlus,
  RefreshCw,
  Settings,
  Star,
} from 'lucide-react';
import type { SiteSettings } from '../data/scooterData';
import { useGoogleReviews } from '../hooks/useGoogleReviews';
import type { AppRoute } from '../types/routes';
import { getAuthorInitials, type GoogleReviewItem } from '../utils/googleReviewsHelpers';

interface RiderProofProps {
  settings: SiteSettings;
  hasMapsApiKey: boolean;
  onNavigate: (route: AppRoute) => void;
}

function StarRatingRow({
  rating,
  lightSurface = false,
}: {
  rating: number;
  lightSurface?: boolean;
}) {
  const filledCount = Math.round(rating);
  return (
    <div
      className="inline-flex items-center gap-1"
      aria-label={`Rated ${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((starNum) => {
        const isFilled = starNum <= filledCount;
        return (
          <Star
            key={starNum}
            className={`w-3.5 h-3.5 ${
              isFilled
                ? 'fill-[#E8452C] text-[#E8452C]'
                : lightSurface
                  ? 'text-black/20'
                  : 'text-white/20'
            }`}
            aria-hidden="true"
          />
        );
      })}
      <span
        className={`ml-1 font-mono text-xs font-semibold tabular-nums ${
          lightSurface ? 'text-[#121214]' : 'text-[#F4F4F0]'
        }`}
      >
        {rating.toFixed(1)} / 5
      </span>
    </div>
  );
}

function ReviewerAvatar({
  photoUri,
  displayName,
  lightSurface,
}: {
  photoUri: string | null;
  displayName: string;
  lightSurface: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (photoUri && !imgFailed) {
    return (
      <img
        src={photoUri}
        alt={displayName}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-9 h-9 rounded-full object-cover border border-black/10 shrink-0"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-semibold shrink-0 ${
        lightSurface
          ? 'bg-[#121214] text-[#F4F4F0]'
          : 'bg-white/10 text-[#F4F4F0]'
      }`}
    >
      {getAuthorInitials(displayName)}
    </span>
  );
}

function GoogleReviewCard({
  review,
  isChalk,
}: {
  review: GoogleReviewItem;
  isChalk: boolean;
}) {
  return (
    <figure
      className={`rounded-[22px] p-6 flex flex-col justify-between gap-6 border ${
        isChalk
          ? 'bg-[#F4F4F0] text-[#121214] border-black/10'
          : 'bg-[#131316] text-[#F4F4F0] border-white/10'
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {review.rating !== null ? (
            <StarRatingRow rating={review.rating} lightSurface={isChalk} />
          ) : (
            <span className="font-mono text-xs text-[#A1A1AA]">GOOGLE REVIEW</span>
          )}
          {review.relativePublishTimeDescription && (
            <span
              className={`font-mono text-[11px] ${
                isChalk ? 'text-[#52525B]' : 'text-[#A1A1AA]'
              }`}
            >
              {review.relativePublishTimeDescription}
            </span>
          )}
        </div>

        <blockquote
          className={`text-sm leading-relaxed whitespace-pre-line ${
            isChalk ? 'text-[#18181B]' : 'text-[#E4E4E7]'
          }`}
        >
          {review.text ? `“${review.text}”` : 'Customer submitted a verified star rating on Google.'}
        </blockquote>
      </div>

      <figcaption
        className={`pt-4 border-t flex items-center justify-between gap-3 ${
          isChalk ? 'border-black/10' : 'border-white/10'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ReviewerAvatar
            photoUri={review.authorPhotoUri}
            displayName={review.authorName}
            lightSurface={isChalk}
          />
          <div className="min-w-0">
            {review.authorUri ? (
              <a
                href={review.authorUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline truncate block"
              >
                {review.authorName}
              </a>
            ) : (
              <div className="text-sm font-semibold truncate">{review.authorName}</div>
            )}
            <div className={`font-mono text-[11px] ${isChalk ? 'text-[#52525B]' : 'text-[#A1A1AA]'}`}>
              Google Review
            </div>
          </div>
        </div>

        {review.googleMapsUri && (
          <a
            href={review.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs font-semibold inline-flex items-center gap-1 shrink-0 hover:text-[#E8452C] transition-colors ${
              isChalk ? 'text-[#3F3F46]' : 'text-[#A1A1AA]'
            }`}
          >
            Google Maps
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

function LiveGoogleReviewsFeed({
  settings,
  onNavigate,
}: {
  settings: SiteSettings;
  onNavigate: (route: AppRoute) => void;
}) {
  const { status, data, errorMessage, reload } = useGoogleReviews(settings);

  if (status === 'loading') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading live Google reviews">
        <div className="rounded-[22px] bg-[#131316] border border-white/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="space-y-2.5">
            <div className="h-3 w-36 rounded bg-white/10" />
            <div className="h-8 w-56 rounded bg-white/10" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-36 rounded-[10px] bg-white/10" />
            <div className="h-10 w-36 rounded-[10px] bg-white/10" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className="rounded-[22px] bg-[#131316] border border-white/10 p-6 h-56 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-3.5 w-28 rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-5/6 rounded bg-white/10" />
                <div className="h-3 w-2/3 rounded bg-white/10" />
              </div>
              <div className="h-8 w-40 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-[22px] bg-[#131316] border border-white/12 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 font-mono text-xs text-[#E8452C]">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            LIVE GOOGLE REVIEWS UNAVAILABLE
          </div>
          <h2 className="text-xl font-semibold text-[#F4F4F0]">
            Could not load reviews from Google Maps right now.
          </h2>
          <p className="text-sm text-[#A1A1AA] leading-relaxed">{errorMessage}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={reload}
            className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#F4F4F0] text-[#121214] hover:bg-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry Live Fetch
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="min-h-[42px] px-4 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] inline-flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" aria-hidden="true" />
            Check Place ID
          </button>
        </div>
      </div>
    );
  }

  if (status === 'not_found' || !data) {
    return (
      <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] border border-black/10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="font-mono text-xs text-[#52525B]">
            GOOGLE BUSINESS PROFILE · PLACE ID NEEDED
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">
            Connect your Google Place ID to display your live Google reviews.
          </h2>
          <p className="text-sm text-[#3F3F46] leading-relaxed">
            Automatic Google Maps lookup did not find a public storefront match for{' '}
            <strong>{settings.businessName}</strong> (common for mobile service-area businesses).
            Paste your Google Business Profile Place ID in the Admin Console under{' '}
            <strong>Site Data &amp; Pricing</strong> to stream your verified Google reviews directly
            here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="min-h-[44px] px-5 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" aria-hidden="true" />
            Set Google Place ID in Admin
          </button>
          <a
            href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-4 py-2.5 rounded-[12px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#121214] inline-flex items-center gap-1.5"
          >
            Find Place ID
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Aggregate Google Business Profile Header */}
      <div className="rounded-[22px] bg-[#F4F4F0] text-[#121214] border border-black/10 p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="font-mono text-xs text-[#52525B]">
            GOOGLE MAPS · VERIFIED BUSINESS PROFILE
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#121214]">
              {data.displayName}
            </h2>
            {data.rating !== null && (
              <div className="inline-flex items-center gap-2.5">
                <span className="font-dot text-3xl font-extrabold text-[#121214] tabular-nums">
                  {data.rating.toFixed(1)}
                </span>
                <StarRatingRow rating={data.rating} lightSurface />
              </div>
            )}
          </div>
          <p className="text-xs text-[#3F3F46]">
            {data.userRatingCount > 0
              ? `Based on ${data.userRatingCount.toLocaleString('en-US')} Google ${
                  data.userRatingCount === 1 ? 'review' : 'reviews'
                } · Loaded live from Google Maps`
              : 'Connected to Google Maps · No published reviews yet'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {data.reviewsUri && (
            <a
              href={data.reviewsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-4 py-2 rounded-[10px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#121214] inline-flex items-center gap-2 whitespace-nowrap"
            >
              View All on Google Maps
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
          {data.writeReviewUri && (
            <a
              href={data.writeReviewUri}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-xs font-semibold text-white inline-flex items-center gap-2 whitespace-nowrap"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
              Write a Google Review
            </a>
          )}
        </div>
      </div>

      {/* Individual Verified Google Reviews */}
      {data.reviews.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {data.reviews.map((review, idx) => (
            <GoogleReviewCard key={review.id} review={review} isChalk={idx === 1} />
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] bg-[#131316] border border-white/10 p-8 text-center space-y-3">
          <p className="text-sm font-medium text-[#F4F4F0]">
            No written Google reviews have been published for {data.displayName} yet.
          </p>
          <p className="text-xs text-[#A1A1AA] max-w-md mx-auto">
            Have we repaired your scooter recently? Share your real experience directly on Google
            Maps.
          </p>
          {data.writeReviewUri && (
            <div className="pt-1">
              <a
                href={data.writeReviewUri}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-5 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-xs font-semibold text-white inline-flex items-center gap-2"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
                Leave the First Google Review
              </a>
            </div>
          )}
        </div>
      )}

      {/* Required Google Maps Attribution Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[#A1A1AA] px-1">
        <span>Reviews sourced live from Google Maps (showing Google&apos;s featured reviews).</span>
        {data.googleMapsUri && (
          <a
            href={data.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#F4F4F0] underline decoration-white/25 inline-flex items-center gap-1"
          >
            Powered by Google
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

export function RiderProof({ settings, hasMapsApiKey, onNavigate }: RiderProofProps) {
  const brandCount = settings.supportedBrands.length;
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

        {/* Live Google Reviews Section */}
        {hasMapsApiKey ? (
          <LiveGoogleReviewsFeed settings={settings} onNavigate={onNavigate} />
        ) : (
          <div className="rounded-[22px] bg-[#131316] border border-white/10 p-6 sm:p-8 space-y-2">
            <div className="font-mono text-xs text-[#E8452C]">GOOGLE MAPS CONFIGURATION</div>
            <h2 className="text-xl font-semibold text-[#F4F4F0]">
              Google Maps API key is not active in this preview environment.
            </h2>
            <p className="text-sm text-[#A1A1AA] max-w-2xl leading-relaxed">
              Live Google reviews require a configured Google Maps Platform API key with Places API
              (New) enabled. No placeholder reviews are displayed when the live feed is offline.
            </p>
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
