import type { CodeSnippetPlacement, CodeSnippetRecord } from '../data/scooterData';

export interface SnippetPlacementMeta {
  id: CodeSnippetPlacement;
  label: string;
  shortBadge: string;
  description: string;
  examples: string;
}

export const CODE_SNIPPET_PLACEMENTS: SnippetPlacementMeta[] = [
  {
    id: 'reviews_section',
    label: 'Reviews Page · Live Reviews Box',
    shortBadge: 'REVIEWS PAGE',
    description:
      'Renders directly inside the Reviews section on /reviews (floating review badges are automatically docked neatly inside the box).',
    examples: 'Trustindex, Elfsight, EmbedSocial, or Google reviews embed',
  },
  {
    id: 'head',
    label: 'Site-Wide <head> (Analytics & Meta)',
    shortBadge: 'GLOBAL <HEAD>',
    description:
      'Injected into the page <head> on all public pages (automatically paused inside /admin for safety).',
    examples: 'Google Analytics (GA4), Google Search Console meta tag, Meta Pixel, custom CSS',
  },
  {
    id: 'body_end',
    label: 'Site-Wide Body / Floating Widget',
    shortBadge: 'GLOBAL FOOTER',
    description:
      'Mounted across all public pages (automatically paused inside /admin for safety). Ideal for floating widgets or chat bubbles.',
    examples: 'Live chat widget, floating Trustindex badge, call tracking script',
  },
  {
    id: 'home_section',
    label: 'Home Page · Custom Embed Section',
    shortBadge: 'HOME PAGE',
    description:
      'Renders cleanly in a dedicated section on the Home page below the Seattle studio showcase.',
    examples: 'Reviews slider, promo video iframe, Instagram feed, announcement embed',
  },
  {
    id: 'booking_section',
    label: 'Booking Page · Below Form Embed',
    shortBadge: 'BOOKING PAGE',
    description: 'Renders cleanly on /book below the booking console.',
    examples: 'Trust badge, scheduling helper widget, financing/warranty embed',
  },
];

export const SNIPPET_STARTER_TEMPLATES: {
  id: string;
  label: string;
  name: string;
  placement: CodeSnippetPlacement;
  code: string;
}[] = [
  {
    id: 'trustindex',
    label: 'Trustindex Reviews',
    name: 'Google Reviews Widget (Trustindex)',
    placement: 'reviews_section',
    code: "<script defer async src='https://cdn.trustindex.io/loader.js?630546f86466713ee556f97ca06'></script>",
  },
  {
    id: 'ga4',
    label: 'Google Analytics (GA4)',
    name: 'Google Analytics 4',
    placement: 'head',
    code: `<!-- Replace G-XXXXXXXXXX with your GA4 Measurement ID -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`,
  },
  {
    id: 'custom-embed',
    label: 'Custom Widget / HTML',
    name: 'Custom Site Widget',
    placement: 'home_section',
    code: '<div class="text-sm text-center py-2">Paste your third-party widget HTML or &lt;script&gt; embed here.</div>',
  },
];

const VALID_PLACEMENTS = new Set<CodeSnippetPlacement>(
  CODE_SNIPPET_PLACEMENTS.map((p) => p.id),
);

export function isValidSnippetPlacement(value: unknown): value is CodeSnippetPlacement {
  return typeof value === 'string' && VALID_PLACEMENTS.has(value as CodeSnippetPlacement);
}

export function getPlacementMeta(placement: CodeSnippetPlacement): SnippetPlacementMeta {
  return (
    CODE_SNIPPET_PLACEMENTS.find((p) => p.id === placement) ?? CODE_SNIPPET_PLACEMENTS[0]
  );
}

export function generateSnippetId(name: string, now: number = Date.now()): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  const suffix = String(now).slice(-5);
  const base = slug.length >= 2 ? slug : 'snippet';
  return `${base}-${suffix}`.slice(0, 64);
}

export function isSafeSnippetUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  // Allow root-relative or protocol-relative URLs
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface SnippetValidationResult {
  valid: boolean;
  errors: {
    name?: string;
    placement?: string;
    code?: string;
  };
}

export function validateCodeSnippetInput(input: {
  name: string;
  placement: string;
  code: string;
}): SnippetValidationResult {
  const errors: SnippetValidationResult['errors'] = {};
  const trimmedName = input.name.trim();
  const trimmedCode = input.code.trim();

  if (trimmedName.length < 2) {
    errors.name = 'Give this snippet a clear name (at least 2 characters).';
  } else if (trimmedName.length > 100) {
    errors.name = 'Snippet name must be 100 characters or fewer.';
  }

  if (!isValidSnippetPlacement(input.placement)) {
    errors.placement = 'Choose a valid placement on your site.';
  }

  if (trimmedCode.length === 0) {
    errors.code = 'Paste the embed or script code snippet before saving.';
  } else if (trimmedCode.length > 10000) {
    errors.code = 'Code snippet must be 10,000 characters or fewer.';
  } else if (/(?:href|src)\s*=\s*['"]?\s*(?:javascript|vbscript):/i.test(trimmedCode)) {
    errors.code = 'Blocked unsafe javascript: or vbscript: URL inside snippet attributes.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getEnabledSnippetsForPlacement(
  snippets: CodeSnippetRecord[],
  placement: CodeSnippetPlacement,
): CodeSnippetRecord[] {
  return snippets
    .filter((s) => s.enabled && s.placement === placement && s.code.trim().length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getSnippetCodePreview(code: string, maxLen: number = 110): string {
  const collapsed = code.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLen) return collapsed;
  return `${collapsed.slice(0, maxLen - 1)}…`;
}
