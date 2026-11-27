import { useEffect, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  MailCheck,
  MessageSquare,
  RefreshCw,
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
import {
  mapFirebaseAuthError,
  validateEmailAuthInput,
  type EmailAuthMode,
  type EmailAuthValidationErrors,
} from '../utils/customerAuth';
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
  const [emailVerified, setEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  // Email & password form state
  const [authMode, setAuthMode] = useState<EmailAuthMode>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EmailAuthValidationErrors>({});

  // Email verification screen actions
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

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
      setEmailVerified(Boolean(nextUser?.emailVerified));
      setAuthReady(true);
      setAuthError('');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.email || !emailVerified) {
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
  }, [authReady, user, emailVerified]);

  const switchAuthMode = (nextMode: EmailAuthMode) => {
    setAuthMode(nextMode);
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});
  };

  const handleEmailAuthSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const validation = validateEmailAuthInput(authMode, {
      fullName: authName,
      email: authEmail,
      password: authPassword,
      confirmPassword: authConfirmPassword,
    });

    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setSigningIn(true);

    try {
      if (authMode === 'signup') {
        const credential = await createUserWithEmailAndPassword(
          auth,
          validation.normalizedEmail,
          authPassword,
        );
        if (validation.trimmedName) {
          await updateProfile(credential.user, { displayName: validation.trimmedName });
        }
        try {
          await sendEmailVerification(credential.user);
          setAuthNotice(
            `Verification link sent to ${validation.normalizedEmail}. Open it to unlock your repairs and messages.`,
          );
        } catch {
          setAuthNotice(
            'Account created! Click "Resend Verification Email" below if you do not see the verification email.',
          );
        }
        setAuthPassword('');
        setAuthConfirmPassword('');
      } else if (authMode === 'signin') {
        const credential = await signInWithEmailAndPassword(
          auth,
          validation.normalizedEmail,
          authPassword,
        );
        setEmailVerified(Boolean(credential.user.emailVerified));
        setAuthPassword('');
      } else {
        await sendPasswordResetEmail(auth, validation.normalizedEmail);
        setAuthNotice(
          `Password reset link sent to ${validation.normalizedEmail}. Check your inbox and spam folder.`,
        );
      }
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    setAuthNotice('');
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      setEmailVerified(Boolean(credential.user.emailVerified));
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleCheckVerification = async () => {
    const current = auth.currentUser;
    if (!current) return;
    setCheckingVerification(true);
    setAuthError('');
    setAuthNotice('');
    try {
      await current.reload();
      await current.getIdToken(true);
      const isNowVerified = Boolean(auth.currentUser?.emailVerified);
      setEmailVerified(isNowVerified);
      if (!isNowVerified) {
        setAuthNotice(
          `We haven't seen verification for ${current.email} yet. Click the link in your inbox (check spam/junk) and tap Continue again.`,
        );
      }
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    const current = auth.currentUser;
    if (!current) return;
    setResendingVerification(true);
    setAuthError('');
    setAuthNotice('');
    try {
      await sendEmailVerification(current);
      setAuthNotice(`Fresh verification email sent to ${current.email}. Check your inbox or spam folder.`);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSelectedBookingId(null);
    setEmailVerified(false);
    setAuthNotice('');
    setAuthError('');
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
      <section aria-labelledby="account-signin-heading" className="py-12 sm:py-20">
        <div className="max-w-xl mx-auto px-5">
          <div className="rounded-[24px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-9 border border-black/10 space-y-6">
            <div className="space-y-2">
              <div className="font-mono text-xs text-[#52525B]">
                RIDER ACCOUNT · UPDATES &amp; DIRECT MESSAGING
              </div>
              <h1 id="account-signin-heading" className="text-3xl font-semibold tracking-tight">
                Track your scooter repairs &amp; message your mechanic.
              </h1>
              <p className="text-sm text-[#3F3F46] leading-relaxed">
                Create an account or sign in with <strong>any email address</strong> (iCloud,
                Outlook, Yahoo, Gmail, or work email) matching your booking to view live repair
                status and message {settings.businessName}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-[#27272A]">
              <div className="rounded-[12px] bg-white p-3 border border-black/10 space-y-1">
                <div className="font-mono font-semibold text-[#121214]">01 · LIVE STATUS</div>
                <p>See when your visit is confirmed, in progress, or completed.</p>
              </div>
              <div className="rounded-[12px] bg-white p-3 border border-black/10 space-y-1">
                <div className="font-mono font-semibold text-[#121214]">02 · DIRECT CHAT</div>
                <p>Share gate codes, parking notes, or questions directly with the shop.</p>
              </div>
              <div className="rounded-[12px] bg-white p-3 border border-black/10 space-y-1">
                <div className="font-mono font-semibold text-[#121214]">03 · SAVED SCOOTER</div>
                <p>Save your phone, address, and scooter model for faster booking.</p>
              </div>
            </div>

            {authMode !== 'reset' ? (
              <div
                role="tablist"
                aria-label="Account authentication mode"
                className="grid grid-cols-2 gap-1 p-1 rounded-[12px] bg-black/6 border border-black/8"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signin'}
                  onClick={() => switchAuthMode('signin')}
                  className={`min-h-[40px] rounded-[9px] text-xs font-semibold transition-colors cursor-pointer ${
                    authMode === 'signin'
                      ? 'bg-[#121214] text-[#F4F4F0]'
                      : 'text-[#52525B] hover:text-[#121214]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  onClick={() => switchAuthMode('signup')}
                  className={`min-h-[40px] rounded-[9px] text-xs font-semibold transition-colors cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-[#121214] text-[#F4F4F0]'
                      : 'text-[#52525B] hover:text-[#121214]'
                  }`}
                >
                  Create Account
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-3">
                <div>
                  <div className="font-mono text-[11px] text-[#52525B]">PASSWORD RECOVERY</div>
                  <h2 className="text-base font-semibold text-[#121214]">Reset your password</h2>
                </div>
                <button
                  type="button"
                  onClick={() => switchAuthMode('signin')}
                  className="text-xs font-semibold text-[#52525B] hover:text-[#121214] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Back to Sign In
                </button>
              </div>
            )}

            {authError && (
              <p
                role="alert"
                className="rounded-[10px] bg-[#E8452C]/10 border border-[#E8452C]/35 px-4 py-3 text-xs font-medium text-[#991B1B]"
              >
                {authError}
              </p>
            )}

            {authNotice && (
              <p
                role="status"
                className="rounded-[10px] bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-medium text-emerald-900"
              >
                {authNotice}
              </p>
            )}

            <form onSubmit={handleEmailAuthSubmit} noValidate className="space-y-3.5">
              {authMode === 'signup' && (
                <div className="space-y-1">
                  <label htmlFor="auth-name" className="block text-xs font-semibold text-[#27272A]">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Alex Rivera"
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                  />
                  {fieldErrors.fullName && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {fieldErrors.fullName}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="auth-email" className="block text-xs font-semibold text-[#27272A]">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                />
                {fieldErrors.email && (
                  <p role="alert" className="text-xs font-medium text-[#C82A14]">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {authMode !== 'reset' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-semibold text-[#27272A]"
                    >
                      Password
                    </label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => switchAuthMode('reset')}
                        className="text-xs font-semibold text-[#E8452C] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={
                        authMode === 'signup' ? 'At least 6 characters' : 'Enter your password'
                      }
                      aria-invalid={Boolean(fieldErrors.password)}
                      className="w-full min-h-[44px] pl-3.5 pr-11 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-[8px] text-[#52525B] hover:text-[#121214] inline-flex items-center justify-center cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
              )}

              {authMode === 'signup' && (
                <div className="space-y-1">
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-semibold text-[#27272A]"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                  />
                  {fieldErrors.confirmPassword && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={signingIn}
                className="w-full min-h-[46px] px-6 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {signingIn && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {authMode === 'signup'
                  ? 'Create Rider Account'
                  : authMode === 'signin'
                    ? 'Sign In with Email'
                    : 'Send Password Reset Link'}
              </button>
            </form>

            {authMode !== 'reset' && (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="w-full border-t border-black/12" aria-hidden="true" />
                  <span className="bg-[#F4F4F0] px-3 font-mono text-[11px] text-[#71717A] whitespace-nowrap">
                    OR CONTINUE WITH
                  </span>
                  <div className="w-full border-t border-black/12" aria-hidden="true" />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={signingIn}
                    className="flex-1 min-h-[44px] px-5 py-2.5 rounded-[12px] bg-white border border-black/15 hover:bg-black/5 disabled:opacity-60 text-sm font-semibold text-[#121214] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/book')}
                    className="min-h-[44px] px-4 py-2.5 rounded-[12px] border border-black/15 hover:bg-black/5 text-sm font-semibold text-[#121214] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Book a Repair First
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!emailVerified) {
    return (
      <section aria-labelledby="verify-email-heading" className="py-16 sm:py-24">
        <div className="max-w-lg mx-auto px-5">
          <div className="rounded-[24px] bg-[#F4F4F0] text-[#121214] p-7 sm:p-9 border border-black/10 space-y-6">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#E8452C]/12 text-[#E8452C] flex items-center justify-center shrink-0">
                <MailCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <div className="font-mono text-xs text-[#52525B]">EMAIL VERIFICATION REQUIRED</div>
                <h1 id="verify-email-heading" className="text-2xl font-semibold tracking-tight">
                  Verify your email to unlock your repairs
                </h1>
              </div>
            </div>

            <p className="text-sm text-[#3F3F46] leading-relaxed">
              We sent a verification link to <strong>{user.email}</strong>. Confirming your email
              protects your home address, booking history, and private messages with{' '}
              {settings.businessName}.
            </p>

            {authError && (
              <p
                role="alert"
                className="rounded-[10px] bg-[#E8452C]/10 border border-[#E8452C]/35 px-4 py-3 text-xs font-medium text-[#991B1B]"
              >
                {authError}
              </p>
            )}

            {authNotice && (
              <p
                role="status"
                className="rounded-[10px] bg-white border border-black/12 px-4 py-3 text-xs font-medium text-[#27272A]"
              >
                {authNotice}
              </p>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleCheckVerification}
                disabled={checkingVerification}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {checkingVerification ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                )}
                I&apos;ve Verified My Email — Continue
              </button>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="flex-1 min-h-[42px] px-4 py-2 rounded-[10px] bg-white border border-black/15 hover:bg-black/5 disabled:opacity-60 text-xs font-semibold text-[#121214] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {resendingVerification && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  )}
                  Resend Verification Email
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[42px] px-4 py-2 rounded-[10px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#52525B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  Switch Email
                </button>
              </div>
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
