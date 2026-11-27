import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_SITE_SETTINGS,
  SCOOTER_SERVICES,
  type BookingRecord,
  type BookingStatus,
  type CustomerProfileRecord,
  type OperatingDay,
  type ScooterService,
  type SiteSettings,
  type TimeWindow,
} from '../data/scooterData';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

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

export function subscribeSiteSettings(
  onData: (settings: SiteSettings) => void,
): Unsubscribe {
  const path = 'siteSettings/main';
  return onSnapshot(
    doc(db, 'siteSettings', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SITE_SETTINGS);
        return;
      }
      const d = snap.data();
      onData({
        businessName: typeof d.businessName === 'string' ? d.businessName : DEFAULT_SITE_SETTINGS.businessName,
        tagline: typeof d.tagline === 'string' ? d.tagline : DEFAULT_SITE_SETTINGS.tagline,
        phoneDisplay: typeof d.phoneDisplay === 'string' ? d.phoneDisplay : DEFAULT_SITE_SETTINGS.phoneDisplay,
        email: typeof d.email === 'string' ? d.email : DEFAULT_SITE_SETTINGS.email,
        hoursShort: typeof d.hoursShort === 'string' ? d.hoursShort : DEFAULT_SITE_SETTINGS.hoursShort,
        hourlyRate: typeof d.hourlyRate === 'number' ? d.hourlyRate : DEFAULT_SITE_SETTINGS.hourlyRate,
        dispatchPolicyNote:
          typeof d.dispatchPolicyNote === 'string'
            ? d.dispatchPolicyNote
            : DEFAULT_SITE_SETTINGS.dispatchPolicyNote,
        warrantyDays: typeof d.warrantyDays === 'number' ? d.warrantyDays : DEFAULT_SITE_SETTINGS.warrantyDays,
        announcement: typeof d.announcement === 'string' ? d.announcement : '',
        googlePlaceId: typeof d.googlePlaceId === 'string' ? d.googlePlaceId : '',
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
  preferredWindow: TimeWindow;
  serviceIds: string[];
  serviceTitles: string[];
  estimatedLaborLabel: string;
  estimatedMinutes: number;
  notes: string;
}

export async function createPublicBooking(payload: CreateBookingPayload): Promise<string> {
  const bookingId = payload.referenceId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const path = `bookings/${bookingId}`;
  try {
    await setDoc(doc(db, 'bookings', bookingId), {
      referenceId: trimStr(payload.referenceId.toUpperCase(), 32),
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
      adminNotes: '',
      status: 'new' as BookingStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
      const list: BookingRecord[] = snapshot.docs.map((docSnap) => {
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
          preferredWindow: (d.preferredWindow ?? '10:00 AM – 12:00 PM') as TimeWindow,
          serviceIds: Array.isArray(d.serviceIds) ? d.serviceIds.map(String) : [],
          serviceTitles: Array.isArray(d.serviceTitles) ? d.serviceTitles.map(String) : [],
          estimatedLaborLabel: String(d.estimatedLaborLabel ?? ''),
          estimatedMinutes: Number(d.estimatedMinutes ?? 0),
          notes: String(d.notes ?? ''),
          adminNotes: String(d.adminNotes ?? ''),
          status: (d.status ?? 'new') as BookingStatus,
          createdAtIso: toIsoString(d.createdAt),
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

export async function updateAdminBooking(
  bookingId: string,
  updates: {
    riderName: string;
    contactEmail: string;
    contactPhone: string;
    scooterModel: string;
    address: string;
    preferredDay: OperatingDay;
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
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
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
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
