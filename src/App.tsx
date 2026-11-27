import { useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { TopBar } from './components/TopBar';
import { HomePage } from './components/HomePage';
import { ServiceMatrix } from './components/ServiceMatrix';
import { RiderProof } from './components/RiderProof';
import { BookingConsole, type ConfirmedBooking } from './components/BookingConsole';
import { PolicyPages } from './components/PolicyPages';
import { AdminConsole } from './components/AdminConsole';
import { CustomerAccountPortal } from './components/CustomerAccountPortal';
import { Footer } from './components/Footer';
import {
  DEFAULT_SITE_SETTINGS,
  SCOOTER_SERVICES,
  type ScooterService,
  type SiteSettings,
} from './data/scooterData';
import { subscribeServices, subscribeSiteSettings } from './services/firestoreService';
import { normalizeRoute, type AppRoute } from './types/routes';
import { calculateRepairEstimate } from './utils/repairCalculator';

const STORAGE_KEY_BOOKING = 'rain_city_scooter_confirmed_booking_v2';
const STORAGE_KEY_SERVICES = 'rain_city_scooter_selected_services_v2';
const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
const MAPS_LIBRARIES = ['places'];

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    normalizeRoute(window.location.pathname),
  );
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [services, setServices] = useState<ScooterService[]>(SCOOTER_SERVICES);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    readStoredJson<string[]>(STORAGE_KEY_SERVICES, ['silver-tune-up']),
  );
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(() =>
    readStoredJson<ConfirmedBooking | null>(STORAGE_KEY_BOOKING, null),
  );

  // Listen for Google Maps Platform Demo Key quota exhaustion events at top-level app state
  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Listen to browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      setCurrentRoute(normalizeRoute(window.location.pathname));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Subscribe to public Firestore SiteSettings & Services so admin edits reflect live
  useEffect(() => {
    const unsubSettings = subscribeSiteSettings(setSettings);
    const unsubServices = subscribeServices(setServices);
    return () => {
      unsubSettings();
      unsubServices();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(selectedServiceIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedServiceIds]);

  useEffect(() => {
    try {
      if (confirmedBooking) {
        window.localStorage.setItem(STORAGE_KEY_BOOKING, JSON.stringify(confirmedBooking));
      } else {
        window.localStorage.removeItem(STORAGE_KEY_BOOKING);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [confirmedBooking]);

  const navigate = (route: AppRoute) => {
    if (window.location.pathname !== route) {
      window.history.pushState({}, '', route);
    }
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const estimate = useMemo(
    () => calculateRepairEstimate(selectedServiceIds, services),
    [selectedServiceIds, services],
  );

  const handleToggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    );
  };

  const hasMapsApiKey = GOOGLE_MAPS_API_KEY.length > 0;

  const appShell = (
    <div id="top" className="min-h-screen flex flex-col bg-[#09090B] text-[#F4F4F0]">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <TopBar
        currentRoute={currentRoute}
        selectedCount={selectedServiceIds.length}
        settings={settings}
        onNavigate={navigate}
      />

      {settings.announcement.trim().length > 0 && (
        <div className="bg-[#141418] border-b border-white/10 py-2 px-4 text-center font-mono text-xs text-[#E4E4E7]">
          {settings.announcement}
        </div>
      )}

      <main className="flex-1">
        {currentRoute === '/' && (
          <HomePage
            services={services}
            settings={settings}
            selectedServiceIds={selectedServiceIds}
            onToggleService={handleToggleService}
            onNavigate={navigate}
          />
        )}

        {currentRoute === '/pricing' && (
          <ServiceMatrix
            services={services}
            settings={settings}
            selectedServiceIds={selectedServiceIds}
            estimate={estimate}
            onToggleService={handleToggleService}
            onProceedToBook={() => navigate('/book')}
          />
        )}

        {currentRoute === '/reviews' && (
          <RiderProof
            settings={settings}
            hasMapsApiKey={hasMapsApiKey}
            onNavigate={navigate}
          />
        )}

        {currentRoute === '/book' && (
          <BookingConsole
            services={services}
            settings={settings}
            selectedServiceIds={selectedServiceIds}
            estimate={estimate}
            confirmedBooking={confirmedBooking}
            onToggleService={handleToggleService}
            onConfirmBooking={(booking) => setConfirmedBooking(booking)}
            onResetBooking={() => setConfirmedBooking(null)}
            onNavigate={navigate}
          />
        )}

        {(currentRoute === '/warranty' ||
          currentRoute === '/terms' ||
          currentRoute === '/privacy') && (
          <PolicyPages
            activePolicy={currentRoute}
            settings={settings}
            onNavigate={navigate}
          />
        )}

        {currentRoute === '/account' && (
          <CustomerAccountPortal settings={settings} onNavigate={navigate} />
        )}

        {currentRoute === '/admin' && (
          <AdminConsole services={services} settings={settings} onNavigate={navigate} />
        )}
      </main>

      <Footer settings={settings} onNavigate={navigate} />
    </div>
  );

  if (!hasMapsApiKey) {
    return appShell;
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      version="weekly"
      language="en"
      region="US"
      libraries={MAPS_LIBRARIES}
      solutionChannel="gmp_mcp_codeassist_v1_aistudio"
    >
      {appShell}
    </APIProvider>
  );
}
