# Rain City Scooter Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: All unmatched paths are denied (`allow read, write: if false`).
2. **PII Isolation**: `bookings` and `customers` contain personal contact details (`email`, `phone`, `address`). Public or non-admin users can NEVER `get`, `list`, `update`, or `delete` any booking or customer profile.
3. **Public Booking Create Gate**: Unauthenticated or signed-in visitors may only `create` a document in `/bookings/{bookingId}` if:
   - `bookingId` matches `^[a-zA-Z0-9_\-]+$` and `<= 128` chars.
   - `status == 'new'` and `adminNotes == ''` (prevents spoofing confirmed bookings or internal mechanic notes).
   - Exact key allowlist (`hasAll` + `hasOnly`) with zero shadow fields.
   - Server timestamps enforced: `createdAt == request.time && updatedAt == request.time`.
   - Every string and array has explicit `.size()` bounds.
4. **Verified Admin Gate**: Admin privileges require `request.auth != null` AND `request.auth.token.email_verified == true` AND either the bootstrapped owner email (`lundonwolf@gmail.com`) or an existing `/admins/{uid}` document.
5. **Immutable Booking Fields**: On booking updates, `referenceId` and `createdAt` can never change; `updatedAt == request.time`.
6. **Public Catalog Read, Admin Write**: `siteSettings` and `services` are publicly readable so the website renders live pricing and business settings, and strictly writable only by verified admins with full schema validation.

## 2. The "Dirty Dozen" Attack Payloads
1. Unauthenticated `get` on `/bookings/b1` -> DENIED (PII isolation).
2. Unauthenticated `list` on `/bookings` -> DENIED (PII scraping).
3. Non-admin authenticated `list` on `/customers` -> DENIED (PII isolation).
4. Spoofed admin email (`lundonwolf@gmail.com`) with `email_verified: false` -> DENIED (Email Spoofing Test).
5. Booking `create` with shadow field `isPaid: true` -> DENIED (Shadow Update / Create Test).
6. Booking `create` with `status: 'confirmed'` -> DENIED (State Shortcutting).
7. Booking `create` with `adminNotes: 'Free repair'` -> DENIED (System/Admin Field Protection).
8. Booking `create` with forged client `createdAt` != `request.time` -> DENIED (Temporal Integrity).
9. Booking `create` with oversized `bookingId` (>128 chars or invalid chars `../hack`) -> DENIED (Path Variable Hardening).
10. Booking `create` with `serviceIds` array length > 12 -> DENIED (Total Array Guarding).
11. Non-admin `update` on `/siteSettings/main` (attempting to set `hourlyRate: 0`) -> DENIED (RBAC).
12. Non-admin `create` on `/admins/attackerUid` (self-assigned admin privilege) -> DENIED (Privilege Escalation).
