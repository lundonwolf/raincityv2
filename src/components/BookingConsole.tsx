import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Check, CheckCircle2, Loader2, MessageSquare, RotateCcw, UserCircle2 } from 'lucide-react';
import {
  OPERATING_DAYS,
  TIME_WINDOWS,
  type OperatingDay,
  type ScooterService,
  type SiteSettings,
  type TimeWindow,
} from '../data/scooterData';
import { auth } from '../lib/firebase';
import { createPublicBooking, subscribeUserAccount } from '../services/firestoreService';
import type { AppRoute } from '../types/routes';
import {
  formatCurrency,
  formatDuration,
  formatServicePrice,
  generateDispatchReference,
  validateBookingForm,
  type BookingFormInput,
  type RepairEstimate,
} from '../utils/repairCalculator';

export interface ConfirmedBooking {
  referenceId: string;
  createdAtIso: string;
  riderName: string;
  contactEmail: string;
  contactPhone: string;
  scooterModel: string;
  address: string;
  preferredDay: OperatingDay;
  preferredWindow: TimeWindow;
  serviceTitles: string[];
  estimateLabel: string;
  estimatedDuration: string;
  modeLabel: string;
  notes: string;
  syncedToCloud: boolean;
}

interface BookingConsoleProps {
  services: ScooterService[];
  settings: SiteSettings;
  selectedServiceIds: string[];
  estimate: RepairEstimate;
  confirmedBooking: ConfirmedBooking | null;
  onToggleService: (serviceId: string) => void;
  onConfirmBooking: (booking: ConfirmedBooking) => void;
  onResetBooking: () => void;
  onNavigate: (route: AppRoute) => void;
}

export function BookingConsole({
  services,
  settings,
  selectedServiceIds,
  estimate,
  confirmedBooking,
  onToggleService,
  onConfirmBooking,
  onResetBooking,
  onNavigate,
}: BookingConsoleProps) {
  const [scooterModel, setScooterModel] = useState('');
  const [riderName, setRiderName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [preferredDay, setPreferredDay] = useState<OperatingDay | ''>('Saturday');
  const [preferredWindow, setPreferredWindow] = useState<TimeWindow | ''>('10:00 AM – 12:00 PM');
  const [notes, setNotes] = useState('');
  const [signedInUser, setSignedInUser] = useState<User | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let unsubAccount: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      setSignedInUser(nextUser);
      if (unsubAccount) {
        unsubAccount();
        unsubAccount = null;
      }
      if (!nextUser) return;

      if (nextUser.displayName) {
        setRiderName((prev) => prev || nextUser.displayName || '');
      }
      if (nextUser.email) {
        setContactEmail((prev) => prev || nextUser.email || '');
      }

      if (nextUser.emailVerified) {
        unsubAccount = subscribeUserAccount(nextUser.uid, (account) => {
          if (!account) return;
          if (account.displayName) setRiderName((prev) => prev || account.displayName);
          if (account.email) setContactEmail((prev) => prev || account.email);
          if (account.phone) setContactPhone((prev) => prev || account.phone);
          if (account.defaultAddress) setAddress((prev) => prev || account.defaultAddress);
          if (account.defaultScooterModel) {
            setScooterModel((prev) => prev || account.defaultScooterModel);
          }
        });
      }
    });

    return () => {
      unsubAuth();
      if (unsubAccount) unsubAccount();
    };
  }, []);

  const activeServices = services.filter((s) => s.active !== false);
  const phoneHref = `tel:+1${settings.phoneDisplay.replace(/\D/g, '')}`;

  const goPolicy = (event: MouseEvent<HTMLAnchorElement>, route: AppRoute) => {
    event.preventDefault();
    onNavigate(route);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');

    const payload: BookingFormInput = {
      selectedServiceIds,
      scooterModel,
      riderName,
      contactEmail,
      contactPhone,
      address,
      preferredDay,
      preferredWindow,
      notes,
    };

    const validation = validateBookingForm(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    const referenceId = generateDispatchReference();
    const serviceTitles = estimate.selectedServices.map((s) => s.title);

    try {
      await createPublicBooking({
        referenceId,
        riderName: riderName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        scooterModel: scooterModel.trim(),
        address: address.trim(),
        preferredDay: preferredDay as OperatingDay,
        preferredWindow: preferredWindow as TimeWindow,
        serviceIds: estimate.selectedServices.map((s) => s.id),
        serviceTitles,
        estimatedLaborLabel: estimate.estimatedLaborLabel,
        estimatedMinutes: estimate.estimatedMinutes,
        notes: notes.trim(),
        customerUid: signedInUser?.emailVerified ? signedInUser.uid : undefined,
      });

      const booking: ConfirmedBooking = {
        referenceId,
        createdAtIso: new Date().toISOString(),
        riderName: riderName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        scooterModel: scooterModel.trim(),
        address: address.trim(),
        preferredDay: preferredDay as OperatingDay,
        preferredWindow: preferredWindow as TimeWindow,
        serviceTitles,
        estimateLabel: estimate.estimatedLaborLabel,
        estimatedDuration: formatDuration(estimate.estimatedMinutes),
        modeLabel:
          estimate.recommendedMode === 'mobile'
            ? 'Curbside Mobile Van Repair'
            : 'On-Site Assessment / Pickup by Arrangement',
        notes: notes.trim(),
        syncedToCloud: true,
      };

      onConfirmBooking(booking);
    } catch (err) {
      console.error('Booking submission failed:', err);
      setSubmitError(
        `Could not save booking to the dispatch database right now. Please try again or call ${settings.phoneDisplay}.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="booking" aria-labelledby="booking-heading" className="py-12 sm:py-16">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="font-mono text-xs tracking-wider text-[#A1A1AA]">
            Mobile Dispatch Request · {settings.dispatchPolicyNote}
          </p>
          <h1
            id="booking-heading"
            className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#F4F4F0] [text-wrap:balance]"
          >
            {settings.bookingHeadline}
          </h1>
          <p className="text-base text-[#A1A1AA] leading-relaxed">
            {settings.bookingIntro}
          </p>
        </div>

        {confirmedBooking ? (
          <div
            data-testid="booking-confirmation-ticket"
            className="hw-chassis rounded-[24px] p-6 sm:p-8 text-[#121214] border border-white/60 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-[#E8452C] shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-mono text-xs text-[#52525B]">
                    DISPATCH REQUEST RECORDED
                  </div>
                  <h2 className="text-2xl font-semibold text-[#121214]">
                    Booking Confirmed · {confirmedBooking.referenceId}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onResetBooking}
                className="hw-key min-h-[42px] px-4 py-2 rounded-[12px] text-xs font-semibold text-[#121214] inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Schedule Another Repair
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
              <div className="oled-well rounded-[16px] p-5 text-[#F4F4F0] space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-[#A1A1AA] border-b border-white/10 pb-3">
                  <span>DISPATCH MANIFEST</span>
                  <span>{confirmedBooking.modeLabel.toUpperCase()}</span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-mono text-[11px] text-[#A1A1AA]">RIDER</dt>
                    <dd className="font-medium mt-0.5">{confirmedBooking.riderName}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[11px] text-[#A1A1AA]">SCOOTER MODEL</dt>
                    <dd className="font-medium mt-0.5">{confirmedBooking.scooterModel}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[11px] text-[#A1A1AA]">REQUESTED WINDOW</dt>
                    <dd className="font-medium mt-0.5">
                      {confirmedBooking.preferredDay} · {confirmedBooking.preferredWindow}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[11px] text-[#A1A1AA]">SERVICE ADDRESS</dt>
                    <dd className="font-medium mt-0.5">{confirmedBooking.address}</dd>
                  </div>
                </dl>

                <div className="pt-3 border-t border-white/10 space-y-1.5">
                  <div className="font-mono text-[11px] text-[#A1A1AA]">SELECTED SERVICES</div>
                  <ul className="space-y-1 text-sm text-[#E4E4E7]">
                    {confirmedBooking.serviceTitles.map((title) => (
                      <li key={title} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8452C]" aria-hidden="true" />
                        {title}
                      </li>
                    ))}
                  </ul>
                </div>

                {confirmedBooking.notes && (
                  <div className="pt-3 border-t border-white/10">
                    <div className="font-mono text-[11px] text-[#A1A1AA]">RIDER NOTES</div>
                    <p className="text-xs text-[#D4D4D8] mt-1">{confirmedBooking.notes}</p>
                  </div>
                )}
              </div>

              <div className="bg-[#F8F8F5] rounded-[16px] p-5 border border-black/10 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <div className="font-mono text-xs text-[#52525B]">ESTIMATED LABOR</div>
                  <div className="font-dot text-4xl font-extrabold text-[#121214] tabular-nums">
                    {confirmedBooking.estimateLabel}
                  </div>
                  <p className="text-xs text-[#52525B] leading-relaxed">
                    $0 dispatch/travel fee · Est. {confirmedBooking.estimatedDuration}. Parts and
                    applicable tax are confirmed and approved before work begins.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-black/10 text-xs text-[#3F3F46]">
                  <p>
                    Confirmation logged for <strong>{confirmedBooking.contactEmail}</strong> and
                    SMS updates to <strong>{confirmedBooking.contactPhone}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('/account')}
                    className="w-full min-h-[42px] px-4 py-2.5 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    Track Updates &amp; Message Mechanic in My Account
                  </button>
                  <p>
                    Need to update your slot? Call or text{' '}
                    <a
                      href={phoneHref}
                      className="font-mono font-semibold text-[#E8452C] hover:underline"
                    >
                      {settings.phoneDisplay}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-6 items-start">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-8 border border-black/10 space-y-6"
            >
              <div className="rounded-[14px] bg-white border border-black/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#27272A]">
                  <UserCircle2 className="w-4 h-4 text-[#E8452C] shrink-0" aria-hidden="true" />
                  {signedInUser?.email ? (
                    <span>
                      Signed in as <strong>{signedInUser.email}</strong> — this booking will
                      automatically appear in My Account for live status updates &amp; messaging.
                    </span>
                  ) : (
                    <span>
                      Sign in to track live repair updates &amp; message your mechanic directly.
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/account')}
                  className="font-semibold text-[#E8452C] hover:underline whitespace-nowrap cursor-pointer"
                >
                  {signedInUser ? 'Open My Account' : 'Sign In / My Account'}
                </button>
              </div>
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-[#121214]">
                  1. Select Services Needed
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeServices.map((service) => {
                    const checked = selectedServiceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => onToggleService(service.id)}
                        className={`min-h-[46px] px-3.5 py-2.5 rounded-[12px] border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          checked
                            ? 'bg-[#121214] text-[#F4F4F0] border-[#121214]'
                            : 'bg-white text-[#121214] border-black/12 hover:border-black/30'
                        }`}
                      >
                        <span className="text-xs font-semibold truncate">{service.shortLabel}</span>
                        <span className="flex items-center gap-1.5 shrink-0 font-mono text-xs tabular-nums">
                          <span>{formatServicePrice(service)}</span>
                          {checked && (
                            <Check className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.selectedServiceIds && (
                  <p role="alert" className="text-xs font-medium text-[#C82A14]">
                    {errors.selectedServiceIds}
                  </p>
                )}
              </fieldset>

              <div className="space-y-1.5">
                <label htmlFor="scooter-model" className="block text-xs font-semibold text-[#27272A]">
                  Scooter Make & Model
                </label>
                <input
                  id="scooter-model"
                  type="text"
                  value={scooterModel}
                  onChange={(e) => setScooterModel(e.target.value)}
                  placeholder="e.g. Segway Ninebot Max G2"
                  aria-invalid={Boolean(errors.scooterModel)}
                  className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                />
                {errors.scooterModel && (
                  <p role="alert" className="text-xs font-medium text-[#C82A14]">
                    {errors.scooterModel}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="preferred-day" className="block text-xs font-semibold text-[#27272A]">
                    Preferred Operating Day
                  </label>
                  <select
                    id="preferred-day"
                    value={preferredDay}
                    onChange={(e) => setPreferredDay(e.target.value as OperatingDay | '')}
                    aria-invalid={Boolean(errors.preferredDay)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214]"
                  >
                    <option value="">Select day</option>
                    {OPERATING_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  {errors.preferredDay && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {errors.preferredDay}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="preferred-window"
                    className="block text-xs font-semibold text-[#27272A]"
                  >
                    Arrival Window (10 AM – 5 PM)
                  </label>
                  <select
                    id="preferred-window"
                    value={preferredWindow}
                    onChange={(e) => setPreferredWindow(e.target.value as TimeWindow | '')}
                    aria-invalid={Boolean(errors.preferredWindow)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214]"
                  >
                    <option value="">Select window</option>
                    {TIME_WINDOWS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                  {errors.preferredWindow && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {errors.preferredWindow}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="rider-name" className="block text-xs font-semibold text-[#27272A]">
                    Full Name
                  </label>
                  <input
                    id="rider-name"
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    placeholder="Alex Rivera"
                    aria-invalid={Boolean(errors.riderName)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                  />
                  {errors.riderName && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {errors.riderName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="contact-email" className="block text-xs font-semibold text-[#27272A]">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="alex@example.com"
                    aria-invalid={Boolean(errors.contactEmail)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                  />
                  {errors.contactEmail && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {errors.contactEmail}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="contact-phone" className="block text-xs font-semibold text-[#27272A]">
                    Mobile Phone
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(206) 555-0148"
                    aria-invalid={Boolean(errors.contactPhone)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                  />
                  {errors.contactPhone && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {errors.contactPhone}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="dispatch-address"
                    className="block text-xs font-semibold text-[#27272A]"
                  >
                    Service Address or Cross-Streets
                  </label>
                  <input
                    id="dispatch-address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="1420 E Pine St, Seattle, WA 98122"
                    aria-invalid={Boolean(errors.address)}
                    className="w-full min-h-[44px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A]"
                  />
                  {errors.address && (
                    <p role="alert" className="text-xs font-medium text-[#C82A14]">
                      {errors.address}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="issue-notes" className="block text-xs font-semibold text-[#27272A]">
                    Symptoms, Error Codes, or Parking Notes (Optional)
                  </label>
                  <textarea
                    id="issue-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Rear tire won't hold air, error code E14 on dash, loading zone available behind building..."
                    className="w-full p-3.5 rounded-[10px] bg-white border border-black/15 text-sm text-[#121214] placeholder:text-[#71717A] resize-y"
                  />
                </div>
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-[10px] bg-[#E8452C]/10 border border-[#E8452C]/35 px-4 py-3 text-xs font-medium text-[#991B1B]"
                >
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] px-6 py-3 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {submitting ? 'Submitting Repair Request...' : 'Confirm Repair Request'}
              </button>

              <p className="text-xs text-[#52525B] leading-relaxed">
                By requesting an appointment you agree to our{' '}
                <a
                  href="/terms"
                  onClick={(e) => goPolicy(e, '/terms')}
                  className="underline text-[#121214] hover:text-[#E8452C]"
                >
                  Terms of Service
                </a>
                ,{' '}
                <a
                  href="/warranty"
                  onClick={(e) => goPolicy(e, '/warranty')}
                  className="underline text-[#121214] hover:text-[#E8452C]"
                >
                  Warranty Policy
                </a>
                , and{' '}
                <a
                  href="/privacy"
                  onClick={(e) => goPolicy(e, '/privacy')}
                  className="underline text-[#121214] hover:text-[#E8452C]"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>

            {/* Right: Recessed OLED Live Estimate Summary */}
            <aside
              aria-label="Repair estimate summary"
              className="rounded-[22px] bg-[#131316] border border-white/10 p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-xs text-[#A1A1AA]">LIVE LABOR ESTIMATE</span>
                <span className="font-mono text-xs text-[#F4F4F0] tabular-nums">
                  {estimate.selectedServices.length} ITEM
                  {estimate.selectedServices.length === 1 ? '' : 'S'}
                </span>
              </div>

              {estimate.selectedServices.length === 0 ? (
                <p className="text-sm text-[#A1A1AA] py-4">
                  Choose one or more service packages or hourly labor items on the left to inspect
                  estimated labor and duration.
                </p>
              ) : (
                <div className="space-y-4">
                  <ul className="divide-y divide-white/10">
                    {estimate.selectedServices.map((service) => (
                      <li
                        key={service.id}
                        className="py-3 first:pt-0 flex items-start justify-between gap-4 text-sm"
                      >
                        <div>
                          <div className="font-medium text-[#F4F4F0]">{service.title}</div>
                          <div className="font-mono text-[11px] text-[#A1A1AA] mt-0.5 tabular-nums">
                            {formatDuration(service.durationMinutes)} ·{' '}
                            {service.mode === 'mobile' ? 'On-Site' : 'Mobile / Pickup'}
                          </div>
                        </div>
                        <span className="font-mono text-xs text-[#F4F4F0] tabular-nums shrink-0">
                          {formatServicePrice(service)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-2 pt-3 border-t border-white/10 text-xs font-mono">
                    {estimate.diagnosticCredit > 0 && (
                      <div className="flex items-center justify-between text-[#4A82E8]">
                        <span>Electrical Diagnosis Credit</span>
                        <span className="tabular-nums">
                          -{formatCurrency(estimate.diagnosticCredit)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[#A1A1AA]">
                      <span>Dispatch / Travel Fee</span>
                      <span className="tabular-nums text-[#F4F4F0]">$0</span>
                    </div>
                    <div className="flex items-center justify-between text-[#A1A1AA]">
                      <span>Estimated Labor Time</span>
                      <span className="tabular-nums">
                        {formatDuration(estimate.estimatedMinutes)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium text-[#D4D4D8]">Estimated Labor</span>
                    <span
                      data-testid="booking-estimate-total"
                      className="font-dot text-3xl font-bold text-[#F4F4F0] tabular-nums"
                    >
                      {estimate.estimatedLaborLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                    Labor only; parts and applicable tax are additional and confirmed before work.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 space-y-1.5 text-xs text-[#A1A1AA]">
                <p>Questions before booking?</p>
                <p className="font-mono text-[#F4F4F0]">
                  <a href={phoneHref} className="hover:text-[#E8452C] transition-colors">
                    {settings.phoneDisplay}
                  </a>{' '}
                  ·{' '}
                  <a
                    href={`mailto:${settings.email}`}
                    className="hover:text-[#E8452C] transition-colors"
                  >
                    {settings.email}
                  </a>
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
