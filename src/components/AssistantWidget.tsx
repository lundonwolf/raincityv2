import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
  MessageSquare,
  RotateCcw,
  Send,
  Square,
  Wrench,
  X,
} from 'lucide-react';
import type { ScooterService, SiteSettings } from '../data/scooterData';
import { streamAssistantChat } from '../services/assistantService';
import type { AppRoute } from '../types/routes';
import {
  ASSISTANT_QUICK_PROMPTS,
  CHAT_MODEL_OPTIONS,
  buildScooterAssistantSystemInstruction,
  type AssistantChatMessage,
  type AssistantChatModel,
} from '../utils/assistantUtils';
import { LiveVoicePanel } from './LiveVoicePanel';

interface AssistantWidgetProps {
  services: ScooterService[];
  settings: SiteSettings;
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

type AssistantMode = 'chat' | 'voice';

function renderFormattedMessage(text: string) {
  const segments = text.split(/(\*\*[^*\n]+\*\*)/g);
  return segments.map((segment, index) => {
    if (segment.startsWith('**') && segment.endsWith('**') && segment.length > 4) {
      return (
        <strong key={index} className="font-semibold text-[#F4F4F0]">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{segment}</span>;
  });
}

export function AssistantWidget({
  services,
  settings,
  currentRoute,
  onNavigate,
}: AssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('chat');
  const [selectedModel, setSelectedModel] = useState<AssistantChatModel>('gemini-4-hydrogen');
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const chatSystemInstruction = useMemo(
    () => buildScooterAssistantSystemInstruction(settings, services, 'chat'),
    [settings, services],
  );
  const voiceSystemInstruction = useMemo(
    () => buildScooterAssistantSystemInstruction(settings, services, 'voice'),
    [settings, services],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Keep the Admin Console uncluttered
  if (currentRoute === '/admin') {
    return null;
  }

  const handleNavigateBook = () => {
    setOpen(false);
    onNavigate('/book');
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const handleClearThread = () => {
    handleStopStreaming();
    setMessages([]);
    setChatError('');
  };

  const sendUserMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || streaming) return;

    setChatError('');
    const nowIso = new Date().toISOString();
    const userMsg: AssistantChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAtIso: nowIso,
    };
    const modelMsgId = `model-${Date.now() + 1}`;
    const placeholderModelMsg: AssistantChatMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      createdAtIso: nowIso,
      model: selectedModel,
    };

    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, placeholderModelMsg]);
    setDraft('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAssistantChat({
        messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        model: selectedModel,
        systemInstruction: chatSystemInstruction,
        signal: controller.signal,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === modelMsgId ? { ...m, text: m.text + delta } : m)),
          );
        },
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === modelMsgId && m.text.trim().length === 0)),
        );
      } else {
        const message =
          err instanceof Error ? err.message : 'Unable to reach the mechanic assistant right now.';
        setChatError(message);
        setMessages((prev) =>
          prev.filter((m) => !(m.id === modelMsgId && m.text.trim().length === 0)),
        );
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setStreaming(false);
    }
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendUserMessage(draft);
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendUserMessage(draft);
    }
  };

  return (
    <>
      {/* Floating Hardware Launcher */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open Rain City Scooter Mechanic Assistant"
            className="min-h-[50px] pl-4 pr-5 py-2.5 rounded-[16px] bg-[#141418] hover:bg-[#1C1C22] text-[#F4F4F0] border border-white/15 shadow-2xl shadow-black/60 inline-flex items-center gap-3 transition-colors cursor-pointer"
          >
            <span className="relative flex items-center justify-center w-8 h-8 rounded-[10px] bg-[#E8452C] text-white shrink-0">
              <Wrench className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-xs font-semibold text-[#F4F4F0]">
                Ask Mechanic
              </span>
              <span className="block font-mono text-[10px] text-[#A1A1AA]">
                Chat &amp; Live Voice
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Docked Assistant Console Drawer */}
      {open && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label="Rain City Scooter Mechanic Assistant"
          data-testid="assistant-drawer"
          className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 w-[min(430px,calc(100vw-1.5rem))] h-[min(660px,calc(100dvh-2rem))] rounded-[22px] bg-[#0E0E11] border border-white/15 shadow-2xl shadow-black/80 flex flex-col overflow-hidden"
        >
          {/* Console Header */}
          <div className="px-4 py-3.5 bg-[#141418] border-b border-white/10 space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-[10px] bg-[#E8452C] text-white flex items-center justify-center shrink-0">
                  <Wrench className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[#F4F4F0] truncate">
                    {settings.businessName} Assistant
                  </h2>
                  <p className="font-mono text-[10px] text-[#A1A1AA] truncate">
                    Repair advice · Pricing · Live Voice
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="w-9 h-9 rounded-[10px] border border-white/12 hover:bg-white/10 text-[#A1A1AA] hover:text-[#F4F4F0] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Mode Switcher: Text Chat vs Live Voice */}
            <div
              role="tablist"
              aria-label="Assistant mode"
              className="grid grid-cols-2 gap-1 p-1 rounded-[12px] bg-[#09090B] border border-white/10"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'chat'}
                onClick={() => setMode('chat')}
                className={`min-h-[36px] px-3 py-1.5 rounded-[9px] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'chat'
                    ? 'bg-[#F4F4F0] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                Text Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'voice'}
                onClick={() => setMode('voice')}
                className={`min-h-[36px] px-3 py-1.5 rounded-[9px] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'voice'
                    ? 'bg-[#F4F4F0] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                <AudioLines className="w-3.5 h-3.5" aria-hidden="true" />
                Live Voice
              </button>
            </div>
          </div>

          {/* MODE 1: MULTI-TURN GEMINI CHATBOT */}
          {mode === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Model Tier Bar + Reset Thread */}
              <div className="px-4 py-2.5 bg-[#121216] border-b border-white/8 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  {CHAT_MODEL_OPTIONS.map((opt) => {
                    const active = selectedModel === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedModel(opt.id)}
                        title={opt.description}
                        aria-pressed={active}
                        className={`min-h-[30px] px-2.5 py-1 rounded-[8px] text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-white/14 text-[#F4F4F0] border border-white/20'
                            : 'text-[#A1A1AA] hover:text-[#F4F4F0] border border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearThread}
                    aria-label="Clear chat history"
                    className="min-h-[30px] px-2 py-1 rounded-[8px] text-[11px] text-[#A1A1AA] hover:text-[#F4F4F0] hover:bg-white/8 inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    Clear
                  </button>
                )}
              </div>

              {/* Scrollable Conversation Thread */}
              <div
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
                data-testid="chat-thread"
                className="flex-1 overflow-y-auto p-4 space-y-3.5"
              >
                {messages.length === 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-[16px] bg-[#15151A] border border-white/10 p-4 space-y-1.5">
                      <div className="font-mono text-[10px] text-[#A1A1AA] uppercase tracking-wider">
                        Rain City Scooter · Repair Advisor
                      </div>
                      <p className="text-xs text-[#E4E4E7] leading-relaxed">
                        Ask about flat tires, brake adjustments, error codes, labor pricing, or
                        which service package fits your scooter.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="font-mono text-[10px] text-[#71717A] uppercase tracking-wider px-0.5">
                        Common questions
                      </p>
                      <div className="space-y-2">
                        {ASSISTANT_QUICK_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => void sendUserMessage(prompt)}
                            className="w-full text-left rounded-[12px] bg-[#141418] hover:bg-[#1C1C22] border border-white/10 hover:border-[#E8452C]/50 px-3.5 py-2.5 text-xs text-[#E4E4E7] leading-snug transition-colors cursor-pointer"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const isEmptyStreaming = !isUser && streaming && msg.text.length === 0;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <span className="font-mono text-[10px] text-[#71717A] mb-1 uppercase">
                          {isUser ? 'You' : 'Rain City Mechanic'}
                        </span>
                        <div
                          className={`max-w-[90%] rounded-[15px] px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                            isUser
                              ? 'bg-[#E8452C] text-white'
                              : 'bg-[#17171C] border border-white/10 text-[#E4E4E7]'
                          }`}
                        >
                          {isEmptyStreaming ? (
                            <span className="inline-flex items-center gap-1.5 text-[#A1A1AA]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#E8452C] animate-pulse" />
                              Thinking…
                            </span>
                          ) : isUser ? (
                            msg.text
                          ) : (
                            renderFormattedMessage(msg.text)
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {chatError && (
                  <div
                    role="alert"
                    className="rounded-[12px] bg-[#E8452C]/15 border border-[#E8452C]/40 px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#FCA5A5]"
                  >
                    <AlertCircle
                      className="w-4 h-4 shrink-0 mt-0.5 text-[#E8452C]"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">{chatError}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer + Book Repair Shortcut */}
              <div className="p-3.5 border-t border-white/10 bg-[#121216] space-y-2.5 shrink-0">
                <form onSubmit={handleFormSubmit} className="flex items-end gap-2">
                  <label htmlFor="assistant-chat-input" className="sr-only">
                    Ask a scooter repair question
                  </label>
                  <textarea
                    id="assistant-chat-input"
                    ref={textareaRef}
                    rows={2}
                    maxLength={2000}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Ask about a repair, error code, or price…"
                    className="flex-1 resize-none rounded-[12px] bg-[#09090B] border border-white/15 focus:border-[#E8452C] focus:outline-none px-3 py-2 text-xs text-[#F4F4F0] placeholder:text-[#71717A] leading-relaxed"
                  />
                  {streaming ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      aria-label="Stop response"
                      className="h-10 w-10 rounded-[12px] bg-[#27272A] hover:bg-[#3F3F46] text-[#F4F4F0] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      aria-label="Send message"
                      className="h-10 w-10 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </form>

                <div className="flex items-center justify-between gap-2 text-[11px] text-[#A1A1AA]">
                  <span>Enter to send · Shift+Enter for new line</span>
                  <button
                    type="button"
                    onClick={handleNavigateBook}
                    className="font-semibold text-[#F4F4F0] hover:text-[#E8452C] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Book Repair
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: REAL-TIME GEMINI 3.8 LIVE VOICE CONVERSATION */}
          {mode === 'voice' && (
            <LiveVoicePanel
              systemInstruction={voiceSystemInstruction}
              onNavigateBook={handleNavigateBook}
            />
          )}
        </aside>
      )}
    </>
  );
}
