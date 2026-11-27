import { useEffect, useState, type FormEvent } from 'react';
import { Bell, CheckCircle2, Loader2, MailCheck, Send } from 'lucide-react';
import type { BookingMessageRecord, BookingRecord } from '../data/scooterData';
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
}

export function BookingMessagesPanel({
  booking,
  viewerRole,
  viewerUid,
  viewerEmail,
  viewerName,
  businessName,
  surface = 'dark',
}: BookingMessagesPanelProps) {
  const [messages, setMessages] = useState<BookingMessageRecord[]>([]);
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

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError('');
    try {
      await sendBookingMessage({
        booking,
        senderUid: viewerUid,
        senderRole: viewerRole,
        senderName: viewerRole === 'admin' ? businessName : viewerName,
        messageType: 'chat',
        body: text,
      });
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const isLight = surface === 'light';

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
            UPDATES &amp; DIRECT MESSAGES · {booking.referenceId}
          </div>
          <h3 className="text-sm font-semibold mt-0.5">
            {viewerRole === 'admin'
              ? `Conversation with ${booking.riderName}`
              : `Updates & Direct Chat with ${businessName}`}
          </h3>
        </div>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            isLight ? 'text-[#52525B]' : 'text-[#A1A1AA]'
          }`}
        >
          {messages.length} {messages.length === 1 ? 'EVENT' : 'EVENTS'}
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
              ? 'No messages yet. Send a quick arrival note or reply to this customer below.'
              : 'No updates yet. Send a message below if you have gate codes, parking info, or repair questions.'}
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
                  className={`rounded-[12px] p-3 border text-xs flex items-start justify-between gap-3 ${
                    isLight
                      ? 'bg-white border-black/10 text-[#27272A]'
                      : 'bg-[#17171D] border-white/10 text-[#D4D4D8]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Bell className="w-3.5 h-3.5 text-[#E8452C] mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="leading-relaxed">{msg.body}</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-65 whitespace-nowrap shrink-0">
                    {timeStr}
                  </span>
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

      {/* Composer */}
      <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={`msg-input-${booking.id}`} className="sr-only">
          Write a message for booking {booking.referenceId}
        </label>
        <input
          id={`msg-input-${booking.id}`}
          type="text"
          maxLength={1500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            viewerRole === 'admin'
              ? `Message ${booking.riderName} about ETA, parts, or repair progress...`
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
