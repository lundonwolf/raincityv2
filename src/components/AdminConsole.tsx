import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Calendar,
  Check,
  Code2,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  OPERATING_DAYS,
  SCOOTER_SERVICES,
  TIME_WINDOWS,
  type BookingRecord,
  type BookingStatus,
  type CodeSnippetRecord,
  type CustomerProfileRecord,
  type OperatingDay,
  type PricingType,
  type ScooterService,
  type ServiceCategory,
  type SiteSettings,
  type TimeWindow,
} from '../data/scooterData';
import { auth, BOOTSTRAPPED_ADMIN_EMAILS, googleProvider } from '../lib/firebase';
import {
  checkIsAdminDocument,
  deleteAdminBooking,
  deleteAdminBookingsBulk,
  deleteAdminCustomer,
  deleteCodeSnippet,
  deleteServiceItem,
  markBookingConfirmationSent,
  saveAdminCustomer,
  saveCodeSnippet,
  saveServiceItem,
  saveSiteSettings,
  seedDefaultServicesToFirestore,
  sendBookingMessage,
  subscribeAdminBookings,
  subscribeAdminCustomers,
  updateAdminBooking,
  updateAdminBookingStatus,
} from '../services/firestoreService';
import {
  triggerBookingConfirmationEmailApi,
  type ConfirmationEmailApiResponse,
} from '../services/mailService';
import type { AppRoute } from '../types/routes';
import { formatConfirmationTimestamp } from '../utils/bookingConfirmation';
import { formatBookingDate, getOperatingDayFromDateKey } from '../utils/bookingDates';
import {
  deriveCustomersFromBookings,
  formatServicePrice,
  type AggregatedCustomer,
} from '../utils/repairCalculator';
import { AdminAnalyticsPanel } from './AdminAnalyticsPanel';
import { AdminCalendarPanel } from './AdminCalendarPanel';
import { AdminCodeSnippetsPanel } from './AdminCodeSnippetsPanel';
import { AdminImportPanel } from './AdminImportPanel';
import { AdminSiteEditor } from './AdminSiteEditor';
import { BookingConfirmationModal } from './BookingConfirmationModal';
import { BookingMessagesPanel } from './BookingMessagesPanel';

interface AdminConsoleProps {
  services: ScooterService[];
  settings: SiteSettings;
  codeSnippets: CodeSnippetRecord[];
  codeSnippetsFromFirestore: boolean;
  onNavigate: (route: AppRoute) => void;
}

type AdminTab = 'bookings' | 'calendar' | 'analytics' | 'customers' | 'site' | 'snippets' | 'import';

const BOOKING_STATUSES: BookingStatus[] = [
  'new',
  'confirmed',
  'in_progress',
  'ongoing',
  'completed',
  'cancelled',
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function AdminConsole({
  services,
  settings,
  codeSnippets,
  codeSnippetsFromFirestore,
  onNavigate,
}: AdminConsoleProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('bookings');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerProfileRecord[]>([]);
  const [dataError, setDataError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Bookings filter, status, confirmation, messaging & editor state
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [editingBooking, setEditingBooking] = useState<BookingRecord | null>(null);
  const [editCustomerUpdate, setEditCustomerUpdate] = useState('');
  const [confirmingBookingId, setConfirmingBookingId] = useState<string | null>(null);
  const [messagingBookingId, setMessagingBookingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [savingConfirmation, setSavingConfirmation] = useState(false);
  const [confirmDeleteBookingId, setConfirmDeleteBookingId] = useState<string | null>(null);
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [confirmBulkDeleteBookings, setConfirmBulkDeleteBookings] = useState(false);
  const [bulkDeletingBookings, setBulkDeletingBookings] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);

  // Customers CRM editor & deletion state
  const [customerSearch, setCustomerSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<
    Omit<CustomerProfileRecord, 'updatedAtIso'> | null
  >(null);
  const [editingCustomerKey, setEditingCustomerKey] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [confirmDeleteCustomerKey, setConfirmDeleteCustomerKey] = useState<string | null>(null);
  const [deletingCustomerKey, setDeletingCustomerKey] = useState<string | null>(null);
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<string[]>([]);
  const [confirmBulkDeleteCustomers, setConfirmBulkDeleteCustomers] = useState(false);
  const [bulkDeletingCustomers, setBulkDeletingCustomers] = useState(false);

  // Site settings & service pricing editor state
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingService, setEditingService] = useState<ScooterService | null>(null);
  const [editingServiceIsNew, setEditingServiceIsNew] = useState(false);
  const [includesDraftText, setIncludesDraftText] = useState('');
  const [savingService, setSavingService] = useState(false);
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthError('');
      if (!nextUser) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const emailLower = (nextUser.email ?? '').toLowerCase();
      const verified = Boolean(nextUser.emailVerified);
      const isBootstrapped = verified && BOOTSTRAPPED_ADMIN_EMAILS.includes(emailLower);

      if (isBootstrapped) {
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      const hasAdminDoc = verified ? await checkIsAdminDocument(nextUser.uid) : false;
      setIsAdmin(hasAdminDoc);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to protected Firestore collections ONLY once verified as admin
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setBookings([]);
      setCustomers([]);
      return;
    }

    setDataError('');
    const unsubBookings = subscribeAdminBookings(
      (list) => setBookings(list),
      (err) => setDataError(err.message),
    );
    const unsubCustomers = subscribeAdminCustomers(
      (list) => setCustomers(list),
      (err) => setDataError(err.message),
    );

    return () => {
      unsubBookings();
      unsubCustomers();
    };
  }, [authReady, isAdmin]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(''), 4000);
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in was cancelled or blocked.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setEditingBooking(null);
    setEditingCustomer(null);
    setEditingService(null);
  };

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.referenceId.toLowerCase().includes(q) ||
        b.riderName.toLowerCase().includes(q) ||
        b.contactEmail.toLowerCase().includes(q) ||
        b.scooterModel.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q)
      );
    });
  }, [bookings, statusFilter, bookingSearch]);

  const aggregatedCustomers = useMemo<AggregatedCustomer[]>(() => {
    const merged = deriveCustomersFromBookings(bookings, customers);
    const q = customerSearch.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.scooterModel.toLowerCase().includes(q),
    );
  }, [bookings, customers, customerSearch]);

  const handleSaveBookingEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    setSavingBooking(true);
    setDataError('');
    try {
      await updateAdminBooking(editingBooking.id, {
        riderName: editingBooking.riderName,
        contactEmail: editingBooking.contactEmail,
        contactPhone: editingBooking.contactPhone,
        scooterModel: editingBooking.scooterModel,
        address: editingBooking.address,
        bookingDate: editingBooking.bookingDate ?? '',
        preferredDay: editingBooking.preferredDay,
        preferredWindow: editingBooking.preferredWindow,
        serviceIds: editingBooking.serviceIds,
        serviceTitles: editingBooking.serviceTitles,
        estimatedLaborLabel: editingBooking.estimatedLaborLabel,
        estimatedMinutes: editingBooking.estimatedMinutes,
        notes: editingBooking.notes,
        adminNotes: editingBooking.adminNotes,
        status: editingBooking.status,
      });

      const postedUpdateText = editCustomerUpdate.trim();
      if (postedUpdateText && user) {
        try {
          await sendBookingMessage({
            booking: editingBooking,
            senderUid: user.uid,
            senderRole: 'admin',
            senderName: settings.businessName,
            messageType: 'status_update',
            body: postedUpdateText,
          });
        } catch {
          // Non-blocking: booking edits already saved
        }
      }

      setEditingBooking(null);
      setEditCustomerUpdate('');
      showToast(
        postedUpdateText
          ? `Saved booking ${editingBooking.referenceId} & posted repair update to customer.`
          : `Saved booking ${editingBooking.referenceId}.`,
      );
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to update booking.');
    } finally {
      setSavingBooking(false);
    }
  };

  const handleQuickStatusChange = async (booking: BookingRecord, nextStatus: BookingStatus) => {
    if (booking.status === nextStatus) return;
    setUpdatingStatusId(booking.id);
    setDataError('');
    try {
      await updateAdminBookingStatus(booking.id, nextStatus);
      if (user) {
        try {
          const scheduleLabel = formatBookingDate(booking.bookingDate, booking.preferredDay);
          await sendBookingMessage({
            booking,
            senderUid: user.uid,
            senderRole: 'admin',
            senderName: settings.businessName,
            messageType: 'status_update',
            body: `Booking status updated to ${STATUS_LABELS[nextStatus]} (${scheduleLabel} · ${booking.preferredWindow}).`,
          });
        } catch {
          // Non-blocking: booking status already updated
        }
      }
      showToast(`Updated ${booking.referenceId} status to ${STATUS_LABELS[nextStatus]}.`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to update booking status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  /**
   * Triggers a confirmation email to the rider via the backend mock mail API,
   * records delivery metadata + Confirmed status on the booking, and posts
   * a confirmation update directly into the customer's My Account timeline.
   */
  const triggerConfirmationEmail = async (
    booking: BookingRecord,
    options: { setConfirmed: boolean; customNote: string },
  ): Promise<ConfirmationEmailApiResponse> => {
    if (!auth.currentUser) {
      throw new Error('Admin session expired. Please sign in again.');
    }
    setSavingConfirmation(true);
    setDataError('');
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await triggerBookingConfirmationEmailApi({
        booking,
        settings,
        customNote: options.customNote,
        idToken,
      });

      const noteStamp = `[${formatConfirmationTimestamp(response.acceptedAt)}] Confirmation email sent via ${response.provider} (${response.messageId})${
        options.customNote.trim() ? `: ${options.customNote.trim()}` : ''
      }`;
      const nextAdminNotes = booking.adminNotes.trim()
        ? `${booking.adminNotes.trim()}\n${noteStamp}`
        : noteStamp;

      await markBookingConfirmationSent(booking.id, {
        status: options.setConfirmed ? 'confirmed' : undefined,
        adminNotes: nextAdminNotes,
        sentAtIso: response.acceptedAt,
        confirmationMessageId: response.messageId,
      });

      try {
        const scheduleLabel = formatBookingDate(booking.bookingDate, booking.preferredDay);
        await sendBookingMessage({
          booking,
          senderUid: auth.currentUser.uid,
          senderRole: 'admin',
          senderName: settings.businessName,
          messageType: 'confirmation_email',
          body: [
            `Confirmation email sent to ${response.to} (Ref: ${response.messageId}).`,
            `Scheduled: ${scheduleLabel} · ${booking.preferredWindow} at ${booking.address}.`,
            options.customNote.trim() ? `Mechanic note: ${options.customNote.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        });
      } catch {
        // Non-blocking: email API and booking record already succeeded
      }

      showToast(`Confirmation email sent to ${response.to} (${response.messageId}).`);
      return response;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to send booking confirmation email.';
      setDataError(message);
      throw err;
    } finally {
      setSavingConfirmation(false);
    }
  };

  const handleRecordConfirmation = async (
    booking: BookingRecord,
    options: {
      setConfirmed: boolean;
      channel: 'email' | 'sms' | 'copy' | 'manual';
      customNote: string;
    },
  ) => {
    setSavingConfirmation(true);
    setDataError('');
    try {
      const nowIso = new Date().toISOString();
      const channelLabel =
        options.channel === 'email'
          ? 'Email confirmation opened'
          : options.channel === 'sms'
            ? 'SMS confirmation opened'
            : options.channel === 'copy'
              ? 'Confirmation message copied'
              : 'Marked confirmed';
      const noteStamp = `[${formatConfirmationTimestamp(nowIso)}] ${channelLabel}${
        options.customNote.trim() ? `: ${options.customNote.trim()}` : ''
      }`;
      const nextAdminNotes = booking.adminNotes.trim()
        ? `${booking.adminNotes.trim()}\n${noteStamp}`
        : noteStamp;

      await markBookingConfirmationSent(booking.id, {
        status: options.setConfirmed ? 'confirmed' : undefined,
        adminNotes: nextAdminNotes,
        sentAtIso: nowIso,
      });

      if (user) {
        try {
          const scheduleLabel = formatBookingDate(booking.bookingDate, booking.preferredDay);
          await sendBookingMessage({
            booking,
            senderUid: user.uid,
            senderRole: 'admin',
            senderName: settings.businessName,
            messageType: options.channel === 'manual' ? 'status_update' : 'confirmation_email',
            body: `${channelLabel} for ${scheduleLabel} (${booking.preferredWindow}).${
              options.customNote.trim() ? ` Note: ${options.customNote.trim()}` : ''
            }`,
          });
        } catch {
          // Non-blocking
        }
      }

      showToast(
        options.setConfirmed
          ? `${booking.referenceId} marked Confirmed & confirmation logged.`
          : `Confirmation logged for ${booking.referenceId}.`,
      );
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to log booking confirmation.');
    } finally {
      setSavingConfirmation(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      await deleteAdminBooking(bookingId);
      setConfirmDeleteBookingId(null);
      setSelectedBookingIds((prev) => prev.filter((id) => id !== bookingId));
      if (editingBooking?.id === bookingId) setEditingBooking(null);
      showToast('Booking deleted.');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to delete booking.');
    }
  };

  const toggleBookingSelection = (bookingId: string) => {
    setConfirmBulkDeleteBookings(false);
    setSelectedBookingIds((prev) =>
      prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId],
    );
  };

  const handleToggleSelectAllVisibleBookings = () => {
    setConfirmBulkDeleteBookings(false);
    const visibleIds = filteredBookings.map((b) => b.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedBookingIds.includes(id));
    if (allSelected) {
      setSelectedBookingIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedBookingIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDeleteBookings = async () => {
    if (selectedBookingIds.length === 0) return;
    setBulkDeletingBookings(true);
    setDataError('');
    try {
      const count = selectedBookingIds.length;
      await deleteAdminBookingsBulk(selectedBookingIds);
      if (editingBooking && selectedBookingIds.includes(editingBooking.id)) {
        setEditingBooking(null);
      }
      setSelectedBookingIds([]);
      setConfirmBulkDeleteBookings(false);
      showToast(`Deleted ${count} booking${count === 1 ? '' : 's'}.`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to delete selected bookings.');
    } finally {
      setBulkDeletingBookings(false);
    }
  };

  const handleOpenCustomerEditor = (cust: AggregatedCustomer) => {
    if (editingCustomerKey === cust.key && editingCustomer) {
      setEditingCustomer(null);
      setEditingCustomerKey(null);
      return;
    }
    setConfirmDeleteCustomerKey(null);
    setEditingCustomerKey(cust.key);
    setEditingCustomer({
      id: cust.profileId,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      address: cust.address,
      scooterModel: cust.scooterModel,
      serialNumber: cust.serialNumber,
      mechanicNotes: cust.mechanicNotes,
    });
  };

  const handleCreateNewCustomer = () => {
    if (editingCustomerKey === '__new__' && editingCustomer) {
      setEditingCustomer(null);
      setEditingCustomerKey(null);
      return;
    }
    setEditingCustomerKey('__new__');
    setEditingCustomer({
      id: `cust-${Date.now()}`,
      name: '',
      email: '',
      phone: '',
      address: '',
      scooterModel: '',
      serialNumber: '',
      mechanicNotes: '',
    });
  };

  const handleSaveCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (editingCustomer.name.trim().length < 2 || !editingCustomer.email.includes('@')) {
      setDataError('Customer name and valid email address are required.');
      return;
    }
    setSavingCustomer(true);
    setDataError('');
    try {
      await saveAdminCustomer(editingCustomer);
      setEditingCustomer(null);
      setEditingCustomerKey(null);
      showToast(`Saved customer profile for ${editingCustomer.name}.`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to save customer profile.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (
    cust: AggregatedCustomer,
    mode: 'profile_only' | 'customer_and_bookings',
  ) => {
    setDeletingCustomerKey(cust.key);
    setDataError('');
    try {
      if (cust.hasSavedProfile) {
        await deleteAdminCustomer(cust.profileId);
      }
      let deletedBookingsCount = 0;
      if (mode === 'customer_and_bookings') {
        const matchingBookingIds = bookings
          .filter((b) => b.contactEmail.trim().toLowerCase() === cust.key)
          .map((b) => b.id);
        if (matchingBookingIds.length > 0) {
          await deleteAdminBookingsBulk(matchingBookingIds);
          deletedBookingsCount = matchingBookingIds.length;
        }
      }
      if (
        editingCustomer &&
        (editingCustomer.id === cust.profileId ||
          editingCustomer.email.trim().toLowerCase() === cust.key ||
          editingCustomerKey === cust.key)
      ) {
        setEditingCustomer(null);
        setEditingCustomerKey(null);
      }
      setConfirmDeleteCustomerKey(null);
      setSelectedCustomerKeys((prev) => prev.filter((key) => key !== cust.key));
      if (mode === 'profile_only') {
        showToast(`Removed saved CRM profile for ${cust.name}.`);
      } else if (deletedBookingsCount > 0) {
        showToast(
          `Deleted ${cust.name} and ${deletedBookingsCount} associated booking${
            deletedBookingsCount === 1 ? '' : 's'
          }.`,
        );
      } else {
        showToast(`Deleted customer ${cust.name}.`);
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to delete customer data.');
    } finally {
      setDeletingCustomerKey(null);
    }
  };

  const toggleCustomerSelection = (customerKey: string) => {
    setConfirmBulkDeleteCustomers(false);
    setSelectedCustomerKeys((prev) =>
      prev.includes(customerKey) ? prev.filter((k) => k !== customerKey) : [...prev, customerKey],
    );
  };

  const handleToggleSelectAllVisibleCustomers = () => {
    setConfirmBulkDeleteCustomers(false);
    const visibleKeys = aggregatedCustomers.map((c) => c.key);
    const allSelected =
      visibleKeys.length > 0 && visibleKeys.every((key) => selectedCustomerKeys.includes(key));
    if (allSelected) {
      setSelectedCustomerKeys((prev) => prev.filter((key) => !visibleKeys.includes(key)));
    } else {
      setSelectedCustomerKeys((prev) => Array.from(new Set([...prev, ...visibleKeys])));
    }
  };

  const handleBulkDeleteCustomers = async () => {
    if (selectedCustomerKeys.length === 0) return;
    setBulkDeletingCustomers(true);
    setDataError('');
    try {
      const selectedSet = new Set(selectedCustomerKeys);
      const targets = aggregatedCustomers.filter((c) => selectedSet.has(c.key));
      const profileDeletes = targets
        .filter((c) => c.hasSavedProfile)
        .map((c) => deleteAdminCustomer(c.profileId));
      await Promise.all(profileDeletes);

      const bookingIdsToDelete = bookings
        .filter((b) => selectedSet.has(b.contactEmail.trim().toLowerCase()))
        .map((b) => b.id);
      if (bookingIdsToDelete.length > 0) {
        await deleteAdminBookingsBulk(bookingIdsToDelete);
      }

      setSelectedCustomerKeys([]);
      setConfirmBulkDeleteCustomers(false);
      setEditingCustomer(null);
      setEditingCustomerKey(null);
      showToast(
        `Deleted ${targets.length} customer${targets.length === 1 ? '' : 's'}${
          bookingIdsToDelete.length > 0
            ? ` and ${bookingIdsToDelete.length} booking${bookingIdsToDelete.length === 1 ? '' : 's'}`
            : ''
        }.`,
      );
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to delete selected customers.');
    } finally {
      setBulkDeletingCustomers(false);
    }
  };

  const handleSaveSiteSettings = async (nextSettings: SiteSettings) => {
    setSavingSettings(true);
    setDataError('');
    try {
      await saveSiteSettings(nextSettings);
      showToast('All website changes published live to Firestore.');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to save site settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const openServiceEditor = (svc: ScooterService) => {
    if (editingService && !editingServiceIsNew && editingService.id === svc.id) {
      setEditingService(null);
      return;
    }
    setConfirmDeleteServiceId(null);
    setEditingServiceIsNew(false);
    setEditingService({ ...svc });
    setIncludesDraftText(svc.includes.join('\n'));
  };

  const openNewServiceEditor = () => {
    if (editingService && editingServiceIsNew) {
      setEditingService(null);
      setEditingServiceIsNew(false);
      return;
    }
    const nextNum = String(services.length + 1).padStart(2, '0');
    setEditingServiceIsNew(true);
    setEditingService({
      id: `custom-service-${Date.now()}`,
      index: nextNum,
      title: '',
      shortLabel: '',
      category: 'standup',
      categoryLabel: 'Stand-Up Labor',
      pricingType: 'hourly',
      price: settings.hourlyRate,
      durationMinutes: 45,
      mode: 'mobile',
      summary: '',
      includes: ['Scope confirmed before work'],
      featuredTone: 'dark',
      active: true,
      sortOrder: services.length + 1,
    });
    setIncludesDraftText('Scope confirmed before work');
  };

  const scrollToBookingCard = (bookingId: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(`booking-card-${bookingId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleSaveService = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    if (editingService.title.trim().length < 2 || editingService.summary.trim().length < 4) {
      setDataError('Service title and summary are required.');
      return;
    }
    setSavingService(true);
    setDataError('');
    try {
      const includesList = includesDraftText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      await saveServiceItem({
        ...editingService,
        includes: includesList.length > 0 ? includesList : ['Scope confirmed before work'],
      });
      setEditingService(null);
      showToast(`Saved "${editingService.title}" live.`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to save service item.');
    } finally {
      setSavingService(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSavingService(true);
    setDataError('');
    try {
      await seedDefaultServicesToFirestore();
      await saveSiteSettings(settings);
      showToast('Synced official raincityscooter.com pricing catalog to Firestore.');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to seed defaults.');
    } finally {
      setSavingService(false);
    }
  };

  // Auth loading state
  if (!authReady) {
    return (
      <section className="py-24">
        <div className="max-w-[680px] mx-auto px-5 text-center space-y-4">
          <Loader2 className="w-7 h-7 animate-spin text-[#E8452C] mx-auto" aria-hidden="true" />
          <p className="font-mono text-xs text-[#A1A1AA]">INITIALIZING ADMIN AUTHENTICATION</p>
        </div>
      </section>
    );
  }

  // Signed-out or unauthorized gate
  if (!user || !isAdmin) {
    return (
      <section aria-labelledby="admin-gate-heading" className="py-16 sm:py-24">
        <div className="max-w-[560px] mx-auto px-5">
          <div className="hw-chassis rounded-[24px] p-6 sm:p-8 text-[#121214] border border-white/60 space-y-6">
            <div className="oled-well rounded-[14px] p-5 text-[#F4F4F0] space-y-3">
              <div className="flex items-center justify-between font-mono text-[11px] text-[#A1A1AA]">
                <span>ADMIN ACCESS GATE</span>
                <ShieldCheck className="w-4 h-4 text-[#E8452C]" aria-hidden="true" />
              </div>
              <h1 id="admin-gate-heading" className="text-2xl font-semibold text-white">
                Rain City Scooter Admin Console
              </h1>
              <p className="text-xs text-[#B4B4BC] leading-relaxed">
                Sign in with your authorized owner Google account to inspect bookings, update
                dispatch schedules, manage customer equipment profiles, and edit live site pricing.
              </p>
            </div>

            {user && !isAdmin && (
              <div
                role="alert"
                className="rounded-[12px] bg-[#E8452C]/12 border border-[#E8452C]/35 p-4 text-xs text-[#7F1D1D] space-y-2"
              >
                <p className="font-semibold">Access denied for {user.email}</p>
                <p>
                  This portal is restricted to the verified Rain City Scooter administrator account.
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="underline font-semibold text-[#121214] cursor-pointer"
                >
                  Sign out and switch account
                </button>
              </div>
            )}

            {authError && (
              <p
                role="alert"
                className="rounded-[12px] bg-[#E8452C]/12 border border-[#E8452C]/35 p-3 text-xs text-[#7F1D1D]"
              >
                {authError}
              </p>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full min-h-[48px] px-5 py-3 rounded-[12px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {signingIn && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Sign in with Google
            </button>
          </div>
        </div>
      </section>
    );
  }

  const openBookingsCount = bookings.filter(
    (b) =>
      b.status === 'new' ||
      b.status === 'confirmed' ||
      b.status === 'in_progress' ||
      b.status === 'ongoing',
  ).length;
  const ongoingBookingsCount = bookings.filter((b) => b.status === 'ongoing').length;

  return (
    <section aria-labelledby="admin-console-heading" className="py-12 sm:py-16">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 space-y-8">
        {/* Top Console Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#A1A1AA]">
              ADMIN BACKEND · SIGNED IN AS {user.email?.toUpperCase()}
            </p>
            <h1
              id="admin-console-heading"
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F4F4F0]"
            >
              Operations & Site Control
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Admin sections"
              className="flex items-center gap-1 p-1.5 rounded-[14px] bg-[#141418] border border-white/10 overflow-x-auto max-w-full"
            >
              {(
                [
                  { id: 'bookings', label: `Bookings (${bookings.length})` },
                  { id: 'calendar', label: 'Calendar' },
                  { id: 'analytics', label: 'Analytics' },
                  { id: 'customers', label: `Customers (${aggregatedCustomers.length})` },
                  { id: 'site', label: 'Site Editor & Pricing' },
                  { id: 'snippets', label: `Code Snippets (${codeSnippets.length})` },
                  { id: 'import', label: 'Import Data' },
                ] as { id: AdminTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#F4F4F0] text-[#121214]'
                      : 'text-[#A1A1AA] hover:text-[#F4F4F0]'
                  }`}
                >
                  {tab.id === 'calendar' && <Calendar className="w-3.5 h-3.5" aria-hidden="true" />}
                  {tab.id === 'snippets' && <Code2 className="w-3.5 h-3.5" aria-hidden="true" />}
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[42px] px-3.5 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-[18px] bg-[#F4F4F0] text-[#121214] p-5 border border-black/10">
            <div className="font-mono text-[11px] text-[#52525B]">ACTIVE BOOKINGS</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              {openBookingsCount}
            </div>
            {ongoingBookingsCount > 0 && (
              <div className="font-mono text-[11px] text-[#B45309] mt-1">
                {ongoingBookingsCount} ONGOING
              </div>
            )}
          </div>
          <div className="rounded-[18px] bg-[#131316] p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">TOTAL REQUESTS</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              {bookings.length}
            </div>
          </div>
          <div className="rounded-[18px] bg-[#131316] p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">CUSTOMER RECORDS</div>
            <div className="font-dot text-3xl font-extrabold tabular-nums mt-1">
              {aggregatedCustomers.length}
            </div>
          </div>
          <div className="rounded-[18px] bg-[#131316] p-5 border border-white/10">
            <div className="font-mono text-[11px] text-[#A1A1AA]">LIVE LABOR RATE</div>
            <div className="font-dot text-3xl font-extrabold text-[#E8452C] tabular-nums mt-1">
              ${settings.hourlyRate}/hr
            </div>
          </div>
        </div>

        {/* Feedback / Error Banners */}
        {feedback && (
          <div
            role="status"
            className="rounded-[12px] bg-[#F4F4F0] text-[#121214] px-4 py-3 text-xs font-semibold flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-[#E8452C]" aria-hidden="true" />
            {feedback}
          </div>
        )}
        {dataError && (
          <div
            role="alert"
            className="rounded-[12px] bg-[#E8452C]/15 border border-[#E8452C]/40 text-[#FCA5A5] px-4 py-3 text-xs break-words"
          >
            {dataError}
          </div>
        )}

        {/* TAB 1: BOOKINGS MANAGER */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', ...BOOKING_STATUSES] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`min-h-[36px] px-3 py-1 rounded-[10px] text-xs font-semibold cursor-pointer transition-colors ${
                      statusFilter === status
                        ? 'bg-[#E8452C] text-white'
                        : 'bg-[#141418] text-[#A1A1AA] border border-white/10 hover:text-white'
                    }`}
                  >
                    {status === 'all' ? 'All' : STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search
                  className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search bookings"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search ref, rider, scooter..."
                  className="w-full min-h-[40px] pl-9 pr-3 rounded-[10px] bg-[#141418] border border-white/12 text-xs text-[#F4F4F0] placeholder:text-[#71717A]"
                />
              </div>
            </div>

            {editingBooking && !filteredBookings.some((b) => b.id === editingBooking.id) && (
              <form
                onSubmit={handleSaveBookingEdit}
                className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-black/15 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
                  <div>
                    <span className="font-mono text-xs text-[#52525B]">EDITING BOOKING</span>
                    <h2 className="text-xl font-semibold">
                      {editingBooking.referenceId} · {editingBooking.riderName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingBooking(null)}
                    className="text-xs font-semibold text-[#52525B] hover:text-[#121214] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-[#52525B]">
                  This booking is currently hidden by your active filter. Clear filters to view its
                  card, or save changes here.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setBookingSearch('');
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                  >
                    Show Booking Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBooking(null)}
                    className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#121214] text-white text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </form>
            )}

            {filteredBookings.length === 0 ? (
              <div className="rounded-[20px] bg-[#131316] border border-white/10 p-10 text-center space-y-2">
                <p className="text-sm font-medium text-[#F4F4F0]">No bookings match this view.</p>
                <p className="text-xs text-[#A1A1AA]">
                  New requests submitted on the Book Repair page appear here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Bulk Selection Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[#141418] border border-white/10 px-4 py-2.5">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#D4D4D8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        filteredBookings.length > 0 &&
                        filteredBookings.every((b) => selectedBookingIds.includes(b.id))
                      }
                      onChange={handleToggleSelectAllVisibleBookings}
                      className="w-4 h-4 accent-[#E8452C] cursor-pointer"
                    />
                    Select All Visible ({filteredBookings.length})
                  </label>

                  {selectedBookingIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-[#A1A1AA]">
                        {selectedBookingIds.length} SELECTED
                      </span>
                      {confirmBulkDeleteBookings ? (
                        <>
                          <button
                            type="button"
                            disabled={bulkDeletingBookings}
                            onClick={handleBulkDeleteBookings}
                            className="min-h-[34px] px-3 py-1 rounded-[9px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                          >
                            {bulkDeletingBookings
                              ? 'Deleting...'
                              : `Confirm Delete (${selectedBookingIds.length})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmBulkDeleteBookings(false)}
                            className="min-h-[34px] px-3 py-1 rounded-[9px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmBulkDeleteBookings(true)}
                            className="min-h-[34px] px-3 py-1 rounded-[9px] bg-[#E8452C]/15 border border-[#E8452C]/40 text-[#FCA5A5] hover:bg-[#E8452C] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Delete Selected ({selectedBookingIds.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedBookingIds([])}
                            className="min-h-[34px] px-2.5 py-1 rounded-[9px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {filteredBookings.map((b) => {
                  const isUpdatingThis = updatingStatusId === b.id;
                  const isConfirmOpen = confirmingBookingId === b.id;
                  const isMessagesOpen = messagingBookingId === b.id;
                  const isEditingThis = editingBooking?.id === b.id;
                  const isSelected = selectedBookingIds.includes(b.id);
                  const sentLabel = formatConfirmationTimestamp(b.confirmationSentAt);
                  const scheduleLabel = formatBookingDate(b.bookingDate, b.preferredDay);
                  return (
                    <div key={b.id} id={`booking-card-${b.id}`} className="space-y-3">
                      <article
                        className={`rounded-[18px] bg-[#131316] border p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 transition-colors ${
                          isEditingThis || isSelected ? 'border-[#E8452C]/60' : 'border-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <input
                            type="checkbox"
                            aria-label={`Select booking ${b.referenceId}`}
                            checked={isSelected}
                            onChange={() => toggleBookingSelection(b.id)}
                            className="w-4 h-4 mt-1 accent-[#E8452C] shrink-0 cursor-pointer"
                          />
                          <div className="space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                              <span className="text-[#F4F4F0] font-semibold">{b.referenceId}</span>
                              <span
                                className={`font-semibold ${
                                  b.status === 'confirmed'
                                    ? 'text-emerald-400'
                                    : b.status === 'ongoing'
                                      ? 'text-amber-400'
                                      : b.status === 'in_progress'
                                        ? 'text-[#60A5FA]'
                                        : b.status === 'completed'
                                          ? 'text-[#A1A1AA]'
                                          : b.status === 'cancelled'
                                            ? 'text-[#71717A]'
                                            : 'text-[#E8452C]'
                                }`}
                              >
                                {STATUS_LABELS[b.status].toUpperCase()}
                              </span>
                              {sentLabel && (
                                <span className="text-emerald-400">
                                  · CONFIRMATION SENT {sentLabel.toUpperCase()}
                                </span>
                              )}
                              <span className="text-[#F4F4F0]">
                                {scheduleLabel} · {b.preferredWindow}
                              </span>
                              {!b.bookingDate && (
                                <span className="text-amber-300">· NO EXACT DATE</span>
                              )}
                              <span className="text-[#F4F4F0] tabular-nums">
                                {b.estimatedLaborLabel}
                              </span>
                            </div>

                            <div className="text-base font-semibold text-[#F4F4F0]">
                              {b.riderName} · {b.scooterModel}
                            </div>

                            <div className="text-xs text-[#A1A1AA] space-y-0.5">
                              <p>
                                {b.contactPhone} · {b.contactEmail} · {b.address}
                              </p>
                              <p className="text-[#D4D4D8]">Services: {b.serviceTitles.join(', ')}</p>
                            {b.notes && <p className="text-[#A1A1AA]">Rider note: {b.notes}</p>}
                            {b.adminNotes && (
                              <p className="text-[#4A82E8] whitespace-pre-line">
                                Mechanic note: {b.adminNotes}
                              </p>
                            )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {/* Inline 1-Click Status Selector */}
                          <label className="sr-only" htmlFor={`status-${b.id}`}>
                            Status for {b.referenceId}
                          </label>
                          <select
                            id={`status-${b.id}`}
                            disabled={isUpdatingThis}
                            value={b.status}
                            onChange={(e) =>
                              handleQuickStatusChange(b, e.target.value as BookingStatus)
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-[10px] bg-[#1C1C22] border border-white/15 text-[#F4F4F0] text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {BOOKING_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                Status: {STATUS_LABELS[st]}
                              </option>
                            ))}
                          </select>

                          {/* Send Confirmation Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBooking(null);
                              setMessagingBookingId(null);
                              setConfirmingBookingId(isConfirmOpen ? null : b.id);
                            }}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                              isConfirmOpen
                                ? 'bg-white text-[#121214]'
                                : b.status === 'new' || !b.confirmationSentAt
                                  ? 'bg-[#E8452C] hover:bg-[#D53A22] text-white'
                                  : 'border border-white/15 text-[#F4F4F0] hover:bg-white/10'
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" aria-hidden="true" />
                            {isConfirmOpen
                              ? 'Close Composer'
                              : b.confirmationSentAt
                                ? 'Resend Confirmation'
                                : 'Send Confirmation'}
                          </button>

                          {/* Customer Updates & Chat Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBooking(null);
                              setConfirmingBookingId(null);
                              setMessagingBookingId(isMessagesOpen ? null : b.id);
                            }}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                              isMessagesOpen
                                ? 'bg-white text-[#121214]'
                                : 'border border-white/15 text-[#F4F4F0] hover:bg-white/10'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                            {isMessagesOpen ? 'Hide Updates' : 'Updates & Chat'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingBookingId(null);
                              setMessagingBookingId(null);
                              setEditCustomerUpdate('');
                              setEditingBooking(isEditingThis ? null : { ...b });
                            }}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer transition-colors ${
                              isEditingThis
                                ? 'bg-white text-[#121214] ring-2 ring-[#E8452C]/50'
                                : 'bg-[#F4F4F0] text-[#121214] hover:bg-white'
                            }`}
                          >
                            {isEditingThis ? 'Close Editor' : 'Edit Details'}
                          </button>

                          {confirmDeleteBookingId === b.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteBooking(b.id)}
                                className="min-h-[38px] px-3 py-1.5 rounded-[10px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteBookingId(null)}
                                className="min-h-[38px] px-2.5 py-1.5 rounded-[10px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Delete booking ${b.referenceId}`}
                              onClick={() => setConfirmDeleteBookingId(b.id)}
                              className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-[10px] border border-white/15 text-[#A1A1AA] hover:text-[#E8452C] hover:border-[#E8452C] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </article>

                      {isEditingThis && editingBooking && (
                        <form
                          onSubmit={handleSaveBookingEdit}
                          className="rounded-[20px] bg-[#F4F4F0] text-[#121214] p-5 sm:p-6 border border-black/15 space-y-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
                            <div>
                              <span className="font-mono text-xs text-[#52525B]">
                                EDITING BOOKING
                              </span>
                              <h2 className="text-lg font-semibold">
                                {editingBooking.referenceId} · {editingBooking.riderName}
                              </h2>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingBooking(null)}
                              className="text-xs font-semibold text-[#52525B] hover:text-[#121214] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="space-y-1">
                              <label htmlFor={`edit-status-${b.id}`} className="text-xs font-semibold">
                                Status
                              </label>
                              <select
                                id={`edit-status-${b.id}`}
                                value={editingBooking.status}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    status: e.target.value as BookingStatus,
                                  })
                                }
                                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              >
                                {BOOKING_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {STATUS_LABELS[st]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label
                                htmlFor={`edit-booking-date-${b.id}`}
                                className="text-xs font-semibold"
                              >
                                Appointment Date
                              </label>
                              <input
                                id={`edit-booking-date-${b.id}`}
                                type="date"
                                value={editingBooking.bookingDate ?? ''}
                                onChange={(e) => {
                                  const nextDate = e.target.value;
                                  const derivedDay = nextDate
                                    ? getOperatingDayFromDateKey(nextDate)
                                    : null;
                                  setEditingBooking({
                                    ...editingBooking,
                                    bookingDate: nextDate || undefined,
                                    preferredDay: derivedDay ?? editingBooking.preferredDay,
                                  });
                                }}
                                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                              />
                            </div>

                            <div className="space-y-1">
                              <label htmlFor={`edit-day-${b.id}`} className="text-xs font-semibold">
                                Scheduled Day
                              </label>
                              <select
                                id={`edit-day-${b.id}`}
                                value={editingBooking.preferredDay}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    preferredDay: e.target.value as OperatingDay,
                                  })
                                }
                                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              >
                                {OPERATING_DAYS.map((day) => (
                                  <option key={day} value={day}>
                                    {day}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label htmlFor={`edit-window-${b.id}`} className="text-xs font-semibold">
                                Time Window
                              </label>
                              <select
                                id={`edit-window-${b.id}`}
                                value={editingBooking.preferredWindow}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    preferredWindow: e.target.value as TimeWindow,
                                  })
                                }
                                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              >
                                {TIME_WINDOWS.map((slot) => (
                                  <option key={slot} value={slot}>
                                    {slot}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label
                                htmlFor={`edit-estimate-${b.id}`}
                                className="text-xs font-semibold"
                              >
                                Quoted Labor Label
                              </label>
                              <input
                                id={`edit-estimate-${b.id}`}
                                type="text"
                                value={editingBooking.estimatedLaborLabel}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    estimatedLaborLabel: e.target.value,
                                  })
                                }
                                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label
                                htmlFor={`edit-address-${b.id}`}
                                className="text-xs font-semibold"
                              >
                                Service Address
                              </label>
                              <input
                                id={`edit-address-${b.id}`}
                                type="text"
                                value={editingBooking.address}
                                onChange={(e) =>
                                  setEditingBooking({ ...editingBooking, address: e.target.value })
                                }
                                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              />
                            </div>

                            <div className="space-y-1">
                              <label
                                htmlFor={`edit-scooter-${b.id}`}
                                className="text-xs font-semibold"
                              >
                                Scooter Model
                              </label>
                              <input
                                id={`edit-scooter-${b.id}`}
                                type="text"
                                value={editingBooking.scooterModel}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    scooterModel: e.target.value,
                                  })
                                }
                                className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label
                                htmlFor={`edit-admin-notes-${b.id}`}
                                className="text-xs font-semibold"
                              >
                                Internal Mechanic Notes (Private — Admin Only)
                              </label>
                              <textarea
                                id={`edit-admin-notes-${b.id}`}
                                rows={3}
                                value={editingBooking.adminNotes}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    adminNotes: e.target.value,
                                  })
                                }
                                placeholder="Private parts cost, torque specs, diagnostic findings..."
                                className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              />
                            </div>

                            <div className="space-y-1">
                              <label
                                htmlFor={`edit-customer-update-${b.id}`}
                                className="text-xs font-semibold text-[#C82A14]"
                              >
                                Post Scooter Repair Update to Customer (Optional — Live in My
                                Account)
                              </label>
                              <textarea
                                id={`edit-customer-update-${b.id}`}
                                rows={3}
                                maxLength={1500}
                                value={editCustomerUpdate}
                                onChange={(e) => setEditCustomerUpdate(e.target.value)}
                                placeholder="e.g. Replaced rear inner tube, adjusted rear brake caliper, waiting on replacement throttle..."
                                className="w-full p-3 rounded-[10px] bg-white border border-[#E8452C]/35 text-sm"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBooking(null);
                                setEditCustomerUpdate('');
                              }}
                              className="min-h-[40px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingBooking}
                              className="min-h-[40px] px-5 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" aria-hidden="true" />
                              {savingBooking
                                ? 'Saving...'
                                : editCustomerUpdate.trim()
                                  ? 'Save & Post Repair Update'
                                  : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      )}

                      {isConfirmOpen && (
                        <BookingConfirmationModal
                          booking={b}
                          settings={settings}
                          saving={savingConfirmation}
                          onClose={() => setConfirmingBookingId(null)}
                          onTriggerConfirmationEmail={triggerConfirmationEmail}
                          onRecordConfirmation={handleRecordConfirmation}
                        />
                      )}

                      {isMessagesOpen && (
                        <BookingMessagesPanel
                          booking={b}
                          viewerRole="admin"
                          viewerUid={user.uid}
                          viewerEmail={user.email ?? ''}
                          viewerName={settings.businessName}
                          businessName={settings.businessName}
                          surface="light"
                          onUpdateStatus={async (nextStatus) => {
                            await updateAdminBookingStatus(b.id, nextStatus);
                            showToast(
                              `Updated ${b.referenceId} status to ${STATUS_LABELS[nextStatus]}.`,
                            );
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISPATCH & REPAIR CALENDAR */}
        {activeTab === 'calendar' && (
          <AdminCalendarPanel
            bookings={bookings}
            updatingStatusId={updatingStatusId}
            onQuickStatusChange={handleQuickStatusChange}
            onEditBooking={(b) => {
              setStatusFilter('all');
              setBookingSearch('');
              setConfirmingBookingId(null);
              setMessagingBookingId(null);
              setEditingBooking({ ...b });
              setActiveTab('bookings');
              scrollToBookingCard(b.id);
            }}
            onOpenConfirm={(b) => {
              setStatusFilter('all');
              setBookingSearch('');
              setEditingBooking(null);
              setMessagingBookingId(null);
              setConfirmingBookingId(b.id);
              setActiveTab('bookings');
              scrollToBookingCard(b.id);
            }}
            onOpenMessages={(b) => {
              setStatusFilter('all');
              setBookingSearch('');
              setEditingBooking(null);
              setConfirmingBookingId(null);
              setMessagingBookingId(b.id);
              setActiveTab('bookings');
              scrollToBookingCard(b.id);
            }}
            onDeleteBooking={handleDeleteBooking}
          />
        )}

        {/* TAB 3: BOOKING & SERVICE ANALYTICS */}
        {activeTab === 'analytics' && (
          <AdminAnalyticsPanel
            bookings={bookings}
            services={services}
            onSwitchToBookings={() => setActiveTab('bookings')}
          />
        )}

        {/* TAB 3: CUSTOMERS CRM */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search
                  className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search customers"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search rider name, email, scooter..."
                  className="w-full min-h-[40px] pl-9 pr-3 rounded-[10px] bg-[#141418] border border-white/12 text-xs text-[#F4F4F0] placeholder:text-[#71717A]"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateNewCustomer}
                className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Customer Profile
              </button>
            </div>

            {editingCustomer && editingCustomerKey === '__new__' && (
              <form
                onSubmit={handleSaveCustomer}
                className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-black/15 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-black/10 pb-3">
                  <h2 className="text-lg font-semibold">New Customer Equipment & Contact Profile</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCustomer(null);
                      setEditingCustomerKey(null);
                    }}
                    className="text-xs font-semibold text-[#52525B] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="cust-new-name" className="text-xs font-semibold">
                      Full Name
                    </label>
                    <input
                      id="cust-new-name"
                      type="text"
                      required
                      value={editingCustomer.name}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, name: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-new-email" className="text-xs font-semibold">
                      Email
                    </label>
                    <input
                      id="cust-new-email"
                      type="email"
                      required
                      value={editingCustomer.email}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, email: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-new-phone" className="text-xs font-semibold">
                      Phone
                    </label>
                    <input
                      id="cust-new-phone"
                      type="tel"
                      required
                      value={editingCustomer.phone}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, phone: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="cust-new-address" className="text-xs font-semibold">
                      Service Address
                    </label>
                    <input
                      id="cust-new-address"
                      type="text"
                      value={editingCustomer.address}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, address: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-new-scooter" className="text-xs font-semibold">
                      Scooter Model
                    </label>
                    <input
                      id="cust-new-scooter"
                      type="text"
                      value={editingCustomer.scooterModel}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, scooterModel: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cust-new-serial" className="text-xs font-semibold">
                      Serial Number / VIN
                    </label>
                    <input
                      id="cust-new-serial"
                      type="text"
                      value={editingCustomer.serialNumber}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, serialNumber: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="cust-new-notes" className="text-xs font-semibold">
                    Mechanic Service History & Notes
                  </label>
                  <textarea
                    id="cust-new-notes"
                    rows={3}
                    value={editingCustomer.mechanicNotes}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, mechanicNotes: e.target.value })
                    }
                    className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCustomer(null);
                      setEditingCustomerKey(null);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCustomer}
                    className="min-h-[40px] px-5 py-2 rounded-[10px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingCustomer ? 'Saving...' : 'Save Customer Profile'}
                  </button>
                </div>
              </form>
            )}

            {aggregatedCustomers.length === 0 ? (
              <div className="rounded-[20px] bg-[#131316] border border-white/10 p-10 text-center text-sm text-[#A1A1AA]">
                No customer records yet. Customer entries automatically populate from incoming
                bookings or can be added manually above.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bulk Selection Bar for Customers */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[#141418] border border-white/10 px-4 py-2.5">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#D4D4D8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        aggregatedCustomers.length > 0 &&
                        aggregatedCustomers.every((c) => selectedCustomerKeys.includes(c.key))
                      }
                      onChange={handleToggleSelectAllVisibleCustomers}
                      className="w-4 h-4 accent-[#E8452C] cursor-pointer"
                    />
                    Select All Visible ({aggregatedCustomers.length})
                  </label>

                  {selectedCustomerKeys.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-[#A1A1AA]">
                        {selectedCustomerKeys.length} SELECTED
                      </span>
                      {confirmBulkDeleteCustomers ? (
                        <>
                          <button
                            type="button"
                            disabled={bulkDeletingCustomers}
                            onClick={handleBulkDeleteCustomers}
                            className="min-h-[34px] px-3 py-1 rounded-[9px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                          >
                            {bulkDeletingCustomers
                              ? 'Deleting...'
                              : `Confirm Delete (${selectedCustomerKeys.length}) & Bookings`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmBulkDeleteCustomers(false)}
                            className="min-h-[34px] px-3 py-1 rounded-[9px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmBulkDeleteCustomers(true)}
                            className="min-h-[34px] px-3 py-1 rounded-[9px] bg-[#E8452C]/15 border border-[#E8452C]/40 text-[#FCA5A5] hover:bg-[#E8452C] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Delete Selected ({selectedCustomerKeys.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerKeys([])}
                            className="min-h-[34px] px-2.5 py-1 rounded-[9px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {aggregatedCustomers.map((cust) => {
                    const isConfirmingDelete = confirmDeleteCustomerKey === cust.key;
                    const isDeletingThis = deletingCustomerKey === cust.key;
                    const isEditingThis =
                      editingCustomer !== null && editingCustomerKey === cust.key;
                    const isSelected = selectedCustomerKeys.includes(cust.key);
                    return (
                      <div key={cust.key} className="space-y-3">
                        <article
                          className={`rounded-[18px] bg-[#131316] border p-5 flex flex-col justify-between gap-4 transition-colors ${
                            isEditingThis || isSelected ? 'border-[#E8452C]/60' : 'border-white/10'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#A1A1AA]">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  aria-label={`Select customer ${cust.name}`}
                                  checked={isSelected}
                                  onChange={() => toggleCustomerSelection(cust.key)}
                                  className="w-4 h-4 accent-[#E8452C] cursor-pointer"
                                />
                                <span>
                                  {cust.bookingCount} BOOKING{cust.bookingCount === 1 ? '' : 'S'} ·
                                  LAST {cust.lastBookingRef}
                                </span>
                              </label>
                              <span>{cust.hasSavedProfile ? 'SAVED CRM' : 'FROM BOOKING'}</span>
                            </div>
                            <h3 className="text-base font-semibold text-[#F4F4F0]">{cust.name}</h3>
                            <p className="text-xs text-[#D4D4D8]">
                              {cust.phone} · {cust.email}
                            </p>
                            <p className="text-xs text-[#A1A1AA]">
                              Scooter: {cust.scooterModel || '—'}
                              {cust.serialNumber ? ` · S/N ${cust.serialNumber}` : ''}
                            </p>
                            {cust.address && (
                              <p className="text-xs text-[#A1A1AA]">Address: {cust.address}</p>
                            )}
                            {cust.mechanicNotes && (
                              <p className="text-xs text-[#4A82E8]">Notes: {cust.mechanicNotes}</p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-white/10 space-y-2.5">
                            {isConfirmingDelete ? (
                              <div className="rounded-[12px] bg-[#1A1416] border border-[#E8452C]/35 p-3 space-y-2.5">
                                <p className="text-xs text-[#FCA5A5]">
                                  {cust.bookingCount > 0
                                    ? `Delete ${cust.name}? Removing all ${cust.bookingCount} booking${
                                        cust.bookingCount === 1 ? '' : 's'
                                      } permanently removes them from this list.`
                                    : `Permanently delete customer profile for ${cust.name}?`}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  {cust.hasSavedProfile && cust.bookingCount > 0 && (
                                    <button
                                      type="button"
                                      disabled={isDeletingThis}
                                      onClick={() => handleDeleteCustomer(cust, 'profile_only')}
                                      className="min-h-[34px] px-3 py-1 rounded-[9px] border border-white/20 text-xs font-semibold text-[#F4F4F0] hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                                    >
                                      Delete CRM Profile Only
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isDeletingThis}
                                    onClick={() =>
                                      handleDeleteCustomer(cust, 'customer_and_bookings')
                                    }
                                    className="min-h-[34px] px-3 py-1 rounded-[9px] bg-[#E8452C] hover:bg-[#D53A22] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    {isDeletingThis
                                      ? 'Deleting...'
                                      : cust.bookingCount > 0
                                        ? `Delete Customer & ${cust.bookingCount} Booking${
                                            cust.bookingCount === 1 ? '' : 's'
                                          }`
                                        : 'Confirm Delete Customer'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeletingThis}
                                    onClick={() => setConfirmDeleteCustomerKey(null)}
                                    className="min-h-[34px] px-2.5 py-1 rounded-[9px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCustomerEditor(cust)}
                                  className={`min-h-[38px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer transition-colors ${
                                    isEditingThis
                                      ? 'bg-white text-[#121214] ring-2 ring-[#E8452C]/50'
                                      : 'bg-[#F4F4F0] text-[#121214] hover:bg-white'
                                  }`}
                                >
                                  {isEditingThis
                                    ? 'Close Editor'
                                    : cust.hasSavedProfile
                                      ? 'Edit Profile'
                                      : 'Save to CRM'}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete customer ${cust.name}`}
                                  onClick={() => setConfirmDeleteCustomerKey(cust.key)}
                                  className="min-h-[38px] px-3 py-1.5 rounded-[10px] border border-white/15 text-xs font-semibold text-[#A1A1AA] hover:text-[#E8452C] hover:border-[#E8452C] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </article>

                        {isEditingThis && editingCustomer && (
                          <form
                            onSubmit={handleSaveCustomer}
                            className="rounded-[18px] bg-[#F4F4F0] text-[#121214] p-5 border border-black/15 space-y-4"
                          >
                            <div className="flex items-center justify-between border-b border-black/10 pb-2.5">
                              <div>
                                <span className="font-mono text-[11px] text-[#52525B]">
                                  EDITING CUSTOMER
                                </span>
                                <h3 className="text-base font-semibold">
                                  {editingCustomer.name || cust.name}
                                </h3>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCustomer(null);
                                  setEditingCustomerKey(null);
                                }}
                                className="text-xs font-semibold text-[#52525B] hover:text-[#121214] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label
                                  htmlFor={`cust-name-${cust.key}`}
                                  className="text-xs font-semibold"
                                >
                                  Full Name
                                </label>
                                <input
                                  id={`cust-name-${cust.key}`}
                                  type="text"
                                  required
                                  value={editingCustomer.name}
                                  onChange={(e) =>
                                    setEditingCustomer({ ...editingCustomer, name: e.target.value })
                                  }
                                  className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label
                                  htmlFor={`cust-email-${cust.key}`}
                                  className="text-xs font-semibold"
                                >
                                  Email
                                </label>
                                <input
                                  id={`cust-email-${cust.key}`}
                                  type="email"
                                  required
                                  value={editingCustomer.email}
                                  onChange={(e) =>
                                    setEditingCustomer({
                                      ...editingCustomer,
                                      email: e.target.value,
                                    })
                                  }
                                  className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label
                                  htmlFor={`cust-phone-${cust.key}`}
                                  className="text-xs font-semibold"
                                >
                                  Phone
                                </label>
                                <input
                                  id={`cust-phone-${cust.key}`}
                                  type="tel"
                                  required
                                  value={editingCustomer.phone}
                                  onChange={(e) =>
                                    setEditingCustomer({
                                      ...editingCustomer,
                                      phone: e.target.value,
                                    })
                                  }
                                  className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label
                                  htmlFor={`cust-scooter-${cust.key}`}
                                  className="text-xs font-semibold"
                                >
                                  Scooter Model
                                </label>
                                <input
                                  id={`cust-scooter-${cust.key}`}
                                  type="text"
                                  value={editingCustomer.scooterModel}
                                  onChange={(e) =>
                                    setEditingCustomer({
                                      ...editingCustomer,
                                      scooterModel: e.target.value,
                                    })
                                  }
                                  className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label
                                  htmlFor={`cust-address-${cust.key}`}
                                  className="text-xs font-semibold"
                                >
                                  Service Address
                                </label>
                                <input
                                  id={`cust-address-${cust.key}`}
                                  type="text"
                                  value={editingCustomer.address}
                                  onChange={(e) =>
                                    setEditingCustomer({
                                      ...editingCustomer,
                                      address: e.target.value,
                                    })
                                  }
                                  className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label
                                  htmlFor={`cust-serial-${cust.key}`}
                                  className="text-xs font-semibold"
                                >
                                  Serial Number / VIN
                                </label>
                                <input
                                  id={`cust-serial-${cust.key}`}
                                  type="text"
                                  value={editingCustomer.serialNumber}
                                  onChange={(e) =>
                                    setEditingCustomer({
                                      ...editingCustomer,
                                      serialNumber: e.target.value,
                                    })
                                  }
                                  className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label
                                htmlFor={`cust-notes-${cust.key}`}
                                className="text-xs font-semibold"
                              >
                                Mechanic Service History & Notes
                              </label>
                              <textarea
                                id={`cust-notes-${cust.key}`}
                                rows={3}
                                value={editingCustomer.mechanicNotes}
                                onChange={(e) =>
                                  setEditingCustomer({
                                    ...editingCustomer,
                                    mechanicNotes: e.target.value,
                                  })
                                }
                                className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              />
                            </div>

                            <div className="flex justify-end gap-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCustomer(null);
                                  setEditingCustomerKey(null);
                                }}
                                className="min-h-[38px] px-4 py-1.5 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={savingCustomer}
                                className="min-h-[38px] px-4 py-1.5 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                                {savingCustomer ? 'Saving...' : 'Save Customer'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FULL-SITE VISUAL EDITOR & PRICING CATALOG */}
        {activeTab === 'site' && (
          <div className="space-y-8">
            <AdminSiteEditor
              settings={settings}
              saving={savingSettings}
              onSave={handleSaveSiteSettings}
              onNavigate={onNavigate}
              onOpenCodeSnippets={() => setActiveTab('snippets')}
            />

            {/* Live Pricing Catalog Editor */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-xs text-[#A1A1AA]">PRICING & SERVICE CATALOG</div>
                  <h2 className="text-xl font-semibold text-[#F4F4F0]">
                    Manage Live Packages & Labor Items
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSeedDefaults}
                    disabled={savingService}
                    className="min-h-[40px] px-3.5 py-2 rounded-[10px] border border-white/15 hover:bg-white/10 text-xs font-semibold text-[#F4F4F0] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Sync Official Defaults ({SCOOTER_SERVICES.length})
                  </button>
                  <button
                    type="button"
                    onClick={openNewServiceEditor}
                    className="min-h-[40px] px-4 py-2 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add Service Item
                  </button>
                </div>
              </div>

              {editingService && editingServiceIsNew && (
                <form
                  onSubmit={handleSaveService}
                  className="rounded-[22px] bg-[#F4F4F0] text-[#121214] p-6 border border-black/15 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-black/10 pb-3">
                    <h3 className="text-lg font-semibold">
                      {editingService.title || 'New Service Item'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingService(null);
                        setEditingServiceIsNew(false);
                      }}
                      className="text-xs font-semibold text-[#52525B] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1 sm:col-span-2">
                      <label htmlFor="svc-new-title" className="text-xs font-semibold">
                        Service Title
                      </label>
                      <input
                        id="svc-new-title"
                        type="text"
                        required
                        value={editingService.title}
                        onChange={(e) =>
                          setEditingService({ ...editingService, title: e.target.value })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-new-price" className="text-xs font-semibold">
                        Price ($)
                      </label>
                      <input
                        id="svc-new-price"
                        type="number"
                        min={0}
                        max={2000}
                        value={editingService.price}
                        onChange={(e) =>
                          setEditingService({ ...editingService, price: Number(e.target.value) })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-new-pricing-type" className="text-xs font-semibold">
                        Pricing Type
                      </label>
                      <select
                        id="svc-new-pricing-type"
                        value={editingService.pricingType}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            pricingType: e.target.value as PricingType,
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      >
                        <option value="fixed">Fixed Price ($65)</option>
                        <option value="from">Starting From (from $175)</option>
                        <option value="hourly">Hourly Rate ($45/hr)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="svc-new-short" className="text-xs font-semibold">
                        Short Label
                      </label>
                      <input
                        id="svc-new-short"
                        type="text"
                        value={editingService.shortLabel}
                        onChange={(e) =>
                          setEditingService({ ...editingService, shortLabel: e.target.value })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-new-cat" className="text-xs font-semibold">
                        Category
                      </label>
                      <select
                        id="svc-new-cat"
                        value={editingService.category}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            category: e.target.value as Exclude<ServiceCategory, 'all'>,
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                      >
                        <option value="packages">Packages</option>
                        <option value="standup">Stand-Up Labor</option>
                        <option value="electrical">Electrical</option>
                        <option value="mobility">Mobility</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="svc-new-mins" className="text-xs font-semibold">
                        Est. Minutes
                      </label>
                      <input
                        id="svc-new-mins"
                        type="number"
                        min={5}
                        max={480}
                        value={editingService.durationMinutes}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            durationMinutes: Number(e.target.value),
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                      />
                    </div>
                    <div className="space-y-1 flex flex-col justify-end">
                      <label className="inline-flex items-center gap-2 min-h-[40px] text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingService.active}
                          onChange={(e) =>
                            setEditingService({ ...editingService, active: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#E8452C]"
                        />
                        Visible on Public Site
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="svc-new-summary" className="text-xs font-semibold">
                      Summary
                    </label>
                    <textarea
                      id="svc-new-summary"
                      rows={2}
                      value={editingService.summary}
                      onChange={(e) =>
                        setEditingService({ ...editingService, summary: e.target.value })
                      }
                      className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="svc-new-includes" className="text-xs font-semibold">
                      Included Items (One per line)
                    </label>
                    <textarea
                      id="svc-new-includes"
                      rows={3}
                      value={includesDraftText}
                      onChange={(e) => setIncludesDraftText(e.target.value)}
                      className="w-full p-3 rounded-[10px] bg-white border border-black/15 text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingService(null);
                        setEditingServiceIsNew(false);
                      }}
                      className="min-h-[40px] px-4 py-2 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingService}
                      className="min-h-[40px] px-5 py-2 rounded-[10px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer"
                    >
                      {savingService ? 'Saving...' : 'Save Service'}
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {services.map((svc) => {
                  const isEditingThis =
                    editingService !== null && !editingServiceIsNew && editingService.id === svc.id;
                  return (
                    <div key={svc.id} className="space-y-3">
                      <div
                        className={`rounded-[18px] bg-[#131316] border p-5 flex flex-col justify-between gap-4 transition-colors ${
                          isEditingThis ? 'border-[#E8452C]/60' : 'border-white/10'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between font-mono text-[11px] text-[#A1A1AA]">
                            <span>
                              {svc.index} · {svc.categoryLabel}
                            </span>
                            <span className={svc.active ? 'text-[#F4F4F0]' : 'text-[#E8452C]'}>
                              {svc.active ? 'VISIBLE' : 'HIDDEN'}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-[#F4F4F0]">{svc.title}</h3>
                          <div className="font-dot text-2xl font-bold text-[#F4F4F0] tabular-nums">
                            {formatServicePrice(svc)}
                          </div>
                          <p className="text-xs text-[#A1A1AA] line-clamp-2">{svc.summary}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => openServiceEditor(svc)}
                            className={`min-h-[36px] px-3.5 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer transition-colors ${
                              isEditingThis
                                ? 'bg-white text-[#121214] ring-2 ring-[#E8452C]/50'
                                : 'bg-[#F4F4F0] text-[#121214] hover:bg-white'
                            }`}
                          >
                            {isEditingThis ? 'Close Editor' : 'Edit Price / Details'}
                          </button>
                          {confirmDeleteServiceId === svc.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await deleteServiceItem(svc.id);
                                    setConfirmDeleteServiceId(null);
                                    if (editingService?.id === svc.id) {
                                      setEditingService(null);
                                    }
                                    showToast(`Removed ${svc.title}.`);
                                  } catch (err) {
                                    setDataError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Failed to delete service.',
                                    );
                                  }
                                }}
                                className="min-h-[36px] px-2.5 py-1 rounded-[9px] bg-[#E8452C] text-white text-xs font-semibold cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteServiceId(null)}
                                className="min-h-[36px] px-2.5 py-1 rounded-[9px] border border-white/15 text-xs text-[#A1A1AA] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Delete ${svc.title}`}
                              onClick={() => setConfirmDeleteServiceId(svc.id)}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-[10px] border border-white/15 text-[#A1A1AA] hover:text-[#E8452C] hover:border-[#E8452C] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditingThis && editingService && (
                        <form
                          onSubmit={handleSaveService}
                          className="rounded-[18px] bg-[#F4F4F0] text-[#121214] p-4 sm:p-5 border border-black/15 space-y-3.5"
                        >
                          <div className="flex items-center justify-between border-b border-black/10 pb-2.5">
                            <span className="font-mono text-[11px] text-[#52525B]">
                              EDITING SERVICE
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingService(null)}
                              className="text-xs font-semibold text-[#52525B] hover:text-[#121214] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor={`svc-title-${svc.id}`}
                              className="text-xs font-semibold"
                            >
                              Service Title
                            </label>
                            <input
                              id={`svc-title-${svc.id}`}
                              type="text"
                              required
                              value={editingService.title}
                              onChange={(e) =>
                                setEditingService({ ...editingService, title: e.target.value })
                              }
                              className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label
                                htmlFor={`svc-price-${svc.id}`}
                                className="text-xs font-semibold"
                              >
                                Price ($)
                              </label>
                              <input
                                id={`svc-price-${svc.id}`}
                                type="number"
                                min={0}
                                max={2000}
                                value={editingService.price}
                                onChange={(e) =>
                                  setEditingService({
                                    ...editingService,
                                    price: Number(e.target.value),
                                  })
                                }
                                className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                              />
                            </div>
                            <div className="space-y-1">
                              <label
                                htmlFor={`svc-pricing-type-${svc.id}`}
                                className="text-xs font-semibold"
                              >
                                Pricing Type
                              </label>
                              <select
                                id={`svc-pricing-type-${svc.id}`}
                                value={editingService.pricingType}
                                onChange={(e) =>
                                  setEditingService({
                                    ...editingService,
                                    pricingType: e.target.value as PricingType,
                                  })
                                }
                                className="w-full min-h-[38px] px-2.5 rounded-[10px] bg-white border border-black/15 text-sm"
                              >
                                <option value="fixed">Fixed ($)</option>
                                <option value="from">From ($)</option>
                                <option value="hourly">Hourly</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label
                                htmlFor={`svc-short-${svc.id}`}
                                className="text-xs font-semibold"
                              >
                                Short Label
                              </label>
                              <input
                                id={`svc-short-${svc.id}`}
                                type="text"
                                value={editingService.shortLabel}
                                onChange={(e) =>
                                  setEditingService({
                                    ...editingService,
                                    shortLabel: e.target.value,
                                  })
                                }
                                className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label
                                htmlFor={`svc-mins-${svc.id}`}
                                className="text-xs font-semibold"
                              >
                                Est. Minutes
                              </label>
                              <input
                                id={`svc-mins-${svc.id}`}
                                type="number"
                                min={5}
                                max={480}
                                value={editingService.durationMinutes}
                                onChange={(e) =>
                                  setEditingService({
                                    ...editingService,
                                    durationMinutes: Number(e.target.value),
                                  })
                                }
                                className="w-full min-h-[38px] px-3 rounded-[10px] bg-white border border-black/15 text-sm tabular-nums"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 items-end">
                            <div className="space-y-1">
                              <label
                                htmlFor={`svc-cat-${svc.id}`}
                                className="text-xs font-semibold"
                              >
                                Category
                              </label>
                              <select
                                id={`svc-cat-${svc.id}`}
                                value={editingService.category}
                                onChange={(e) =>
                                  setEditingService({
                                    ...editingService,
                                    category: e.target.value as Exclude<ServiceCategory, 'all'>,
                                  })
                                }
                                className="w-full min-h-[38px] px-2.5 rounded-[10px] bg-white border border-black/15 text-sm"
                              >
                                <option value="packages">Packages</option>
                                <option value="standup">Stand-Up Labor</option>
                                <option value="electrical">Electrical</option>
                                <option value="mobility">Mobility</option>
                              </select>
                            </div>
                            <label className="inline-flex items-center gap-2 min-h-[38px] text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingService.active}
                                onChange={(e) =>
                                  setEditingService({
                                    ...editingService,
                                    active: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 accent-[#E8452C]"
                              />
                              Visible
                            </label>
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor={`svc-summary-${svc.id}`}
                              className="text-xs font-semibold"
                            >
                              Summary
                            </label>
                            <textarea
                              id={`svc-summary-${svc.id}`}
                              rows={2}
                              value={editingService.summary}
                              onChange={(e) =>
                                setEditingService({ ...editingService, summary: e.target.value })
                              }
                              className="w-full p-2.5 rounded-[10px] bg-white border border-black/15 text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor={`svc-includes-${svc.id}`}
                              className="text-xs font-semibold"
                            >
                              Included Items (One per line)
                            </label>
                            <textarea
                              id={`svc-includes-${svc.id}`}
                              rows={3}
                              value={includesDraftText}
                              onChange={(e) => setIncludesDraftText(e.target.value)}
                              className="w-full p-2.5 rounded-[10px] bg-white border border-black/15 text-sm"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingService(null)}
                              className="min-h-[36px] px-3.5 py-1.5 rounded-[10px] border border-black/15 text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingService}
                              className="min-h-[36px] px-4 py-1.5 rounded-[10px] bg-[#E8452C] hover:bg-[#D53A22] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" aria-hidden="true" />
                              {savingService ? 'Saving...' : 'Save Service'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CODE SNIPPETS & EMBED MANAGER */}
        {activeTab === 'snippets' && (
          <AdminCodeSnippetsPanel
            snippets={codeSnippets}
            isFromFirestore={codeSnippetsFromFirestore}
            onSaveSnippet={async (snippet) => {
              await saveCodeSnippet(snippet);
              showToast(`Saved snippet "${snippet.name}" live.`);
            }}
            onDeleteSnippet={async (snippetId) => {
              await deleteCodeSnippet(snippetId);
              showToast('Deleted code snippet.');
            }}
            onNavigate={onNavigate}
          />
        )}

        {/* TAB 6: REPLIT POSTGRESQL DATA IMPORTER */}
        {activeTab === 'import' && (
          <AdminImportPanel
            services={services}
            onImportComplete={(entity, count) => {
              showToast(`Imported ${count} ${entity} record${count === 1 ? '' : 's'} into Firestore.`);
            }}
          />
        )}
      </div>
    </section>
  );
}
