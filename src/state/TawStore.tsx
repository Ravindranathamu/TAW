import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type {
  Company,
  ComplianceDoc,
  CourtCase,
  Expense,
  FuelLog,
  GpsPoint,
  Invoice,
  InvoiceKind,
  MaintenanceRecord,
  Partner,
  PartnerJob,
  PayrollEntry,
  ServiceRule,
  Staff,
  TawState,
  Toast,
  Trip,
  Vehicle,
  VehicleCatalogItem,
} from "../types";
import { seedState } from "../lib/seed";
import {
  demoUnlockedKey,
  loadState,
  makeNotifications,
  money,
  saveState,
  seedStateKey,
  uid,
} from "../lib/utils";
import { calculateEfficiency } from "../lib/efficiency";
import { buildInvoice } from "../lib/invoice";
import {
  checkPortalLicence,
  getCloudConfig,
  pullCloud,
  pushCloud,
  signOut as cloudSignOut,
  type PortalLicence,
} from "../lib/cloud";
import {
  checkClockRollback,
  licenceInfo,
  markClockRepaired,
  normaliseLicenceStatus,
  offlineGraceDaysLeft,
  TAW_LICENSE_KEY_STORAGE,
  withinOfflineGrace,
  type LicenceInfo,
} from "../lib/licence";

type Mutator = (draft: TawState) => void;
type SessionRole = "owner" | "driver";
const DEMO_STATE_KEY = seedStateKey("owner");
const DEMO_ROLE_KEY = "taw_demo_role";

interface TawContextValue {
  mode: "demo" | "cloud" | null;
  role: SessionRole;
  state: TawState;
  toast: Toast | null;
  loading: boolean;
  licence: LicenceInfo;
  notify: (toast: Toast) => void;
  clearToast: () => void;
  enterDemo: (role?: SessionRole) => void;
  enterCloud: (session: Session, role?: SessionRole) => Promise<void>;
  leave: () => Promise<void>;
  refresh: () => Promise<void>;
  mutate: (fn: Mutator, toast?: Toast) => void;
  updateCompany: (patch: Partial<Company>) => void;
  addCatalogItem: (item: Omit<VehicleCatalogItem, "id" | "custom">) => void;
  saveVehicle: (vehicle: Vehicle) => void;
  deleteVehicle: (id: string) => void;
  addCompliance: (vehicleId: string, doc: ComplianceDoc) => void;
  deleteCompliance: (vehicleId: string, docId: string) => void;
  saveStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;
  saveCourtCase: (item: CourtCase) => void;
  saveServiceRule: (item: ServiceRule) => void;
  saveMaintenance: (item: MaintenanceRecord) => void;
  addFuelLog: (item: FuelLog) => void;
  saveTrip: (trip: Trip) => void;
  addTrip: (trip: Trip) => void;
  updateGps: (point: GpsPoint) => void;
  savePartner: (partner: Partner) => void;
  savePartnerJob: (job: PartnerJob) => void;
  handoffToPartners: (trip: Trip) => Trip | null;
  issueInvoice: (tripId: string, kind: InvoiceKind, customerTin?: string, sequence?: number) => Invoice | null;
  saveInvoice: (invoice: Invoice) => void;
  savePayroll: (entry: PayrollEntry) => void;
  addExpense: (item: Expense) => void;
  markNotificationsRead: () => void;
  verifyLicence: (identifier?: string) => Promise<{ ok: boolean; message: string }>;
  syncLicence: () => Promise<{ ok: boolean; message: string }>;
  acknowledgeActivation: () => void;
}

const TawContext = createContext<TawContextValue | null>(null);
const clone = <T,>(value: T): T => structuredClone(value);

function storedRole(): SessionRole {
  try {
    return sessionStorage.getItem(DEMO_ROLE_KEY) === "driver" ? "driver" : "owner";
  } catch {
    return "owner";
  }
}

export function TawProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"demo" | "cloud" | null>(() => {
    try {
      if (sessionStorage.getItem(demoUnlockedKey)) return "demo";
    } catch {
      /* ignore */
    }
    return null;
  });
  const [role, setRole] = useState<SessionRole>(storedRole);
  const [state, setState] = useState<TawState>(() => loadState<TawState>(DEMO_STATE_KEY) ?? seedState());
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(false);

  const notify = useCallback((value: Toast) => setToast(value), []);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (mode !== "demo") return;
    saveState(DEMO_STATE_KEY, state);
  }, [state, mode]);

  const mutate = useCallback((fn: Mutator, message?: Toast) => {
    setState((current) => {
      const draft = clone(current);
      fn(draft);
      // The system computes km/L from runs + fuel logs; owners never enter it.
      for (const vehicle of draft.vehicles) {
        vehicle.efficiencyKmpl = calculateEfficiency(vehicle.id, draft.fuelLogs, draft.trips).kmpl;
      }
      draft.notifications = makeNotifications(draft);
      return draft;
    });
    if (message) setToast(message);
  }, []);

  const applyPortalLicence = useCallback((result: PortalLicence): boolean => {
    const status = normaliseLicenceStatus(result.status);
    if (!status || result.product?.toUpperCase() !== "TAW") return false;
    setState((current) => {
      const company = { ...current.company };
      const now = new Date().toISOString();
      const becameActive =
        status === "Active" && company.licenseStatus !== "Active";

      company.licenseStatus = status;
      if (result.plan) company.licensePlan = result.plan;
      if (result.expiresAt) company.licenseExpiresAt = result.expiresAt;
      if (result.installationId) {
        company.installationId = result.installationId.trim().toUpperCase();
      }
      if (result.holder) company.licenseHolder = result.holder;
      if (status === "Active") {
        if (becameActive) {
          company.licenseActivatedAt = now;
          company.licenceActivationAcknowledgedAt = undefined;
        }
        company.licenseKey =
          localStorage.getItem(TAW_LICENSE_KEY_STORAGE) || company.licenseKey;
      }
      company.lastLicenceSyncAt = now;
      company.lastLicenceServerTime = result.serverTime || now;
      company.licenceClockRollback = false;
      return { ...current, company };
    });
    return true;
  }, []);

  const resolveIdentifier = useCallback(
    (company: Company, explicit?: string) =>
      (explicit?.trim() ||
        company.installationId?.trim() ||
        localStorage.getItem(TAW_LICENSE_KEY_STORAGE) ||
        "").trim().toUpperCase(),
    [],
  );

  const syncLicenceFor = useCallback(
    async (
      company: Company,
      explicit?: string,
    ): Promise<{ ok: boolean; message: string }> => {
      const identifier = resolveIdentifier(company, explicit);
      if (!identifier) {
        return {
          ok: false,
          message: "Add the installation ID from your RAVBsoft handover in Settings → Licence.",
        };
      }
      if (checkClockRollback()) {
        mutate((draft) => {
          draft.company.licenceClockRollback = true;
        });
        return {
          ok: false,
          message:
            "The device clock moved backwards. Connect to the licence server to verify this installation.",
        };
      }
      const config = getCloudConfig();
      if (!config.licenseUrl && !config.url) {
        return { ok: false, message: "Licence server is not configured on this device." };
      }
      try {
        const result = await checkPortalLicence(identifier);
        const applied = applyPortalLicence(result);
        if (!applied) {
          return { ok: false, message: result.message || "Licence check failed." };
        }
        markClockRepaired(result.serverTime);
        return {
          ok: result.valid,
          message: result.message || `Licence is ${result.status.toLowerCase()}.`,
        };
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Could not reach the licence server.";
        const grace = offlineGraceDaysLeft(company.lastLicenceSyncAt);
        return {
          ok: false,
          message: withinOfflineGrace(company.lastLicenceSyncAt)
            ? `${error} Offline — using the cached licence (${grace} day${grace === 1 ? "" : "s"} of grace left).`
            : `${error} The offline grace period has ended; reconnect to verify the licence.`,
        };
      }
    },
    [applyPortalLicence, mutate, resolveIdentifier],
  );

  const syncLicence = useCallback(
    () => syncLicenceFor(state.company),
    [state.company, syncLicenceFor],
  );

  // Outbound-only polling. Login performs the first check; this keeps an open
  // installation current without ever opening an inbound licence endpoint.
  const syncLicenceRef = useRef(syncLicence);
  syncLicenceRef.current = syncLicence;
  useEffect(() => {
    if (mode !== "cloud") return;
    const run = () => {
      const config = getCloudConfig();
      if (config.licenseUrl || config.url) void syncLicenceRef.current();
    };
    const timer = window.setInterval(run, 6 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const verifyLicence = useCallback(
    async (identifier?: string) => {
      const clean = resolveIdentifier(state.company, identifier);
      if (clean) {
        try {
          localStorage.setItem(TAW_LICENSE_KEY_STORAGE, clean);
        } catch {
          /* storage unavailable */
        }
      }
      return syncLicenceFor(state.company, clean);
    },
    [resolveIdentifier, state.company, syncLicenceFor],
  );

  const acknowledgeActivation = useCallback(() => {
    mutate((draft) => {
      draft.company.licenceActivationAcknowledgedAt = draft.company.licenseActivatedAt;
    });
  }, [mutate]);

  const enterDemo = useCallback((nextRole: SessionRole = "owner") => {
    sessionStorage.setItem(demoUnlockedKey, "1");
    sessionStorage.setItem(DEMO_ROLE_KEY, nextRole);
    setState(loadState<TawState>(DEMO_STATE_KEY) ?? seedState());
    setRole(nextRole);
    setMode("demo");
  }, []);

  const enterCloud = useCallback(
    async (_session: Session, nextRole: SessionRole = "owner") => {
      setLoading(true);
      try {
        const data = await pullCloud();
        setState(data);
        setRole(nextRole);
        setMode("cloud");
        if (resolveIdentifier(data.company)) {
          const result = await syncLicenceFor(data.company);
          if (!result.ok) {
            notify({ tone: "info", text: result.message });
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [notify, resolveIdentifier, syncLicenceFor],
  );

  const leave = useCallback(async () => {
    if (mode === "cloud") await cloudSignOut();
    sessionStorage.removeItem(demoUnlockedKey);
    sessionStorage.removeItem(DEMO_ROLE_KEY);
    setMode(null);
    setRole("owner");
  }, [mode]);

  const refresh = useCallback(async () => {
    if (mode !== "cloud") return;
    setLoading(true);
    try {
      setState(await pullCloud());
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const persist = useCallback(() => {
    if (mode === "cloud") void pushCloud(state).catch((error) => notify({ tone: "error", text: String(error) }));
  }, [mode, state, notify]);

  useEffect(() => {
    if (mode !== "cloud") return;
    const timer = window.setTimeout(persist, 700);
    return () => window.clearTimeout(timer);
  }, [state, mode, persist]);

  const value = useMemo<TawContextValue>(
    () => ({
      mode,
      role,
      state,
      toast,
      loading,
      licence: licenceInfo(state.company),
      notify,
      clearToast,
      enterDemo,
      enterCloud,
      leave,
      refresh,
      mutate,
      updateCompany: (patch) => mutate((d) => Object.assign(d.company, patch), { tone: "ok", text: "Company profile saved." }),
      addCatalogItem: (item) =>
        mutate((d) => d.catalog.push({ ...item, id: uid(), custom: true }), { tone: "ok", text: "Vehicle added to the directory." }),
      saveVehicle: (vehicle) =>
        mutate((d) => {
          const index = d.vehicles.findIndex((v) => v.id === vehicle.id);
          if (index >= 0) d.vehicles[index] = vehicle;
          else d.vehicles.unshift(vehicle);
        }, { tone: "ok", text: `${vehicle.plate} saved.` }),
      deleteVehicle: (id) => mutate((d) => { d.vehicles = d.vehicles.filter((v) => v.id !== id); }, { tone: "info", text: "Vehicle removed." }),
      addCompliance: (vehicleId, doc) =>
        mutate((d) => {
          const v = d.vehicles.find((item) => item.id === vehicleId);
          v?.compliance.push(doc);
        }, { tone: "ok", text: "Compliance document added." }),
      deleteCompliance: (vehicleId, docId) =>
        mutate((d) => {
          const v = d.vehicles.find((item) => item.id === vehicleId);
          if (v) v.compliance = v.compliance.filter((doc) => doc.id !== docId);
        }),
      saveStaff: (member) =>
        mutate((d) => {
          const index = d.staff.findIndex((s) => s.id === member.id);
          if (index >= 0) d.staff[index] = member;
          else d.staff.unshift(member);
        }, { tone: "ok", text: `${member.name} saved.` }),
      deleteStaff: (id) => mutate((d) => { d.staff = d.staff.filter((s) => s.id !== id); }, { tone: "info", text: "Staff member removed." }),
      saveCourtCase: (item) =>
        mutate((d) => {
          const index = d.courtCases.findIndex((c) => c.id === item.id);
          if (index >= 0) d.courtCases[index] = item;
          else d.courtCases.unshift(item);
        }, { tone: "ok", text: "Court case saved." }),
      saveServiceRule: (item) =>
        mutate((d) => {
          const index = d.serviceRules.findIndex((s) => s.id === item.id);
          if (index >= 0) d.serviceRules[index] = item;
          else d.serviceRules.push(item);
        }, { tone: "ok", text: "Service interval saved." }),
      saveMaintenance: (item) =>
        mutate((d) => {
          const index = d.maintenance.findIndex((m) => m.id === item.id);
          if (index >= 0) d.maintenance[index] = item;
          else d.maintenance.unshift(item);
          const v = d.vehicles.find((vehicle) => vehicle.id === item.vehicleId);
          if (v) v.odometerKm = Math.max(v.odometerKm, item.odometerKm);
        }, { tone: "ok", text: "Maintenance record saved." }),
      addFuelLog: (item) =>
        mutate((d) => {
          d.fuelLogs.unshift(item);
          const v = d.vehicles.find((vehicle) => vehicle.id === item.vehicleId);
          if (v) v.odometerKm = Math.max(v.odometerKm, item.odometerKm);
        }, { tone: "ok", text: item.anomaly ? "Fuel log saved — consumption anomaly flagged." : "Fuel log saved." }),
      saveTrip: (trip) => mutate((d) => {
        const index = d.trips.findIndex((t) => t.id === trip.id);
        if (index >= 0) d.trips[index] = trip;
      }),
      addTrip: (trip) => mutate((d) => { d.trips.unshift(trip); }, { tone: "ok", text: `${trip.code} created.` }),
      updateGps: (point) => mutate((d) => {
        const trip = d.trips.find((t) => t.id === point.tripId);
        if (!trip) return;
        trip.gps = point;
        const last = [...trip.milestones].reverse().find((m) => m.lat !== undefined);
        const recent = last && Date.now() - new Date(last.at).getTime() < 5 * 60_000;
        if (last && last.status === point.status && recent && last.lat === point.lat && last.lng === point.lng) return;
        if (!recent) {
          trip.milestones.push({ at: point.updatedAt, status: point.status, lat: point.lat, lng: point.lng });
        }
      }),
      savePartner: (partner) => mutate((d) => {
        const index = d.partners.findIndex((p) => p.id === partner.id);
        if (index >= 0) d.partners[index] = partner;
        else d.partners.unshift(partner);
      }, { tone: "ok", text: "Partner saved." }),
      savePartnerJob: (job) => mutate((d) => {
        const index = d.partnerJobs.findIndex((j) => j.id === job.id);
        if (index >= 0) d.partnerJobs[index] = job;
        else d.partnerJobs.unshift(job);
      }, { tone: "ok", text: "Partner settlement saved." }),
      /**
       * No eligible in-house carrier: hand the job to an active TAW partner.
       * The commission is retained by this company and the trip stays visible
       * in history as SUBCONTRACTED for customer tracking and settlement.
       */
      handoffToPartners: (incoming) => {
        const partners = state.partners
          .filter((p) => !p.external && p.linkState === "ACTIVE")
          .sort((a, b) => a.commissionPct - b.commissionPct || a.agreedRate - b.agreedRate);
        const partner = partners[0];
        if (!partner) return null;
        const customerPrice = incoming.price.finalQuote;
        const partnerPayout = Math.min(customerPrice, partner.agreedRate || Math.round(customerPrice * 0.85));
        const commission = Math.max(0, customerPrice - partnerPayout);
        const jobId = uid();
        const job: PartnerJob = {
          id: jobId,
          partnerId: partner.id,
          tripId: incoming.id,
          mode: "SUBCONTRACT",
          customerPrice,
          partnerPayout,
          commission,
          settled: false,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        const trip: Trip = {
          ...incoming,
          status: "SUBCONTRACTED",
          enquiryOnly: false,
          partnerJobId: jobId,
          note: `Handed to TAW partner ${partner.companyName}${partner.tawPartnerId ? ` (${partner.tawPartnerId})` : ""}`,
          milestones: [
            ...incoming.milestones,
            { at: new Date().toISOString(), status: "SUBCONTRACTED", note: `Order passed to ${partner.companyName} · ${money(commission)} commission retained` },
          ],
        };
        mutate((d) => {
          d.partnerJobs.unshift(job);
          const index = d.trips.findIndex((t) => t.id === trip.id);
          if (index >= 0) d.trips[index] = trip;
          else d.trips.unshift(trip);
        }, { tone: "ok", text: `Passed to ${partner.companyName}. ${money(commission)} commission retained.` });
        return trip;
      },
      issueInvoice: (tripId, kind, customerTin, sequence = 1) => {
        const trip = state.trips.find((t) => t.id === tripId);
        if (!trip) return null;
        const invoice = buildInvoice(state.company, trip, { sequence, kind, customerTin });
        mutate((d) => { d.invoices.unshift(invoice); }, { tone: "ok", text: `${invoice.serial} issued.` });
        return invoice;
      },
      saveInvoice: (invoice) => mutate((d) => {
        const index = d.invoices.findIndex((i) => i.id === invoice.id);
        if (index >= 0) d.invoices[index] = invoice;
      }, { tone: "ok", text: "Invoice updated." }),
      savePayroll: (entry) => mutate((d) => {
        const index = d.payroll.findIndex((p) => p.id === entry.id);
        if (index >= 0) d.payroll[index] = entry;
        else d.payroll.unshift(entry);
      }, { tone: "ok", text: "Payroll entry saved." }),
      addExpense: (item) => mutate((d) => { d.expenses.unshift(item); }, { tone: "ok", text: "Expense recorded." }),
      markNotificationsRead: () => mutate((d) => { d.notifications = d.notifications.map((n) => ({ ...n, read: true })); }),
      verifyLicence,
      syncLicence,
      acknowledgeActivation,
    }),
    [mode, role, state, toast, loading, notify, clearToast, enterDemo, enterCloud, leave, refresh, mutate, verifyLicence, syncLicence, acknowledgeActivation],
  );

  return <TawContext.Provider value={value}>{children}</TawContext.Provider>;
}

export function useTaw() {
  const ctx = useContext(TawContext);
  if (!ctx) throw new Error("useTaw must be used inside TawProvider");
  return ctx;
}
