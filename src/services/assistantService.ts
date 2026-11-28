import type { AssistantChatModel, SanitizedChatTurn } from '../utils/assistantUtils';

export interface StreamAssistantChatParams {
  messages: SanitizedChatTurn[];
  model: AssistantChatModel;
  systemInstruction: string;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

interface ChatSseFrame {
  delta?: string;
  done?: boolean;
  error?: string;
  model?: string;
}

export async function streamAssistantChat({
  messages,
  model,
  systemInstruction,
  signal,
  onDelta,
}: StreamAssistantChatParams): Promise<void> {
  const response = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, systemInstruction }),
    signal,
  });

  if (!response.ok) {
    let errorMessage = `Assistant request failed (${response.status}).`;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody.error) {
        errorMessage = errBody.error;
      }
    } catch {
      // Fall back to generic status message
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('Streaming response is unavailable in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonPayload = trimmed.slice('data:'.length).trim();
    if (!jsonPayload) return;

    let frame: ChatSseFrame;
    try {
      frame = JSON.parse(jsonPayload) as ChatSseFrame;
    } catch {
      return;
    }

    if (frame.error) {
      throw new Error(frame.error);
    }
    if (frame.delta) {
      onDelta(frame.delta);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      processLine(line);
    }
  }

  if (buffer.trim()) {
    processLine(buffer);
  }
}
