import type { Server as HttpServer } from 'node:http';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type GenerateContentResponse,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  buildScooterAssistantSystemInstruction,
  formatGeminiErrorMessage,
  resolveChatModel,
  resolveLiveVoice,
  sanitizeChatHistory,
  type AssistantChatModel,
  type SanitizedChatTurn,
} from '../src/utils/assistantUtils';

const MAX_SYSTEM_INSTRUCTION_CHARS = 7000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cleanSystemInstruction(raw: unknown, mode: 'chat' | 'voice'): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().slice(0, MAX_SYSTEM_INSTRUCTION_CHARS);
  }
  return buildScooterAssistantSystemInstruction(undefined, undefined, mode);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}

export interface ChatStreamRequest {
  messages: SanitizedChatTurn[];
  model: AssistantChatModel;
  systemInstruction: string;
}

export function parseChatRequestBody(body: unknown): ChatStreamRequest {
  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const messages = sanitizeChatHistory(record.messages, 24, 2500);
  const model = resolveChatModel(record.model);
  const systemInstruction = cleanSystemInstruction(record.systemInstruction, 'chat');
  return { messages, model, systemInstruction };
}

export async function streamScooterChat(
  request: ChatStreamRequest,
  onDelta: (delta: string) => void,
): Promise<void> {
  if (request.messages.length === 0) {
    throw new Error('Please enter a message to start chatting.');
  }

  const lastTurn = request.messages[request.messages.length - 1];
  if (lastTurn.role !== 'user') {
    throw new Error('The latest message must come from the rider.');
  }

  const ai = getGeminiClient();
  const priorHistory = request.messages.slice(0, -1).map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));

  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const chat = ai.chats.create({
        model: request.model,
        history: priorHistory,
        config: {
          systemInstruction: request.systemInstruction,
          ...(request.model === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });

      const streamResponse = await chat.sendMessageStream({
        message: lastTurn.text,
      });

      for await (const chunk of streamResponse) {
        const responseChunk = chunk as GenerateContentResponse;
        const delta = responseChunk.text ?? '';
        if (delta) {
          onDelta(delta);
        }
      }
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isTransientError(err)) {
        await sleep(500 * attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

interface LiveClientPayload {
  type?: string;
  voiceName?: string;
  systemInstruction?: string;
  audio?: string;
  text?: string;
}

function safeSendWs(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function attachLiveVoiceWebSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = (request.url ?? '').split('?')[0];
    if (pathname !== '/api/live') {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (clientWs) => {
    let sessionPromise: Promise<Session> | null = null;
    let activeSession: Session | null = null;
    let closed = false;

    const cleanupSession = () => {
      if (closed) return;
      closed = true;
      const sessionToClose = activeSession;
      activeSession = null;
      if (sessionToClose) {
        try {
          sessionToClose.close();
        } catch {
          // Ignore close errors during teardown
        }
      } else if (sessionPromise) {
        sessionPromise
          .then((session) => {
            try {
              session.close();
            } catch {
              // Ignore close errors
            }
          })
          .catch(() => {});
      }
      sessionPromise = null;
    };

    const startLiveSession = (voiceRaw: unknown, systemInstructionRaw: unknown) => {
      if (sessionPromise || closed) return;

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Server configuration error';
        safeSendWs(clientWs, { type: 'error', message: formatGeminiErrorMessage(message) });
        return;
      }

      const voiceName = resolveLiveVoice(voiceRaw);
      const systemInstruction = cleanSystemInstruction(systemInstructionRaw, 'voice');

      sessionPromise = ai.live
        .connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
          },
          callbacks: {
            onopen: () => {
              if (!closed) {
                safeSendWs(clientWs, { type: 'ready', voiceName, model: 'gemini-3.8-live' });
              }
            },
            onmessage: (message: LiveServerMessage) => {
              if (closed) return;
              const serverContent = message.serverContent;
              if (!serverContent) return;

              if (serverContent.interrupted) {
                safeSendWs(clientWs, { type: 'interrupted' });
              }

              if (serverContent.inputTranscription?.text) {
                safeSendWs(clientWs, {
                  type: 'input_transcript',
                  text: serverContent.inputTranscription.text,
                  finished: Boolean(serverContent.inputTranscription.finished),
                });
              }

              if (serverContent.outputTranscription?.text) {
                safeSendWs(clientWs, {
                  type: 'output_transcript',
                  text: serverContent.outputTranscription.text,
                  finished: Boolean(serverContent.outputTranscription.finished),
                });
              }

              for (const part of serverContent.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  safeSendWs(clientWs, {
                    type: 'audio',
                    audio: part.inlineData.data,
                  });
                }
              }

              if (serverContent.turnComplete) {
                safeSendWs(clientWs, { type: 'turn_complete' });
              }
            },
            onerror: (event) => {
              if (closed) return;
              const detail =
                typeof (event as { message?: unknown })?.message === 'string'
                  ? (event as { message: string }).message
                  : 'Live voice session encountered a connection error.';
              safeSendWs(clientWs, { type: 'error', message: formatGeminiErrorMessage(detail) });
            },
            onclose: () => {
              if (!closed) {
                safeSendWs(clientWs, { type: 'closed' });
              }
              cleanupSession();
            },
          },
        })
        .then((session) => {
          if (closed) {
            try {
              session.close();
            } catch {
              // Ignore
            }
            return session;
          }
          activeSession = session;
          return session;
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          safeSendWs(clientWs, {
            type: 'error',
            message: formatGeminiErrorMessage(message),
          });
          cleanupSession();
          throw err;
        });
    };

    clientWs.on('message', (rawData) => {
      if (closed) return;
      let payload: LiveClientPayload;
      try {
        payload = JSON.parse(rawData.toString()) as LiveClientPayload;
      } catch {
        return;
      }

      if (payload.type === 'start') {
        startLiveSession(payload.voiceName, payload.systemInstruction);
        return;
      }

      if (payload.type === 'stop') {
        cleanupSession();
        return;
      }

      if (payload.type === 'audio' && typeof payload.audio === 'string' && payload.audio.length > 0) {
        if (!sessionPromise) return;
        const audioBase64 = payload.audio;
        sessionPromise
          .then((session) => {
            if (!closed) {
              session.sendRealtimeInput({
                audio: { data: audioBase64, mimeType: 'audio/pcm;rate=16000' },
              });
            }
          })
          .catch(() => {});
        return;
      }

      if (payload.type === 'text' && typeof payload.text === 'string' && payload.text.trim()) {
        if (!sessionPromise) return;
        const text = payload.text.trim().slice(0, 1000);
        sessionPromise
          .then((session) => {
            if (!closed) {
              session.sendRealtimeInput({ text });
            }
          })
          .catch(() => {});
      }
    });

    clientWs.on('close', cleanupSession);
    clientWs.on('error', cleanupSession);
  });
}
