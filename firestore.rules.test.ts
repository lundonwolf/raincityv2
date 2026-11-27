import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');

function readRules(): string {
  const target = fs.existsSync(rulesPath) ? rulesPath : draftPath;
  return fs.readFileSync(target, 'utf8');
}

test('Dirty Dozen security invariants are enforced in Firestore rules', () => {
  const rules = readRules();

  // 1. Default deny safety net
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

  // 2. Email spoofing protection: email_verified == true required
  assert.match(rules, /request\.auth\.token\.email_verified == true/);

  // 3. Bootstrapped admin email present
  assert.match(rules, /lundonwolf@gmail\.com/i);

  // 4. PII isolation: bookings and customers disallow non-admin get/list
  assert.match(rules, /match \/bookings\/\{bookingId\}[\s\S]*allow get: if isValidId\(bookingId\) && isAdmin\(\);/);
  assert.match(rules, /match \/bookings\/\{bookingId\}[\s\S]*allow list: if isAdmin\(\);/);
  assert.match(rules, /match \/customers\/\{customerId\}[\s\S]*allow get: if isValidId\(customerId\) && isAdmin\(\);/);
  assert.match(rules, /match \/customers\/\{customerId\}[\s\S]*allow list: if isAdmin\(\);/);

  // 5. Public booking creation enforces status == 'new', empty adminNotes, server timestamps
  assert.match(rules, /incoming\(\)\.status == 'new'/);
  assert.match(rules, /incoming\(\)\.adminNotes == ''/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);

  // 6. Strict key allowlists (hasAll + hasOnly) and affectedKeys().hasOnly on updates
  assert.ok(rules.includes('data.keys().hasAll('));
  assert.ok(rules.includes('data.keys().hasOnly('));
  assert.ok(rules.includes('affectedKeys().hasOnly('));

  // 7. Path ID hardening & bounded arrays
  assert.ok(rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"));
  assert.ok(rules.includes('data.serviceIds.size() <= 12'));

  // 8. Admin role table prevents self-assignment
  assert.match(rules, /match \/admins\/\{uid\}[\s\S]*allow create: if isBootstrappedAdmin\(\)/);

  // 9. Optional googlePlaceId validated cleanly on siteSettings
  assert.ok(rules.includes("'googlePlaceId'"));
  assert.ok(rules.includes("data.googlePlaceId.matches('^[a-zA-Z0-9_\\\\-]*$')"));
});
