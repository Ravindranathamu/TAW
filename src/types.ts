// ============================================================================
// TAW — shared domain types
// ============================================================================

export type Mode = "demo" | "cloud";
export type Role = "owner" | "driver" | "customer";

/** Shared RAVBsoft licence vocabulary. TAW has no paid module flags. */
export type LicenceStatus = "Trial" | "Active" | "Expired" | "Suspended";
export type LicencePlan = "Lite" | "Starter" | "Growth" | "Pro" | "Enterprise";

export type StaffRole = "PERMANENT_DRIVER" | "TEMP_DRIVER" | "HELPER";
export type TruckStatus = "AVAILABLE" | "ON_TRIP" | "IN_WORKSHOP" | "RETIRED";
export type ComplianceKind = "INSURANCE" | "REVENUE_LICENSE" | "FITNESS" | "EMISSION";
export type TripStatus =
  | "ENQUIRY"
  | "HEADING_TO_PICKUP"
  | "AT_PICKUP"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED"
  | "SUBCONTRACTED";
export type PaymentStatus = "UNPAID" | "PAID_CASH" | "PAID_BANK" | "PENDING_CORPORATE";
export type InvoiceKind = "RECEIPT" | "TAX_INVOICE";
export type PartnerMode = "COMMISSION" | "SUBCONTRACT";
export type PartnerLinkState = "PENDING" | "ACTIVE" | "SUSPENDED";
export type WeightTier = "LIGHT" | "MEDIUM" | "HEAVY";
export type RoadFactor = "NORMAL" | "HIGHWAY" | "URBAN" | "HILLY" | "OFFROAD";

export interface Company {
  id: string;
  name: string;
  registeredName: string;
  address: string;
  phone: string;
  email: string;
  tin: string; // 9-digit IRD TIN
  vatRate: number; // 18
  vatRegistered: boolean;
  partnerCode: string; // TAW-to-TAW network id
  driveRootFolderId: string;
  alertDays: number[]; // e.g. [30, 14, 3]
  currency: "LKR";
  setupComplete: boolean;
  createdAt: string;
  /** Portal-assigned installation ID, shown in Settings → Licence. */
  installationId: string;
  /** Client setup starts the 30-day full-access trial. */
  trialStartedAt: string;
  licenseStatus: LicenceStatus;
  licensePlan: LicencePlan | string;
  licenseExpiresAt?: string;
  licenseActivatedAt?: string;
  licenceActivationAcknowledgedAt?: string;
  licenseKey?: string;
  licenseHolder?: string;
  lastLicenceSyncAt?: string;
  lastLicenceServerTime?: string;
  /** Set when the device clock moves backwards until a fresh portal poll repairs it. */
  licenceClockRollback?: boolean;
}

export interface VehicleCatalogItem {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  bodyType: string;
  lengthMm: number;
  minWeightKg: number;
  maxWeightKg: number;
  custom: boolean;
}

export interface ComplianceDoc {
  id: string;
  kind: ComplianceKind;
  provider?: string;
  number: string;
  expiry: string; // ISO date
  documentUrl?: string;
  note?: string;
}

export interface FinancePlan {
  institution: string;
  monthlyAmount: number;
  dueDay: number; // 1-31
  remainingTerms: number;
  totalTerms: number;
  nextDue: string;
}

export interface TyreRecord {
  id: string;
  position: string; // e.g. "Front Left"
  brand: string;
  serial: string;
  fittedKm: number;
  replaceAtKm: number;
  warrantyUntil: string;
}

export interface BatteryRecord {
  id: string;
  brand: string;
  serial: string;
  fittedOn: string;
  warrantyUntil: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  chassis: string;
  engine: string;
  bodyType: string;
  colour: string;
  maxPayloadKg: number;
  deckLengthMm: number;
  status: TruckStatus;
  odometerKm: number;
  efficiencyKmpl: number;
  compliance: ComplianceDoc[];
  finance?: FinancePlan;
  tyres: TyreRecord[];
  battery?: BatteryRecord;
  note?: string;
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  nic: string;
  phone: string;
  emergencyContact: string;
  address: string;
  licenseNumber: string;
  licenseClasses: string[];
  licenseExpiry: string;
  licenseHeldByPolice: boolean;
  temporaryPermitUntil?: string;
  // payroll
  monthlySalary?: number;
  perTripWage?: number;
  battaPerTrip?: number;
  epfEligible?: boolean;
  active: boolean;
  note?: string;
}

export interface CourtCase {
  id: string;
  staffId?: string;
  vehicleId?: string;
  date: string;
  court: string;
  caseNumber: string;
  description: string;
  fineAmount: number;
  status: "PENDING" | "PAID" | "DISMISSED";
}

export interface ServiceRule {
  id: string;
  label: string;
  intervalKm: number;
  lastDoneKm: number;
  note?: string;
}

export interface PartUsed {
  id: string;
  name: string;
  serial?: string;
  supplier: string;
  warrantyUntil?: string;
  cost: number;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  odometerKm: number;
  category: "ENGINE" | "HYDRAULIC" | "TYRE" | "BATTERY" | "ELECTRICAL" | "OTHER";
  type: "SCHEDULED_SERVICE" | "REPAIR" | "BREAKDOWN" | "HYDRAULIC_SERVICE";
  description: string;
  workshop: string;
  labourCost: number;
  parts: PartUsed[];
  totalCost: number;
  nextDueKm?: number;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  tripId?: string;
  staffId?: string;
  date: string;
  station: string;
  odometerKm: number;
  litres: number;
  cost: number;
  fullTank: boolean;
  receiptUrl?: string;
  efficiencyKmpl?: number;
  anomaly: boolean;
}

export interface MapPoint {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteInfo {
  from: string;
  to: string;
  fromPoint?: MapPoint;
  toPoint?: MapPoint;
  distanceKm: number;
  durationMins: number;
  useHighway: boolean;
  highwayToll: number;
  returnToll: boolean;
}

export interface PriceBreakdown {
  baseFee: number;
  perKmRate: number;
  distanceKm: number;
  weightTier: WeightTier;
  weightFactor: number;
  roadFactor: RoadFactor;
  roadMultiplier: number;
  highwayTolls: number;
  serviceSubtotal: number;
  suggestedTotal: number;
  finalQuote: number;
  discount: number;
}

export interface TripMilestone {
  at: string;
  status: TripStatus;
  note?: string;
  lat?: number;
  lng?: number;
}

export interface Partner {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  truckPlate: string;
  driverPhone: string;
  agreedRate: number;
  commissionPct: number;
  external: boolean;
  tawPartnerId?: string;
  linkState: PartnerLinkState;
}

export interface PartnerJob {
  id: string;
  partnerId: string;
  tripId: string;
  mode: PartnerMode;
  customerPrice: number;
  partnerPayout: number;
  commission: number;
  settled: boolean;
  createdAt: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  vatApplicable: boolean;
}

export interface Invoice {
  id: string;
  tripId: string;
  kind: InvoiceKind;
  serial: string; // YYMMM_QQQQ_XXXXX
  date: string;
  supplyDate: string;
  placeOfSupply: string;
  customerName: string;
  customerTin: string;
  customerAddress: string;
  customerPhone: string;
  lines: InvoiceLine[];
  subtotal: number;
  vatAmount: number;
  total: number;
  paymentStatus: PaymentStatus;
  copyType: "ORIGINAL" | "DUPLICATE";
  driveFolderUrl?: string;
}

export interface PayrollEntry {
  id: string;
  staffId: string;
  month: string; // YYYY-MM
  base: number;
  batta: number;
  deductions: number;
  net: number;
  paid: boolean;
  paidAt?: string;
}

export interface GpsPoint {
  tripId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  updatedAt: string;
  status: TripStatus;
}

export interface Trip {
  id: string;
  code: string;
  enquiryOnly: boolean;
  status: TripStatus;
  customerName: string;
  customerPhone: string;
  customerVehicle: {
    catalogId?: string;
    make: string;
    model: string;
    year: string;
    plate: string;
    lengthMm: number;
    weightKg: number;
    bodyType: string;
  };
  route: RouteInfo;
  vehicleId?: string;
  supportVehicleId?: string;
  staffId?: string;
  supportStaffId?: string;
  helperIds: string[];
  startKm?: number;
  endKm?: number;
  price: PriceBreakdown;
  paymentStatus: PaymentStatus;
  partnerJobId?: string;
  milestones: TripMilestone[];
  gps?: GpsPoint;
  trackingToken: string;
  photosFolderUrl?: string;
  note?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  vehicleId?: string;
  amount: number;
  note: string;
}

export interface NotificationItem {
  id: string;
  kind: "COMPLIANCE" | "FINANCE" | "SERVICE" | "LICENSE" | "COURT" | "WARRANTY" | "SYSTEM";
  severity: "OK" | "SOON" | "URGENT";
  title: string;
  detail: string;
  dueDate: string;
  daysLeft: number;
  linkTo?: string;
  read: boolean;
}

export interface TawState {
  company: Company;
  catalog: VehicleCatalogItem[];
  vehicles: Vehicle[];
  staff: Staff[];
  courtCases: CourtCase[];
  serviceRules: ServiceRule[];
  maintenance: MaintenanceRecord[];
  fuelLogs: FuelLog[];
  trips: Trip[];
  partners: Partner[];
  partnerJobs: PartnerJob[];
  invoices: Invoice[];
  payroll: PayrollEntry[];
  expenses: Expense[];
  notifications: NotificationItem[];
}

export interface Toast {
  tone: "ok" | "error" | "info";
  text: string;
}
