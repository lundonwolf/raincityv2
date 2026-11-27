import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Check,
  ExternalLink,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  OPERATING_DAYS,
  SCOOTER_SERVICES,
  TIME_WINDOWS,
  type BookingRecord,
  type BookingStatus,
  type CustomerProfileRecord,
  type OperatingDay,
  type PricingType,
  type ScooterService,
  type ServiceCategory,
  type SiteSettings,
  type TimeWindow,
} from '../data/scooterData';
import { auth, BOOTSTRAPPED_ADMIN_EMAILS, googleProvider } from '../lib/firebase';
import {
  checkIsAdminDocument,
  deleteAdminBooking,
  deleteAdminCustomer,
  deleteServiceItem,
  saveAdminCustomer,
  saveServiceItem,
  saveSiteSettings,
  seedDefaultServicesToFirestore,
  subscribeAdminBookings,
  subscribeAdminCustomers,
  updateAdminBooking,
} from '../services/firestoreService';
import {
  deriveCustomersFromBookings,
  formatServicePrice,
  type AggregatedCustomer,
} from '../utils/repairCalculator';
import { AdminAnalyticsPanel } from './AdminAnalyticsPanel';

interface AdminConsoleProps {
  services: ScooterService[];
  settings: SiteSettings;
}

type AdminTab = 'bookings' | 'analytics' | 'customers' | 'site';

const BOOKING_STATUSES: BookingStatus[] = [
  'new',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function AdminConsole({ services, settings }: AdminConsoleProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('bookings');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerProfileRecord[]>([]);
  const [dataError, setDataError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Bookings filter & editor state
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [editingBooking, setEditingBooking] = useState<BookingRecord | null>(null);
  const [confirmDeleteBookingId, setConfirmDeleteBookingId] = useState<string | null>(null);
  const [savingBooking, setSavingBooking] = useState(false);

  // Customers CRM editor state
  const [customerSearch, setCustomerSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<
    Omit<CustomerProfileRecord, 'updatedAtIso'> | null
  >(null);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Site settings & service pricing editor state
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingService, setEditingService] = useState<ScooterService | null>(null);
  const [includesDraftText, setIncludesDraftText] = useState('');
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthError('');
      if (!nextUser) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const emailLower = (nextUser.email ?? '').toLowerCase();
      const verified = Boolean(nextUser.emailVerified);
      const isBootstrapped = verified && BOOTSTRAPPED_ADMIN_EMAILS.includes(emailLower);

      if (isBootstrapped) {
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      const hasAdminDoc = verified ? await checkIsAdminDocument(nextUser.uid) : false;
      setIsAdmin(hasAdminDoc);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to protected Firestore collections ONLY once verified as admin
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setBookings([]);
      setCustomers([]);
      return;
    }

    setDataError('');
    const unsubBookings = subscribeAdminBookings(
      (list) => setBookings(list),
      (err) => setDataError(err.message),
    );
    const unsubCustomers = subscribeAdminCustomers(
      (list) => setCustomers(list),
      (err) => setDataError(err.message),
    );

    return () => {
      unsubBookings();
      unsubCustomers();
    };
  }, [authReady, isAdmin]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(''), 4000);
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in was cancelled or blocked.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setEditingBooking(null);
    setEditingCustomer(null);
    setEditingService(null);
  };

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.referenceId.toLowerCase().includes(q) ||
        b.riderName.toLowerCase().includes(q) ||
        b.contactEmail.toLowerCase().includes(q) ||
        b.scooterModel.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q)
      );
    });
  }, [bookings, statusFilter, bookingSearch]);

  const aggregatedCustomers = useMemo<AggregatedCustomer[]>(() => {
    const merged = deriveCustomersFromBookings(bookings, customers);
    const q = customerSearch.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.scooterModel.toLowerCase().includes(q),
    );
  }, [bookings, customers, customerSearch]);

  const handleSaveBookingEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    setSavingBooking(true);
    setDataError('');
    try {
      await updateAdminBooking(editingBooking.id, {
        riderName: editingBooking.riderName,
        contactEmail: editingBooking.contactEmail,
        contactPhone: editingBooking.contactPhone,
        scooterModel: editingBooking.scooterModel,
        address: editingBooking.address,
        preferredDay: editingBooking.preferredDay,
        preferredWindow: editingBooking.preferredWindow,
        serviceIds: editingBooking.serviceIds,
        serviceTitles: editingBooking.serviceTitles,
        estimatedLaborLabel: editingBooking.estimatedLaborLabel,
        estimatedMinutes: editingBooking.estimatedMinutes,
        notes: editingBooking.notes,
        adminNotes: editingBooking.adminNotes,
        status: editingBooking.status,
      });
      setEditingBooking(null);
      showToast(`Saved booking ${editingBooking.referenceId}.`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to update booking.');
    } finally {
      setSavingBooking(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      await deleteAdminBooking(bookingId);
      setConfirmDeleteBookingId(null);
      if (editingBooking?.id === bookingId) setEditingBooking(null);
      showToast('Booking deleted.');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to delete booking.');
    }
  };

  const handleOpenCustomerEditor = (cust: AggregatedCustomer) => {
    setEditingCustomer({
      id: cust.profileId,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      address: cust.address,
      scooterModel: cust.scooterModel,
      serialNumber: cust.serialNumber,
      mechanicNotes: cust.mechanicNotes,
    });
  };

  const handleCreateNewCustomer = () => {
    setEditingCustomer({
      id: `cust-${Date.now()}`,
      name: '',
      email: '',
      phone: '',
      address: '',
      scooterModel: '',
      serialNumber: '',
      mechanicNotes: '',
    });
  };

  const handleSaveCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (editingCustomer.name.trim().length < 2 || !editingCustomer.email.includes('@')) {
      setDataError('Customer name and valid email address are required.');
      return;
    }
    setSavingCustomer(true);
    setDataError('');
    try {
      await saveAdminCustomer(editingCustomer);
      setEditingCustomer(null);
      showToast(`Saved customer profile for ${editingCustomer.name}.`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to save customer profile.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomerProfile = async (profileId: string) => {
    try {
      await deleteAdminCustomer(profileId);
      showToast('Saved customer profile removed.');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to remove customer profile.');
    }
  };

  const handleSaveSiteSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setDataError('');
    try {
      await saveSiteSettings(settingsDraft);
      showToast('Site settings saved live to Firestore.');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to save site settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const openServiceEditor = (svc: ScooterService) => {
    setEditingService({ ...svc });
    setIncludesDraftText(svc.includes.join('\n'));
  };

  const openNewServiceEditor = () => {
    const nextNum = String(services.length + 1).padStart(2, '0');
    setEditingService({
      id: `custom-service-${Date.now()}`,
      index: nextNum,
      title: '',
      shortLabel: '',
      category: 'standup',
      categoryLabel: 'Stand-Up Labor',
      pricingType: 'hourly',
      price: settings.hourlyRate,
      durationMinutes: 45,
      mode: 'mobile',
      summary: '',
      includes: ['Scope confirmed before work'],
      featuredTone: 'dark',
      active: true,
      sortOrder: services.length + 1,
    });
    setIncludesDraftText('Scope confirmed before work');
  };

  const handleSaveService = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    if (editingService.title.trim().length < 2 || editingService.summary.trim().length < 4) {
      setDataError('Service title and summary are required.');
      return;
    }
    setSavingService(true);
    setDataError('');
    try {
      const includesList = includesDraftText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      await saveServiceItem({
        ...editingService,
        includes: includesList.length > 0 ? includesList : ['Scope confirmed before work'],
      });
      setEditingService(null);
      showToast(`Saved "${editingService.title}" live.`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to save service item.');
    } finally {
      setSavingService(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSavingService(true);
    setDataError('');
    try {
      await seedDefaultServicesToFirestore();
      await saveSiteSettings(settingsDraft);
      showToast('Synced official raincityscooter.com pricing catalog to Firestore.');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to seed defaults.');
    } finally {
      setSavingService(false);
    }
  };

  // Auth loading state
  if (!authReady) {
    return (
      <section className="py-24">
        <div className="max-w-[680px] mx-auto px-5 text-center space-y-4">
          <Loader2 className="w-7 h-7 animate-spin text-[#E8452C] mx-auto" aria-hidden="true" />
          <p className="font-mono text-xs text-[#A1A1AA]">INITIALIZING ADMIN AUTHENTICATION</p>
        </div>
      </section>
    );
  }

  // Signed-out or unauthorized gate
  if (!user || !isAdmin) {
    return (
      <section aria-labelledby="admin-gate-heading" className="py-16 sm:py-24">
        <div className="max-w-[560px] mx-auto px-5">
          <div className="hw-chassis rounded-[24px] p-6 sm:p-8 text-[#121214] border border-white/60 space-y-6">
            <div className="oled-well rounded-[14px] p-5 text-[#F4F4F0] space-y-3">
              <div className="flex items-center justify-between font-mono text-[11px] text-[#A1A1AA]">
                <span>ADMIN ACCESS GATE</span>
                <ShieldCheck className="w-4 h-4 text-[#E8452C]" aria-hidden="true" />
              </div>
              <h1 id="admin-gate-heading" className="text-2xl font-semibold text-white">
                Rain City Scooter Admin Console
              </h1>
              <p className="text-xs text-[#B4B4BC] leading-relaxed">
                Sign in with your authorized owner Google account to inspect bookings, update
                dispatch schedules, manage customer equipment profiles, and edit live site pricing.
              </p>
            </div>

            {user && !isAdmin && (
              <div
                role="alert"
                className="rounded-[12px] bg-[#E8452C]/12 border border-[#E8452C]/35 p-4 text-xs text-[#7F1D1D] space-y-2"
              >
                <p className="font-semibold">Access denied for {user.email}</p>
                <p>
                  This portal is restricted to the verified Rain City Scooter administrator account.
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="underline font-semibold text-[#121214] cursor-pointer"
                >
                  Sign out and switch account
                </button>
              </div>
            )}

            {authError && (
              <p
                role="alert"
                className="rounded-[12px] bg-[#E8452C]/12 border border-[#E8452C]/35 p-3 text-xs text-[#7F1D1D]"
              >
                {authError}
              </p>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full min-h-[48px] px-5 py-3 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {signingIn && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Sign in with Google
            </button>
          </div>
        </div>
      </section>
    );
  }

  const openBookingsCount = bookings.filter(
    (b) => b.status === 'new' || b.status === 'confirmed' || b.status === 'in_progress',
  ).length;

  return (
    <section aria-labelledby="admin-console-heading" className="py-12 sm:py-16">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 space-y-8">
        {/* Top Console Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#A1A1AA]">
              ADMIN BACKEND · SIGNED IN AS {user.email?.toUpperCase()}
            </p>
            <h1
              id="admin-console-heading"
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F4F4F0]"
            >
              Operations & Site Control
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Admin sections"
              className="flex items-center gap-1 p-1.5 rounded-[14px] bg-[#141418] border border-white/10 overflow-x-auto max-w-full"
            >
              {(
                [
                  { id: 'bookings', label: `Bookings (${bookings.length})` },
                  { id: 'analytics', label: 'Analytics' },
                  { id: 'customers', label: `Customers (${aggregatedCustomers.length})` },
                  { id: 'site', label: 'Site Data & Pricing' },
                ] as { id: AdminTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#F4F4F0] text-[#121214]'
                      : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[42px] px-3.5 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-[18px] bg-[#F4F4F0] text-[#121214] p-5 border border-black/10">
            <div className="font-mono text-[11px] text-[#52525B]">ACTIVE BOOKINGS</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              {openBookingsCount}
            </div>
          </div>
          <div className="rounded-[18px] bg-[#131316] p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">TOTAL REQUESTS</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              {bookings.length}
            </div>
          </div>
          <div className="rounded-[18px] bg-[#131316] p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">CUSTOMER RECORDS</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              {aggregatedCustomers.length}
            </div>
          </div>
          <div className="rounded-[18px] bg-[#131316] p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">LIVE LABOR RATE</div>
            <div className="font-dot text-3xl font-extrabold text-[#E8452C] tabular-nums mt-1">
              ${settings.hourlyRate}/hr
            </div>
          </div>
        </div>

        {/* Feedback / Error Banners */}
        {feedback && (
          <div
            role="status"
            className="rounded-[12px] bg-[#F4F4F0] text-[#121214] px-4 py-3 text-xs font-semibold flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-[#E8452C]" aria-hidden="true" />
            {feedback}
          </div>
        )}
        {dataError && (
          <div
            role="alert"
            className="rounded-[12px] bg-[#E8452C]/15 border border-[#E8452C]/40 text-[#FCA5A5] px-4 py-3 text-xs break-words"
          >
            {dataError}
          </div>
        )}

        {/* TAB 1: BOOKINGS MANAGER */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', ...BOOKING_STATUSES] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`min-h-[36px] px-3 py-1 rounded-[10px] text-xs font-semibold cursor-pointer transition-colors ${
                      statusFilter === status
                        ? 'bg-[#E8452C] text-white'
                        : 'bg-[#141418] text-[#A1A1AA] border border-white/10 hover:text-white'
                    }`}
                  >
                    {status === 'all' ? 'All' : STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search
                  className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search bookings"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search ref, rider, scooter..."
                  className="w-full min-h-[40px] pl-9 pr-3 rounded-[10px] bg-[#141418] border border-white/12 text-xs text-[#F4F4F0] placeholder:text-[#71717A]"
                />
              </div>
            </div>

            {editingBooking && (
              <form
                onSubmit={handleSaveBookingEdit}
                className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-black/15 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
                  <div>
                    <span className="font-mono text-xs text-[#52525B]">EDITING BOOKING</span>
                    <h2 className="text-xl font-semibold">
                      {editingBooking.referenceId} · {editingBooking.riderName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingBooking(null)}
                    className="text-xs font-semibold text-[#52525B] hover:text-[#121214] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="edit-status" className="text-xs font-semibold">
                      Status
                    </label>
                    <select
                      id="edit-status"
                      value={editingBooking.status}
                      onChange={(e) =>
                        setEditingBooking({
                          ...editingBooking,
                          status: e.target.value as BookingStatus,
                        })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    >
                      {BOOKING_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="edit-day" className="text-xs font-semibold">
                      Scheduled Day
                    </label>
                    <select
                      id="edit-day"
                      value={editingBooking.preferredDay}
                      onChange={(e) =>
                        setEditingBooking({
                          ...editingBooking,
                          preferredDay: e.target.value as OperatingDay,
                        })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    >
                      {OPERATING_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="edit-window" className="text-xs font-semibold">
                      Time Window
                    </label>
                    <select
                      id="edit-window"
                      value={editingBooking.preferredWindow}
                      onChange={(e) =>
                        setEditingBooking({
                          ...editingBooking,
                          preferredWindow: e.target.value as TimeWindow,
                        })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    >
                      {TIME_WINDOWS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="edit-estimate" className="text-xs font-semibold">
                      Quoted Labor Label
                    </label>
                    <input
                      id="edit-estimate"
                      type="text"
                      value={editingBooking.estimatedLaborLabel}
                      onChange={(e) =>
                        setEditingBooking({
                          ...editingBooking,
                          estimatedLaborLabel: e.target.value,
                        })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="edit-address" className="text-xs font-semibold">
                      Service Address
                    </label>
                    <input
                      id="edit-address"
                      type="text"
                      value={editingBooking.address}
                      onChange={(e) =>
                        setEditingBooking({ ...editingBooking, address: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="edit-scooter" className="text-xs font-semibold">
                      Scooter Model
                    </label>
                    <input
                      id="edit-scooter"
                      type="text"
                      value={editingBooking.scooterModel}
                      onChange={(e) =>
                        setEditingBooking({ ...editingBooking, scooterModel: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="edit-admin-notes" className="text-xs font-semibold">
                    Internal Mechanic Notes (Private — Admin Only)
                  </label>
                  <textarea
                    id="edit-admin-notes"
                    rows={3}
                    value={editingBooking.adminNotes}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, adminNotes: e.target.value })
                    }
                    placeholder="Parts ordered, torque specs, diagnostic findings, payment note..."
                    className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingBooking(null)}
                    className="min-h-[42px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBooking}
                    className="min-h-[42px] px-5 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                    {savingBooking ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {filteredBookings.length === 0 ? (
              <div className="rounded-[20px] bg-[#131316] border border-white/10 p-10 text-center space-y-2">
                <p className="text-sm font-medium text-[#F4F4F0]">No bookings match this view.</p>
                <p className="text-xs text-[#A1A1AA]">
                  New requests submitted on the Book Repair page appear here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((b) => (
                  <article
                    key={b.id}
                    className="rounded-[18px] bg-[#131316] border border-white/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                        <span className="text-[#F4F4F0] font-semibold">{b.referenceId}</span>
                        <span className="text-[#E8452C] font-semibold">
                          {STATUS_LABELS[b.status].toUpperCase()}
                        </span>
                        <span className="text-[#A1A1AA]">
                          {b.preferredDay} · {b.preferredWindow}
                        </span>
                        <span className="text-[#F4F4F0] tabular-nums">{b.estimatedLaborLabel}</span>
                      </div>

                      <div className="text-base font-semibold text-[#F4F4F0]">
                        {b.riderName} · {b.scooterModel}
                      </div>

                      <div className="text-xs text-[#A1A1AA] space-y-0.5">
                        <p>
                          {b.contactPhone} · {b.contactEmail} · {b.address}
                        </p>
                        <p className="text-[#D4D4D8]">Services: {b.serviceTitles.join(', ')}</p>
                        {b.notes && <p className="text-[#A1A1AA]">Rider note: {b.notes}</p>}
                        {b.adminNotes && (
                          <p className="text-[#4A82E8]">Mechanic note: {b.adminNotes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingBooking(b)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-[10px] bg-[#F4F4F0] text-[#121214] text-xs font-semibold hover:bg-white cursor-pointer"
                      >
                        Edit Booking
                      </button>

                      {confirmDeleteBookingId === b.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteBooking(b.id)}
                            className="min-h-[38px] px-3 py-1.5 rounded-[10px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBookingId(null)}
                            className="min-h-[38px] px-2.5 py-1.5 rounded-[10px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete booking ${b.referenceId}`}
                          onClick={() => setConfirmDeleteBookingId(b.id)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-[10px] border border-white/15 text-[#A1A1AA] hover:text-[#E8452C] hover:border-[#E8452C] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BOOKING & SERVICE ANALYTICS */}
        {activeTab === 'analytics' && (
          <AdminAnalyticsPanel
            bookings={bookings}
            services={services}
            onSwitchToBookings={() => setActiveTab('bookings')}
          />
        )}

        {/* TAB 3: CUSTOMERS CRM */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search
                  className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search customers"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search rider name, email, scooter..."
                  className="w-full min-h-[40px] pl-9 pr-3 rounded-[10px] bg-[#141418] border border-white/12 text-xs text-[#F4F4F0] placeholder:text-[#71717A]"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateNewCustomer}
                className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Customer Profile
              </button>
            </div>

            {editingCustomer && (
              <form
                onSubmit={handleSaveCustomer}
                className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-black/15 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-black/10 pb-3">
                  <h2 className="text-lg font-semibold">Customer Equipment & Contact Profile</h2>
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="text-xs font-semibold text-[#52525B] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="cust-name" className="text-xs font-semibold">
                      Full Name
                    </label>
                    <input
                      id="cust-name"
                      type="text"
                      required
                      value={editingCustomer.name}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, name: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-email" className="text-xs font-semibold">
                      Email
                    </label>
                    <input
                      id="cust-email"
                      type="email"
                      required
                      value={editingCustomer.email}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, email: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-phone" className="text-xs font-semibold">
                      Phone
                    </label>
                    <input
                      id="cust-phone"
                      type="tel"
                      required
                      value={editingCustomer.phone}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, phone: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="cust-address" className="text-xs font-semibold">
                      Service Address
                    </label>
                    <input
                      id="cust-address"
                      type="text"
                      value={editingCustomer.address}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, address: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-scooter" className="text-xs font-semibold">
                      Scooter Model
                    </label>
                    <input
                      id="cust-scooter"
                      type="text"
                      value={editingCustomer.scooterModel}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, scooterModel: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-serial" className="text-xs font-semibold">
                      Serial Number / VIN
                    </label>
                    <input
                      id="cust-serial"
                      type="text"
                      value={editingCustomer.serialNumber}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, serialNumber: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="cust-notes" className="text-xs font-semibold">
                    Mechanic Service History & Notes
                  </label>
                  <textarea
                    id="cust-notes"
                    rows={3}
                    value={editingCustomer.mechanicNotes}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, mechanicNotes: e.target.value })
                    }
                    className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="min-h-[40px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCustomer}
                    className="min-h-[40px] px-5 py-2 rounded-[10px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingCustomer ? 'Saving...' : 'Save Customer Profile'}
                  </button>
                </div>
              </form>
            )}

            {aggregatedCustomers.length === 0 ? (
              <div className="rounded-[20px] bg-[#131316] border border-white/10 p-10 text-center text-sm text-[#A1A1AA]">
                No customer records yet. Customer entries automatically populate from incoming
                bookings or can be added manually above.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aggregatedCustomers.map((cust) => (
                  <article
                    key={cust.key}
                    className="rounded-[18px] bg-[#131316] border border-white/10 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#A1A1AA]">
                        <span>
                          {cust.bookingCount} BOOKING{cust.bookingCount === 1 ? '' : 'S'} · LAST{' '}
                          {cust.lastBookingRef}
                        </span>
                        <span>{cust.hasSavedProfile ? 'SAVED CRM' : 'FROM BOOKING'}</span>
                      </div>
                      <h3 className="text-base font-semibold text-[#F4F4F0]">{cust.name}</h3>
                      <p className="text-xs text-[#D4D4D8]">
                        {cust.phone} · {cust.email}
                      </p>
                      <p className="text-xs text-[#A1A1AA]">
                        Scooter: {cust.scooterModel || '—'}
                        {cust.serialNumber ? ` · S/N ${cust.serialNumber}` : ''}
                      </p>
                      {cust.address && (
                        <p className="text-xs text-[#A1A1AA]">Address: {cust.address}</p>
                      )}
                      {cust.mechanicNotes && (
                        <p className="text-xs text-[#4A82E8]">Notes: {cust.mechanicNotes}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerEditor(cust)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-[10px] bg-[#F4F4F0] text-[#121214] text-xs font-semibold hover:bg-white cursor-pointer"
                      >
                        {cust.hasSavedProfile ? 'Edit Profile' : 'Save to CRM'}
                      </button>
                      {cust.hasSavedProfile && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomerProfile(cust.profileId)}
                          className="text-xs text-[#A1A1AA] hover:text-[#E8452C] cursor-pointer"
                        >
                          Remove CRM Note
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SITE DATA & PRICING EDITOR */}
        {activeTab === 'site' && (
          <div className="space-y-8">
            {/* Global Site Settings Form */}
            <form
              onSubmit={handleSaveSiteSettings}
              className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-8 border border-black/10 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
                <div>
                  <div className="font-mono text-xs text-[#52525B]">LIVE SITE CONFIGURATION</div>
                  <h2 className="text-xl font-semibold">Business Details & Global Rates</h2>
                </div>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="min-h-[42px] px-5 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  {savingSettings ? 'Saving...' : 'Publish Site Settings'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label htmlFor="set-name" className="text-xs font-semibold">
                    Business Name
                  </label>
                  <input
                    id="set-name"
                    type="text"
                    value={settingsDraft.businessName}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, businessName: e.target.value })
                    }
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
                    value={settingsDraft.phoneDisplay}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, phoneDisplay: e.target.value })
                    }
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
                    value={settingsDraft.email}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, email: e.target.value })}
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
                    value={settingsDraft.hoursShort}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, hoursShort: e.target.value })
                    }
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
                    value={settingsDraft.hourlyRate}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, hourlyRate: Number(e.target.value) })
                    }
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
                    value={settingsDraft.warrantyDays}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, warrantyDays: Number(e.target.value) })
                    }
                    className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="set-tagline" className="text-xs font-semibold">
                    Hero Tagline
                  </label>
                  <input
                    id="set-tagline"
                    type="text"
                    value={settingsDraft.tagline}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, tagline: e.target.value })
                    }
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
                    value={settingsDraft.dispatchPolicyNote}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, dispatchPolicyNote: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="set-announcement" className="text-xs font-semibold">
                    Optional Top Announcement Banner (Leave blank to hide)
                  </label>
                  <input
                    id="set-announcement"
                    type="text"
                    value={settingsDraft.announcement}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, announcement: e.target.value })
                    }
                    placeholder="e.g. Booking winter tune-ups — $0 travel fee."
                    className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="set-google-place-id" className="text-xs font-semibold">
                      Google Business Profile Place ID (Live Reviews)
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
                    value={settingsDraft.googlePlaceId}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, googlePlaceId: e.target.value })
                    }
                    placeholder="Optional ChIJ... ID (leave blank to auto-search by business name)"
                    className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm font-mono"
                  />
                </div>
              </div>
            </form>

            {/* Live Pricing Catalog Editor */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-xs text-[#A1A1AA]">PRICING & SERVICE CATALOG</div>
                  <h2 className="text-xl font-semibold text-[#F4F4F0]">
                    Manage Live Packages & Labor Items
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSeedDefaults}
                    disabled={savingService}
                    className="min-h-[40px] px-3.5 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Sync Official Defaults ({SCOOTER_SERVICES.length})
                  </button>
                  <button
                    type="button"
                    onClick={openNewServiceEditor}
                    className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add Service Item
                  </button>
                </div>
              </div>

              {editingService && (
                <form
                  onSubmit={handleSaveService}
                  className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-black/15 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-black/10 pb-3">
                    <h3 className="text-lg font-semibold">
                      {editingService.title || 'New Service Item'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingService(null)}
                      className="text-xs font-semibold text-[#52525B] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1 sm:col-span-2">
                      <label htmlFor="svc-title" className="text-xs font-semibold">
                        Service Title
                      </label>
                      <input
                        id="svc-title"
                        type="text"
                        required
                        value={editingService.title}
                        onChange={(e) =>
                          setEditingService({ ...editingService, title: e.target.value })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-price" className="text-xs font-semibold">
                        Price ($)
                      </label>
                      <input
                        id="svc-price"
                        type="number"
                        min={0}
                        max={2000}
                        value={editingService.price}
                        onChange={(e) =>
                          setEditingService({ ...editingService, price: Number(e.target.value) })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-pricing-type" className="text-xs font-semibold">
                        Pricing Type
                      </label>
                      <select
                        id="svc-pricing-type"
                        value={editingService.pricingType}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            pricingType: e.target.value as PricingType,
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      >
                        <option value="fixed">Fixed Price ($65)</option>
                        <option value="from">Starting From (from $175)</option>
                        <option value="hourly">Hourly Rate ($45/hr)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="svc-short" className="text-xs font-semibold">
                        Short Label
                      </label>
                      <input
                        id="svc-short"
                        type="text"
                        value={editingService.shortLabel}
                        onChange={(e) =>
                          setEditingService({ ...editingService, shortLabel: e.target.value })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-cat" className="text-xs font-semibold">
                        Category
                      </label>
                      <select
                        id="svc-cat"
                        value={editingService.category}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            category: e.target.value as Exclude<ServiceCategory, 'all'>,
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      >
                        <option value="packages">Packages</option>
                        <option value="standup">Stand-Up Labor</option>
                        <option value="electrical">Electrical</option>
                        <option value="mobility">Mobility</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-mins" className="text-xs font-semibold">
                        Est. Minutes
                      </label>
                      <input
                        id="svc-mins"
                        type="number"
                        min={5}
                        max={480}
                        value={editingService.durationMinutes}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            durationMinutes: Number(e.target.value),
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                      />
                    </div>
                    <div className="space-y-1 flex flex-col justify-end">
                      <label className="inline-flex items-center gap-2 min-h-[40px] text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingService.active}
                          onChange={(e) =>
                            setEditingService({ ...editingService, active: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#E8452C]"
                        />
                        Visible on Public Site
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="svc-summary" className="text-xs font-semibold">
                      Summary
                    </label>
                    <textarea
                      id="svc-summary"
                      rows={2}
                      value={editingService.summary}
                      onChange={(e) =>
                        setEditingService({ ...editingService, summary: e.target.value })
                      }
                      className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="svc-includes" className="text-xs font-semibold">
                      Included Items (One per line)
                    </label>
                    <textarea
                      id="svc-includes"
                      rows={3}
                      value={includesDraftText}
                      onChange={(e) => setIncludesDraftText(e.target.value)}
                      className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingService(null)}
                      className="min-h-[40px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingService}
                      className="min-h-[40px] px-5 py-2 rounded-[10px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer"
                    >
                      {savingService ? 'Saving...' : 'Save Service'}
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    className="rounded-[18px] bg-[#131316] border border-white/10 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[11px] text-[#A1A1AA]">
                        <span>
                          {svc.index} · {svc.categoryLabel}
                        </span>
                        <span className={svc.active ? 'text-[#F4F4F0]' : 'text-[#E8452C]'}>
                          {svc.active ? 'VISIBLE' : 'HIDDEN'}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-[#F4F4F0]">{svc.title}</h3>
                      <div className="font-dot text-2xl font-bold text-[#F4F4F0] tabular-nums">
                        {formatServicePrice(svc)}
                      </div>
                      <p className="text-xs text-[#A1A1AA] line-clamp-2">{svc.summary}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => openServiceEditor(svc)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-[10px] bg-[#F4F4F0] text-[#121214] text-xs font-semibold hover:bg-white cursor-pointer"
                      >
                        Edit Price / Details
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${svc.title}`}
                        onClick={async () => {
                          await deleteServiceItem(svc.id);
                          showToast(`Removed ${svc.title}.`);
                        }}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-[10px] border border-white/15 text-[#A1A1AA] hover:text-[#E8452C] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
