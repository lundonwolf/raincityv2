export type ServiceCategory = 'all' | 'packages' | 'standup' | 'electrical' | 'mobility';

export type RepairMode = 'mobile' | 'pickup';

export type PricingType = 'fixed' | 'from' | 'hourly';

export interface ScooterService {
  id: string;
  index: string;
  title: string;
  shortLabel: string;
  category: Exclude<ServiceCategory, 'all'>;
  categoryLabel: string;
  pricingType: PricingType;
  price: number;
  durationMinutes: number;
  mode: RepairMode;
  summary: string;
  includes: string[];
  featuredTone: 'light' | 'dark';
  active: boolean;
  sortOrder: number;
}

export interface SiteSettings {
  businessName: string;
  tagline: string;
  phoneDisplay: string;
  email: string;
  hoursShort: string;
  hourlyRate: number;
  dispatchPolicyNote: string;
  warrantyDays: number;
  announcement: string;
  googlePlaceId: string;
  // Home page copy
  heroEyebrow: string;
  heroHeadline: string;
  heroSubcopy: string;
  studioKicker: string;
  studioHeadline: string;
  // Pricing page copy & lists
  pricingEyebrow: string;
  pricingHeadline: string;
  pricingIntro: string;
  standupHourlyItems: string[];
  mobilityHourlyItems: string[];
  estimateRules: string[];
  // Reviews & brands page copy
  reviewsHeadline: string;
  reviewsIntro: string;
  supportedBrands: string[];
  // Booking page copy
  bookingHeadline: string;
  bookingIntro: string;
  // Policy pages copy
  policyEffectiveDate: string;
  warrantyHighlightNote: string;
  termsScopeNote: string;
  privacyIntroNote: string;
  // Footer
  footerNote: string;
}

export type BookingStatus =
  | 'new'
  | 'confirmed'
  | 'in_progress'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

export interface BookingRecord {
  id: string;
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
  adminNotes: string;
  status: BookingStatus;
  customerUid?: string;
  confirmationSentAt?: string;
  confirmationMessageId?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface UserAccountRecord {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  defaultAddress: string;
  defaultScooterModel: string;
  updatedAtIso: string;
}

export type BookingMessageType = 'chat' | 'status_update' | 'confirmation_email';

export interface BookingMessageRecord {
  id: string;
  bookingId: string;
  bookingOwnerEmail: string;
  bookingOwnerUid: string;
  senderUid: string;
  senderRole: 'customer' | 'admin';
  senderName: string;
  messageType: BookingMessageType;
  body: string;
  createdAtIso: string;
}

export interface CustomerProfileRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  scooterModel: string;
  serialNumber: string;
  mechanicNotes: string;
  updatedAtIso: string;
}

export const OPERATING_DAYS = ['Monday', 'Friday', 'Saturday', 'Sunday'] as const;
export type OperatingDay = (typeof OPERATING_DAYS)[number];

export const TIME_WINDOWS = [
  '10:00 AM – 12:00 PM',
  '12:00 PM – 2:30 PM',
  '2:30 PM – 5:00 PM',
] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const STANDUP_HOURLY_ITEMS = [
  'Other diagnostic and inspection work',
  'Tire and tube replacement',
  'Solid tire installation',
  'Brake adjustment, pads, cables, and rotors',
  'Hydraulic bleeding, where supported',
  'Compatible throttle, display, and charging-port replacement',
  'Compatible controller, battery-pack, and motor-wheel replacement',
  'Steering, folding mechanism, wiring, bearing, and suspension repairs',
];

export const MOBILITY_HOURLY_ITEMS = [
  'Inspections and function tests',
  'Battery and charging-system testing',
  'Battery replacement',
  'Control, wiring, motor, and brake work',
];

export const ESTIMATE_RULES = [
  'Basic inspection is $30 and electrical diagnosis is $45 for up to 40 minutes. Other labor is $45/hour.',
  'There are no dispatch or travel fees.',
  'Electrical diagnosis ($45) is credited when a repair quote includes the same troubleshooting work.',
  'Package prices cover listed labor; parts (including brake pads) and applicable tax are additional.',
  'No duplicate labor is charged for work already included in a package.',
  'Complex access, seized hardware, and unusual assemblies may increase repair time; scope changes are discussed first.',
  'Complete battery-pack replacement is offered; internal battery rebuilding is outside this menu.',
];

export const SUPPORTED_BRANDS = [
  'Segway Ninebot',
  'Apollo',
  'NIU',
  'Dualtron',
  'Kaabo',
  'VSETT',
  'Xiaomi',
  'Hiboy',
  'FluidFreeride',
  'Gotrax',
  'Inokim',
  'NAMI',
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  businessName: 'Rain City Scooter',
  tagline: 'Independent mobile electric scooter repair.',
  phoneDisplay: '(425) 476-6177',
  email: 'info@raincityscooter.com',
  hoursShort: 'Mon, Fri–Sun · 10:00 AM – 5:00 PM',
  hourlyRate: 45,
  dispatchPolicyNote: 'No dispatch or travel fees.',
  warrantyDays: 30,
  announcement: '',
  googlePlaceId: '',
  heroEyebrow: 'Mobile Electric Scooter Repair',
  heroHeadline: 'Mobile scooter repair, engineered like an instrument.',
  heroSubcopy:
    'Independent mobile electric scooter repair. Basic inspection is $30, tune-ups start at $65, and general labor is $45/hour—with zero travel or dispatch fees.',
  studioKicker: 'ONE LOCAL MECHANIC',
  studioHeadline: 'Built for Seattle rain, hills, and daily electric commuting.',
  pricingEyebrow: 'Straightforward Labor Menu · Zero Travel Charges',
  pricingHeadline: 'Know the labor. Agree the scope.',
  pricingIntro:
    'Basic inspection is $30 and electrical diagnosis is $45 for up to 40 minutes. Other labor is $45/hour. Parts and applicable tax are extra; no dispatch or travel fees.',
  standupHourlyItems: STANDUP_HOURLY_ITEMS,
  mobilityHourlyItems: MOBILITY_HOURLY_ITEMS,
  estimateRules: ESTIMATE_RULES,
  reviewsHeadline: 'Real feedback from verified Google reviewers.',
  reviewsIntro:
    'Every rating and review below is fetched live from Google Maps—no fabricated quotes, no edited excerpts, and transparent pricing backed by our workmanship warranty.',
  supportedBrands: SUPPORTED_BRANDS,
  bookingHeadline: 'Schedule your mobile repair visit.',
  bookingIntro:
    'No upfront payment required. We confirm component compatibility, repair scope, and arrival timing before dispatching.',
  policyEffectiveDate: 'September 24, 2026',
  warrantyHighlightNote:
    'Unless otherwise stated on your invoice, repair labor performed by Rain City Scooter carries a 30-day workmanship warranty beginning on the date the repair is completed. When a covered workmanship issue is confirmed, our first remedy is to correct or repeat the affected labor at no additional charge.',
  termsScopeNote:
    'Rain City Scooter is an independent mobile repair practice. We visit your location for on-site repairs and offer pickup by arrangement for complex bench work. We may decline, pause, or reschedule work whenever site safety, weather, electrical hazards, swollen or damaged lithium batteries, or unsafe equipment make mobile work unsafe.',
  privacyIntroNote:
    'Rain City Scooter collects only information reasonably required to schedule mobile visits, perform safe repairs, maintain warranty records, and communicate with you:',
  footerNote: '',
};

/**
 * Official pricing catalog matching https://raincityscooter.com/pricing/
 * Labor only; parts and applicable tax are additional. Zero dispatch or travel fees.
 */
export const SCOOTER_SERVICES: ScooterService[] = [
  {
    id: 'basic-inspection',
    index: '01',
    title: 'Basic Inspection',
    shortLabel: 'Basic Inspection',
    category: 'packages',
    categoryLabel: 'Service Package',
    pricingType: 'fixed',
    price: 30,
    durationMinutes: 30,
    mode: 'mobile',
    summary:
      'Hands-on mechanical and safety check with clear findings and repair recommendations before you commit to parts or labor.',
    includes: [
      'Tires, brakes, steering, and folding mechanism check',
      'Visible wiring and fastener inspection',
      'Written repair recommendations and upfront estimate',
    ],
    featuredTone: 'light',
    active: true,
    sortOrder: 1,
  },
  {
    id: 'silver-tune-up',
    index: '02',
    title: 'Silver Essential Tune-Up',
    shortLabel: 'Silver Tune-Up',
    category: 'packages',
    categoryLabel: 'Service Package',
    pricingType: 'fixed',
    price: 65,
    durationMinutes: 45,
    mode: 'mobile',
    summary:
      'Essential seasonal maintenance to tighten stem play, dial in mechanical brakes, and keep daily commuters safe in wet weather.',
    includes: [
      'Full inspection and tire pressure adjustment',
      'Mechanical brake adjustment and accessible fastener torque checks',
      'Serviceable steering and folding adjustments plus function test',
    ],
    featuredTone: 'dark',
    active: true,
    sortOrder: 2,
  },
  {
    id: 'gold-commuter',
    index: '03',
    title: 'Gold Commuter Service',
    shortLabel: 'Gold Commuter',
    category: 'packages',
    categoryLabel: 'Service Package',
    pricingType: 'fixed',
    price: 110,
    durationMinutes: 75,
    mode: 'mobile',
    summary:
      'Deep commuter service adding exterior cleaning, electrical connector checks, disc rotor alignment, and pad swap labor.',
    includes: [
      'Includes complete Silver Essential tune-up work',
      'Exterior cleaning and accessible electrical connector inspection',
      'Rotor alignment and pad replacement labor for up to two brakes',
    ],
    featuredTone: 'light',
    active: true,
    sortOrder: 3,
  },
  {
    id: 'comprehensive-service',
    index: '04',
    title: 'Comprehensive Service',
    shortLabel: 'Comprehensive Service',
    category: 'packages',
    categoryLabel: 'Service Package',
    pricingType: 'from',
    price: 175,
    durationMinutes: 120,
    mode: 'pickup',
    summary:
      'Full overhaul for high-mileage scooters covering serviceable bearings, folding assemblies, and suspension. Scope confirmed before booking.',
    includes: [
      'Includes complete Gold Commuter service work',
      'Agreed work on serviceable bearings and folding mechanism',
      'Suspension service and full scope confirmed prior to work',
    ],
    featuredTone: 'dark',
    active: true,
    sortOrder: 4,
  },
  {
    id: 'electrical-diagnosis',
    index: '05',
    title: 'Electrical Diagnosis',
    shortLabel: 'Electrical Diagnosis',
    category: 'electrical',
    categoryLabel: 'Electrical & Power',
    pricingType: 'fixed',
    price: 45,
    durationMinutes: 40,
    mode: 'mobile',
    summary:
      'Up to 40 minutes investigating no-power, charging, intermittent, or error-code faults. Credited when a repair quote includes the same troubleshooting work.',
    includes: [
      'Up to 40 minutes fault isolation on no-power, charging, or error codes',
      'Connector, throttle, display, and pack voltage checks',
      'Clear findings and approved repair estimate (credited toward same repair)',
    ],
    featuredTone: 'light',
    active: true,
    sortOrder: 5,
  },
  {
    id: 'tire-tube-labor',
    index: '06',
    title: 'Tire, Tube & Solid Tire Labor',
    shortLabel: 'Tire & Tube Labor',
    category: 'standup',
    categoryLabel: 'Stand-Up Labor',
    pricingType: 'hourly',
    price: 45,
    durationMinutes: 45,
    mode: 'mobile',
    summary:
      'Tubed tire and inner-tube swaps, tubeless service, and solid tire installations billed at transparent hourly labor. Parts extra.',
    includes: [
      'Tire and tube replacement ($45/hour labor)',
      'Solid tire installation where compatible ($45/hour labor)',
      'Component compatibility and scope confirmed before work',
    ],
    featuredTone: 'dark',
    active: true,
    sortOrder: 6,
  },
  {
    id: 'brake-hydraulic-labor',
    index: '07',
    title: 'Brake, Rotor & Hydraulic Labor',
    shortLabel: 'Brakes & Hydraulics',
    category: 'standup',
    categoryLabel: 'Stand-Up Labor',
    pricingType: 'hourly',
    price: 45,
    durationMinutes: 45,
    mode: 'mobile',
    summary:
      'Individual brake adjustments, pad swaps, cable replacements, rotor changes, and hydraulic bleeding where supported.',
    includes: [
      'Brake adjustment, pads, cables, and rotors ($45/hour labor)',
      'Hydraulic bleeding where supported ($45/hour labor)',
      'Wet-hill lever feel check and caliper alignment',
    ],
    featuredTone: 'light',
    active: true,
    sortOrder: 7,
  },
  {
    id: 'electronics-hardware-labor',
    index: '08',
    title: 'Controller, Display, Battery & Steering Labor',
    shortLabel: 'Electrical & Chassis',
    category: 'electrical',
    categoryLabel: 'Stand-Up Labor',
    pricingType: 'hourly',
    price: 45,
    durationMinutes: 60,
    mode: 'pickup',
    summary:
      'Compatible throttle, display, charge port, controller, complete battery pack, motor wheel, steering, folding, bearing, and suspension repairs.',
    includes: [
      'Throttle, display, charge-port, controller, and motor-wheel replacement',
      'Complete battery-pack replacement (no internal pack rebuilding)',
      'Steering, folding mechanism, wiring, bearing, and suspension work',
    ],
    featuredTone: 'dark',
    active: true,
    sortOrder: 8,
  },
  {
    id: 'mobility-scooter-labor',
    index: '09',
    title: 'Mobility Scooter Service & Labor',
    shortLabel: 'Mobility Scooter',
    category: 'mobility',
    categoryLabel: 'Mobility Scooters',
    pricingType: 'hourly',
    price: 45,
    durationMinutes: 60,
    mode: 'mobile',
    summary:
      'On-location inspections, battery and charging-system testing, timed capacity checks, battery replacement, and control or brake service.',
    includes: [
      'Inspections, function tests, and battery voltage/load testing ($45/hour)',
      'Complete battery replacement and charging-system troubleshooting',
      'Control, wiring, motor, and brake service at your location',
    ],
    featuredTone: 'light',
    active: true,
    sortOrder: 9,
  },
];

