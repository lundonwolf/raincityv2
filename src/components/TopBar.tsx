import { useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import type { SiteSettings } from '../data/scooterData';
import type { AppRoute } from '../types/routes';

interface TopBarProps {
  currentRoute: AppRoute;
  selectedCount: number;
  settings: SiteSettings;
  onNavigate: (route: AppRoute) => void;
}

const NAV_LINKS: { route: AppRoute; label: string; matchRoutes?: AppRoute[] }[] = [
  { route: '/pricing', label: 'Pricing' },
  { route: '/reviews', label: 'Reviews' },
  { route: '/warranty', label: 'Policies', matchRoutes: ['/warranty', '/terms', '/privacy'] },
  { route: '/admin', label: 'Admin' },
];

export function TopBar({ currentRoute, selectedCount, settings, onNavigate }: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, route: AppRoute) => {
    event.preventDefault();
    setMobileOpen(false);
    onNavigate(route);
  };

  const handleBook = () => {
    setMobileOpen(false);
    onNavigate('/book');
  };

  return (
    <header className="sticky top-0 z-40 h-16 bg-[#09090B]/92 backdrop-blur-md border-b border-white/10">
      <div className="max-w-[1280px] mx-auto h-full px-4 sm:px-8 flex items-center justify-between gap-3 md:gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, '/')}
          className="font-dot text-base sm:text-xl font-bold tracking-tight text-[#F4F4F0] whitespace-nowrap shrink-0 hover:text-white transition-colors"
        >
          {settings.businessName}
        </a>

        {/* Zone 2: 5 single-line page links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium text-[#A1A1AA]"
        >
          {NAV_LINKS.map((link) => {
            const isActive = link.matchRoutes
              ? link.matchRoutes.includes(currentRoute)
              : currentRoute === link.route;
            return (
              <a
                key={link.route}
                href={link.route}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleLinkClick(e, link.route)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors underline-offset-4 ${
                  isActive
                    ? 'text-[#F4F4F0] underline decoration-[#E8452C] decoration-2'
                    : 'hover:text-[#F4F4F0] hover:underline decoration-[#E8452C]'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA + mobile menu toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleBook}
            className="min-h-[40px] px-3 sm:px-4 py-2 rounded-lg bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <span className="sm:hidden">
              {selectedCount > 0 ? `Book (${selectedCount})` : 'Book'}
            </span>
            <span className="hidden sm:inline">
              {selectedCount > 0 ? `Book Repair (${selectedCount})` : 'Book Repair'}
            </span>
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-lg border border-white/15 text-[#F4F4F0] hover:bg-white/10 transition-colors cursor-pointer"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden bg-[#111114] border-b border-white/10 px-5 py-4 flex flex-col gap-1"
        >
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            className={`min-h-[44px] flex items-center text-base font-medium border-b border-white/5 ${
              currentRoute === '/' ? 'text-[#E8452C]' : 'text-[#E4E4E7]'
            }`}
          >
            Home & Cockpit
          </a>
          {NAV_LINKS.map((link) => {
            const isActive = link.matchRoutes
              ? link.matchRoutes.includes(currentRoute)
              : currentRoute === link.route;
            return (
              <a
                key={link.route}
                href={link.route}
                onClick={(e) => handleLinkClick(e, link.route)}
                className={`min-h-[44px] flex items-center text-base font-medium border-b border-white/5 last:border-b-0 ${
                  isActive ? 'text-[#E8452C]' : 'text-[#E4E4E7]'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      )}
    </header>
  );
}
