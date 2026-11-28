import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CODE_SNIPPETS, type CodeSnippetRecord } from '../data/scooterData';
import {
  generateSnippetId,
  getEnabledSnippetsForPlacement,
  getSnippetCodePreview,
  isSafeSnippetUrl,
  validateCodeSnippetInput,
} from './codeSnippets';

test('generateSnippetId creates Firestore-safe alphanumeric hyphenated IDs', () => {
  const id = generateSnippetId('Google Reviews (Trustindex)!', 173000012345);
  assert.match(id, /^[a-zA-Z0-9_-]{2,64}$/);
  assert.ok(id.startsWith('google-reviews-trustindex-'));

  const fallback = generateSnippetId('!!!', 173000099999);
  assert.match(fallback, /^snippet-\d{5}$/);
});

test('isSafeSnippetUrl permits https/http/relative URLs and blocks javascript/data/vbscript', () => {
  assert.equal(isSafeSnippetUrl('https://cdn.trustindex.io/loader.js?abc'), true);
  assert.equal(isSafeSnippetUrl('//cdn.example.com/widget.js'), true);
  assert.equal(isSafeSnippetUrl('/assets/embed.js'), true);
  assert.equal(isSafeSnippetUrl('javascript:alert(1)'), false);
  assert.equal(isSafeSnippetUrl('vbscript:msgbox(1)'), false);
  assert.equal(isSafeSnippetUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeSnippetUrl(''), false);
});

test('validateCodeSnippetInput validates name, placement, length, and unsafe URLs', () => {
  const bad = validateCodeSnippetInput({
    name: 'A',
    placement: 'invalid_slot',
    code: '',
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.name);
  assert.ok(bad.errors.placement);
  assert.ok(bad.errors.code);

  const unsafe = validateCodeSnippetInput({
    name: 'Bad Link',
    placement: 'home_section',
    code: '<a href="javascript:alert(1)">Click</a>',
  });
  assert.equal(unsafe.valid, false);
  assert.match(unsafe.errors.code ?? '', /unsafe/i);

  const good = validateCodeSnippetInput({
    name: 'Trustindex Reviews',
    placement: 'reviews_section',
    code: "<script defer async src='https://cdn.trustindex.io/loader.js?630546f86466713ee556f97ca06'></script>",
  });
  assert.equal(good.valid, true);
  assert.deepEqual(good.errors, {});
});

test('getEnabledSnippetsForPlacement filters enabled snippets and sorts by sortOrder', () => {
  const list: CodeSnippetRecord[] = [
    ...DEFAULT_CODE_SNIPPETS,
    {
      id: 'disabled-widget',
      name: 'Disabled Widget',
      placement: 'reviews_section',
      code: '<div>off</div>',
      enabled: false,
      sortOrder: 0,
      updatedAtIso: '',
    },
    {
      id: 'ga4-head',
      name: 'GA4',
      placement: 'head',
      code: '<script src="https://www.googletagmanager.com/gtag/js?id=G-123"></script>',
      enabled: true,
      sortOrder: 2,
      updatedAtIso: '',
    },
  ];

  const reviews = getEnabledSnippetsForPlacement(list, 'reviews_section');
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].id, 'google-reviews-trustindex');

  const head = getEnabledSnippetsForPlacement(list, 'head');
  assert.equal(head.length, 1);
  assert.equal(head[0].id, 'ga4-head');

  assert.equal(getSnippetCodePreview('<div>  hello \n world </div>', 20), '<div> hello world <…');
});
