import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
} from 'lucide-react';
import {
  LIVE_VOICE_OPTIONS,
  base64PcmToFloat32,
  computeRmsLevel,
  pcmFloat32ToBase64,
  resampleFloat32,
  type LiveVoiceName,
} from '../utils/assistantUtils';

interface LiveVoicePanelProps {
  systemInstruction: string;
  onNavigateBook: () => void;
}

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

interface VoiceTranscriptItem {
  id: string;
  speaker: 'user' | 'model';
  text: string;
}

interface LiveServerPayload {
  type?: string;
  audio?: string;
  text?: string;
  message?: string;
  finished?: boolean;
}

const INPUT_TARGET_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BAR_WEIGHTS = [0.4, 0.72, 0.95, 0.65, 1.0, 0.85, 0.98, 0.7, 0.88, 0.55, 0.75, 0.45];

export function LiveVoicePanel({ systemInstruction, onNavigateBook }: LiveVoicePanelProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [voiceName, setVoiceName] = useState<LiveVoiceName>('Zephyr');
  const [muted, setMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [userLevel, setUserLevel] = useState(0);
  const [modelSpeaking, setModelSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<VoiceTranscriptItem[]>([]);

  // Refs prevent stale closures inside onaudioprocess and WebSocket callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mutedRef = useRef<boolean>(false);
  const activeRef = useRef<boolean>(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const stopPlaybackQueue = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setModelSpeaking(false);
  }, []);

  const appendTranscriptChunk = useCallback((speaker: 'user' | 'model', chunk: string) => {
    const cleaned = chunk.replace(/\s+/g, ' ');
    if (!cleaned.trim()) return;

    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        const needsSpace =
          last.text.length > 0 &&
          !last.text.endsWith(' ') &&
          !cleaned.startsWith(' ') &&
          !/^[.,!?;:'"]/.test(cleaned);
        const updatedText = `${last.text}${needsSpace ? ' ' : ''}${cleaned}`.trim();
        return [...prev.slice(0, -1), { ...last, text: updatedText }];
      }
      return [
        ...prev,
        {
          id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text: cleaned.trim(),
        },
      ];
    });
  }, []);

  const teardownSession = useCallback(
    (nextStatus: VoiceStatus = 'idle') => {
      activeRef.current = false;
      stopPlaybackQueue();

      if (processorRef.current) {
        processorRef.current.onaudioprocess = null;
        try {
          processorRef.current.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        processorRef.current = null;
      }

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // Ignore
        }
        sourceNodeRef.current = null;
      }

      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) {
          track.stop();
        }
        mediaStreamRef.current = null;
      }

      if (inputAudioCtxRef.current) {
        void inputAudioCtxRef.current.close().catch(() => {});
        inputAudioCtxRef.current = null;
      }

      if (outputAudioCtxRef.current) {
        void outputAudioCtxRef.current.close().catch(() => {});
        outputAudioCtxRef.current = null;
      }

      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stop' }));
          }
          ws.close();
        } catch {
          // Ignore close errors
        }
      }

      setUserLevel(0);
      setModelSpeaking(false);
      setMuted(false);
      setStatus(nextStatus);
    },
    [stopPlaybackQueue],
  );

  // Always clean up microphone, AudioContexts, and WebSocket on unmount
  useEffect(() => {
    return () => {
      teardownSession('idle');
    };
  }, [teardownSession]);

  const scheduleAudioChunk = useCallback((base64Pcm: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx || !activeRef.current) return;

    const float32 = base64PcmToFloat32(base64Pcm);
    if (float32.length === 0) return;

    const buffer = outCtx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = outCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt = Math.max(now + 0.01, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(source);
    setModelSpeaking(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setModelSpeaking(false);
      }
    };

    source.start(startAt);
  }, []);

  const handleStartCall = async () => {
    if (status === 'connecting' || status === 'live') return;

    setErrorMessage('');
    setStatus('connecting');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Microphone capture is not supported in this browser.');
      setStatus('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: INPUT_TARGET_SAMPLE_RATE });
      const outputCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live`);
      wsRef.current = ws;
      activeRef.current = true;

      ws.onopen = () => {
        if (!activeRef.current) return;
        ws.send(
          JSON.stringify({
            type: 'start',
            voiceName,
            systemInstruction,
          }),
        );
      };

      ws.onmessage = (event) => {
        if (!activeRef.current) return;
        let payload: LiveServerPayload;
        try {
          payload = JSON.parse(String(event.data)) as LiveServerPayload;
        } catch {
          return;
        }

        if (payload.type === 'ready') {
          setStatus('live');

          // Start streaming 16kHz 16-bit PCM microphone audio once Live session is ready
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          sourceNodeRef.current = source;
          processorRef.current = processor;

          processor.onaudioprocess = (audioEvent) => {
            if (!activeRef.current || mutedRef.current) {
              setUserLevel(0);
              return;
            }
            const currentWs = wsRef.current;
            if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;

            const rawChannel = audioEvent.inputBuffer.getChannelData(0);
            const pcm16k = resampleFloat32(
              rawChannel,
              inputCtx.sampleRate,
              INPUT_TARGET_SAMPLE_RATE,
            );
            setUserLevel(computeRmsLevel(pcm16k));

            const base64 = pcmFloat32ToBase64(pcm16k);
            currentWs.send(JSON.stringify({ type: 'audio', audio: base64 }));
          };

          source.connect(processor);
          processor.connect(inputCtx.destination);
          return;
        }

        if (payload.type === 'audio' && payload.audio) {
          scheduleAudioChunk(payload.audio);
          return;
        }

        if (payload.type === 'interrupted') {
          stopPlaybackQueue();
          return;
        }

        if (payload.type === 'input_transcript' && payload.text) {
          appendTranscriptChunk('user', payload.text);
          return;
        }

        if (payload.type === 'output_transcript' && payload.text) {
          appendTranscriptChunk('model', payload.text);
          return;
        }

        if (payload.type === 'error') {
          setErrorMessage(
            payload.message || 'Voice conversation encountered an error. Please try again.',
          );
          teardownSession('error');
          return;
        }

        if (payload.type === 'closed') {
          teardownSession('idle');
        }
      };

      ws.onerror = () => {
        if (!activeRef.current) return;
        setErrorMessage('Could not connect to the live voice service. Please try again.');
        teardownSession('error');
      };

      ws.onclose = () => {
        if (activeRef.current) {
          teardownSession('idle');
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission')
        ? 'Microphone access was denied. Allow microphone access in your browser to talk live.'
        : msg || 'Could not start microphone capture.';
      setErrorMessage(friendly);
      teardownSession('error');
    }
  };

  const isLive = status === 'live';
  const isConnecting = status === 'connecting';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Live Voice Control Deck */}
      <div className="p-4 border-b border-white/10 bg-[#121216] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-mono text-[10px] tracking-wider text-[#A1A1AA] uppercase">
              Gemini 3.8 Live · Real-Time Audio
            </div>
            <div className="text-sm font-semibold text-[#F4F4F0] flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLive
                    ? modelSpeaking
                      ? 'bg-[#4A82E8] animate-pulse'
                      : 'bg-emerald-400 animate-pulse'
                    : isConnecting
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-white/25'
                }`}
                aria-hidden="true"
              />
              {isLive
                ? modelSpeaking
                  ? 'Mechanic speaking…'
                  : muted
                    ? 'Microphone muted'
                    : 'Listening — speak naturally'
                : isConnecting
                  ? 'Connecting voice line…'
                  : 'Ready for live voice call'}
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
            <span className="sr-only">Assistant voice</span>
            <Volume2 className="w-3.5 h-3.5 text-[#A1A1AA]" aria-hidden="true" />
            <select
              aria-label="Assistant voice"
              disabled={isLive || isConnecting}
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value as LiveVoiceName)}
              className="min-h-[32px] px-2 rounded-[8px] bg-[#1A1A20] border border-white/12 text-xs text-[#F4F4F0] disabled:opacity-50 cursor-pointer"
            >
              {LIVE_VOICE_OPTIONS.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.tone})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Tactile 12-Bar Level Visualizer */}
        <div
          aria-hidden="true"
          className="h-14 rounded-[14px] bg-[#09090B] border border-white/10 px-4 flex items-center justify-center gap-2"
        >
          {BAR_WEIGHTS.map((weight, idx) => {
            const activeMagnitude = isLive
              ? modelSpeaking
                ? 0.35 + ((idx * 17) % 5) * 0.14
                : muted
                  ? 0.08
                  : Math.max(0.12, userLevel * weight)
              : 0.1;
            const HEIGHT_STEPS = [
              'h-2',
              'h-3',
              'h-4',
              'h-5',
              'h-6',
              'h-7',
              'h-8',
              'h-9',
              'h-10',
              'h-11',
            ];
            const stepIndex = Math.min(
              HEIGHT_STEPS.length - 1,
              Math.max(0, Math.round(activeMagnitude * (HEIGHT_STEPS.length - 1))),
            );
            return (
              <span
                key={idx}
                className={`w-1.5 rounded-full transition-all duration-100 ${HEIGHT_STEPS[stepIndex]} ${
                  isLive
                    ? modelSpeaking
                      ? 'bg-[#4A82E8]'
                      : muted
                        ? 'bg-white/20'
                        : 'bg-[#E8452C]'
                    : 'bg-white/15'
                }`}
              />
            );
          })}
        </div>

        {/* Primary Call Controls */}
        <div className="flex items-center gap-2.5">
          {isLive || isConnecting ? (
            <>
              <button
                type="button"
                onClick={() => teardownSession('idle')}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" aria-hidden="true" />
                End Voice Call
              </button>
              <button
                type="button"
                disabled={!isLive}
                onClick={() => setMuted((prev) => !prev)}
                aria-pressed={muted}
                className={`min-h-[42px] px-3.5 py-2 rounded-[12px] border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                  muted
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                    : 'bg-[#1A1A20] border-white/15 text-[#F4F4F0] hover:bg-white/10'
                }`}
              >
                {muted ? (
                  <>
                    <MicOff className="w-4 h-4" aria-hidden="true" />
                    Unmute
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" aria-hidden="true" />
                    Mute
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStartCall}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              Start Live Voice Call
            </button>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-[12px] bg-[#E8452C]/15 border border-[#E8452C]/40 px-3 py-2.5 flex items-start gap-2 text-xs text-[#FCA5A5]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E8452C]" aria-hidden="true" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Live Voice Transcript Stream */}
      <div
        role="log"
        aria-label="Live voice transcript"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {transcript.length === 0 ? (
          <div className="rounded-[14px] bg-[#141418] border border-white/8 p-4 space-y-2 text-xs text-[#A1A1AA]">
            <p className="font-semibold text-[#F4F4F0]">Hands-free scooter repair guidance</p>
            <p className="leading-relaxed">
              Tap <strong>Start Live Voice Call</strong> and describe what your scooter is doing —
              flat tire, brake rub, error code, or battery issue. You can interrupt naturally at any
              time, and a live transcript will appear here.
            </p>
          </div>
        ) : (
          transcript.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col ${item.speaker === 'user' ? 'items-end' : 'items-start'}`}
            >
              <span className="font-mono text-[10px] text-[#71717A] mb-1 uppercase">
                {item.speaker === 'user' ? 'You' : 'Rain City Mechanic'}
              </span>
              <div
                className={`max-w-[88%] rounded-[14px] px-3.5 py-2.5 text-xs leading-relaxed ${
                  item.speaker === 'user'
                    ? 'bg-[#E8452C] text-white'
                    : 'bg-[#17171C] border border-white/10 text-[#E4E4E7]'
                }`}
              >
                {item.text}
              </div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Footer Book Repair Shortcut */}
      <div className="px-4 py-3 border-t border-white/10 bg-[#111115] flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#A1A1AA]">Need a mobile mechanic visit?</span>
        <button
          type="button"
          onClick={onNavigateBook}
          className="text-xs font-semibold text-[#F4F4F0] hover:text-[#E8452C] inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          Book Repair
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
