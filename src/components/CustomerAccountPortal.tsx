import { useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  LogOut,
  MessageSquare,
  Save,
  User as UserIcon,
} from 'lucide-react';
import type {
  BookingRecord,
  BookingStatus,
  SiteSettings,
  UserAccountRecord,
} from '../data/scooterData';
import { auth, googleProvider } from '../lib/firebase';
import {
  saveUserAccount,
  subscribeCustomerBookings,
  subscribeUserAccount,
} from '../services/firestoreService';
import type { AppRoute } from '../types/routes';
import { formatConfirmationTimestamp } from '../utils/bookingConfirmation';
import { formatBookingDate } from '../utils/bookingDates';
import { BookingMessagesPanel } from './BookingMessagesPanel';

interface CustomerAccountPortalProps {
  settings: SiteSettings;
  onNavigate: (route: AppRoute) => void;
}

const STATUS_STEPS: { id: BookingStatus; label: string }[] = [
  { id: 'new', label: 'Requested' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function CustomerAccountPortal({
  settings,
  onNavigate,
}: CustomerAccountPortalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<'bookings' | 'profile'>('bookings');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [account, setAccount] = useState<UserAccountRecord | null>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [defaultScooterModel, setDefaultScooterModel] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState('');
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthError('');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.email) {
      setBookings([]);
      setAccount(null);
      return;
    }

    setDataError('');
    const unsubBookings = subscribeCustomerBookings(
      user.uid,
      user.email,
      (list) => {
        setBookings(list);
        setSelectedBookingId((prev) =>
          prev && list.some((b) => b.id === prev) ? prev : list[0]?.id ?? null,
        );
      },
      (err) => setDataError(err.message),
    );

    const unsubAccount = subscribeUserAccount(
      user.uid,
      (acct) => {
        setAccount(acct);
        setDisplayName(acct?.displayName || user.displayName || '');
        setPhone(acct?.phone || '');
        setDefaultAddress(acct?.defaultAddress || '');
        setDefaultScooterModel(acct?.defaultScooterModel || '');
      },
      (err) => setDataError(err.message),
    );

    return () => {
      unsubBookings();
      unsubAccount();
    };
  }, [authReady, user]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Sign-in was cancelled or blocked by your browser.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSelectedBookingId(null);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setSavingProfile(true);
    setDataError('');
    try {
      await saveUserAccount({
        uid: user.uid,
        displayName: displayName.trim() || user.displayName || 'Rider',
        email: user.email,
        phone: phone.trim(),
        defaultAddress: defaultAddress.trim(),
        defaultScooterModel: defaultScooterModel.trim(),
      });
      setProfileSavedToast('Profile saved — future bookings will auto-fill your details.');
      window.setTimeout(() => setProfileSavedToast(''), 4000);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!authReady) {
    return (
      <section className="py-20">
        <div className="max-w-md mx-auto px-5 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#E8452C] mx-auto" aria-hidden="true" />
          <p className="font-mono text-xs text-[#A1A1AA]">LOADING RIDER ACCOUNT...</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section aria-labelledby="account-signin-heading" className="py-16 sm:py-24">
        <div className="max-w-xl mx-auto px-5">
          <div className="rounded-[24px] bg-[#F4F4F0] text-[#121214] p-7 sm:p-10 border border-black/10 space-y-6">
            <div className="space-y-2">
              <div className="font-mono text-xs text-[#52525B]">
                RIDER ACCOUNT · UPDATES &amp; DIRECT MESSAGING
              </div>
              <h1 id="account-signin-heading" className="text-3xl font-semibold tracking-tight">
                Track your scooter repairs &amp; message your mechanic.
              </h1>
              <p className="text-sm text-[#3F3F46] leading-relaxed">
                Sign in with the same email you used when booking to view live repair status,
                confirmation updates, and direct messages with {settings.businessName}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#27272A]">
              <div className="rounded-[12px] bg-white p-3.5 border border-black/10 space-y-1">
                <div className="font-mono font-semibold text-[#121214]">01 · LIVE STATUS</div>
                <p>See when your visit is confirmed, in progress, or completed.</p>
              </div>
              <div className="rounded-[12px] bg-white p-3.5 border border-black/10 space-y-1">
                <div className="font-mono font-semibold text-[#121214]">02 · DIRECT CHAT</div>
                <p>Share gate codes, parking notes, or questions directly with the shop.</p>
              </div>
              <div className="rounded-[12px] bg-white p-3.5 border border-black/10 space-y-1">
                <div className="font-mono font-semibold text-[#121214]">03 · SAVED SCOOTER</div>
                <p>Save your phone, address, and scooter model for faster booking.</p>
              </div>
            </div>

            {authError && (
              <p
                role="alert"
                className="rounded-[10px] bg-[#E8452C]/10 border border-[#E8452C]/35 px-4 py-3 text-xs font-medium text-[#991B1B]"
              >
                {authError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="min-h-[46px] px-6 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                {signingIn && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Sign In with Google
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/book')}
                className="min-h-[46px] px-5 py-2.5 rounded-[12px] border border-black/15 hover:bg-black/5 text-sm font-semibold text-[#121214] inline-flex items-center gap-2 cursor-pointer"
              >
                Book a Repair First
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const activeBooking = bookings.find((b) => b.id === selectedBookingId) ?? bookings[0] ?? null;

  return (
    <section aria-labelledby="customer-account-heading" className="py-12 sm:py-16">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 space-y-8">
        {/* Account Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#A1A1AA]">
              RIDER ACCOUNT · {user.email?.toUpperCase()}
            </p>
            <h1
              id="customer-account-heading"
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F4F4F0]"
            >
              Welcome back, {account?.displayName || user.displayName || 'Rider'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Account sections"
              className="flex items-center gap-1 p-1.5 rounded-[14px] bg-[#141418] border border-white/10"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'bookings'}
                onClick={() => setActiveTab('bookings')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'bookings'
                    ? 'bg-[#F4F4F0] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                My Repairs &amp; Messages ({bookings.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'profile'}
                onClick={() => setActiveTab('profile')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[#F4F4F0] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Saved Scooter &amp; Contact
              </button>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[42px] px-3.5 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] inline-flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>

        {dataError && (
          <div
            role="alert"
            className="rounded-[12px] bg-[#E8452C]/15 border border-[#E8452C]/40 text-[#FCA5A5] px-4 py-3 text-xs"
          >
            {dataError}
          </div>
        )}

        {profileSavedToast && (
          <div
            role="status"
            className="rounded-[12px] bg-[#F4F4F0] text-[#121214] px-4 py-3 text-xs font-semibold flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-[#E8452C]" aria-hidden="true" />
            {profileSavedToast}
          </div>
        )}

        {/* TAB 1: MY REPAIRS & MESSAGES */}
        {activeTab === 'bookings' && (
          <>
            {bookings.length === 0 ? (
              <div className="rounded-[22px] bg-[#131316] border border-white/10 p-10 text-center space-y-4">
                <h2 className="text-xl font-semibold text-[#F4F4F0]">
                  No bookings found for {user.email} yet.
                </h2>
                <p className="text-sm text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
                  Any mobile repair you book while signed in—or booked previously with this email
                  address—will automatically appear here with live updates and messaging.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/book')}
                  className="min-h-[44px] px-6 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  Schedule Mobile Repair
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.35fr] gap-6 items-start">
                {/* Left Column: Customer Bookings List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="font-mono text-xs text-[#A1A1AA]">YOUR REPAIR REQUESTS</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('/book')}
                      className="text-xs font-semibold text-[#E8452C] hover:underline cursor-pointer"
                    >
                      + New Booking
                    </button>
                  </div>

                  {bookings.map((b) => {
                    const isSelected = activeBooking?.id === b.id;
                    const sentLabel = formatConfirmationTimestamp(b.confirmationSentAt);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBookingId(b.id)}
                        className={`w-full text-left rounded-[18px] p-5 border transition-colors cursor-pointer space-y-2.5 ${
                          isSelected
                            ? 'bg-[#F4F4F0] text-[#121214] border-[#E8452C] ring-1 ring-[#E8452C]'
                            : 'bg-[#131316] text-[#F4F4F0] border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-mono text-xs">
                          <span className="font-semibold">{b.referenceId}</span>
                          <span
                            className={`font-semibold ${
                              b.status === 'confirmed'
                                ? isSelected
                                  ? 'text-emerald-700'
                                  : 'text-emerald-400'
                                : b.status === 'ongoing'
                                  ? isSelected
                                    ? 'text-amber-700'
                                    : 'text-amber-400'
                                  : b.status === 'cancelled'
                                    ? 'text-[#71717A]'
                                    : 'text-[#E8452C]'
                            }`}
                          >
                            {STATUS_LABELS[b.status].toUpperCase()}
                          </span>
                        </div>
                        <div className="text-base font-semibold">{b.scooterModel}</div>
                        <div
                          className={`text-xs space-y-0.5 ${
                            isSelected ? 'text-[#3F3F46]' : 'text-[#A1A1AA]'
                          }`}
                        >
                          <p>
                            {formatBookingDate(b.bookingDate, b.preferredDay)} · {b.preferredWindow}
                          </p>
                          <p className="truncate">{b.serviceTitles.join(', ')}</p>
                          {sentLabel && (
                            <p className="font-mono text-[11px] text-emerald-600">
                              Confirmation email sent {sentLabel}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right Column: Selected Booking Status Stepper + Updates & Live Messaging */}
                {activeBooking && user.email && (
                  <div className="space-y-5">
                    <div className="rounded-[22px] bg-[#131316] border border-white/10 p-6 space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                        <div className="space-y-1">
                          <div className="font-mono text-xs text-[#A1A1AA]">
                            BOOKING {activeBooking.referenceId}
                          </div>
                          <h2 className="text-2xl font-semibold text-[#F4F4F0]">
                            {activeBooking.scooterModel}
                          </h2>
                          <p className="text-xs text-[#A1A1AA]">
                            {formatBookingDate(
                              activeBooking.bookingDate,
                              activeBooking.preferredDay,
                            )}{' '}
                            · {activeBooking.preferredWindow} · {activeBooking.address}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[11px] text-[#A1A1AA]">EST. LABOR</div>
                          <div className="font-dot text-2xl font-bold text-[#F4F4F0] tabular-nums">
                            {activeBooking.estimatedLaborLabel}
                          </div>
                        </div>
                      </div>

                      {/* Visual Status Progress Stepper */}
                      {activeBooking.status === 'cancelled' ? (
                        <div className="rounded-[12px] bg-[#1A1A20] border border-white/10 px-4 py-3 text-xs text-[#A1A1AA]">
                          This booking is marked <strong className="text-[#F4F4F0]">Cancelled</strong>.
                          Message us below if you would like to reschedule.
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2">
                          {STATUS_STEPS.map((step, idx) => {
                            const currentIdx = STATUS_STEPS.findIndex(
                              (s) => s.id === activeBooking.status,
                            );
                            const isComplete = idx <= currentIdx;
                            return (
                              <div key={step.id} className="space-y-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    isComplete
                                      ? activeBooking.status === 'ongoing' && step.id === 'ongoing'
                                        ? 'bg-amber-400'
                                        : 'bg-[#E8452C]'
                                      : 'bg-white/12'
                                  }`}
                                />
                                <div
                                  className={`font-mono text-[11px] flex items-center gap-1 ${
                                    isComplete ? 'text-[#F4F4F0] font-semibold' : 'text-[#71717A]'
                                  }`}
                                >
                                  {isComplete && (
                                    <CheckCircle2
                                      className={`w-3 h-3 shrink-0 ${
                                        activeBooking.status === 'ongoing' && step.id === 'ongoing'
                                          ? 'text-amber-400'
                                          : 'text-[#E8452C]'
                                      }`}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="truncate">{step.label}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="text-xs text-[#D4D4D8] space-y-1 pt-1">
                        <div>
                          <span className="font-mono text-[#A1A1AA]">SERVICES: </span>
                          {activeBooking.serviceTitles.join(', ')}
                        </div>
                        {activeBooking.notes && (
                          <div>
                            <span className="font-mono text-[#A1A1AA]">YOUR NOTES: </span>
                            {activeBooking.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <BookingMessagesPanel
                      booking={activeBooking}
                      viewerRole="customer"
                      viewerUid={user.uid}
                      viewerEmail={user.email}
                      viewerName={account?.displayName || user.displayName || activeBooking.riderName}
                      businessName={settings.businessName}
                      surface="dark"
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 2: SAVED RIDER PROFILE */}
        {activeTab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="max-w-2xl rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-8 border border-black/10 space-y-5"
          >
            <div className="border-b border-black/10 pb-4">
              <div className="font-mono text-xs text-[#52525B]">SAVED RIDER DETAILS</div>
              <h2 className="text-xl font-semibold mt-1">Default Contact &amp; Scooter Info</h2>
              <p className="text-xs text-[#52525B] mt-1">
                Used to automatically pre-fill the Book Repair form whenever you are signed in.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="acct-name" className="text-xs font-semibold">
                  Full Name
                </label>
                <input
                  id="acct-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="acct-phone" className="text-xs font-semibold">
                  Mobile Phone
                </label>
                <input
                  id="acct-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(206) 555-0148"
                  className="w-full min-h-[42px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="acct-scooter" className="text-xs font-semibold">
                Default Scooter Make &amp; Model
              </label>
              <input
                id="acct-scooter"
                type="text"
                value={defaultScooterModel}
                onChange={(e) => setDefaultScooterModel(e.target.value)}
                placeholder="e.g. Segway Ninebot Max G2"
                className="w-full min-h-[42px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="acct-address" className="text-xs font-semibold">
                Default Service Address
              </label>
              <input
                id="acct-address"
                type="text"
                value={defaultAddress}
                onChange={(e) => setDefaultAddress(e.target.value)}
                placeholder="1420 E Pine St, Seattle, WA 98122"
                className="w-full min-h-[42px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="min-h-[42px] px-5 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                {savingProfile ? 'Saving...' : 'Save Rider Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
