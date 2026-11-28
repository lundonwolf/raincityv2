import {
  DEFAULT_SITE_SETTINGS,
  SCOOTER_SERVICES,
  type ScooterService,
  type SiteSettings,
} from '../data/scooterData';

export type AssistantChatModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
export type LiveVoiceName = 'Zephyr' | 'Kore' | 'Puck' | 'Fenrir' | 'Charon';

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAtIso: string;
  model?: AssistantChatModel;
}

export interface SanitizedChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ChatModelOption {
  id: AssistantChatModel;
  label: string;
  badge: string;
  description: string;
}

export const CHAT_MODEL_OPTIONS: ChatModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'General Mechanic',
    badge: 'Balanced',
    description: 'Detailed scooter troubleshooting, repair estimates, and service advice',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Quick Triage',
    badge: 'Fast',
    description: 'Fast answers for pricing, hours, warranty terms, and quick checks',
  },
];

export const LIVE_VOICE_OPTIONS: { name: LiveVoiceName; tone: string }[] = [
  { name: 'Zephyr', tone: 'Warm & clear' },
  { name: 'Kore', tone: 'Crisp & steady' },
  { name: 'Puck', tone: 'Upbeat & friendly' },
  { name: 'Fenrir', tone: 'Calm & direct' },
  { name: 'Charon', tone: 'Deep & measured' },
];

export const ASSISTANT_QUICK_PROMPTS: string[] = [
  'My rear tire went flat — which service should I book and what does labor cost?',
  "My scooter won't power on after riding in the rain. What should I check first?",
  'What is the difference between the Silver Tune-Up and Gold Service?',
  'When are you open and how does mobile booking work?',
];

const ALLOWED_CHAT_MODELS = new Set<string>(CHAT_MODEL_OPTIONS.map((m) => m.id));
const ALLOWED_LIVE_VOICES = new Set<string>(LIVE_VOICE_OPTIONS.map((v) => v.name));

export function resolveChatModel(raw: unknown): AssistantChatModel {
  if (typeof raw === 'string' && ALLOWED_CHAT_MODELS.has(raw.trim())) {
    return raw.trim() as AssistantChatModel;
  }
  return 'gemini-4-hydrogen';
}

export function resolveLiveVoice(raw: unknown): LiveVoiceName {
  if (typeof raw === 'string' && ALLOWED_LIVE_VOICES.has(raw.trim())) {
    return raw.trim() as LiveVoiceName;
  }
  return 'Zephyr';
}

export function sanitizeChatHistory(
  raw: unknown,
  maxTurns = 24,
  maxCharsPerTurn = 2500,
): SanitizedChatTurn[] {
  if (!Array.isArray(raw)) return [];

  const cleaned: SanitizedChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const role = record.role === 'user' || record.role === 'model' ? record.role : null;
    const text = typeof record.text === 'string' ? record.text.trim().slice(0, maxCharsPerTurn) : '';
    if (!role || !text) continue;
    cleaned.push({ role, text });
  }

  if (cleaned.length > maxTurns) {
    return cleaned.slice(cleaned.length - maxTurns);
  }
  return cleaned;
}

function formatServiceLine(service: ScooterService): string {
  const priceText =
    service.pricingType === 'hourly'
      ? `$${service.price}/hr`
      : service.pricingType === 'from'
        ? `from $${service.price}`
        : `$${service.price}`;
  const includesText =
    service.includes.length > 0 ? ` Includes: ${service.includes.slice(0, 4).join('; ')}.` : '';
  return `- ${service.title} (${priceText}, ~${service.durationMinutes} min): ${service.summary}${includesText}`;
}

export function buildScooterAssistantSystemInstruction(
  settingsInput?: Partial<SiteSettings>,
  servicesInput?: ScooterService[],
  mode: 'chat' | 'voice' = 'chat',
): string {
  const settings: SiteSettings = { ...DEFAULT_SITE_SETTINGS, ...(settingsInput ?? {}) };
  const activeServices = (servicesInput && servicesInput.length > 0 ? servicesInput : SCOOTER_SERVICES)
    .filter((svc) => svc.active)
    .slice(0, 16);

  const serviceCatalogLines = activeServices.map(formatServiceLine).join('\n');
  const brandsLine = settings.supportedBrands.slice(0, 20).join(', ');

  const modeRules =
    mode === 'voice'
      ? [
          'VOICE CONVERSATION RULES:',
          '- You are speaking live with the rider over voice audio.',
          '- Keep every reply concise, natural, and conversational (1 to 3 short sentences at a time).',
          '- Never use markdown formatting, bullet points, hashtags, or asterisks.',
          '- Ask one clarifying question at a time if you need their scooter model or symptom.',
        ].join('\n')
      : [
          'CHAT RESPONSE RULES:',
          '- Be helpful, concise, and practical like an experienced electric scooter mechanic.',
          '- Keep replies clear and scannable (2 to 5 short sentences or a compact list when comparing packages).',
          '- When recommending a repair, mention the matching service name, labor estimate, and suggest booking via the Book Repair page.',
        ].join('\n');

  return [
    `You are the official Repair Advisor and Booking Assistant for ${settings.businessName}, a mobile electric scooter and mobility scooter repair shop.`,
    '',
    'VERIFIED BUSINESS FACTS (always stay accurate to these):',
    `- Business Name: ${settings.businessName}`,
    `- Contact: Phone ${settings.phoneDisplay} | Email ${settings.email}`,
    `- Operating Hours: ${settings.hoursShort} (Mon, Fri, Sat, and Sun; closed Tue–Thu)`,
    `- Dispatch Fee: $0 — ${settings.dispatchPolicyNote}`,
    `- General Hourly Labor Rate: $${settings.hourlyRate}/hr (labor only; parts and applicable tax are additional and always approved before work)`,
    `- Electrical Diagnosis Policy: $45 electrical diagnosis fee is credited toward repair labor if the rider proceeds with repair on the same visit.`,
    `- Workmanship Warranty: ${settings.warrantyDays}-day workmanship warranty on every repair and tune-up.`,
    `- Payment: No upfront payment is collected to schedule online; payment is collected after repair is completed.`,
    `- Common Scooter Makes Serviced: ${brandsLine}.`,
    '',
    'CURRENT SERVICE MENU:',
    serviceCatalogLines,
    '',
    'SAFETY & HONESTY GUARDRAILS:',
    '- Never tell a rider to open a lithium-ion battery pack, bypass a BMS, or ride a scooter with failing brakes or a cracked folding stem.',
    '- Never invent discounts, turnaround guarantees, or unverified parts prices; give labor estimates from the menu above and note that parts are quoted separately.',
    '- Never mention dispatch zones or service area boundaries unless the rider asks directly; simply explain we come to their location with $0 travel fees.',
    '- You cannot directly modify or submit bookings in the database yourself; guide the rider to click "Book Repair" to lock in a day and 2-hour arrival window.',
    '',
    modeRules,
  ].join('\n');
}

export function float32ToInt16Pcm(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return pcm;
}

export function int16PcmToFloat32(pcm: Int16Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(new ArrayBuffer(pcm.length * 4));
  for (let i = 0; i < pcm.length; i += 1) {
    out[i] = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff;
  }
  return out;
}

export function resampleFloat32(
  samples: Float32Array,
  fromSampleRate: number,
  toSampleRate: number,
): Float32Array {
  if (
    samples.length === 0 ||
    fromSampleRate <= 0 ||
    toSampleRate <= 0 ||
    Math.round(fromSampleRate) === Math.round(toSampleRate)
  ) {
    return samples;
  }

  const ratio = fromSampleRate / toSampleRate;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const result = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, samples.length - 1);
    const weight = srcIndex - lower;
    result[i] = samples[lower] * (1 - weight) + samples[upper] * weight;
  }

  return result;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined' && typeof btoa === 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined' && typeof atob === 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function pcmFloat32ToBase64(samples: Float32Array): string {
  const pcm16 = float32ToInt16Pcm(samples);
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  return uint8ToBase64(bytes);
}

export function base64PcmToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const bytes = base64ToUint8(base64);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const pcm16 = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    pcm16[i] = view.getInt16(i * 2, true);
  }
  return int16PcmToFloat32(pcm16);
}

export function computeRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.min(1, Math.max(0, rms * 3.5));
}

export function formatGeminiErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('gemini_api_key') ||
    lower.includes('api key')
  ) {
    return 'The Gemini API key is missing or invalid. Please check your key in Settings > Secrets.';
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return 'Gemini API rate limit or quota was reached. Please try again in a moment or check Settings > Secrets.';
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return 'The requested Gemini model is temporarily unavailable. Please switch modes or try again.';
  }
  return raw.trim() || 'Could not reach the assistant right now. Please try again.';
}
