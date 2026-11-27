# Rain City Scooter Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: All unmatched paths are denied (`allow read, write: if false`).
2. **PII Isolation & Customer Self-Service**: `bookings` and `customers` contain personal contact details (`email`, `phone`, `address`). Public visitors can NEVER `get`, `list`, `update`, or `delete` any booking or customer profile. Verified signed-in customers may only `get` or `list` their OWN bookings (where `resource.data.customerUid == request.auth.uid` or `resource.data.contactEmail == request.auth.token.email`) and can never mutate or delete bookings directly.
3. **Public Booking Create Gate**: Unauthenticated or signed-in visitors may only `create` a document in `/bookings/{bookingId}` if:
   - `bookingId` matches `^[a-zA-Z0-9_\-]+$` and `<= 128` chars.
   - `status == 'new'` and `adminNotes == ''` (prevents spoofing confirmed bookings or internal mechanic notes).
   - Optional `customerUid` is only accepted when equal to `request.auth.uid` for an authenticated user.
   - Exact key allowlist (`hasAll` + `hasOnly`) with zero shadow fields.
   - Server timestamps enforced: `createdAt == request.time && updatedAt == request.time`.
   - Every string and array has explicit `.size()` bounds.
4. **Verified Admin Gate**: Admin privileges require `request.auth != null` AND `request.auth.token.email_verified == true` AND either the bootstrapped owner email (`lundonwolf@gmail.com`) or an existing `/admins/{uid}` document. Server-side confirmation email routes (`/api/send-confirmation`, `/api/mail-outbox`) independently verify the Firebase ID token and admin email on the backend.
5. **Immutable Booking Fields**: On booking updates, `referenceId` and `createdAt` can never change; `updatedAt == request.time`.
6. **Customer Accounts (`/userAccounts/{uid}`)**: Strictly isolated to `uid == request.auth.uid` (verified email) or verified admins, with schema validation and server timestamps.
7. **Booking Updates & Messaging (`/bookings/{bookingId}/messages/{messageId}`)**: Messages are append-only (`update`/`delete` denied). Verified customers may only read messages matching their own email/UID and may only create `senderRole == 'customer'` and `messageType == 'chat'` messages on bookings they own (verified against parent booking). Only verified admins may post `admin` replies, `status_update`, or `confirmation_email` events.
8. **Public Catalog Read, Admin Write**: `siteSettings` and `services` are publicly readable so the website renders live pricing and business settings, and strictly writable only by verified admins with full schema validation.

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
13. Customer posting `senderRole: 'admin'` or `messageType: 'confirmation_email'` in `/bookings/{id}/messages` -> DENIED (Role & Event Spoofing).
14. Customer accessing another customer's `/userAccounts/{otherUid}` -> DENIED (Account Isolation).
