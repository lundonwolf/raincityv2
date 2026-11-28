import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64PcmToFloat32,
  buildScooterAssistantSystemInstruction,
  computeRmsLevel,
  float32ToInt16Pcm,
  formatGeminiErrorMessage,
  pcmFloat32ToBase64,
  resampleFloat32,
  resolveChatModel,
  resolveLiveVoice,
  sanitizeChatHistory,
} from './assistantUtils';

test('resolveChatModel and resolveLiveVoice enforce strict allowlists with defaults', () => {
  assert.equal(resolveChatModel('gemini-4-hydrogen'), 'gemini-4-hydrogen');
  assert.equal(resolveChatModel('gemini-3.1-flash-lite'), 'gemini-3.1-flash-lite');
  assert.equal(resolveChatModel('gemini-1.5-pro'), 'gemini-4-hydrogen');
  assert.equal(resolveChatModel(null), 'gemini-4-hydrogen');

  assert.equal(resolveLiveVoice('Kore'), 'Kore');
  assert.equal(resolveLiveVoice('Fenrir'), 'Fenrir');
  assert.equal(resolveLiveVoice('UnknownVoice'), 'Zephyr');
  assert.equal(resolveLiveVoice(undefined), 'Zephyr');
});

test('sanitizeChatHistory trims, filters invalid turns, and enforces max turns', () => {
  const input = [
    { role: 'user', text: '  Hello mechanic  ' },
    { role: 'system', text: 'should be stripped' },
    { role: 'model', text: '   ' },
    { role: 'model', text: 'Hi! What scooter do you ride?' },
    { role: 'user', text: 'Segway Ninebot Max G2' },
  ];

  const cleaned = sanitizeChatHistory(input, 2);
  assert.equal(cleaned.length, 2);
  assert.deepEqual(cleaned, [
    { role: 'model', text: 'Hi! What scooter do you ride?' },
    { role: 'user', text: 'Segway Ninebot Max G2' },
  ]);
});

test('buildScooterAssistantSystemInstruction embeds live shop settings, pricing, and mode rules', () => {
  const chatPrompt = buildScooterAssistantSystemInstruction(
    {
      businessName: 'Rain City Scooter',
      hourlyRate: 50,
      warrantyDays: 45,
      phoneDisplay: '(425) 476-6177',
    },
    undefined,
    'chat',
  );
  assert.match(chatPrompt, /Rain City Scooter/);
  assert.match(chatPrompt, /\$50\/hr/);
  assert.match(chatPrompt, /45-day workmanship warranty/);
  assert.match(chatPrompt, /CHAT RESPONSE RULES/);

  const voicePrompt = buildScooterAssistantSystemInstruction(undefined, undefined, 'voice');
  assert.match(voicePrompt, /VOICE CONVERSATION RULES/);
  assert.match(voicePrompt, /Never use markdown/);
});

test('PCM 16-bit encoding/decoding round-trips and clamps out-of-range samples', () => {
  const input = new Float32Array([0, 0.5, -0.5, 1.4, -1.8]);
  const int16 = float32ToInt16Pcm(input);
  assert.equal(int16[0], 0);
  assert.equal(int16[3], 32767);
  assert.equal(int16[4], -32768);

  const b64 = pcmFloat32ToBase64(input);
  const decoded = base64PcmToFloat32(b64);
  assert.equal(decoded.length, input.length);
  assert.ok(Math.abs(decoded[1] - 0.5) < 0.001);
  assert.ok(Math.abs(decoded[2] + 0.5) < 0.001);
  assert.ok(Math.abs(decoded[3] - 1.0) < 0.001);
  assert.ok(Math.abs(decoded[4] + 1.0) < 0.001);
});

test('resampleFloat32 downsamples 48kHz to 16kHz cleanly and computeRmsLevel stays in [0, 1]', () => {
  const src = new Float32Array(480);
  src.fill(0.25);
  const resampled = resampleFloat32(src, 48000, 16000);
  assert.equal(resampled.length, 160);
  assert.ok(Math.abs(resampled[0] - 0.25) < 0.0001);

  assert.equal(computeRmsLevel(new Float32Array(0)), 0);
  const loud = new Float32Array([1, -1, 1, -1]);
  assert.equal(computeRmsLevel(loud), 1);
});

test('formatGeminiErrorMessage maps API key and quota errors to user-friendly guidance', () => {
  assert.match(formatGeminiErrorMessage('API_KEY_INVALID: bad key'), /Settings > Secrets/);
  assert.match(formatGeminiErrorMessage('429 RESOURCE_EXHAUSTED'), /quota|rate limit/i);
  assert.match(formatGeminiErrorMessage('404 NOT_FOUND model'), /temporarily unavailable/i);
});
