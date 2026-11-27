import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWriteReviewFallbackUrl,
  doesPlaceMatchBusinessName,
  getAuthorInitials,
  isMapsQuotaError,
  normalizeGoogleReviews,
  sanitizeGooglePlaceId,
  toSafeHttpsUrl,
} from './googleReviewsHelpers.ts';

test('sanitizeGooglePlaceId strips whitespace and disallowed characters', () => {
  assert.equal(sanitizeGooglePlaceId('  ChIJ_abc-123!@#  '), 'ChIJ_abc-123');
  assert.equal(sanitizeGooglePlaceId(''), '');
});

test('toSafeHttpsUrl permits only https links and rejects javascript/http', () => {
  assert.equal(
    toSafeHttpsUrl('https://maps.google.com/?cid=12345'),
    'https://maps.google.com/?cid=12345',
  );
  assert.equal(toSafeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(toSafeHttpsUrl('http://example.com'), null);
  assert.equal(toSafeHttpsUrl('not-a-url'), null);
});

test('doesPlaceMatchBusinessName accepts genuine business matches and rejects unrelated shops', () => {
  assert.equal(doesPlaceMatchBusinessName('Rain City Scooter', 'Rain City Scooter'), true);
  assert.equal(
    doesPlaceMatchBusinessName('Rain City Scooter Mobile Repair', 'Rain City Scooter'),
    true,
  );
  assert.equal(doesPlaceMatchBusinessName('Seattle E-Bike Co', 'Rain City Scooter'), false);
  assert.equal(doesPlaceMatchBusinessName('', 'Rain City Scooter'), false);
});

test('normalizeGoogleReviews preserves author attribution, ratings, and safe links', () => {
  const reviews = normalizeGoogleReviews(
    [
      {
        rating: 5,
        text: 'Fast on-site tire swap right outside my building.',
        relativePublishTimeDescription: '2 weeks ago',
        publishTime: new Date('2026-10-01T18:00:00.000Z'),
        googleMapsURI: 'https://www.google.com/maps/reviews/data=abc',
        authorAttribution: {
          displayName: 'Alex Rivera',
          uri: 'https://www.google.com/maps/contrib/123',
          photoURI: 'https://lh3.googleusercontent.com/a/avatar',
        },
      },
      {
        rating: 4,
        text: '',
        relativePublishTimeDescription: '1 month ago',
        authorAttribution: {
          displayName: 'Sam',
          uri: 'javascript:alert(1)',
        },
      },
    ],
    'https://maps.google.com/?cid=999',
  );

  assert.equal(reviews.length, 2);
  assert.equal(reviews[0].authorName, 'Alex Rivera');
  assert.equal(reviews[0].rating, 5);
  assert.equal(reviews[0].authorUri, 'https://www.google.com/maps/contrib/123');
  assert.equal(reviews[0].googleMapsUri, 'https://www.google.com/maps/reviews/data=abc');

  assert.equal(reviews[1].authorName, 'Sam');
  assert.equal(reviews[1].authorUri, null);
  assert.equal(reviews[1].googleMapsUri, 'https://maps.google.com/?cid=999');
});

test('getAuthorInitials and buildWriteReviewFallbackUrl handle edge cases', () => {
  assert.equal(getAuthorInitials('Jordan Lee'), 'JL');
  assert.equal(getAuthorInitials('Jordan'), 'JO');
  assert.equal(getAuthorInitials(''), 'GR');
  assert.equal(
    buildWriteReviewFallbackUrl('ChIJ123_abc'),
    'https://search.google.com/local/writereview?placeid=ChIJ123_abc',
  );
  assert.equal(buildWriteReviewFallbackUrl(''), null);
});

test('isMapsQuotaError detects quota errors without false positives on empty results', () => {
  assert.equal(isMapsQuotaError(new Error('RESOURCE_EXHAUSTED: daily limit')), true);
  assert.equal(isMapsQuotaError(new Error('OVER_QUERY_LIMIT')), true);
  assert.equal(isMapsQuotaError(new Error('HTTP 429 Too Many Requests')), true);
  assert.equal(isMapsQuotaError(new Error('No places found')), false);
  assert.equal(isMapsQuotaError(new Error('Network offline')), false);
});
