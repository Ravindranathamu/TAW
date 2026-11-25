import type {
  Company,
  ComplianceDoc,
  FuelLog,
  Invoice,
  MaintenanceRecord,
  Partner,
  Staff,
  TawState,
  Trip,
  Vehicle,
  VehicleCatalogItem,
} from "../types";
import { isoDays, makeNotifications, uid } from "./utils";
import { buildInvoice } from "./invoice";
import { calculateQuote, estimateRoute } from "./pricing";
import { calculateEfficiency } from "./efficiency";

const catalogRows: Array<[string, string, string, string, number, number, number]> = [
  ["Honda", "Vezel (RU1/RU3)", "2014-2020", "Compact SUV", 4295, 1499, 1608],
  ["Honda", "Fit (GK3/GP5)", "2013-2019", "Hatchback", 3955, 1080, 1190],
  ["Honda", "Grace", "2014-2020", "Hybrid Sedan", 4440, 1170, 1250],
  ["Honda", "Civic (FC/FK)", "2016-2021", "Sedan", 4648, 1280, 1370],
  ["Honda", "CR-V", "2012-2025", "Mid-Size SUV", 4600, 1520, 1730],
  ["Toyota", "Aqua", "2012-2020", "Hybrid Hatchback", 3995, 1050, 1130],
  ["Toyota", "Vitz (KSP130)", "2010-2019", "Hatchback", 3885, 1000, 1100],
  ["Toyota", "Prius (ZVW30)", "2009-2015", "Hybrid Sedan", 4460, 1310, 1380],
  ["Toyota", "Prius (ZVW50)", "2016-2022", "Hybrid Sedan", 4540, 1360, 1460],
  ["Toyota", "Corolla Axio", "2012-2021", "Sedan", 4400, 1090, 1180],
  ["Toyota", "Premio / Allion", "2007-2021", "Sedan", 4595, 1210, 1280],
  ["Toyota", "Camry", "2012-2025", "Executive Sedan", 4885, 1520, 1660],
  ["Toyota", "Raize", "2019-2026", "Compact SUV", 3995, 980, 1070],
  ["Toyota", "Corolla Cross", "2020-2026", "SUV", 4460, 1385, 1565],
  ["Toyota", "RAV4", "2013-2025", "Mid-Size SUV", 4600, 1540, 1740],
  ["Toyota", "Harrier", "2014-2025", "Luxury SUV", 4740, 1620, 1790],
  ["Toyota", "Land Cruiser Prado 150", "2010-2023", "Full-Size 4x4", 4825, 2110, 2430],
  ["Toyota", "Hilux Double Cab", "2015-2026", "Pickup", 5325, 1980, 2180],
  ["Toyota", "HiAce KDH High Roof", "2005-2020", "Van", 4840, 1890, 2210],
  ["Toyota", "Dyna / ToyoAce 14ft", "2005-2022", "Light Lorry", 4690, 2100, 2650],
  ["Suzuki", "Alto 800", "2012-2023", "Mini Hatchback", 3430, 695, 730],
  ["Suzuki", "Wagon R", "2014-2024", "Kei Wagon", 3395, 790, 860],
  ["Suzuki", "Swift", "2011-2025", "Hatchback", 3840, 890, 980],
  ["Suzuki", "Every DA17V", "2015-2025", "Mini Van", 3395, 880, 1010],
  ["Suzuki", "Jimny JB64", "2018-2026", "Mini 4x4", 3480, 1040, 1110],
  ["Nissan", "Leaf ZE1", "2011-2023", "Electric Hatchback", 4480, 1520, 1640],
  ["Nissan", "X-Trail T32", "2014-2021", "Mid-Size SUV", 4640, 1510, 1680],
  ["Nissan", "Navara NP300", "2015-2025", "Double Cab Pickup", 5260, 1920, 2120],
  ["Nissan", "Caravan NV350", "2012-2024", "Van", 4695, 1820, 2120],
  ["Mitsubishi", "Montero / Pajero", "2007-2021", "Full-Size 4x4", 4900, 2150, 2380],
  ["Mitsubishi", "L200 / Triton", "2015-2025", "Double Cab Pickup", 5280, 1890, 2080],
  ["Mitsubishi", "Canter 14ft", "2005-2023", "Light Lorry", 4720, 2150, 2750],
  ["BYD", "Atto 3", "2023-2026", "Electric SUV", 4455, 1680, 1750],
  ["BYD", "Dolphin", "2023-2026", "Electric Hatchback", 4125, 1405, 1658],
  ["BYD", "Seal", "2023-2026", "Electric Sedan", 4800, 1885, 2185],
  ["MG", "ZS EV", "2019-2025", "Compact SUV", 4323, 1258, 1620],
  ["Kia", "Sportage", "2016-2025", "Mid-Size SUV", 4515, 1520, 1740],
  ["Hyundai", "Tucson", "2016-2025", "Mid-Size SUV", 4500, 1480, 1690],
  ["Mazda", "CX-5", "2013-2025", "Mid-Size SUV", 4550, 1510, 1680],
  ["Mercedes-Benz", "C-Class W205", "2015-2025", "Luxury Sedan", 4751, 1505, 1765],
  ["BMW", "3 Series G20", "2013-2025", "Luxury Sedan", 4709, 1495, 1740],
  ["Isuzu", "Elf / NPR 14ft", "2005-2024", "Light Lorry", 4750, 2150, 2750],
  ["Mahindra", "Bolero Maxi Truck", "2012-2024", "Utility Pickup", 4107, 1615, 1750],
];

export const seedCatalog = (): VehicleCatalogItem[] =>
  catalogRows.map(([make, model, yearRange, bodyType, lengthMm, minWeightKg, maxWeightKg]) => ({
    id: `cat_${make}_${model}`.replace(/[^a-z0-9]/gi, "_").toLowerCase(),
    make,
    model,
    yearRange,
    bodyType,
    lengthMm,
    minWeightKg,
    maxWeightKg,
    custom: false,
  }));

export const seedCompany = (): Company => ({
  id: "taw_co_001",
  name: "TAW Vehicle Carrier Services",
  registeredName: "TAW Vehicle Carrier Services (Pvt) Ltd",
  address: "No. 42, Kandy Road, Kadugannawa, Sri Lanka",
  phone: "+94 81 234 5678",
  email: "operations@taw.lk",
  tin: "123456789",
  vatRate: 18,
  vatRegistered: true,
  partnerCode: "TAW-KDY-001",
  driveRootFolderId: "",
  alertDays: [30, 14, 3],
  currency: "LKR",
  setupComplete: true,
  createdAt: isoDays(-420),
  installationId: "",
  trialStartedAt: new Date().toISOString(),
  licenseStatus: "Trial",
  licensePlan: "Growth",
  licenceClockRollback: false,
});

const doc = (kind: ComplianceDoc["kind"], number: string, expiryDays: number, provider = "SLIC"): ComplianceDoc => ({
  id: uid(),
  kind,
  number,
  provider,
  expiry: isoDays(expiryDays),
});

const vehicle = (
  plate: string,
  make: string,
  model: string,
  payload: number,
  deck: number,
  odo: number,
  demoKmpl: number,
  expiries: [number, number, number, number],
  status: Vehicle["status"] = "AVAILABLE",
): Vehicle => ({
  id: `veh_${plate.replace(/[^a-z0-9]/gi, "")}`,
  plate,
  make,
  model,
  year: 2018,
  chassis: `CHS-${plate.replace(/[^0-9]/g, "")}-8891`,
  engine: `ENG-${plate.replace(/[^0-9]/g, "")}-4412`,
  bodyType: "Flatbed Carrier",
  colour: "White",
  maxPayloadKg: payload,
  deckLengthMm: deck,
  status,
  odometerKm: odo,
  efficiencyKmpl: demoKmpl, // seeded input only; recalculated from run + fuel records below
  compliance: [
    doc("INSURANCE", `POL-${plate}-2026`, expiries[0]),
    doc("REVENUE_LICENSE", `RL-${plate}-26`, expiries[1], "Department of Revenue"),
    doc("FITNESS", `FN-${plate}-26`, expiries[2], "Department of Motor Traffic"),
    doc("EMISSION", `EM-${plate}-26`, expiries[3], "CEB Emissions"),
  ],
  finance: {
    institution: "People's Leasing & Finance",
    monthlyAmount: 48000,
    dueDay: 15,
    remainingTerms: 18,
    totalTerms: 60,
    nextDue: isoDays(9),
  },
  tyres: [
    { id: uid(), position: "Front Left", brand: "Yokohama", serial: "YL-8821", fittedKm: odo - 28000, replaceAtKm: odo + 22000, warrantyUntil: isoDays(120) },
    { id: uid(), position: "Front Right", brand: "Yokohama", serial: "YL-8822", fittedKm: odo - 28000, replaceAtKm: odo + 22000, warrantyUntil: isoDays(120) },
  ],
  battery: { id: uid(), brand: "Exide", serial: "EX-9942", fittedOn: isoDays(-400), warrantyUntil: isoDays(20) },
  createdAt: isoDays(-600),
});

const staff = (
  name: string,
  role: Staff["role"],
  expiryDays: number,
  phone: string,
  extra: Partial<Staff> = {},
): Staff => ({
  id: `stf_${name.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
  name,
  role,
  nic: `9${Math.floor(100000000 + Math.random() * 899999999)}V`,
  phone,
  emergencyContact: "+94 77 900 1122",
  address: "Kadugannawa, Kandy",
  licenseNumber: `DL-KDY-${Math.floor(10000 + Math.random() * 89999)}`,
  licenseClasses: role === "HELPER" ? ["B"] : ["CE", "C1E", "B"],
  licenseExpiry: isoDays(expiryDays),
  licenseHeldByPolice: false,
  monthlySalary: role === "PERMANENT_DRIVER" ? 68000 : undefined,
  perTripWage: role === "TEMP_DRIVER" ? 4500 : undefined,
  battaPerTrip: role === "HELPER" ? 1800 : 2500,
  epfEligible: role === "PERMANENT_DRIVER",
  active: true,
  ...extra,
});

const seedVehicles = (): Vehicle[] => [
  vehicle("WP LB 4582", "Mitsubishi", "Fuso Canter Flatbed", 3000, 4400, 128400, 6.4, [190, 260, 48, 21]),
  vehicle("WP LB 6719", "Toyota", "Dyna 14ft Carrier", 2650, 4300, 96300, 7.1, [22, 310, 120, 75]),
  vehicle("WP LB 8834", "Isuzu", "Elf NPR Flatbed", 2750, 4400, 74500, 6.8, [140, 11, 90, 60]),
  vehicle("WP LB 2291", "Hino", "Toyota Hino Recovery", 3200, 5000, 158900, 5.9, [300, 220, 2, 140], "IN_WORKSHOP"),
];

const seedStaff = (): Staff[] => [
  staff("Sunil Perera", "PERMANENT_DRIVER", 410, "+94 77 231 4455"),
  staff("Kasun Fernando", "PERMANENT_DRIVER", 18, "+94 77 812 9900"),
  staff("Nimal Silva", "TEMP_DRIVER", 620, "+94 76 551 2030"),
  staff("Chamila Wickramasinghe", "TEMP_DRIVER", -4, "+94 77 530 9981", {
    licenseHeldByPolice: true,
    temporaryPermitUntil: isoDays(6),
  }),
  staff("Ranjith Bogahawatta", "HELPER", 900, "+94 75 220 6181"),
  staff("Dinesh Kumara", "HELPER", 540, "+94 77 640 3382", { active: false }),
];

function trip(
  id: string,
  customerName: string,
  plate: string,
  make: string,
  model: string,
  lengthMm: number,
  weightKg: number,
  from: string,
  to: string,
  daysAgo: number,
  status: Trip["status"],
  vehicleId?: string,
  staffId?: string,
): Trip {
  const route = estimateRoute(from, to, weightKg > 1500, true);
  const price = calculateQuote({
    distanceKm: route.distanceKm,
    weightKg,
    roadFactor: /kandy|nuwara/i.test(from + to) ? "HILLY" : "NORMAL",
    highwayTolls: route.highwayToll,
  });
  return {
    id,
    code: `TAW-${String(1042 + Number(id.replace(/\D/g, ""))).padStart(5, "0")}`,
    enquiryOnly: false,
    status,
    customerName,
    customerPhone: `+94 77 ${100 + (Number(id.replace(/\D/g, "")) * 37) % 899} ${2200 + Number(id.replace(/\D/g, ""))}`,
    customerVehicle: { make, model, year: "2014", plate, lengthMm, weightKg, bodyType: "SUV" },
    route: { from, to, useHighway: true, returnToll: false, ...route },
    vehicleId,
    staffId,
    helperIds: [],
    startKm: 120000,
    endKm: status === "COMPLETED" ? 120000 + route.distanceKm : undefined,
    price,
    paymentStatus: status === "COMPLETED" ? "PAID_BANK" : "UNPAID",
    milestones: [
      { at: isoDays(daysAgo), status: "HEADING_TO_PICKUP", note: "Driver dispatched" },
      ...(status === "COMPLETED" ? [{ at: isoDays(daysAgo), status: "COMPLETED" as Trip["status"], note: "Vehicle delivered" }] : []),
    ],
    trackingToken: `trk_${id}_x9f2`,
    createdAt: isoDays(daysAgo),
    completedAt: status === "COMPLETED" ? isoDays(daysAgo) : undefined,
  };
}

const seedTrips = (): Trip[] => [
  trip("t1", "Mr. Perera", "WP CAB 1234", "Honda", "Vezel", 4295, 1608, "Kandy", "Colombo", -12, "COMPLETED", "veh_WPLB4582", "stf_sunilperera"),
  trip("t2", "Kandy Motor Traders", "WP CAB 7781", "Toyota", "Hilux Double Cab", 5325, 2180, "Kandy", "Galle", -8, "COMPLETED", "veh_WPLB6719", "stf_kasunfernando"),
  trip("t3", "Mrs. Fernando", "WP CAB 5520", "BYD", "Atto 3", 4455, 1750, "Colombo", "Kandy", -3, "IN_TRANSIT", "veh_WPLB8834", "stf_nimalsilva"),
  trip("t4", "Auto Works Lanka", "WP CAB 9012", "Mitsubishi", "Canter 14ft", 4720, 2750, "Kurunegala", "Colombo", 0, "ENQUIRY"),
];

/**
 * Demo fuel records deliberately mirror completed runs so the system-calculated
 * km/L has real samples. No owner-entered efficiency is used in the UI.
 */
const seedFuel = (vehicles: Vehicle[], trips: Trip[]): FuelLog[] =>
  vehicles.flatMap((v, index) => {
    const baseline = v.efficiencyKmpl || 6.8;
    const runLogs = trips
      .filter((trip) => trip.vehicleId === v.id && trip.status === "COMPLETED")
      .map((trip) => {
        const distance = Math.max(1, (trip.endKm ?? v.odometerKm) - (trip.startKm ?? v.odometerKm - 300));
        const litres = Number((distance / baseline).toFixed(1));
        return {
          id: uid(),
          vehicleId: v.id,
          tripId: trip.id,
          date: (trip.completedAt ?? trip.createdAt).slice(0, 10),
          station: "Shell Kandy Road",
          odometerKm: trip.endKm ?? v.odometerKm,
          litres,
          cost: litres * 182,
          fullTank: true,
          efficiencyKmpl: Number((distance / litres).toFixed(2)),
          anomaly: false,
        } satisfies FuelLog;
      });
    if (runLogs.length > 0) return runLogs;

    const interval = 300;
    return [1, 2].map((n) => {
      const litres = Number((interval / baseline).toFixed(1));
      return {
        id: uid(),
        vehicleId: v.id,
        date: isoDays(-(n * 11 + index * 2)),
        station: n === 1 ? "Shell Kandy Road" : "Caltex Kadugannawa",
        odometerKm: v.odometerKm - n * interval,
        litres,
        cost: litres * 182,
        fullTank: true,
        efficiencyKmpl: Number((interval / litres).toFixed(2)),
        anomaly: index === 3 && n === 2,
      } satisfies FuelLog;
    });
  });

const seedMaintenance = (vehicles: Vehicle[]): MaintenanceRecord[] => [
  {
    id: uid(),
    vehicleId: vehicles[3].id,
    date: isoDays(-5),
    odometerKm: vehicles[3].odometerKm - 120,
    category: "HYDRAULIC",
    type: "BREAKDOWN",
    description: "Hydraulic pump seal failure — winch inoperative on recovery job.",
    workshop: "Kandy Hydraulic Services",
    labourCost: 24000,
    parts: [{ id: uid(), name: "Hydraulic pump seal kit", supplier: "Lanka Auto Spares", warrantyUntil: isoDays(180), cost: 18500 }],
    totalCost: 42500,
  },
  {
    id: uid(),
    vehicleId: vehicles[0].id,
    date: isoDays(-34),
    odometerKm: vehicles[0].odometerKm - 2100,
    category: "ENGINE",
    type: "SCHEDULED_SERVICE",
    description: "10,000 km service — oil, filters and brake inspection.",
    workshop: "TAW Workshop",
    labourCost: 9500,
    parts: [{ id: uid(), name: "Engine oil 15W-40 + filters", supplier: "Auto Parts Centre", cost: 14200 }],
    totalCost: 23700,
    nextDueKm: vehicles[0].odometerKm + 7900,
  },
];

const seedPartners = (): Partner[] => [
  {
    id: "par_001",
    companyName: "Kandy Heavy Recovery",
    contactName: "Mr. Jayawardena",
    phone: "+94 77 330 1122",
    truckPlate: "WP LB 7712",
    driverPhone: "+94 77 330 1199",
    agreedRate: 28000,
    commissionPct: 10,
    external: true,
    linkState: "ACTIVE",
  },
  {
    id: "par_002",
    companyName: "Southern Carrier Services",
    contactName: "Ms. Fernando",
    phone: "+94 91 220 7711",
    truckPlate: "WP LB 3388",
    driverPhone: "+94 91 220 7722",
    agreedRate: 32000,
    commissionPct: 12,
    external: false,
    tawPartnerId: "TAW-GAL-004",
    linkState: "ACTIVE",
  },
];

export function seedState(): TawState {
  const company = seedCompany();
  const catalog = seedCatalog();
  const vehicles = seedVehicles();
  const staff = seedStaff();
  const trips = seedTrips();
  const invoices: Invoice[] = trips
    .filter((t) => t.status === "COMPLETED")
    .map((t, i) => buildInvoice(company, t, { sequence: 41 + i, kind: "TAX_INVOICE" }));

  const state: TawState = {
    company,
    catalog,
    vehicles,
    staff,
    courtCases: [
      {
        id: uid(),
        staffId: staff[1].id,
        vehicleId: vehicles[1].id,
        date: isoDays(6),
        court: "Kandy Magistrate's Court",
        caseNumber: "MC/KDY/2026/1182",
        description: "Overload summons — canter deck",
        fineAmount: 15000,
        status: "PENDING",
      },
    ],
    serviceRules: [
      { id: uid(), label: "Engine oil & filter", intervalKm: 10000, lastDoneKm: 90000, note: "Every 10,000 km" },
      { id: uid(), label: "Hydraulic oil change", intervalKm: 20000, lastDoneKm: 110000, note: "Pump & PTO inspection" },
      { id: uid(), label: "Wheel alignment", intervalKm: 15000, lastDoneKm: 100000 },
    ],
    maintenance: seedMaintenance(vehicles),
    fuelLogs: seedFuel(vehicles, trips),
    trips,
    partners: seedPartners(),
    partnerJobs: [
      {
        id: uid(),
        partnerId: "par_002",
        tripId: "t2",
        mode: "SUBCONTRACT",
        customerPrice: 42000,
        partnerPayout: 32000,
        commission: 0,
        settled: false,
        createdAt: isoDays(-8),
      },
    ],
    invoices,
    payroll: staff
      .filter((s) => s.role === "PERMANENT_DRIVER")
      .map((s) => ({
        id: uid(),
        staffId: s.id,
        month: new Date().toISOString().slice(0, 7),
        base: s.monthlySalary ?? 0,
        batta: 12500,
        deductions: 1500,
        net: (s.monthlySalary ?? 0) + 11000,
        paid: false,
      })),
    expenses: [
      { id: uid(), date: isoDays(-20), category: "Insurance", amount: 148000, note: "Fleet annual insurance", vehicleId: vehicles[0].id },
      { id: uid(), date: isoDays(-12), category: "Office", amount: 24000, note: "Office rent & utilities" },
    ],
    notifications: [],
  };
  // Efficiency is always a system output, never an owner input.
  for (const vehicle of state.vehicles) {
    vehicle.efficiencyKmpl = calculateEfficiency(vehicle.id, state.fuelLogs, state.trips).kmpl;
  }
  state.notifications = makeNotifications(state);
  return state;
}
