import { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  MailCheck,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import type { BookingRecord, BookingStatus, SiteSettings } from '../data/scooterData';
import type { ConfirmationEmailApiResponse } from '../services/mailService';
import {
  buildBookingConfirmationBundle,
  formatConfirmationTimestamp,
} from '../utils/bookingConfirmation';

interface BookingConfirmationModalProps {
  booking: BookingRecord;
  settings: SiteSettings;
  saving: boolean;
  onClose: () => void;
  onTriggerConfirmationEmail: (
    booking: BookingRecord,
    options: { setConfirmed: boolean; customNote: string },
  ) => Promise<ConfirmationEmailApiResponse>;
  onRecordConfirmation: (
    booking: BookingRecord,
    options: { setConfirmed: boolean; channel: 'email' | 'sms' | 'copy' | 'manual'; customNote: string },
  ) => Promise<void>;
}

export function BookingConfirmationModal({
  booking,
  settings,
  saving,
  onClose,
  onTriggerConfirmationEmail,
  onRecordConfirmation,
}: BookingConfirmationModalProps) {
  const [customNote, setCustomNote] = useState('');
  const [previewMode, setPreviewMode] = useState<'email' | 'sms'>('email');
  const [setConfirmed, setSetConfirmed] = useState(booking.status === 'new');
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [apiError, setApiError] = useState('');
  const [receipt, setReceipt] = useState<ConfirmationEmailApiResponse | null>(null);

  const bundle = useMemo(
    () => buildBookingConfirmationBundle(booking, settings, customNote),
    [booking, settings, customNote],
  );

  const handleSendViaApi = async () => {
    setSendingEmail(true);
    setApiError('');
    try {
      const res = await onTriggerConfirmationEmail(booking, {
        setConfirmed,
        customNote,
      });
      setReceipt(res);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Failed to send confirmation email via API.',
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopyAndMark = async () => {
    const textToCopy =
      previewMode === 'email'
        ? `Subject: ${bundle.subject}\n\n${bundle.emailBody}`
        : bundle.smsBody;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard may be blocked in restricted contexts
    }
    await onRecordConfirmation(booking, {
      setConfirmed,
      channel: 'copy',
      customNote,
    });
  };

  const sentDisplay = formatConfirmationTimestamp(booking.confirmationSentAt);
  const nextStatusLabel: BookingStatus = setConfirmed ? 'confirmed' : booking.status;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 sm:p-7 border-2 border-[#E8452C] space-y-5 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
        <div className="space-y-1">
          <div className="font-mono text-xs text-[#E8452C] font-semibold">
            SEND BOOKING CONFIRMATION · {booking.referenceId}
          </div>
          <h2 id="confirm-modal-title" className="text-xl font-semibold">
            Confirm {booking.riderName} ({booking.scooterModel})
          </h2>
          <p className="text-xs text-[#52525B]">
            {booking.preferredDay} · {booking.preferredWindow} · {booking.address}
            {sentDisplay ? ` · Last sent ${sentDisplay}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close confirmation composer"
          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-[10px] border border-black/15 text-[#52525B] hover:text-[#121214] cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Delivery Receipt Banner */}
      {receipt && (
        <div
          role="status"
          className="rounded-[14px] bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 space-y-1.5"
        >
          <div className="flex items-center gap-2 font-semibold text-emerald-900">
            <MailCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Confirmation Email Sent via Mail Service</span>
          </div>
          <p className="font-mono text-[11px] text-emerald-800">
            To: {receipt.to} · Message ID: {receipt.messageId} · Provider: {receipt.provider}
          </p>
          <p className="text-emerald-900">
            Sent {formatConfirmationTimestamp(receipt.acceptedAt)} and posted automatically to the
            customer&apos;s My Account timeline.
          </p>
        </div>
      )}

      {apiError && (
        <div
          role="alert"
          className="rounded-[12px] bg-[#E8452C]/12 border border-[#E8452C]/35 p-3.5 text-xs text-[#991B1B]"
        >
          {apiError}
        </div>
      )}

      {/* Optional Custom Arrival / Mechanic Note */}
      <div className="space-y-1.5">
        <label htmlFor="confirm-custom-note" className="text-xs font-semibold text-[#121214]">
          Optional Personal Note for Rider (ETA, parking request, parts update)
        </label>
        <input
          id="confirm-custom-note"
          type="text"
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="e.g. I will text 15 minutes before arrival. Please have your charger handy."
          className="w-full min-h-[40px] px-3.5 rounded-[10px] bg-white border border-black/15 text-sm"
        />
      </div>

      {/* Preview Mode Switcher */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-[10px] bg-black/5 border border-black/10">
            <button
              type="button"
              onClick={() => setPreviewMode('email')}
              className={`min-h-[32px] px-3 rounded-[8px] text-xs font-semibold cursor-pointer ${
                previewMode === 'email'
                  ? 'bg-[#121214] text-[#F4F4F0]'
                  : 'text-[#52525B] hover:text-[#121214]'
              }`}
            >
              Email Preview
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('sms')}
              className={`min-h-[32px] px-3 rounded-[8px] text-xs font-semibold cursor-pointer ${
                previewMode === 'sms'
                  ? 'bg-[#121214] text-[#F4F4F0]'
                  : 'text-[#52525B] hover:text-[#121214]'
              }`}
            >
              SMS / Text Preview
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#121214] cursor-pointer">
            <input
              type="checkbox"
              checked={setConfirmed}
              onChange={(e) => setSetConfirmed(e.target.checked)}
              className="w-4 h-4 accent-[#E8452C]"
            />
            Update status to Confirmed ({nextStatusLabel.toUpperCase()})
          </label>
        </div>

        <div className="rounded-[14px] bg-white border border-black/12 p-4 space-y-2">
          {previewMode === 'email' ? (
            <>
              <div className="text-xs font-mono text-[#52525B] border-b border-black/8 pb-2 space-y-0.5">
                <div>
                  <strong className="text-[#121214]">To:</strong> {booking.contactEmail}
                </div>
                <div>
                  <strong className="text-[#121214]">Subject:</strong> {bundle.subject}
                </div>
              </div>
              <pre className="text-xs text-[#27272A] whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
                {bundle.emailBody}
              </pre>
            </>
          ) : (
            <>
              <div className="text-xs font-mono text-[#52525B] border-b border-black/8 pb-2">
                <strong className="text-[#121214]">To SMS:</strong> {booking.contactPhone}
              </div>
              <p className="text-xs text-[#27272A] leading-relaxed">{bundle.smsBody}</p>
            </>
          )}
        </div>
      </div>

      {/* Dispatch Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-black/10">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={saving || sendingEmail}
            onClick={handleSendViaApi}
            className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            {sendingEmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {sendingEmail ? 'Sending Confirmation...' : 'Send Confirmation Email'}
          </button>

          <a
            href={bundle.mailtoHref}
            onClick={() => {
              void onRecordConfirmation(booking, {
                setConfirmed,
                channel: 'email',
                customNote,
              });
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-[10px] bg-[#121214] hover:bg-[#27272A] text-[#F4F4F0] text-xs font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            Open in Mail App
          </a>

          <a
            href={bundle.smsHref}
            onClick={() => {
              void onRecordConfirmation(booking, {
                setConfirmed,
                channel: 'sms',
                customNote,
              });
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-[10px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#121214] inline-flex items-center gap-2 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            Send Text / SMS
          </a>

          <button
            type="button"
            disabled={saving || sendingEmail}
            onClick={handleCopyAndMark}
            className="min-h-[42px] px-3.5 py-2 rounded-[10px] border border-black/15 hover:bg-black/5 text-xs font-semibold text-[#121214] inline-flex items-center gap-2 cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#E8452C]" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {copied ? 'Copied & Logged!' : 'Copy Message'}
          </button>
        </div>

        <button
          type="button"
          disabled={saving || sendingEmail}
          onClick={async () => {
            await onRecordConfirmation(booking, {
              setConfirmed: true,
              channel: 'manual',
              customNote,
            });
            onClose();
          }}
          className="min-h-[40px] px-3.5 py-2 rounded-[10px] text-xs font-semibold text-[#52525B] hover:text-[#121214] inline-flex items-center gap-1.5 cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Mark Confirmed Only
        </button>
      </div>
    </div>
  );
}
