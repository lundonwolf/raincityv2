import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  attachLiveVoiceWebSocket,
  parseChatRequestBody,
  streamScooterChat,
} from './server/geminiAssistant';
import { formatGeminiErrorMessage } from './src/utils/assistantUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_ALLOWLIST = new Set(['lundonwolf@gmail.com']);

interface FirebaseAppletConfig {
  apiKey?: string;
  projectId?: string;
}

interface MockMailDeliveryRecord {
  messageId: string;
  provider: string;
  status: 'sent';
  bookingId: string;
  referenceId: string;
  toEmail: string;
  riderName: string;
  subject: string;
  textBody: string;
  sentByEmail: string;
  acceptedAt: string;
}

const mockMailOutbox: MockMailDeliveryRecord[] = [];
const MAX_OUTBOX_ITEMS = 100;

function readFirebaseApiKey(): string {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as FirebaseAppletConfig;
    return typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
  } catch {
    return '';
  }
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

async function verifyAdminIdToken(authHeader: string | undefined): Promise<VerifiedFirebaseUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (idToken.length < 20 || idToken.length > 4096) {
    return null;
  }

  const apiKey = readFirebaseApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
      }>;
    };

    const user = payload.users?.[0];
    if (!user?.localId || !user.email || user.emailVerified !== true) {
      return null;
    }

    if (!ADMIN_ALLOWLIST.has(user.email.toLowerCase())) {
      return null;
    }

    return {
      uid: user.localId,
      email: user.email,
      emailVerified: true,
    };
  } catch {
    return null;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, mailProvider: 'mock-mail-service' });
  });

  // Assistant capabilities metadata
  app.get('/api/assistant/status', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      chatModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
      liveModel: 'gemini-3.8-live',
    });
  });

  // Multi-turn Gemini Chatbot (Server-Sent Events streaming)
  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const parsed = parseChatRequestBody(req.body);
    if (parsed.messages.length === 0) {
      res.status(400).json({ ok: false, error: 'Please enter a message to start chatting.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    const writeEvent = (payload: Record<string, unknown>) => {
      if (!clientDisconnected && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      await streamScooterChat(parsed, (delta) => {
        writeEvent({ delta });
      });
      writeEvent({ done: true, model: parsed.model });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      writeEvent({ error: formatGeminiErrorMessage(rawMessage) });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // Protected Admin API: Trigger confirmation email via mock mail service
  app.post('/api/send-confirmation', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminIdToken(req.headers.authorization);
    if (!adminUser) {
      res.status(401).json({
        ok: false,
        error: 'Verified admin authentication is required to send confirmation emails.',
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const bookingId = cleanString(body.bookingId, 128);
    const referenceId = cleanString(body.referenceId, 32);
    const toEmail = cleanString(body.toEmail, 120);
    const riderName = cleanString(body.riderName, 100);
    const subject = cleanString(body.subject, 180);
    const textBody = cleanString(body.textBody, 4000);

    if (!bookingId || !/^[a-zA-Z0-9_-]+$/.test(bookingId)) {
      res.status(400).json({ ok: false, error: 'Valid bookingId is required.' });
      return;
    }
    if (!referenceId || !isValidEmail(toEmail) || !subject || !textBody) {
      res.status(400).json({
        ok: false,
        error: 'Valid referenceId, recipient email, subject, and message body are required.',
      });
      return;
    }

    const messageId = `mock-rcs-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const acceptedAt = new Date().toISOString();

    const record: MockMailDeliveryRecord = {
      messageId,
      provider: 'mock-mail-service',
      status: 'sent',
      bookingId,
      referenceId,
      toEmail,
      riderName: riderName || 'Customer',
      subject,
      textBody,
      sentByEmail: adminUser.email,
      acceptedAt,
    };

    mockMailOutbox.unshift(record);
    if (mockMailOutbox.length > MAX_OUTBOX_ITEMS) {
      mockMailOutbox.length = MAX_OUTBOX_ITEMS;
    }

    console.info(
      `[MockMailService] Accepted confirmation email ${messageId} -> ${toEmail} (${referenceId})`,
    );

    res.status(200).json({
      ok: true,
      provider: record.provider,
      status: record.status,
      messageId: record.messageId,
      acceptedAt: record.acceptedAt,
      to: record.toEmail,
      subject: record.subject,
    });
  });

  // Protected Admin API: Inspect recent mock mail deliveries
  app.get('/api/mail-outbox', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminIdToken(req.headers.authorization);
    if (!adminUser) {
      res.status(401).json({ ok: false, error: 'Verified admin authentication required.' });
      return;
    }

    res.status(200).json({
      ok: true,
      provider: 'mock-mail-service',
      items: mockMailOutbox.slice(0, 25),
    });
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  attachLiveVoiceWebSocket(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.info(`Rain City Scooter server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
