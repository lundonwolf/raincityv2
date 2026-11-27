import type { MouseEvent } from 'react';
import type { SiteSettings } from '../data/scooterData';
import type { AppRoute } from '../types/routes';

interface FooterProps {
  settings: SiteSettings;
  onNavigate: (route: AppRoute) => void;
}

export function Footer({ settings, onNavigate }: FooterProps) {
  const phoneHref = `tel:+1${settings.phoneDisplay.replace(/\D/g, '')}`;

  const go = (event: MouseEvent<HTMLAnchorElement>, route: AppRoute) => {
    event.preventDefault();
    onNavigate(route);
  };

  return (
    <footer className="border-t border-white/10 bg-[#09090B] py-12">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="space-y-2">
          <a
            href="/"
            onClick={(e) => go(e, '/')}
            className="font-dot text-lg font-bold text-[#F4F4F0]"
          >
            {settings.businessName}
          </a>
          <p className="text-xs text-[#A1A1AA] leading-relaxed max-w-xs">
            {settings.footerNote.trim()
              ? settings.footerNote
              : `${settings.tagline} ${settings.hoursShort}.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 text-xs">
          <nav aria-label="Footer site navigation" className="space-y-2.5">
            <div className="font-mono text-[11px] text-[#71717A]">NAVIGATION</div>
            <div className="flex flex-col gap-2 text-[#A1A1AA]">
              <a href="/" onClick={(e) => go(e, '/')} className="hover:text-[#F4F4F0]">
                Home & Cockpit
              </a>
              <a href="/pricing" onClick={(e) => go(e, '/pricing')} className="hover:text-[#F4F4F0]">
                Pricing & Services
              </a>
              <a href="/reviews" onClick={(e) => go(e, '/reviews')} className="hover:text-[#F4F4F0]">
                Reviews
              </a>
              <a href="/book" onClick={(e) => go(e, '/book')} className="hover:text-[#F4F4F0]">
                Book Repair
              </a>
              <a href="/account" onClick={(e) => go(e, '/account')} className="hover:text-[#F4F4F0]">
                My Account
              </a>
            </div>
          </nav>

          <nav aria-label="Policy and admin links" className="space-y-2.5">
            <div className="font-mono text-[11px] text-[#71717A]">POLICIES & ADMIN</div>
            <div className="flex flex-col gap-2 text-[#A1A1AA]">
              <a href="/warranty" onClick={(e) => go(e, '/warranty')} className="hover:text-[#F4F4F0]">
                Warranty & Returns
              </a>
              <a href="/terms" onClick={(e) => go(e, '/terms')} className="hover:text-[#F4F4F0]">
                Terms of Service
              </a>
              <a href="/privacy" onClick={(e) => go(e, '/privacy')} className="hover:text-[#F4F4F0]">
                Privacy Policy
              </a>
              <a href="/admin" onClick={(e) => go(e, '/admin')} className="hover:text-[#E8452C]">
                Admin Console
              </a>
            </div>
          </nav>
        </div>

        <div className="flex flex-col md:items-end gap-1.5 text-xs font-mono text-[#A1A1AA]">
          <a href={phoneHref} className="text-[#F4F4F0] hover:text-[#E8452C] transition-colors">
            {settings.phoneDisplay}
          </a>
          <a href={`mailto:${settings.email}`} className="hover:text-[#F4F4F0] transition-colors">
            {settings.email}
          </a>
          <span className="text-[11px] text-[#A1A1AA]">{settings.dispatchPolicyNote}</span>
          <span className="text-[11px] text-[#71717A] pt-1">
            © {new Date().getFullYear()} {settings.businessName}
          </span>
        </div>
      </div>
    </footer>
  );
}
