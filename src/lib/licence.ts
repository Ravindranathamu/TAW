import type { Company, LicenceStatus } from "../types";
import {
  LIFETIME_DAYS_THRESHOLD,
  OFFLINE_GRACE_DAYS,
  TRIAL_DAYS,
} from "./licenceConfig";

export {
  LIFETIME_DAYS_THRESHOLD,
  OFFLINE_GRACE_DAYS,
  TRIAL_DAYS,
} from "./licenceConfig";

const CLOCK_KEY = "taw_licence_monotonic_v1";

/** TAW is all-or-nothing: activation unlocks the whole product. */
export const TAW_LICENSE_FEATURES = [
  "Owner and driver logins",
  "Dispatch and carrier matching",
  "Map-pinned pickup and drop locations",
  "Automatic customer and owner GPS tracking",
  "Partner handover with commission",
  "WAHA WhatsApp messaging",
  "IRD invoices, payroll and P&L",
] as const;

/** Converts portal text into the four client licence states. */
export function normaliseLicenceStatus(value: unknown): LicenceStatus | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "active") return "Active";
  if (text === "trial") return "Trial";
  if (text === "expired") return "Expired";
  if (text === "suspended" || text === "revoked") return "Suspended";
  return null;
}

function parseDate(value?: string): number | null {
  if (!value) return null;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : null;
}

function daysBetween(target: number, now: number): number {
  return Math.max(0, Math.ceil((target - now) / 86_400_000));
}

function readClockHighWater(): number {
  try {
    return Number(localStorage.getItem(CLOCK_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * A backwards system clock must not extend a trial or paid licence. The
 * high-water mark is only repaired by a successful portal poll.
 */
export function checkClockRollback(toleranceMinutes = 10): boolean {
  return readClockHighWater() > Date.now() + toleranceMinutes * 60_000;
}

export function markClockRepaired(serverTime?: string): void {
  try {
    const stamp = serverTime ? new Date(serverTime).getTime() : Date.now();
    const repaired = Number.isFinite(stamp) ? stamp : Date.now();
    localStorage.setItem(
      CLOCK_KEY,
      String(Math.max(readClockHighWater(), repaired, Date.now())),
    );
  } catch {
    /* storage unavailable */
  }
}

/** True while the cached licence may be used without a fresh portal check. */
export function withinOfflineGrace(lastSyncedAt?: string, now = Date.now()): boolean {
  const synced = parseDate(lastSyncedAt);
  if (synced === null) return false;
  return now - synced <= OFFLINE_GRACE_DAYS * 86_400_000;
}

export function offlineGraceDaysLeft(lastSyncedAt?: string, now = Date.now()): number {
  const synced = parseDate(lastSyncedAt);
  if (synced === null) return OFFLINE_GRACE_DAYS;
  return Math.max(0, OFFLINE_GRACE_DAYS - Math.floor((now - synced) / 86_400_000));
}

export type LicenceReason =
  | "suspended"
  | "offline-expired"
  | "clock-rollback"
  | "expired"
  | "trial-ended";

export interface LicenceInfo {
  mode: LicenceStatus;
  status: LicenceStatus;
  plan: string;
  daysLeft: number;
  trialElapsed: number;
  lifetime: boolean;
  expiresAt?: string;
  installationId: string;
  lastSyncedAt?: string;
  clockRollback: boolean;
  offlineGraceExpired: boolean;
  offlineGraceDaysLeft: number;
  reason?: LicenceReason;
}

/**
 * Resolves the effective licence state. Trial is always full access; a stored
 * Active licence is enforced after payment. Missing data on a fresh install is
 * treated as a Trial starting at first setup.
 */
export function licenceInfo(company: Company, now = Date.now()): LicenceInfo {
  const base: LicenceInfo = {
    mode: "Trial",
    status: "Trial",
    plan: company.licensePlan || "Growth",
    daysLeft: 0,
    trialElapsed: 0,
    lifetime: false,
    expiresAt: company.licenseExpiresAt,
    installationId: company.installationId || "",
    lastSyncedAt: company.lastLicenceSyncAt,
    clockRollback: Boolean(company.licenceClockRollback || checkClockRollback()),
    offlineGraceExpired: false,
    offlineGraceDaysLeft: offlineGraceDaysLeft(company.lastLicenceSyncAt, now),
  };

  if (base.clockRollback) {
    return {
      ...base,
      mode: "Expired",
      status: "Suspended",
      daysLeft: 0,
      reason: "clock-rollback",
    };
  }

  const storedStatus = normaliseLicenceStatus(company.licenseStatus) ?? "Trial";
  let expiry = parseDate(company.licenseExpiresAt);

  if (storedStatus === "Trial" && expiry === null) {
    const start = parseDate(company.trialStartedAt || company.createdAt) ?? now;
    expiry = start + TRIAL_DAYS * 86_400_000;
    base.expiresAt = new Date(expiry).toISOString();
  }

  let mode: LicenceStatus = storedStatus;
  let reason: LicenceReason | undefined;
  if (storedStatus === "Suspended") {
    mode = "Suspended";
    reason = "suspended";
  } else if (expiry !== null && expiry < now) {
    mode = "Expired";
    reason = storedStatus === "Trial" ? "trial-ended" : "expired";
  }

  const syncAge = parseDate(company.lastLicenceSyncAt);
  const offlineGraceExpired =
    syncAge !== null &&
    now - syncAge > OFFLINE_GRACE_DAYS * 86_400_000 &&
    storedStatus !== "Trial";
  if (offlineGraceExpired && mode !== "Expired" && mode !== "Suspended") {
    mode = "Expired";
    reason = "offline-expired";
  }

  const lifetime =
    mode === "Active" &&
    expiry !== null &&
    expiry - now > LIFETIME_DAYS_THRESHOLD * 86_400_000;
  const daysLeft =
    mode === "Active" && expiry === null
      ? LIFETIME_DAYS_THRESHOLD
      : expiry === null
        ? 0
        : daysBetween(expiry, now);

  return {
    ...base,
    mode,
    status: storedStatus,
    daysLeft,
    trialElapsed:
      mode === "Trial" ? Math.max(0, TRIAL_DAYS - daysLeft) : TRIAL_DAYS,
    lifetime,
    offlineGraceExpired,
    reason,
  };
}
