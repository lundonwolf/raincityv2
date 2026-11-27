import {
  OPERATING_DAYS,
  SCOOTER_SERVICES,
  TIME_WINDOWS,
  type BookingRecord,
  type CustomerProfileRecord,
  type OperatingDay,
  type RepairMode,
  type ScooterService,
  type ServiceCategory,
  type TimeWindow,
} from '../data/scooterData';

export interface RepairEstimate {
  selectedServices: ScooterService[];
  fixedLaborSubtotal: number;
  hourlyLaborEstimate: number;
  hasHourlyOrFromItem: boolean;
  diagnosticCredit: number;
  dispatchFee: number;
  estimatedLaborTotal: number;
  estimatedLaborLabel: string;
  estimatedMinutes: number;
  recommendedMode: RepairMode;
}

export interface BookingFormInput {
  selectedServiceIds: string[];
  scooterModel: string;
  riderName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  preferredDay: OperatingDay | '';
  preferredWindow: TimeWindow | '';
  notes: string;
}

export interface BookingValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof BookingFormInput, string>>;
}

export interface SeattleScheduleStatus {
  timeString: string;
  dayLabel: string;
  isOpenNow: boolean;
  statusLabel: string;
}

export interface AggregatedCustomer {
  key: string;
  profileId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  scooterModel: string;
  serialNumber: string;
  mechanicNotes: string;
  bookingCount: number;
  lastBookingRef: string;
  lastBookingStatus: string;
  hasSavedProfile: boolean;
}

export function filterServicesByCategory(
  services: ScooterService[],
  category: ServiceCategory,
): ScooterService[] {
  const activeOnly = services.filter((service) => service.active !== false);
  if (category === 'all') {
    return activeOnly;
  }
  return activeOnly.filter((service) => service.category === category);
}

export function formatServicePrice(service: Pick<ScooterService, 'pricingType' | 'price'>): string {
  const formatted = formatCurrency(service.price);
  if (service.pricingType === 'hourly') {
    return `${formatted}/hr`;
  }
  if (service.pricingType === 'from') {
    return `from ${formatted}`;
  }
  return formatted;
}

export function calculateRepairEstimate(
  selectedServiceIds: string[],
  catalog: ScooterService[] = SCOOTER_SERVICES,
): RepairEstimate {
  const uniqueIds = Array.from(new Set(selectedServiceIds));
  const selectedServices = catalog.filter((service) => uniqueIds.includes(service.id));

  const hasElectricalDiagnosis = selectedServices.some(
    (service) => service.id === 'electrical-diagnosis',
  );
  const hasCompanionRepair = selectedServices.some(
    (service) => service.id !== 'electrical-diagnosis' && service.id !== 'basic-inspection',
  );
  const diagnosisService = selectedServices.find(
    (service) => service.id === 'electrical-diagnosis',
  );
  const diagnosticCredit =
    hasElectricalDiagnosis && hasCompanionRepair && diagnosisService
      ? diagnosisService.price
      : 0;

  let fixedLaborSubtotal = 0;
  let hourlyLaborEstimate = 0;
  let hasHourlyOrFromItem = false;

  for (const service of selectedServices) {
    if (service.pricingType === 'hourly') {
      hourlyLaborEstimate += service.price;
      hasHourlyOrFromItem = true;
    } else if (service.pricingType === 'from') {
      fixedLaborSubtotal += service.price;
      hasHourlyOrFromItem = true;
    } else {
      fixedLaborSubtotal += service.price;
    }
  }

  // Official Rain City Scooter policy: $0 dispatch/travel fee
  const dispatchFee = 0;
  const estimatedLaborTotal = Math.max(
    0,
    fixedLaborSubtotal + hourlyLaborEstimate - diagnosticCredit + dispatchFee,
  );

  const estimatedMinutes = selectedServices.reduce(
    (sum, service) => sum + service.durationMinutes,
    0,
  );

  const requiresPickup = selectedServices.some((service) => service.mode === 'pickup');
  const recommendedMode: RepairMode = requiresPickup ? 'pickup' : 'mobile';

  let estimatedLaborLabel = '$0';
  if (selectedServices.length > 0) {
    if (selectedServices.length === 1 && selectedServices[0].pricingType === 'hourly') {
      estimatedLaborLabel = `${formatCurrency(selectedServices[0].price)}/hr est.`;
    } else if (hasHourlyOrFromItem) {
      estimatedLaborLabel = `from ${formatCurrency(estimatedLaborTotal)}`;
    } else {
      estimatedLaborLabel = formatCurrency(estimatedLaborTotal);
    }
  }

  return {
    selectedServices,
    fixedLaborSubtotal,
    hourlyLaborEstimate,
    hasHourlyOrFromItem,
    diagnosticCredit,
    dispatchFee,
    estimatedLaborTotal,
    estimatedLaborLabel,
    estimatedMinutes,
    recommendedMode,
  };
}

export function validateBookingForm(input: BookingFormInput): BookingValidationResult {
  const errors: Partial<Record<keyof BookingFormInput, string>> = {};

  if (!input.selectedServiceIds || input.selectedServiceIds.length === 0) {
    errors.selectedServiceIds = 'Select at least one service package or labor item.';
  }

  if (!input.scooterModel.trim() || input.scooterModel.trim().length < 2) {
    errors.scooterModel = 'Enter your scooter make and model (e.g. Segway Max G2).';
  }

  if (!input.riderName.trim() || input.riderName.trim().length < 2) {
    errors.riderName = 'Enter your full name so Ian knows who to meet.';
  }

  const emailTrimmed = input.contactEmail.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailTrimmed || !emailRegex.test(emailTrimmed)) {
    errors.contactEmail = 'Enter a valid email address for appointment confirmation.';
  }

  const phoneDigits = input.contactPhone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    errors.contactPhone = 'Enter a 10-digit mobile number for arrival updates.';
  }

  if (!input.address.trim() || input.address.trim().length < 5) {
    errors.address = 'Enter a street address or cross-streets for mobile service.';
  }

  if (!input.preferredDay || !OPERATING_DAYS.includes(input.preferredDay)) {
    errors.preferredDay = 'Choose an operating day (Mon, Fri, Sat, or Sun).';
  }

  if (!input.preferredWindow || !TIME_WINDOWS.includes(input.preferredWindow)) {
    errors.preferredWindow = 'Choose an arrival window between 10:00 AM and 5:00 PM.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function deriveCustomersFromBookings(
  bookings: BookingRecord[],
  savedProfiles: CustomerProfileRecord[],
): AggregatedCustomer[] {
  const map = new Map<string, AggregatedCustomer>();

  for (const profile of savedProfiles) {
    const emailKey = profile.email.trim().toLowerCase();
    if (!emailKey) continue;
    map.set(emailKey, {
      key: emailKey,
      profileId: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      scooterModel: profile.scooterModel,
      serialNumber: profile.serialNumber,
      mechanicNotes: profile.mechanicNotes,
      bookingCount: 0,
      lastBookingRef: '—',
      lastBookingStatus: '—',
      hasSavedProfile: true,
    });
  }

  for (const booking of bookings) {
    const emailKey = booking.contactEmail.trim().toLowerCase();
    if (!emailKey) continue;
    const existing = map.get(emailKey);
    if (existing) {
      existing.bookingCount += 1;
      if (existing.lastBookingRef === '—') {
        existing.lastBookingRef = booking.referenceId;
        existing.lastBookingStatus = booking.status;
      }
      if (!existing.scooterModel) existing.scooterModel = booking.scooterModel;
      if (!existing.address) existing.address = booking.address;
      if (!existing.phone) existing.phone = booking.contactPhone;
    } else {
      const safeId = emailKey.replace(/[^a-z0-9]/g, '-').slice(0, 64);
      map.set(emailKey, {
        key: emailKey,
        profileId: `cust-${safeId}`,
        name: booking.riderName,
        email: booking.contactEmail,
        phone: booking.contactPhone,
        address: booking.address,
        scooterModel: booking.scooterModel,
        serialNumber: '',
        mechanicNotes: '',
        bookingCount: 1,
        lastBookingRef: booking.referenceId,
        lastBookingStatus: booking.status,
        hasSavedProfile: false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.bookingCount - a.bookingCount || a.name.localeCompare(b.name));
}

export function generateDispatchReference(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const tail = String(date.getTime()).slice(-4);
  return `RCS-${month}${day}-${tail}`;
}

export function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

export function getSeattleScheduleStatus(now: Date = new Date()): SeattleScheduleStatus {
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const weekdayLongFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
  });

  const parts = timeFormatter.formatToParts(now);
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '10';
  const minuteStr = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const hourNum = Number(hourStr) % 24;

  const weekdayLong = weekdayLongFormatter.format(now);
  const isOperatingDay = (OPERATING_DAYS as readonly string[]).includes(weekdayLong);
  const isOpenNow = isOperatingDay && hourNum >= 10 && hourNum < 17;

  return {
    timeString: `${String(hourNum).padStart(2, '0')}:${minuteStr}`,
    dayLabel: dayFormatter.format(now).toUpperCase(),
    isOpenNow,
    statusLabel: isOpenNow
      ? 'Dispatch Open · 10:00–17:00 PT'
      : 'Next Dispatch · Mon, Fri–Sun 10:00–17:00',
  };
}
