export type AppRoute =
  | '/'
  | '/pricing'
  | '/reviews'
  | '/book'
  | '/account'
  | '/warranty'
  | '/terms'
  | '/privacy'
  | '/admin';

const VALID_ROUTES: readonly AppRoute[] = [
  '/',
  '/pricing',
  '/reviews',
  '/book',
  '/account',
  '/warranty',
  '/terms',
  '/privacy',
  '/admin',
];

export function normalizeRoute(pathname: string): AppRoute {
  const cleaned = pathname.replace(/\/+$/, '') || '/';
  if ((VALID_ROUTES as readonly string[]).includes(cleaned)) {
    return cleaned as AppRoute;
  }
  return '/';
}
