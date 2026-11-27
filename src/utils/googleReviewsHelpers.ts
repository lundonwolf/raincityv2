export interface GoogleReviewItem {
  id: string;
  authorName: string;
  authorUri: string | null;
  authorPhotoUri: string | null;
  rating: number | null;
  relativePublishTimeDescription: string;
  publishTime: string | null;
  text: string;
  googleMapsUri: string | null;
}

export interface GooglePlaceReviewsData {
  placeId: string;
  displayName: string;
  rating: number | null;
  userRatingCount: number;
  googleMapsUri: string | null;
  reviewsUri: string | null;
  writeReviewUri: string | null;
  reviews: GoogleReviewItem[];
}

export interface RawGoogleReviewLike {
  rating?: number | null;
  text?: string | null;
  relativePublishTimeDescription?: string | null;
  publishTime?: Date | string | null;
  googleMapsURI?: string | null;
  authorAttribution?: {
    displayName?: string | null;
    uri?: string | null;
    photoURI?: string | null;
  } | null;
}

export function sanitizeGooglePlaceId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

/**
 * Only permit https: external URLs returned by Google Places / author attributions
 * to prevent javascript: or data: URI injection.
 */
export function toSafeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifies a Places Text Search candidate actually matches the configured business name
 * so unrelated businesses are never displayed as Rain City Scooter.
 */
export function doesPlaceMatchBusinessName(
  candidateDisplayName: string | null | undefined,
  businessName: string,
): boolean {
  const candidate = (candidateDisplayName ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const target = businessName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  if (!candidate || !target) return false;
  if (candidate.includes(target) || target.includes(candidate)) return true;

  const targetTokens = target.split(/\s+/).filter((token) => token.length >= 3);
  if (targetTokens.length === 0) return false;
  return targetTokens.every((token) => candidate.includes(token));
}

export function buildWriteReviewFallbackUrl(placeId: string): string | null {
  const cleanId = sanitizeGooglePlaceId(placeId);
  if (!cleanId) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(cleanId)}`;
}

export function getAuthorInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'GR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function normalizeGoogleReviews(
  rawReviews: readonly RawGoogleReviewLike[] | null | undefined,
  fallbackPlaceUri: string | null,
): GoogleReviewItem[] {
  if (!Array.isArray(rawReviews)) return [];

  const safePlaceUri = toSafeHttpsUrl(fallbackPlaceUri);
  const items: GoogleReviewItem[] = [];

  rawReviews.forEach((raw, idx) => {
    const authorName = (raw.authorAttribution?.displayName ?? '').trim() || 'Google Reviewer';
    const text = (raw.text ?? '').trim();
    const rating =
      typeof raw.rating === 'number' && Number.isFinite(raw.rating)
        ? Math.max(1, Math.min(5, Math.round(raw.rating * 10) / 10))
        : null;
    const relativePublishTimeDescription = (raw.relativePublishTimeDescription ?? '').trim();

    let publishTime: string | null = null;
    if (raw.publishTime instanceof Date && !Number.isNaN(raw.publishTime.getTime())) {
      publishTime = raw.publishTime.toISOString();
    } else if (typeof raw.publishTime === 'string' && raw.publishTime.trim()) {
      publishTime = raw.publishTime.trim();
    }

    // Keep only genuine reviews that have either written text or a verified rating
    if (!text && rating === null) return;

    items.push({
      id: `${idx}-${authorName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${publishTime ?? relativePublishTimeDescription}`,
      authorName,
      authorUri: toSafeHttpsUrl(raw.authorAttribution?.uri),
      authorPhotoUri: toSafeHttpsUrl(raw.authorAttribution?.photoURI),
      rating,
      relativePublishTimeDescription,
      publishTime,
      text,
      googleMapsUri: toSafeHttpsUrl(raw.googleMapsURI) ?? safePlaceUri,
    });
  });

  return items;
}

export function isMapsQuotaError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error ?? '');
  return /OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|OverQuotaMapError|QuotaExceeded|429|quota/i.test(text);
}
