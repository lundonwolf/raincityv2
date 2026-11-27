import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, MailCheck, MessageSquare, Send, Wrench } from 'lucide-react';
import type { BookingMessageRecord, BookingRecord, BookingStatus } from '../data/scooterData';
import { sendBookingMessage, subscribeBookingMessages } from '../services/firestoreService';
import { formatConfirmationTimestamp } from '../utils/bookingConfirmation';

interface BookingMessagesPanelProps {
  booking: BookingRecord;
  viewerRole: 'customer' | 'admin';
  viewerUid: string;
  viewerEmail: string;
  viewerName: string;
  businessName: string;
  surface?: 'dark' | 'light';
  onUpdateStatus?: (nextStatus: BookingStatus) => Promise<void>;
}

const REPAIR_UPDATE_PRESETS: {
  label: string;
  text: string;
  suggestedStatus?: BookingStatus;
}[] = [
  {
    label: 'On the way',
    text: 'On my way to your location — arriving shortly.',
    suggestedStatus: 'in_progress',
  },
  {
    label: 'Inspecting',
    text: 'Started hands-on inspection of your scooter to verify parts and repair scope.',
    suggestedStatus: 'in_progress',
  },
  {
    label: 'Tire / Tube',
    text: 'Working on tire/tube replacement, rim inspection, and PSI balance.',
    suggestedStatus: 'in_progress',
  },
  {
    label: 'Brakes & Tune',
    text: 'Adjusting brakes, tightening stem/fasteners, and completing safety check.',
    suggestedStatus: 'in_progress',
  },
  {
    label: 'Parts Ordered',
    text: 'Replacement parts ordered — keeping this repair Ongoing and will update once parts arrive.',
    suggestedStatus: 'ongoing',
  },
  {
    label: 'Test Ride Ready',
    text: 'Repair finished and test ride passed! Your scooter is ready to roll.',
    suggestedStatus: 'completed',
  },
];

const UPDATE_STATUS_CHOICES: { value: BookingStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
];

export function BookingMessagesPanel({
  booking,
  viewerRole,
  viewerUid,
  viewerEmail,
  viewerName,
  businessName,
  surface = 'dark',
  onUpdateStatus,
}: BookingMessagesPanelProps) {
  const [messages, setMessages] = useState<BookingMessageRecord[]>([]);
  const [composeMode, setComposeMode] = useState<'status_update' | 'chat'>(
    viewerRole === 'admin' ? 'status_update' : 'chat',
  );
  const [nextStatusChoice, setNextStatusChoice] = useState<BookingStatus | ''>('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    const unsub = subscribeBookingMessages(
      booking.id,
      viewerRole === 'admin'
        ? { role: 'admin' }
        : { role: 'customer', email: viewerEmail },
      (list) => setMessages(list),
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [booking.id, viewerRole, viewerEmail]);

  const handleApplyPreset = (preset: (typeof REPAIR_UPDATE_PRESETS)[number]) => {
    setComposeMode('status_update');
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${preset.text}` : preset.text));
    if (preset.suggestedStatus && preset.suggestedStatus !== booking.status) {
      setNextStatusChoice(preset.suggestedStatus);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError('');
    try {
      const targetType = viewerRole === 'admin' ? composeMode : 'chat';
      if (
        viewerRole === 'admin' &&
        targetType === 'status_update' &&
        nextStatusChoice &&
        nextStatusChoice !== booking.status &&
        onUpdateStatus
      ) {
        await onUpdateStatus(nextStatusChoice);
      }

      await sendBookingMessage({
        booking,
        senderUid: viewerUid,
        senderRole: viewerRole,
        senderName: viewerRole === 'admin' ? businessName : viewerName,
        messageType: targetType,
        body: text,
      });
      setDraft('');
      setNextStatusChoice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post update.');
    } finally {
      setSending(false);
    }
  };

  const isLight = surface === 'light';
  const isPostingUpdate = viewerRole === 'admin' && composeMode === 'status_update';

  return (
    <div
      className={`rounded-[18px] border p-4 sm:p-5 space-y-4 ${
        isLight
          ? 'bg-[#F4F4F0] text-[#121214] border-black/12'
          : 'bg-[#101014] text-[#F4F4F0] border-white/10'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 pb-3 border-b ${
          isLight ? 'border-black/10' : 'border-white/10'
        }`}
      >
        <div>
          <div
            className={`font-mono text-[11px] ${
              isLight ? 'text-[#52525B]' : 'text-[#A1A1AA]'
            }`}
          >
            REPAIR LOG &amp; DIRECT MESSAGES · {booking.referenceId}
          </div>
          <h3 className="text-sm font-semibold mt-0.5">
            {viewerRole === 'admin'
              ? `Scooter Updates & Chat — ${booking.riderName} (${booking.scooterModel})`
              : `Live Repair Progress & Chat with ${businessName}`}
          </h3>
        </div>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            isLight ? 'text-[#52525B]' : 'text-[#A1A1AA]'
          }`}
        >
          {messages.length} {messages.length === 1 ? 'UPDATE' : 'UPDATES'}
        </span>
      </div>

      {/* Live Timeline */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p
            className={`text-xs py-4 text-center ${
              isLight ? 'text-[#52525B]' : 'text-[#A1A1AA]'
            }`}
          >
            {viewerRole === 'admin'
              ? 'No updates posted yet. Log what you are working on below — the customer sees repair updates live in My Account.'
              : 'No repair updates yet. As your mechanic works on your scooter, live progress notes will appear here.'}
          </p>
        ) : (
          messages.map((msg) => {
            const timeStr = formatConfirmationTimestamp(msg.createdAtIso);

            if (msg.messageType === 'confirmation_email') {
              return (
                <div
                  key={msg.id}
                  className={`rounded-[12px] p-3 border text-xs space-y-1 ${
                    isLight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-emerald-950/35 border-emerald-500/30 text-emerald-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <MailCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      CONFIRMATION EMAIL SENT
                    </span>
                    <span className="opacity-75">{timeStr}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">{msg.body}</p>
                </div>
              );
            }

            if (msg.messageType === 'status_update') {
              return (
                <div
                  key={msg.id}
                  className={`rounded-[12px] p-3.5 border text-xs space-y-1.5 ${
                    isLight
                      ? 'bg-white border-black/12 text-[#18181B]'
                      : 'bg-[#17171D] border-[#E8452C]/30 text-[#F4F4F0]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#E8452C]">
                      <Wrench className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      REPAIR UPDATE
                    </span>
                    <span className="opacity-65 whitespace-nowrap">{timeStr}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">{msg.body}</p>
                </div>
              );
            }

            const isOwnMessage = msg.senderRole === viewerRole;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-xs space-y-1 ${
                    isOwnMessage
                      ? 'bg-[#E8452C] text-white'
                      : isLight
                        ? 'bg-white text-[#121214] border border-black/10'
                        : 'bg-[#1A1A22] text-[#F4F4F0] border border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 font-mono text-[10px] opacity-80">
                    <span className="font-semibold">
                      {msg.senderRole === 'admin' ? `${businessName} (Mechanic)` : msg.senderName}
                    </span>
                    <span>{timeStr}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">{msg.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#E8452C]">
          {error}
        </p>
      )}

      {/* Admin Mode Switcher + 1-Tap Scooter Work Presets */}
      {viewerRole === 'admin' && (
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-black/8">
              <button
                type="button"
                onClick={() => setComposeMode('status_update')}
                className={`min-h-[32px] px-3 py-1 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  composeMode === 'status_update'
                    ? 'bg-[#121214] text-white'
                    : 'text-[#52525B] hover:text-[#121214]'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                Repair Update
              </button>
              <button
                type="button"
                onClick={() => setComposeMode('chat')}
                className={`min-h-[32px] px-3 py-1 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  composeMode === 'chat'
                    ? 'bg-[#121214] text-white'
                    : 'text-[#52525B] hover:text-[#121214]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                Direct Chat
              </button>
            </div>

            {isPostingUpdate && onUpdateStatus && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`update-status-${booking.id}`}
                  className="text-[11px] font-semibold text-[#52525B]"
                >
                  Also set status:
                </label>
                <select
                  id={`update-status-${booking.id}`}
                  value={nextStatusChoice}
                  onChange={(e) => setNextStatusChoice(e.target.value as BookingStatus | '')}
                  className="min-h-[34px] px-2.5 rounded-[8px] bg-white border border-black/15 text-xs font-semibold text-[#121214] cursor-pointer"
                >
                  <option value="">Keep current</option>
                  {UPDATE_STATUS_CHOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isPostingUpdate && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] text-[#52525B] mr-1">QUICK LOG:</span>
              {REPAIR_UPDATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="min-h-[28px] px-2.5 py-1 rounded-[8px] bg-white border border-black/12 hover:border-[#E8452C] hover:text-[#E8452C] text-[11px] font-semibold text-[#27272A] transition-colors cursor-pointer"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="space-y-2.5">
        <label htmlFor={`msg-input-${booking.id}`} className="sr-only">
          {isPostingUpdate
            ? `Post a scooter repair update for ${booking.referenceId}`
            : `Write a message for booking ${booking.referenceId}`}
        </label>
        {isPostingUpdate ? (
          <div className="space-y-2">
            <textarea
              id={`msg-input-${booking.id}`}
              rows={2}
              maxLength={1500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Describe what you are doing on ${booking.riderName}'s ${booking.scooterModel} (e.g., replaced rear tube, adjusted brake pads, ordered controller)...`}
              className="w-full p-3 rounded-[10px] border bg-white border-black/15 text-xs text-[#121214] placeholder:text-[#71717A]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-[#52525B]">
                Visible live to {booking.riderName} in their My Account portal.
              </span>
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Post Repair Update
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id={`msg-input-${booking.id}`}
              type="text"
              maxLength={1500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                viewerRole === 'admin'
                  ? `Message ${booking.riderName} about ETA, parts, or questions...`
                  : `Message ${businessName} (gate code, parking, timing, or questions)...`
              }
              className={`flex-1 min-h-[42px] px-3.5 rounded-[10px] border text-xs ${
                isLight
                  ? 'bg-white border-black/15 text-[#121214] placeholder:text-[#71717A]'
                  : 'bg-[#16161C] border-white/15 text-[#F4F4F0] placeholder:text-[#71717A]'
              }`}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="min-h-[42px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Send Message
            </button>
          </div>
        )}
      </form>

      {booking.confirmationSentAt && (
        <div
          className={`flex items-center gap-1.5 font-mono text-[11px] ${
            isLight ? 'text-[#52525B]' : 'text-[#A1A1AA]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
          <span>
            Confirmation sent {formatConfirmationTimestamp(booking.confirmationSentAt)}
            {booking.confirmationMessageId ? ` · Ref ${booking.confirmationMessageId}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
