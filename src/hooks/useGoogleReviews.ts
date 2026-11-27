import { useCallback, useEffect, useState } from 'react';
import { APILoadingStatus, useApiLoadingStatus, useMapsLibrary } from '@vis.gl/react-google-maps';
import type { SiteSettings } from '../data/scooterData';
import {
  buildWriteReviewFallbackUrl,
  doesPlaceMatchBusinessName,
  isMapsQuotaError,
  normalizeGoogleReviews,
  sanitizeGooglePlaceId,
  toSafeHttpsUrl,
  type GooglePlaceReviewsData,
  type RawGoogleReviewLike,
} from '../utils/googleReviewsHelpers';

export type GoogleReviewsStatus =
  | 'loading'
  | 'loaded'
  | 'not_found'
  | 'error';

export interface UseGoogleReviewsResult {
  status: GoogleReviewsStatus;
  data: GooglePlaceReviewsData | null;
  errorMessage: string;
  reload: () => void;
}

const GMP_USAGE_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

const PLACE_FIELDS_WITH_LINKS = [
  'id',
  'displayName',
  'rating',
  'userRatingCount',
  'reviews',
  'googleMapsURI',
  'googleMapsLinks',
] as const;

const PLACE_FIELDS_CORE = [
  'id',
  'displayName',
  'rating',
  'userRatingCount',
  'reviews',
  'googleMapsURI',
] as const;

interface PlaceLike {
  id?: string | null;
  displayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  reviews?: readonly RawGoogleReviewLike[] | null;
  googleMapsURI?: string | null;
  googleMapsLinks?: {
    reviewsURI?: string | null;
    writeAReviewURI?: string | null;
    placeURI?: string | null;
  } | null;
  fetchFields: (options: { fields: readonly string[] }) => Promise<{ place: PlaceLike }>;
}

function mapPlaceToReviewsData(place: PlaceLike, fallbackName: string): GooglePlaceReviewsData {
  const placeId = sanitizeGooglePlaceId(place.id ?? '');
  const googleMapsUri =
    toSafeHttpsUrl(place.googleMapsLinks?.placeURI) ?? toSafeHttpsUrl(place.googleMapsURI);
  const reviewsUri = toSafeHttpsUrl(place.googleMapsLinks?.reviewsURI) ?? googleMapsUri;
  const writeReviewUri =
    toSafeHttpsUrl(place.googleMapsLinks?.writeAReviewURI) ??
    buildWriteReviewFallbackUrl(placeId);

  const rating =
    typeof place.rating === 'number' && Number.isFinite(place.rating)
      ? Math.round(place.rating * 10) / 10
      : null;

  const userRatingCount =
    typeof place.userRatingCount === 'number' && Number.isFinite(place.userRatingCount)
      ? Math.max(0, Math.round(place.userRatingCount))
      : 0;

  return {
    placeId,
    displayName: (place.displayName ?? '').trim() || fallbackName,
    rating,
    userRatingCount,
    googleMapsUri,
    reviewsUri,
    writeReviewUri,
    reviews: normalizeGoogleReviews(place.reviews, googleMapsUri),
  };
}

/**
 * Fetches live Google Business Profile reviews via Places API (New) (`Place` class).
 * Reviews are never cached in Firestore or localStorage to stay compliant with Google Maps Platform Terms.
 * See: https://developers.google.com/maps/documentation/javascript/place-details?utm_campaign=gmp_mcp_codeassist_v1_aistudio
 */
export function useGoogleReviews(settings: SiteSettings): UseGoogleReviewsResult {
  const placesLib = useMapsLibrary('places');
  const apiStatus = useApiLoadingStatus();

  const [status, setStatus] = useState<GoogleReviewsStatus>('loading');
  const [data, setData] = useState<GooglePlaceReviewsData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  const configuredPlaceId = sanitizeGooglePlaceId(settings.googlePlaceId ?? '');
  const businessName = (settings.businessName || 'Rain City Scooter').trim();

  useEffect(() => {
    if (apiStatus === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      setStatus('error');
      setErrorMessage(
        'Google Maps Platform authorization or daily quota limit was reached while loading live reviews.',
      );
      return;
    }

    if (apiStatus === APILoadingStatus.FAILED) {
      setStatus('error');
      setErrorMessage('Unable to load the Google Maps Places library. Please check your connection.');
      return;
    }

    if (!placesLib) {
      setStatus('loading');
      return;
    }

    let cancelled = false;

    const fetchWithFallbackFields = async (placeInstance: PlaceLike): Promise<PlaceLike> => {
      try {
        const result = await placeInstance.fetchFields({ fields: [...PLACE_FIELDS_WITH_LINKS] });
        return result?.place ?? placeInstance;
      } catch (err) {
        if (isMapsQuotaError(err)) {
          throw err;
        }
        // Retry with core fields if googleMapsLinks is unavailable on the loaded SDK channel
        const fallbackResult = await placeInstance.fetchFields({ fields: [...PLACE_FIELDS_CORE] });
        return fallbackResult?.place ?? placeInstance;
      }
    };

    const loadReviews = async () => {
      setStatus('loading');
      setErrorMessage('');

      try {
        const PlaceCtor = placesLib.Place as unknown as {
          new (options: { id: string; requestedLanguage?: string; requestedRegion?: string }): PlaceLike;
          searchByText: (request: Record<string, unknown>) => Promise<{ places?: PlaceLike[] }>;
        };

        // 1. Direct Place ID lookup when owner configured their exact Google Business Profile Place ID
        if (configuredPlaceId) {
          const placeInstance = new PlaceCtor({
            id: configuredPlaceId,
            requestedLanguage: 'en',
            requestedRegion: 'US',
          });
          const hydrated = await fetchWithFallbackFields(placeInstance);
          if (cancelled) return;

          setData(mapPlaceToReviewsData(hydrated, businessName));
          setStatus('loaded');
          return;
        }

        // 2. Live Places API (New) Text Search lookup for Rain City Scooter in Seattle, WA
        const searchResponse = await PlaceCtor.searchByText({
          textQuery: `${businessName} Seattle WA`,
          fields: ['id', 'displayName', 'rating', 'userRatingCount', 'reviews', 'googleMapsURI'],
          maxResultCount: 3,
          language: 'en',
          region: 'US',
          internalUsageAttributionIds: [GMP_USAGE_ATTRIBUTION_ID],
        });

        if (cancelled) return;

        const candidates = Array.isArray(searchResponse?.places) ? searchResponse.places : [];
        const matchedPlace = candidates.find((candidate) =>
          doesPlaceMatchBusinessName(candidate?.displayName, businessName),
        );

        if (!matchedPlace || !matchedPlace.id) {
          setData(null);
          setStatus('not_found');
          return;
        }

        // Hydrate full review details + Google Maps links for the matched listing
        const detailInstance = new PlaceCtor({
          id: matchedPlace.id,
          requestedLanguage: 'en',
          requestedRegion: 'US',
        });

        let hydrated: PlaceLike = matchedPlace;
        try {
          hydrated = await fetchWithFallbackFields(detailInstance);
        } catch (detailErr) {
          if (isMapsQuotaError(detailErr)) {
            throw detailErr;
          }
          // Fall back to the fields already returned by searchByText if detail hydration fails
          hydrated = matchedPlace;
        }

        if (cancelled) return;

        setData(mapPlaceToReviewsData(hydrated, businessName));
        setStatus('loaded');
      } catch (err) {
        if (cancelled) return;

        if (isMapsQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          setData(null);
          setStatus('error');
          setErrorMessage(
            'Google Maps Platform quota limit was reached. Live reviews will resume once quota resets or billing is updated.',
          );
          return;
        }

        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Unable to reach Google Places right now.';
        setData(null);
        setStatus('error');
        setErrorMessage(msg);
      }
    };

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [placesLib, apiStatus, configuredPlaceId, businessName, reloadTick]);

  return {
    status,
    data,
    errorMessage,
    reload,
  };
}
