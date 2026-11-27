import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapFirebaseAuthError,
  normalizeEmailAddress,
  validateEmailAuthInput,
} from './customerAuth';

test('normalizeEmailAddress trims whitespace and lowercases emails', () => {
  assert.equal(normalizeEmailAddress('  Alex.Rider@iCloud.COM  '), 'alex.rider@icloud.com');
});

test('validateEmailAuthInput enforces signup fields and password match', () => {
  const empty = validateEmailAuthInput('signup', {
    fullName: '',
    email: 'bad-email',
    password: '123',
    confirmPassword: '456',
  });
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.fullName);
  assert.ok(empty.errors.email);
  assert.ok(empty.errors.password);
  assert.ok(empty.errors.confirmPassword);

  const valid = validateEmailAuthInput('signup', {
    fullName: '  Jamie Chen  ',
    email: 'Jamie@Outlook.com ',
    password: 'scooter-2026',
    confirmPassword: 'scooter-2026',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedEmail, 'jamie@outlook.com');
  assert.equal(valid.trimmedName, 'Jamie Chen');
  assert.deepEqual(valid.errors, {});
});

test('validateEmailAuthInput validates signin and password reset modes', () => {
  const badSignIn = validateEmailAuthInput('signin', {
    email: 'rider@yahoo.com',
    password: '',
  });
  assert.equal(badSignIn.valid, false);
  assert.ok(badSignIn.errors.password);

  const goodSignIn = validateEmailAuthInput('signin', {
    email: 'rider@yahoo.com',
    password: 'mypassword',
  });
  assert.equal(goodSignIn.valid, true);

  const goodReset = validateEmailAuthInput('reset', {
    email: 'rider@proton.me',
  });
  assert.equal(goodReset.valid, true);
  assert.equal(goodReset.normalizedEmail, 'rider@proton.me');
});

test('mapFirebaseAuthError converts Firebase auth error codes to user-friendly guidance', () => {
  assert.match(
    mapFirebaseAuthError({ code: 'auth/operation-not-allowed' }),
    /Firebase Console/i,
  );
  assert.match(
    mapFirebaseAuthError({ code: 'auth/email-already-in-use' }),
    /already exists/i,
  );
  assert.match(
    mapFirebaseAuthError({ code: 'auth/invalid-credential' }),
    /incorrect/i,
  );
  assert.match(
    mapFirebaseAuthError({ code: 'auth/weak-password' }),
    /6 characters/i,
  );
  assert.equal(mapFirebaseAuthError(new Error('Custom error')), 'Custom error');
});
