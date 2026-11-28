import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_CODE_SNIPPETS,
  DEFAULT_SITE_SETTINGS,
  SCOOTER_SERVICES,
  type BookingMessageRecord,
  type BookingMessageType,
  type BookingRecord,
  type BookingStatus,
  type CodeSnippetPlacement,
  type CodeSnippetRecord,
  type CustomerProfileRecord,
  type OperatingDay,
  type ScooterService,
  type SiteSettings,
  type TimeWindow,
  type UserAccountRecord,
} from '../data/scooterData';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isValidDateKey } from '../utils/bookingDates';
import { isValidSnippetPlacement } from '../utils/codeSnippets';

function trimStr(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

function readOptionalString(val: unknown, fallback: string): string {
  return typeof val === 'string' ? val : fallback;
}

function readOptionalNonEmptyString(val: unknown, fallback: string): string {
  return typeof val === 'string' && val.trim().length > 0 ? val : fallback;
}

function sanitizeStringList(
  val: unknown,
  maxItems: number,
  maxItemLen: number,
  fallback: string[],
): string[] {
  if (!Array.isArray(val)) return fallback;
  return val
    .map((item) => trimStr(String(item ?? ''), maxItemLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function subscribeSiteSettings(
  onData: (settings: SiteSettings) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'siteSettings', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SITE_SETTINGS);
        return;
      }
      const d = snap.data();
      onData({
        businessName: readOptionalNonEmptyString(d.businessName, DEFAULT_SITE_SETTINGS.businessName),
        tagline: readOptionalNonEmptyString(d.tagline, DEFAULT_SITE_SETTINGS.tagline),
        phoneDisplay: readOptionalNonEmptyString(d.phoneDisplay, DEFAULT_SITE_SETTINGS.phoneDisplay),
        email: readOptionalNonEmptyString(d.email, DEFAULT_SITE_SETTINGS.email),
        hoursShort: readOptionalNonEmptyString(d.hoursShort, DEFAULT_SITE_SETTINGS.hoursShort),
        hourlyRate: typeof d.hourlyRate === 'number' ? d.hourlyRate : DEFAULT_SITE_SETTINGS.hourlyRate,
        dispatchPolicyNote: readOptionalNonEmptyString(
          d.dispatchPolicyNote,
          DEFAULT_SITE_SETTINGS.dispatchPolicyNote,
        ),
        warrantyDays: typeof d.warrantyDays === 'number' ? d.warrantyDays : DEFAULT_SITE_SETTINGS.warrantyDays,
        announcement: readOptionalString(d.announcement, ''),
        googlePlaceId: readOptionalString(d.googlePlaceId, ''),
        heroEyebrow: readOptionalNonEmptyString(d.heroEyebrow, DEFAULT_SITE_SETTINGS.heroEyebrow),
        heroHeadline: readOptionalNonEmptyString(d.heroHeadline, DEFAULT_SITE_SETTINGS.heroHeadline),
        heroSubcopy: readOptionalNonEmptyString(d.heroSubcopy, DEFAULT_SITE_SETTINGS.heroSubcopy),
        studioKicker: readOptionalNonEmptyString(d.studioKicker, DEFAULT_SITE_SETTINGS.studioKicker),
        studioHeadline: readOptionalNonEmptyString(d.studioHeadline, DEFAULT_SITE_SETTINGS.studioHeadline),
        pricingEyebrow: readOptionalNonEmptyString(d.pricingEyebrow, DEFAULT_SITE_SETTINGS.pricingEyebrow),
        pricingHeadline: readOptionalNonEmptyString(d.pricingHeadline, DEFAULT_SITE_SETTINGS.pricingHeadline),
        pricingIntro: readOptionalNonEmptyString(d.pricingIntro, DEFAULT_SITE_SETTINGS.pricingIntro),
        standupHourlyItems: sanitizeStringList(
          d.standupHourlyItems,
          16,
          160,
          DEFAULT_SITE_SETTINGS.standupHourlyItems,
        ),
        mobilityHourlyItems: sanitizeStringList(
          d.mobilityHourlyItems,
          16,
          160,
          DEFAULT_SITE_SETTINGS.mobilityHourlyItems,
        ),
        estimateRules: sanitizeStringList(
          d.estimateRules,
          16,
          240,
          DEFAULT_SITE_SETTINGS.estimateRules,
        ),
        reviewsHeadline: readOptionalNonEmptyString(d.reviewsHeadline, DEFAULT_SITE_SETTINGS.reviewsHeadline),
        reviewsIntro: readOptionalNonEmptyString(d.reviewsIntro, DEFAULT_SITE_SETTINGS.reviewsIntro),
        supportedBrands: sanitizeStringList(
          d.supportedBrands,
          30,
          60,
          DEFAULT_SITE_SETTINGS.supportedBrands,
        ),
        bookingHeadline: readOptionalNonEmptyString(d.bookingHeadline, DEFAULT_SITE_SETTINGS.bookingHeadline),
        bookingIntro: readOptionalNonEmptyString(d.bookingIntro, DEFAULT_SITE_SETTINGS.bookingIntro),
        policyEffectiveDate: readOptionalNonEmptyString(
          d.policyEffectiveDate,
          DEFAULT_SITE_SETTINGS.policyEffectiveDate,
        ),
        warrantyHighlightNote: readOptionalNonEmptyString(
          d.warrantyHighlightNote,
          DEFAULT_SITE_SETTINGS.warrantyHighlightNote,
        ),
        termsScopeNote: readOptionalNonEmptyString(d.termsScopeNote, DEFAULT_SITE_SETTINGS.termsScopeNote),
        privacyIntroNote: readOptionalNonEmptyString(
          d.privacyIntroNote,
          DEFAULT_SITE_SETTINGS.privacyIntroNote,
        ),
        footerNote: readOptionalString(d.footerNote, ''),
      });
    },
    (error) => {
      console.warn('SiteSettings listener fallback:', error.message);
      onData(DEFAULT_SITE_SETTINGS);
    },
  );
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const path = 'siteSettings/main';
  const cleanPlaceId = (settings.googlePlaceId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);
  try {
    await setDoc(doc(db, 'siteSettings', 'main'), {
      businessName: trimStr(settings.businessName || DEFAULT_SITE_SETTINGS.businessName, 80),
      tagline: trimStr(settings.tagline || DEFAULT_SITE_SETTINGS.tagline, 180),
      phoneDisplay: trimStr(settings.phoneDisplay || DEFAULT_SITE_SETTINGS.phoneDisplay, 32),
      email: trimStr(settings.email || DEFAULT_SITE_SETTINGS.email, 120),
      hoursShort: trimStr(settings.hoursShort || DEFAULT_SITE_SETTINGS.hoursShort, 100),
      hourlyRate: Math.max(0, Math.min(500, Number(settings.hourlyRate) || 45)),
      dispatchPolicyNote: trimStr(
        settings.dispatchPolicyNote || DEFAULT_SITE_SETTINGS.dispatchPolicyNote,
        240,
      ),
      warrantyDays: Math.max(0, Math.min(365, Number(settings.warrantyDays) || 30)),
      announcement: trimStr(settings.announcement || '', 240),
      googlePlaceId: cleanPlaceId,
      heroEyebrow: trimStr(settings.heroEyebrow || DEFAULT_SITE_SETTINGS.heroEyebrow, 80),
      heroHeadline: trimStr(settings.heroHeadline || DEFAULT_SITE_SETTINGS.heroHeadline, 160),
      heroSubcopy: trimStr(settings.heroSubcopy || DEFAULT_SITE_SETTINGS.heroSubcopy, 360),
      studioKicker: trimStr(settings.studioKicker || DEFAULT_SITE_SETTINGS.studioKicker, 80),
      studioHeadline: trimStr(settings.studioHeadline || DEFAULT_SITE_SETTINGS.studioHeadline, 160),
      pricingEyebrow: trimStr(settings.pricingEyebrow || DEFAULT_SITE_SETTINGS.pricingEyebrow, 100),
      pricingHeadline: trimStr(settings.pricingHeadline || DEFAULT_SITE_SETTINGS.pricingHeadline, 140),
      pricingIntro: trimStr(settings.pricingIntro || DEFAULT_SITE_SETTINGS.pricingIntro, 360),
      standupHourlyItems: sanitizeStringList(
        settings.standupHourlyItems,
        16,
        160,
        DEFAULT_SITE_SETTINGS.standupHourlyItems,
      ),
      mobilityHourlyItems: sanitizeStringList(
        settings.mobilityHourlyItems,
        16,
        160,
        DEFAULT_SITE_SETTINGS.mobilityHourlyItems,
      ),
      estimateRules: sanitizeStringList(
        settings.estimateRules,
        16,
        240,
        DEFAULT_SITE_SETTINGS.estimateRules,
      ),
      reviewsHeadline: trimStr(settings.reviewsHeadline || DEFAULT_SITE_SETTINGS.reviewsHeadline, 140),
      reviewsIntro: trimStr(settings.reviewsIntro || DEFAULT_SITE_SETTINGS.reviewsIntro, 360),
      supportedBrands: sanitizeStringList(
        settings.supportedBrands,
        30,
        60,
        DEFAULT_SITE_SETTINGS.supportedBrands,
      ),
      bookingHeadline: trimStr(settings.bookingHeadline || DEFAULT_SITE_SETTINGS.bookingHeadline, 140),
      bookingIntro: trimStr(settings.bookingIntro || DEFAULT_SITE_SETTINGS.bookingIntro, 360),
      policyEffectiveDate: trimStr(
        settings.policyEffectiveDate || DEFAULT_SITE_SETTINGS.policyEffectiveDate,
        60,
      ),
      warrantyHighlightNote: trimStr(
        settings.warrantyHighlightNote || DEFAULT_SITE_SETTINGS.warrantyHighlightNote,
        600,
      ),
      termsScopeNote: trimStr(settings.termsScopeNote || DEFAULT_SITE_SETTINGS.termsScopeNote, 600),
      privacyIntroNote: trimStr(
        settings.privacyIntroNote || DEFAULT_SITE_SETTINGS.privacyIntroNote,
        600,
      ),
      footerNote: trimStr(settings.footerNote || '', 240),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeServices(
  onData: (services: ScooterService[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'services'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(SCOOTER_SERVICES);
        return;
      }
      const list: ScooterService[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          index: typeof d.index === 'string' ? d.index : '01',
          title: typeof d.title === 'string' ? d.title : 'Service',
          shortLabel: typeof d.shortLabel === 'string' ? d.shortLabel : 'Service',
          category: d.category as ScooterService['category'],
          categoryLabel: typeof d.categoryLabel === 'string' ? d.categoryLabel : 'Service',
          pricingType: d.pricingType as ScooterService['pricingType'],
          price: typeof d.price === 'number' ? d.price : 45,
          durationMinutes: typeof d.durationMinutes === 'number' ? d.durationMinutes : 45,
          mode: d.mode === 'pickup' ? 'pickup' : 'mobile',
          summary: typeof d.summary === 'string' ? d.summary : '',
          includes: Array.isArray(d.includes) ? d.includes.map(String) : [],
          featuredTone: d.featuredTone === 'light' ? 'light' : 'dark',
          active: typeof d.active === 'boolean' ? d.active : true,
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 1,
        };
      });
      onData(list);
    },
    (error) => {
      console.warn('Services listener fallback:', error.message);
      onData(SCOOTER_SERVICES);
    },
  );
}

export async function saveServiceItem(service: ScooterService): Promise<void> {
  const safeId = service.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  const path = `services/${safeId}`;
  const cleanIncludes = service.includes
    .map((item) => trimStr(item, 160))
    .filter(Boolean)
    .slice(0, 8);

  try {
    await setDoc(doc(db, 'services', safeId), {
      id: safeId,
      index: trimStr(service.index || '01', 8),
      title: trimStr(service.title, 100),
      shortLabel: trimStr(service.shortLabel || service.title, 48),
      category: service.category,
      categoryLabel: trimStr(service.categoryLabel || 'Service', 48),
      pricingType: service.pricingType,
      price: Math.max(0, Math.min(2000, Number(service.price) || 0)),
      durationMinutes: Math.max(5, Math.min(480, Number(service.durationMinutes) || 45)),
      mode: service.mode,
      summary: trimStr(service.summary, 400),
      includes: cleanIncludes.length > 0 ? cleanIncludes : ['Scope confirmed prior to work'],
      featuredTone: service.featuredTone,
      active: Boolean(service.active),
      sortOrder: Math.max(0, Math.min(100, Number(service.sortOrder) || 1)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedDefaultServicesToFirestore(): Promise<void> {
  for (const service of SCOOTER_SERVICES) {
    await saveServiceItem(service);
  }
}

export async function deleteServiceItem(serviceId: string): Promise<void> {
  const path = `services/${serviceId}`;
  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface CreateBookingPayload {
  referenceId: string;
  riderName: string;
  contactEmail: string;
  contactPhone: string;
  scooterModel: string;
  address: string;
  preferredDay: OperatingDay;
  bookingDate?: string;
  preferredWindow: TimeWindow;
  serviceIds: string[];
  serviceTitles: string[];
  estimatedLaborLabel: string;
  estimatedMinutes: number;
  notes: string;
  customerUid?: string;
}

export interface AdminImportBookingPayload extends CreateBookingPayload {
  status: BookingStatus;
  adminNotes: string;
  createdAtDate: Date;
}

export async function importAdminBooking(payload: AdminImportBookingPayload): Promise<string> {
  const safeRef = trimStr(
    payload.referenceId.toUpperCase().replace(/[^A-Z0-9-]/g, '-'),
    32,
  );
  const bookingId = safeRef.replace(/[^a-zA-Z0-9_-]/g, '-');
  const path = `bookings/${bookingId}`;
  const nowMs = Date.now();
  const safeCreatedMs =
    Number.isFinite(payload.createdAtDate.getTime()) && payload.createdAtDate.getTime() <= nowMs
      ? payload.createdAtDate.getTime()
      : nowMs - 1000;

  const docBody: Record<string, unknown> = {
    referenceId: safeRef,
    riderName: trimStr(payload.riderName, 100),
    contactEmail: trimStr(payload.contactEmail, 120),
    contactPhone: trimStr(payload.contactPhone, 32),
    scooterModel: trimStr(payload.scooterModel, 120),
    address: trimStr(payload.address, 200),
    preferredDay: payload.preferredDay,
    preferredWindow: trimStr(payload.preferredWindow, 40),
    serviceIds: payload.serviceIds.slice(0, 12).map((s) => s.slice(0, 64)),
    serviceTitles: payload.serviceTitles.slice(0, 12).map((s) => trimStr(s, 120)),
    estimatedLaborLabel: trimStr(payload.estimatedLaborLabel, 64),
    estimatedMinutes: Math.max(0, Math.min(600, Math.round(payload.estimatedMinutes))),
    notes: trimStr(payload.notes || '', 1000),
    adminNotes: trimStr(payload.adminNotes || '', 1000),
    status: payload.status,
    createdAt: Timestamp.fromMillis(safeCreatedMs),
    updatedAt: serverTimestamp(),
  };

  if (isValidDateKey(payload.bookingDate)) {
    docBody.bookingDate = payload.bookingDate;
  }

  try {
    await setDoc(doc(db, 'bookings', bookingId), docBody);
    return bookingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function mapBookingDoc(docSnap: QueryDocumentSnapshot): BookingRecord {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    referenceId: String(d.referenceId ?? docSnap.id),
    riderName: String(d.riderName ?? ''),
    contactEmail: String(d.contactEmail ?? ''),
    contactPhone: String(d.contactPhone ?? ''),
    scooterModel: String(d.scooterModel ?? ''),
    address: String(d.address ?? ''),
    preferredDay: (d.preferredDay ?? 'Saturday') as OperatingDay,
    bookingDate:
      typeof d.bookingDate === 'string' && isValidDateKey(d.bookingDate)
        ? d.bookingDate
        : undefined,
    preferredWindow: (d.preferredWindow ?? '10:00 AM – 12:00 PM') as TimeWindow,
    serviceIds: Array.isArray(d.serviceIds) ? d.serviceIds.map(String) : [],
    serviceTitles: Array.isArray(d.serviceTitles) ? d.serviceTitles.map(String) : [],
    estimatedLaborLabel: String(d.estimatedLaborLabel ?? ''),
    estimatedMinutes: Number(d.estimatedMinutes ?? 0),
    notes: String(d.notes ?? ''),
    adminNotes: String(d.adminNotes ?? ''),
    status: (d.status ?? 'new') as BookingStatus,
    customerUid:
      typeof d.customerUid === 'string' && d.customerUid.trim().length > 0
        ? d.customerUid
        : undefined,
    confirmationSentAt:
      typeof d.confirmationSentAt === 'string' && d.confirmationSentAt.trim().length > 0
        ? d.confirmationSentAt
        : undefined,
    confirmationMessageId:
      typeof d.confirmationMessageId === 'string' && d.confirmationMessageId.trim().length > 0
        ? d.confirmationMessageId
        : undefined,
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export async function createPublicBooking(payload: CreateBookingPayload): Promise<string> {
  const bookingId = payload.referenceId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const path = `bookings/${bookingId}`;
  const docBody: Record<string, unknown> = {
    referenceId: trimStr(payload.referenceId.toUpperCase(), 32),
    riderName: trimStr(payload.riderName, 100),
    contactEmail: trimStr(payload.contactEmail.toLowerCase(), 120),
    contactPhone: trimStr(payload.contactPhone, 32),
    scooterModel: trimStr(payload.scooterModel, 120),
    address: trimStr(payload.address, 200),
    preferredDay: payload.preferredDay,
    preferredWindow: trimStr(payload.preferredWindow, 40),
    serviceIds: payload.serviceIds.slice(0, 12).map((s) => s.slice(0, 64)),
    serviceTitles: payload.serviceTitles.slice(0, 12).map((s) => trimStr(s, 120)),
    estimatedLaborLabel: trimStr(payload.estimatedLaborLabel, 64),
    estimatedMinutes: Math.max(0, Math.min(600, Math.round(payload.estimatedMinutes))),
    notes: trimStr(payload.notes || '', 1000),
    adminNotes: '',
    status: 'new' as BookingStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (isValidDateKey(payload.bookingDate)) {
    docBody.bookingDate = payload.bookingDate;
  }
  if (payload.customerUid && /^[a-zA-Z0-9_-]{1,128}$/.test(payload.customerUid)) {
    docBody.customerUid = payload.customerUid;
  }
  try {
    await setDoc(doc(db, 'bookings', bookingId), docBody);
    return bookingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeAdminBookings(
  onData: (bookings: BookingRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map(mapBookingDoc));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    },
  );
}

export function subscribeCustomerBookings(
  uid: string,
  email: string,
  onData: (bookings: BookingRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const byUidMap = new Map<string, BookingRecord>();
  const byEmailMap = new Map<string, BookingRecord>();

  const emitMerged = () => {
    const merged = new Map<string, BookingRecord>();
    for (const [id, rec] of byEmailMap.entries()) merged.set(id, rec);
    for (const [id, rec] of byUidMap.entries()) merged.set(id, rec);
    const sorted = Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
    );
    onData(sorted);
  };

  const qUid = query(collection(db, 'bookings'), where('customerUid', '==', uid));
  const qEmail = query(collection(db, 'bookings'), where('contactEmail', '==', email));

  const unsubUid = onSnapshot(
    qUid,
    (snap) => {
      byUidMap.clear();
      snap.docs.forEach((docSnap) => byUidMap.set(docSnap.id, mapBookingDoc(docSnap)));
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );

  const unsubEmail = onSnapshot(
    qEmail,
    (snap) => {
      byEmailMap.clear();
      snap.docs.forEach((docSnap) => byEmailMap.set(docSnap.id, mapBookingDoc(docSnap)));
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );

  return () => {
    unsubUid();
    unsubEmail();
  };
}

export async function updateAdminBooking(
  bookingId: string,
  updates: {
    riderName: string;
    contactEmail: string;
    contactPhone: string;
    scooterModel: string;
    address: string;
    preferredDay: OperatingDay;
    bookingDate?: string;
    preferredWindow: TimeWindow;
    serviceIds: string[];
    serviceTitles: string[];
    estimatedLaborLabel: string;
    estimatedMinutes: number;
    notes: string;
    adminNotes: string;
    status: BookingStatus;
  },
): Promise<void> {
  const path = `bookings/${bookingId}`;
  const payload: Record<string, unknown> = {
    riderName: trimStr(updates.riderName, 100),
    contactEmail: trimStr(updates.contactEmail, 120),
    contactPhone: trimStr(updates.contactPhone, 32),
    scooterModel: trimStr(updates.scooterModel, 120),
    address: trimStr(updates.address, 200),
    preferredDay: updates.preferredDay,
    preferredWindow: trimStr(updates.preferredWindow, 40),
    serviceIds: updates.serviceIds.slice(0, 12),
    serviceTitles: updates.serviceTitles.slice(0, 12).map((t) => trimStr(t, 120)),
    estimatedLaborLabel: trimStr(updates.estimatedLaborLabel, 64),
    estimatedMinutes: Math.max(0, Math.min(600, Math.round(updates.estimatedMinutes))),
    notes: trimStr(updates.notes, 1000),
    adminNotes: trimStr(updates.adminNotes, 1000),
    status: updates.status,
    updatedAt: serverTimestamp(),
  };

  if (isValidDateKey(updates.bookingDate)) {
    payload.bookingDate = updates.bookingDate;
  } else if (updates.bookingDate === '') {
    payload.bookingDate = deleteField();
  }

  try {
    await updateDoc(doc(db, 'bookings', bookingId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateAdminBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markBookingConfirmationSent(
  bookingId: string,
  options: {
    status?: BookingStatus;
    adminNotes?: string;
    sentAtIso?: string;
    confirmationMessageId?: string;
  },
): Promise<void> {
  const path = `bookings/${bookingId}`;
  const payload: Record<string, unknown> = {
    confirmationSentAt: trimStr(options.sentAtIso ?? new Date().toISOString(), 40),
    updatedAt: serverTimestamp(),
  };
  if (options.status) {
    payload.status = options.status;
  }
  if (typeof options.adminNotes === 'string') {
    payload.adminNotes = trimStr(options.adminNotes, 1000);
  }
  if (typeof options.confirmationMessageId === 'string' && options.confirmationMessageId.trim()) {
    payload.confirmationMessageId = trimStr(options.confirmationMessageId, 120);
  }
  try {
    await updateDoc(doc(db, 'bookings', bookingId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserAccount(
  uid: string,
  onData: (account: UserAccountRecord | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `userAccounts/${uid}`;
  return onSnapshot(
    doc(db, 'userAccounts', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid: String(d.uid ?? uid),
        displayName: String(d.displayName ?? ''),
        email: String(d.email ?? ''),
        phone: String(d.phone ?? ''),
        defaultAddress: String(d.defaultAddress ?? ''),
        defaultScooterModel: String(d.defaultScooterModel ?? ''),
        updatedAtIso: toIsoString(d.updatedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function saveUserAccount(
  account: Omit<UserAccountRecord, 'updatedAtIso'>,
): Promise<void> {
  const path = `userAccounts/${account.uid}`;
  try {
    await setDoc(doc(db, 'userAccounts', account.uid), {
      uid: trimStr(account.uid, 128),
      displayName: trimStr(account.displayName || 'Rider', 100),
      email: trimStr(account.email, 120),
      phone: trimStr(account.phone || '', 32),
      defaultAddress: trimStr(account.defaultAddress || '', 200),
      defaultScooterModel: trimStr(account.defaultScooterModel || '', 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeBookingMessages(
  bookingId: string,
  viewer: { role: 'admin' } | { role: 'customer'; email: string },
  onData: (messages: BookingMessageRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `bookings/${bookingId}/messages`;
  const messagesRef = collection(db, 'bookings', bookingId, 'messages');
  const q =
    viewer.role === 'admin'
      ? query(messagesRef, orderBy('createdAt', 'asc'))
      : query(messagesRef, where('bookingOwnerEmail', '==', viewer.email));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: BookingMessageRecord[] = snapshot.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            bookingId: String(d.bookingId ?? bookingId),
            bookingOwnerEmail: String(d.bookingOwnerEmail ?? ''),
            bookingOwnerUid: String(d.bookingOwnerUid ?? ''),
            senderUid: String(d.senderUid ?? ''),
            senderRole: d.senderRole === 'admin' ? ('admin' as const) : ('customer' as const),
            senderName: String(d.senderName ?? ''),
            messageType: (d.messageType ?? 'chat') as BookingMessageType,
            body: String(d.body ?? ''),
            createdAtIso: toIsoString(d.createdAt),
          };
        })
        .sort((a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime());
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function sendBookingMessage(payload: {
  booking: BookingRecord;
  senderUid: string;
  senderRole: 'customer' | 'admin';
  senderName: string;
  messageType: BookingMessageType;
  body: string;
}): Promise<string> {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `bookings/${payload.booking.id}/messages/${messageId}`;
  const cleanBody = trimStr(payload.body, 1500);
  if (!cleanBody) {
    throw new Error('Message text cannot be empty.');
  }
  try {
    await setDoc(doc(db, 'bookings', payload.booking.id, 'messages', messageId), {
      bookingId: payload.booking.id,
      bookingOwnerEmail: trimStr(payload.booking.contactEmail, 120),
      bookingOwnerUid: trimStr(payload.booking.customerUid ?? '', 128),
      senderUid: trimStr(payload.senderUid, 128),
      senderRole: payload.senderRole,
      senderName: trimStr(payload.senderName || 'User', 100),
      messageType: payload.messageType,
      body: cleanBody,
      createdAt: serverTimestamp(),
    });
    return messageId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAdminBooking(bookingId: string): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    await deleteDoc(doc(db, 'bookings', bookingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteAdminBookingsBulk(bookingIds: string[]): Promise<number> {
  let deleted = 0;
  for (const id of bookingIds) {
    await deleteAdminBooking(id);
    deleted += 1;
  }
  return deleted;
}

export function subscribeAdminCustomers(
  onData: (customers: CustomerProfileRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'customers';
  const q = query(collection(db, 'customers'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CustomerProfileRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: String(d.name ?? ''),
          email: String(d.email ?? ''),
          phone: String(d.phone ?? ''),
          address: String(d.address ?? ''),
          scooterModel: String(d.scooterModel ?? ''),
          serialNumber: String(d.serialNumber ?? ''),
          mechanicNotes: String(d.mechanicNotes ?? ''),
          updatedAtIso: toIsoString(d.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    },
  );
}

export async function saveAdminCustomer(profile: Omit<CustomerProfileRecord, 'updatedAtIso'>): Promise<void> {
  const safeId = profile.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96);
  const path = `customers/${safeId}`;
  try {
    await setDoc(doc(db, 'customers', safeId), {
      name: trimStr(profile.name, 100),
      email: trimStr(profile.email, 120),
      phone: trimStr(profile.phone, 32),
      address: trimStr(profile.address, 200),
      scooterModel: trimStr(profile.scooterModel, 120),
      serialNumber: trimStr(profile.serialNumber, 80),
      mechanicNotes: trimStr(profile.mechanicNotes, 1200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAdminCustomer(customerId: string): Promise<void> {
  const path = `customers/${customerId}`;
  try {
    await deleteDoc(doc(db, 'customers', customerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function checkIsAdminDocument(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export function subscribeCodeSnippets(
  onData: (snippets: CodeSnippetRecord[], fromFirestore: boolean) => void,
): Unsubscribe {
  const q = query(collection(db, 'codeSnippets'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(DEFAULT_CODE_SNIPPETS, false);
        return;
      }
      const list: CodeSnippetRecord[] = snapshot.docs.map((docSnap, idx) => {
        const d = docSnap.data();
        const placement: CodeSnippetPlacement = isValidSnippetPlacement(d.placement)
          ? d.placement
          : 'reviews_section';
        return {
          id: String(d.id ?? docSnap.id),
          name: String(d.name ?? 'Custom Snippet'),
          placement,
          code: String(d.code ?? ''),
          enabled: d.enabled !== false,
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : idx + 1,
          updatedAtIso: toIsoString(d.updatedAt),
        };
      });
      onData(list, true);
    },
    (error) => {
      console.warn('CodeSnippets listener fallback:', error.message);
      onData(DEFAULT_CODE_SNIPPETS, false);
    },
  );
}

export async function saveCodeSnippet(
  snippet: Omit<CodeSnippetRecord, 'updatedAtIso'>,
): Promise<void> {
  const safeId = snippet.id
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const finalId = safeId.length >= 2 ? safeId : `snippet-${Date.now().toString().slice(-5)}`;
  const path = `codeSnippets/${finalId}`;
  const placement: CodeSnippetPlacement = isValidSnippetPlacement(snippet.placement)
    ? snippet.placement
    : 'reviews_section';

  try {
    await setDoc(doc(db, 'codeSnippets', finalId), {
      id: finalId,
      name: trimStr(snippet.name || 'Custom Snippet', 100),
      placement,
      code: snippet.code.trim().slice(0, 10000),
      enabled: Boolean(snippet.enabled),
      sortOrder: Math.max(0, Math.min(1000, Math.round(Number(snippet.sortOrder) || 0))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCodeSnippet(snippetId: string): Promise<void> {
  const path = `codeSnippets/${snippetId}`;
  try {
    await deleteDoc(doc(db, 'codeSnippets', snippetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

